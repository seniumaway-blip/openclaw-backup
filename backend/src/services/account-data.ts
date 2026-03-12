import { dbService } from './db-service'
import type { UserAccount, Position } from '../types/shared'

// 账户数据服务 - 基于 PostgreSQL
class AccountDataService {
  // 内存缓存，用于快速读取
  private cache = new Map<string, { account: UserAccount; positions: Position[]; timestamp: number }>()
  private cacheTTL = 5000 // 5秒缓存

  // 获取账户信息
  async getAccount(userId: string): Promise<UserAccount | null> {
    // 检查缓存
    const cached = this.cache.get(userId)
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.account
    }

    const account = await dbService.getAccount(userId)
    
    if (account) {
      this.updateCache(userId, account, cached?.positions || [])
    }
    
    return account
  }

  // 获取持仓列表
  async getPositions(userId: string, status: string = 'OPEN'): Promise<Position[]> {
    const positions = await dbService.getPositions(userId, status)
    
    // 更新缓存
    const cached = this.cache.get(userId)
    if (cached) {
      cached.positions = positions
      cached.timestamp = Date.now()
    }
    
    return positions
  }

  // 添加持仓
  async addPosition(userId: string, position: Position): Promise<void> {
    await dbService.savePosition(position)
    
    // 更新缓存
    const cached = this.cache.get(userId)
    if (cached) {
      const existingIndex = cached.positions.findIndex(p => p.id === position.id)
      if (existingIndex >= 0) {
        cached.positions[existingIndex] = position
      } else {
        cached.positions.push(position)
      }
      cached.timestamp = Date.now()
    }
  }

  // 移除持仓（平仓）
  async removePosition(userId: string, positionId: string): Promise<void> {
    const cached = this.cache.get(userId)
    if (cached) {
      cached.positions = cached.positions.filter(p => p.id !== positionId)
      cached.timestamp = Date.now()
    }
  }

  // 更新持仓价格（基于最新行情）
  async updatePositionPrices(userId: string, positionId: string, domesticPrice: number, foreignPrice: number, spreadValue: number): Promise<void> {
    const position = await dbService.getPositionById(positionId)
    if (!position) return

    // 计算盈亏
    const pair = await dbService.getPairById(position.pairId)
    if (!pair) return

    // 内盘盈亏计算（人民币）
    const domesticPnl = position.domesticLeg.side === 'BUY'
      ? (domesticPrice - position.domesticLeg.openPrice) * position.domesticLeg.volume * pair.domesticContractSize
      : (position.domesticLeg.openPrice - domesticPrice) * position.domesticLeg.volume * pair.domesticContractSize

    // 外盘盈亏计算（美元）
    const foreignPnl = position.foreignLeg.side === 'BUY'
      ? (foreignPrice - position.foreignLeg.openPrice) * position.foreignLeg.volume * pair.foreignContractSize
      : (position.foreignLeg.openPrice - foreignPrice) * position.foreignLeg.volume * pair.foreignContractSize

    // 总盈亏（人民币）
    const totalPnl = domesticPnl + foreignPnl * 7.2 // 简化汇率

    await dbService.updatePositionPrices(positionId, spreadValue, domesticPrice, foreignPrice, totalPnl)

    // 更新缓存
    const cached = this.cache.get(userId)
    if (cached) {
      const pos = cached.positions.find(p => p.id === positionId)
      if (pos) {
        pos.currentSpreadValue = spreadValue
        pos.domesticLeg.currentPrice = domesticPrice
        pos.foreignLeg.currentPrice = foreignPrice
        pos.totalPnl = totalPnl
      }
    }
  }

  // 初始化用户账户（如果不存在）
  async initUser(userId: string, initialBalance: number = 1000000): Promise<UserAccount> {
    let user = await dbService.getUser(userId)
    
    if (!user) {
      await dbService.createUser(userId, userId, undefined, initialBalance)
    }
    
    const account = await dbService.getAccount(userId)
    if (!account) {
      throw new Error('Failed to create user account')
    }
    
    return account
  }

  // 更新账户余额
  async updateBalance(userId: string, amount: number): Promise<UserAccount | null> {
    await dbService.updateBalance(userId, amount)
    return this.getAccount(userId)
  }

  // 更新保证金
  async updateMargins(userId: string, domesticMargin: number, foreignMargin: number): Promise<void> {
    await dbService.updateAccountMargins(userId, domesticMargin, foreignMargin)
    
    // 清除缓存
    this.cache.delete(userId)
  }

  // 私有方法：更新缓存
  private updateCache(userId: string, account: UserAccount, positions: Position[]): void {
    this.cache.set(userId, {
      account,
      positions,
      timestamp: Date.now(),
    })
  }

  // 清除缓存
  clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId)
    } else {
      this.cache.clear()
    }
  }
}

export const accountDataService = new AccountDataService()
