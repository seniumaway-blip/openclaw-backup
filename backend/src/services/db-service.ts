import { Pool } from 'pg'
import type { Position, Order, UserAccount, TradingPair, OrderBookEntry } from '../types/shared'

// 数据库连接池
let pool: Pool | null = null

try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://trading:trading123@localhost:5432/trading_db',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  })
} catch (err) {
  console.warn('数据库连接池创建失败:', err)
}

// 工具函数：snake_case to camelCase
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase)
  }
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  const result: any = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = toCamelCase(value)
  }
  return result
}

// 内存存储（数据库不可用时使用）
class MemoryStore {
  users = new Map<string, any>()
  accounts = new Map<string, any>()
  positions = new Map<string, Position[]>()
  orders = new Map<string, Order[]>()
  pairs: TradingPair[] = [
    {
      id: 'AU_SPREAD',
      name: '黄金极差',
      domesticSymbol: 'AU',
      foreignSymbol: 'XAUUSD',
      domesticExchange: 'SHFE',
      foreignExchange: 'LME',
      domesticContractSize: 1000,
      foreignContractSize: 100,
      sizeRatio: 3.11,
      domesticTickSize: 0.02,
      foreignTickSize: 0.01,
      domesticMarginRate: 0.12,
      foreignMarginRate: 0.05,
      isActive: true,
      displayOrder: 1,
    },
  ]
}

const memoryStore = new MemoryStore()

// 数据库服务（支持内存回退）
class DBService {
  private pool: Pool | null
  private useMemory = false

  constructor() {
    this.pool = pool
  }

  // 测试连接
  async testConnection(): Promise<boolean> {
    if (!this.pool) {
      console.log('⚠️ 使用内存模式（无数据库）')
      this.useMemory = true
      return false
    }
    try {
      const client = await this.pool.connect()
      await client.query('SELECT NOW()')
      client.release()
      console.log('✅ PostgreSQL 连接成功')
      return true
    } catch (err) {
      console.warn('⚠️ 数据库连接失败，切换到内存模式')
      this.useMemory = true
      return false
    }
  }

  // ============ 交易对 ============
  async getPairs(): Promise<TradingPair[]> {
    if (this.useMemory) return memoryStore.pairs
    const result = await this.pool!.query('SELECT * FROM trading_pairs WHERE is_active = true ORDER BY display_order')
    return toCamelCase(result.rows) as TradingPair[]
  }

  async getPairById(pairId: string): Promise<TradingPair | null> {
    if (this.useMemory) return memoryStore.pairs.find(p => p.id === pairId) || null
    const result = await this.pool!.query('SELECT * FROM trading_pairs WHERE id = $1', [pairId])
    return result.rows.length > 0 ? toCamelCase(result.rows[0]) as TradingPair : null
  }

  // ============ 用户账户（含认证）============
  async getUser(userId: string): Promise<any | null> {
    if (this.useMemory) return memoryStore.users.get(userId) || null
    const result = await this.pool!.query(
      'SELECT id, username, email, initial_balance, currency, trading_mode, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    )
    return result.rows.length > 0 ? toCamelCase(result.rows[0]) : null
  }

  async getUserByUsername(username: string): Promise<any | null> {
    if (this.useMemory) {
      for (const user of memoryStore.users.values()) {
        if (user.username === username) return user
      }
      return null
    }
    const result = await this.pool!.query(
      'SELECT id, username, email, password_hash, initial_balance, currency, trading_mode, created_at, updated_at FROM users WHERE username = $1',
      [username]
    )
    return result.rows.length > 0 ? { ...toCamelCase(result.rows[0]), passwordHash: result.rows[0].password_hash } : null
  }

  async getUserWithPassword(userId: string): Promise<any | null> {
    if (this.useMemory) {
      const user = memoryStore.users.get(userId)
      return user ? { ...user, passwordHash: user.passwordHash } : null
    }
    const result = await this.pool!.query(
      'SELECT id, username, email, password_hash, initial_balance, currency, trading_mode FROM users WHERE id = $1',
      [userId]
    )
    return result.rows.length > 0 ? { ...toCamelCase(result.rows[0]), passwordHash: result.rows[0].password_hash } : null
  }

  async createUser(userId: string, username: string, email?: string, initialBalance: number = 1000000): Promise<any> {
    if (this.useMemory) {
      const user = {
        id: userId,
        username,
        email,
        initialBalance,
        currency: 'CNY',
        tradingMode: 'VIRTUAL',
        createdAt: new Date().toISOString(),
      }
      memoryStore.users.set(userId, user)
      await this.createVirtualAccount(userId, initialBalance)
      return user
    }
    const result = await this.pool!.query(
      `INSERT INTO users (id, username, email, initial_balance, currency, trading_mode)
       VALUES ($1, $2, $3, $4, 'CNY', 'VIRTUAL')
       RETURNING id, username, email, initial_balance, currency, trading_mode, created_at`,
      [userId, username, email || null, initialBalance]
    )
    await this.createVirtualAccount(userId, initialBalance)
    return toCamelCase(result.rows[0])
  }

  async createUserWithAuth(
    userId: string,
    username: string,
    passwordHash: string,
    email?: string,
    initialBalance: number = 1000000
  ): Promise<any> {
    if (this.useMemory) {
      const user = {
        id: userId,
        username,
        email,
        passwordHash,
        initialBalance,
        currency: 'CNY',
        tradingMode: 'VIRTUAL',
        createdAt: new Date().toISOString(),
      }
      memoryStore.users.set(userId, user)
      await this.createVirtualAccount(userId, initialBalance)
      return user
    }
    const result = await this.pool!.query(
      `INSERT INTO users (id, username, password_hash, email, initial_balance, currency, trading_mode)
       VALUES ($1, $2, $3, $4, $5, 'CNY', 'VIRTUAL')
       RETURNING id, username, email, initial_balance, currency, trading_mode, created_at`,
      [userId, username, passwordHash, email || null, initialBalance]
    )
    await this.createVirtualAccount(userId, initialBalance)
    return toCamelCase(result.rows[0])
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    if (this.useMemory) {
      const user = memoryStore.users.get(userId)
      if (user) user.passwordHash = passwordHash
      return
    }
    await this.pool!.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, userId]
    )
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    // 内存模式下忽略
    if (this.useMemory) return
    await this.pool!.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    )
  }

  async getAccount(userId: string): Promise<UserAccount | null> {
    const user = await this.getUser(userId)
    if (!user) return null
    
    const account = this.useMemory 
      ? memoryStore.accounts.get(userId) 
      : (await this.pool!.query('SELECT * FROM virtual_accounts WHERE user_id = $1', [userId])).rows[0]
    
    const usdRate = 7.2
    
    const domesticBalance = account?.domestic_balance || account?.domesticBalance || user.initialBalance * 0.75
    const domesticEquity = account?.domestic_equity || account?.domesticEquity || domesticBalance
    const domesticMargin = account?.domestic_margin || account?.domesticMargin || 0
    const foreignBalance = account?.foreign_balance || account?.foreignBalance || (user.initialBalance / 7.2) * 0.25
    const foreignEquity = account?.foreign_equity || account?.foreignEquity || foreignBalance
    const foreignMargin = account?.foreign_margin || account?.foreignMargin || 0
    
    return {
      userId,
      initialBalance: user.initialBalance,
      virtualSettings: { currency: 'CNY' },
      domestic: {
        name: `模拟CTP-${user.username || userId}`,
        balance: parseFloat(domesticBalance),
        equity: parseFloat(domesticEquity),
        margin: parseFloat(domesticMargin),
        available: parseFloat(domesticEquity) - parseFloat(domesticMargin),
        riskRatio: parseFloat(domesticMargin) / (parseFloat(domesticEquity) || 1) * 100,
        floatingPnl: parseFloat(domesticEquity) - parseFloat(domesticBalance),
      },
      foreign: {
        name: `模拟MT5-${user.username || userId}`,
        balance: parseFloat(foreignBalance),
        equity: parseFloat(foreignEquity),
        margin: parseFloat(foreignMargin),
        available: parseFloat(foreignEquity) - parseFloat(foreignMargin),
        riskRatio: parseFloat(foreignMargin) / (parseFloat(foreignEquity) || 1) * 100,
        floatingPnl: parseFloat(foreignEquity) - parseFloat(foreignBalance),
      },
      total: {
        equity: parseFloat(domesticEquity) + parseFloat(foreignEquity) * usdRate,
        floatingPnl: (parseFloat(domesticEquity) - parseFloat(domesticBalance)) + 
                     (parseFloat(foreignEquity) - parseFloat(foreignBalance)) * usdRate,
        riskRatio: 0,
      },
    }
  }

  async createVirtualAccount(userId: string, initialBalance: number): Promise<any> {
    const usdAmount = initialBalance / 7.2
    const domesticAmount = initialBalance * 0.75
    const foreignAmount = usdAmount * 0.25
    
    if (this.useMemory) {
      const account = {
        userId,
        domesticBalance: domesticAmount,
        domesticEquity: domesticAmount,
        domesticMargin: 0,
        foreignBalance: foreignAmount,
        foreignEquity: foreignAmount,
        foreignMargin: 0,
      }
      memoryStore.accounts.set(userId, account)
      return account
    }
    
    const result = await this.pool!.query(
      `INSERT INTO virtual_accounts (user_id, domestic_balance, domestic_equity, domestic_margin,
                                     foreign_balance, foreign_equity, foreign_margin)
       VALUES ($1, $2, $2, 0, $3, $3, 0)
       RETURNING *`,
      [userId, domesticAmount, foreignAmount]
    )
    return toCamelCase(result.rows[0])
  }

  async updateBalance(userId: string, amount: number): Promise<any | null> {
    if (this.useMemory) {
      const user = memoryStore.users.get(userId)
      if (user) user.initialBalance = amount
      await this.createVirtualAccount(userId, amount)
      return this.getAccount(userId)
    }
    // ... SQL 逻辑
    return this.getAccount(userId)
  }

  async updateAccountMargins(userId: string, domesticMargin: number, foreignMargin: number): Promise<void> {
    if (this.useMemory) {
      const account = memoryStore.accounts.get(userId)
      if (account) {
        account.domesticMargin = domesticMargin
        account.foreignMargin = foreignMargin
      }
      return
    }
    await this.pool!.query(
      `UPDATE virtual_accounts 
       SET domestic_margin = $1, foreign_margin = $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3`,
      [domesticMargin, foreignMargin, userId]
    )
  }

  // ============ 持仓 ============
  async getPositions(userId: string, status: string = 'OPEN'): Promise<Position[]> {
    if (this.useMemory) {
      const positions = memoryStore.positions.get(userId) || []
      return positions.filter(p => p.status === status)
    }
    const result = await this.pool!.query(
      `SELECT * FROM positions WHERE user_id = $1 AND status = $2 ORDER BY opened_at DESC`,
      [userId, status]
    )
    return result.rows.map(row => this.mapPositionFromDB(row))
  }

  async getPositionById(positionId: string): Promise<Position | null> {
    if (this.useMemory) {
      for (const positions of memoryStore.positions.values()) {
        const pos = positions.find(p => p.id === positionId)
        if (pos) return pos
      }
      return null
    }
    const result = await this.pool!.query('SELECT * FROM positions WHERE id = $1', [positionId])
    return result.rows.length > 0 ? this.mapPositionFromDB(result.rows[0]) : null
  }

  async savePosition(position: Position): Promise<void> {
    if (this.useMemory) {
      const positions = memoryStore.positions.get(position.userId) || []
      const index = positions.findIndex(p => p.id === position.id)
      if (index >= 0) {
        positions[index] = position
      } else {
        positions.push(position)
      }
      memoryStore.positions.set(position.userId, positions)
      return
    }
    // ... SQL 逻辑
  }

  async closePosition(positionId: string, realizedPnl: number): Promise<boolean> {
    if (this.useMemory) {
      for (const [userId, positions] of memoryStore.positions) {
        const pos = positions.find(p => p.id === positionId)
        if (pos) {
          pos.status = 'CLOSED'
          pos.realizedPnl = realizedPnl
          pos.closedAt = new Date().toISOString()
          return true
        }
      }
      return false
    }
    return true
  }

  async updatePositionPrices(positionId: string, currentSpreadValue: number, domesticPrice: number, foreignPrice: number, totalPnl: number): Promise<void> {
    // 内存模式下简化处理
    if (this.useMemory) return
    // ... SQL 逻辑
  }

  // ============ 订单 ============
  async getOrders(userId: string, limit: number = 100): Promise<Order[]> {
    if (this.useMemory) {
      const orders = memoryStore.orders.get(userId) || []
      return orders.slice(0, limit)
    }
    // ... SQL 逻辑
    return []
  }

  async getOrderById(orderId: string): Promise<Order | null> {
    if (this.useMemory) {
      for (const orders of memoryStore.orders.values()) {
        const order = orders.find(o => o.id === orderId)
        if (order) return order
      }
      return null
    }
    return null
  }

  async saveOrder(order: Order): Promise<void> {
    if (this.useMemory) {
      const orders = memoryStore.orders.get(order.userId) || []
      const index = orders.findIndex(o => o.id === order.id)
      if (index >= 0) {
        orders[index] = order
      } else {
        orders.unshift(order)
      }
      memoryStore.orders.set(order.userId, orders)
      return
    }
    // ... SQL 逻辑
  }

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    if (this.useMemory) {
      for (const orders of memoryStore.orders.values()) {
        const order = orders.find(o => o.id === orderId)
        if (order) {
          order.overallStatus = status as any
          return
        }
      }
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    if (this.useMemory) {
      for (const orders of memoryStore.orders.values()) {
        const order = orders.find(o => o.id === orderId)
        if (order && order.overallStatus !== 'FILLED') {
          order.overallStatus = 'CANCELLED'
          return true
        }
      }
      return false
    }
    return false
  }

  async updateOrderLegFill(legId: number, filledVolume: number, avgPrice: number): Promise<void> {
    // 简化处理
  }

  // ============ 交易历史 ============
  async getTradeHistory(userId: string, limit: number = 20, offset: number = 0): Promise<{ orders: Order[], total: number }> {
    const orders = await this.getOrders(userId, limit + offset)
    return { orders: orders.slice(offset, offset + limit), total: orders.length }
  }

  // ============ 订单簿 ============
  async getOrderBook(pairId: string): Promise<{ bids: OrderBookEntry[], asks: OrderBookEntry[] }> {
    return { bids: [], asks: [] }
  }

  async updateOrderBook(pairId: string, side: 'BUY' | 'SELL', price: number, volume: number): Promise<void> {}
  async clearOrderBook(pairId?: string): Promise<void> {}

  // ============ 成交记录 ============
  async recordTradeFill(orderLegId: number, filledVolume: number, filledPrice: number): Promise<void> {}

  // ============ 辅助方法 ============
  private mapPositionFromDB(row: any): Position {
    return {
      id: row.id,
      userId: row.user_id,
      pairId: row.pair_id,
      direction: row.direction,
      openSpreadValue: parseFloat(row.open_spread_value),
      currentSpreadValue: parseFloat(row.current_spread_value),
      domesticLeg: {
        symbol: row.domestic_symbol,
        side: row.domestic_side,
        volume: parseFloat(row.domestic_volume),
        filledVolume: parseFloat(row.domestic_filled_volume || 0),
        openPrice: parseFloat(row.domestic_open_price),
        currentPrice: parseFloat(row.domestic_current_price),
        pnl: 0,
        margin: 0,
      },
      foreignLeg: {
        symbol: row.foreign_symbol,
        side: row.foreign_side,
        volume: parseFloat(row.foreign_volume),
        filledVolume: parseFloat(row.foreign_filled_volume || 0),
        openPrice: parseFloat(row.foreign_open_price),
        currentPrice: parseFloat(row.foreign_current_price),
        pnl: 0,
        margin: 0,
      },
      totalPnl: parseFloat(row.total_pnl || 0),
      totalMargin: parseFloat(row.total_margin || 0),
      status: row.status,
      openedAt: row.opened_at.toISOString ? row.opened_at.toISOString() : row.opened_at,
      updatedAt: row.updated_at?.toISOString ? row.updated_at.toISOString() : row.updated_at || row.opened_at,
      closedAt: row.closed_at?.toISOString ? row.closed_at.toISOString() : row.closed_at,
      realizedPnl: row.realized_pnl ? parseFloat(row.realized_pnl) : undefined,
    }
  }
}

export const dbService = new DBService()
