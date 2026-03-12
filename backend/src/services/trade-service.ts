import { dbService } from './db-service'
import { accountDataService } from './account-data'
import { mockMarketData } from './market-data'
import type { Order, Position, OrderBookEntry, PairQuote } from '../types/shared'

// 订单簿模拟
class OrderBookSimulator {
  private orderBooks = new Map<string, { bids: OrderBookEntry[], asks: OrderBookEntry[] }>()

  // 更新订单簿（基于行情数据）
  updateOrderBook(pairId: string, quote: PairQuote): void {
    // 基于买一卖一生成深度
    const bids: OrderBookEntry[] = [
      { price: quote.domestic.bid - 0.02, volume: 10 + Math.floor(Math.random() * 20) },
      { price: quote.domestic.bid - 0.04, volume: 15 + Math.floor(Math.random() * 30) },
      { price: quote.domestic.bid - 0.06, volume: 20 + Math.floor(Math.random() * 40) },
    ]
    
    const asks: OrderBookEntry[] = [
      { price: quote.domestic.ask + 0.02, volume: 10 + Math.floor(Math.random() * 20) },
      { price: quote.domestic.ask + 0.04, volume: 15 + Math.floor(Math.random() * 30) },
      { price: quote.domestic.ask + 0.06, volume: 20 + Math.floor(Math.random() * 40) },
    ]

    this.orderBooks.set(pairId, { bids, asks })
  }

  getOrderBook(pairId: string): { bids: OrderBookEntry[], asks: OrderBookEntry[] } {
    return this.orderBooks.get(pairId) || { bids: [], asks: [] }
  }

  // 模拟撮合：计算可成交数量和均价
  matchOrder(
    pairId: string,
    side: 'BUY' | 'SELL',
    volume: number,
    orderType: 'MARKET' | 'LIMIT',
    limitPrice?: number
  ): { success: boolean; filledVolume: number; avgPrice: number; message?: string } {
    const orderBook = this.orderBooks.get(pairId)
    if (!orderBook) {
      return { success: false, filledVolume: 0, avgPrice: 0, message: '订单簿未初始化' }
    }

    const levels = side === 'BUY' ? orderBook.asks : orderBook.bids
    
    let remainingVolume = volume
    let totalValue = 0
    let filledVolume = 0

    for (const level of levels) {
      if (remainingVolume <= 0) break

      // 限价单检查
      if (orderType === 'LIMIT' && limitPrice !== undefined) {
        if (side === 'BUY' && level.price > limitPrice) break
        if (side === 'SELL' && level.price < limitPrice) break
      }

      const canFill = Math.min(remainingVolume, level.volume)
      totalValue += canFill * level.price
      filledVolume += canFill
      remainingVolume -= canFill
    }

    if (filledVolume === 0) {
      return { 
        success: false, 
        filledVolume: 0, 
        avgPrice: 0, 
        message: orderType === 'LIMIT' ? '限价单未达成交条件' : '流动性不足' 
      }
    }

    const avgPrice = totalValue / filledVolume

    // 如果是限价单且未完全成交，返回部分成交
    if (orderType === 'LIMIT' && filledVolume < volume) {
      return { 
        success: true, 
        filledVolume, 
        avgPrice, 
        message: '部分成交' 
      }
    }

    return { success: true, filledVolume, avgPrice }
  }
}

const orderBookSimulator = new OrderBookSimulator()

// 交易服务 - 基于 PostgreSQL 和真实撮合逻辑
class TradeService {
  // 开仓
  async openPosition(
    userId: string,
    pairId: string,
    direction: 'LONG_SPREAD' | 'SHORT_SPREAD',
    volume: number,
    orderType: 'MARKET' | 'LIMIT' = 'MARKET',
    limitPrice?: number
  ): Promise<{ success: boolean; order?: Order; position?: Position; message?: string }> {
    // 获取交易对信息
    const pair = await dbService.getPairById(pairId)
    if (!pair) {
      return { success: false, message: '交易对不存在' }
    }

    // 获取当前行情
    const quote = mockMarketData.getQuote(pairId)
    if (!quote) {
      return { success: false, message: '无法获取行情数据' }
    }

    // 更新订单簿
    orderBookSimulator.updateOrderBook(pairId, quote)

    // 生成订单ID和持仓ID
    const orderId = `O${Date.now()}${Math.random().toString(36).substr(2, 4)}`
    const positionId = `P${Date.now()}${Math.random().toString(36).substr(2, 4)}`

    // 计算外盘手数（基于比率）
    const foreignVolume = volume * pair.sizeRatio

    // 确定买卖方向
    const domesticSide: 'BUY' | 'SELL' = direction === 'LONG_SPREAD' ? 'BUY' : 'SELL'
    const foreignSide: 'BUY' | 'SELL' = direction === 'LONG_SPREAD' ? 'SELL' : 'BUY'

    // 计算开仓价差
    const openSpreadValue = domesticSide === 'BUY'
      ? quote.domestic.ask - quote.foreign.bid
      : quote.domestic.bid - quote.foreign.ask

    // 创建订单
    const order: Order = {
      id: orderId,
      userId,
      positionId,
      pairId,
      type: 'OPEN',
      direction,
      orderType,
      limitPrice,
      executionMode: 'VIRTUAL',
      overallStatus: 'PENDING',
      domesticOrder: {
        symbol: pair.domesticSymbol,
        side: domesticSide,
        volume,
        filledVolume: 0,
        price: orderType === 'MARKET' ? (domesticSide === 'BUY' ? quote.domestic.ask : quote.domestic.bid) : limitPrice!,
        status: 'PENDING',
      },
      foreignOrder: {
        symbol: pair.foreignSymbol,
        side: foreignSide,
        volume: foreignVolume,
        filledVolume: 0,
        price: orderType === 'MARKET' ? (foreignSide === 'BUY' ? quote.foreign.ask : quote.foreign.bid) : limitPrice!,
        status: 'PENDING',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 保存订单
    await dbService.saveOrder(order)

    // 执行撮合
    const fillResult = await this.executeOrderWithPartialFill(order, pairId)

    if (fillResult.success) {
      // 更新订单和持仓
      const position = await this.processFillResult(order, fillResult, pair, openSpreadValue)
      
      return {
        success: true,
        order,
        position,
      }
    } else {
      order.overallStatus = 'FAILED'
      order.domesticOrder.errorMsg = fillResult.message
      order.foreignOrder.errorMsg = fillResult.message
      await dbService.saveOrder(order)
      
      return {
        success: false,
        order,
        message: fillResult.message,
      }
    }
  }

  // 平仓
  async closePosition(
    userId: string,
    positionId: string,
    orderType: 'MARKET' | 'LIMIT' = 'MARKET',
    limitPrice?: number
  ): Promise<{ success: boolean; order?: Order; realizedPnl?: number; message?: string }> {
    // 获取持仓
    const position = await dbService.getPositionById(positionId)
    if (!position) {
      return { success: false, message: '持仓不存在' }
    }

    if (position.status !== 'OPEN') {
      return { success: false, message: '持仓已关闭' }
    }

    if (position.userId !== userId) {
      return { success: false, message: '无权操作此持仓' }
    }

    // 获取交易对信息
    const pair = await dbService.getPairById(position.pairId)
    if (!pair) {
      return { success: false, message: '交易对不存在' }
    }

    // 获取当前行情
    const quote = mockMarketData.getQuote(position.pairId)
    if (!quote) {
      return { success: false, message: '无法获取行情数据' }
    }

    // 更新订单簿
    orderBookSimulator.updateOrderBook(position.pairId, quote)

    // 计算平仓方向（与开仓相反）
    const closeDomesticSide: 'BUY' | 'SELL' = position.domesticLeg.side === 'BUY' ? 'SELL' : 'BUY'
    const closeForeignSide: 'BUY' | 'SELL' = position.foreignLeg.side === 'BUY' ? 'SELL' : 'BUY'

    // 生成订单ID
    const orderId = `O${Date.now()}${Math.random().toString(36).substr(2, 4)}`

    // 创建平仓订单
    const order: Order = {
      id: orderId,
      userId,
      positionId,
      pairId: position.pairId,
      type: 'CLOSE',
      direction: position.direction,
      orderType,
      limitPrice,
      executionMode: 'VIRTUAL',
      overallStatus: 'PENDING',
      domesticOrder: {
        symbol: position.domesticLeg.symbol,
        side: closeDomesticSide,
        volume: position.domesticLeg.volume,
        filledVolume: 0,
        price: orderType === 'MARKET' ? (closeDomesticSide === 'BUY' ? quote.domestic.ask : quote.domestic.bid) : limitPrice!,
        status: 'PENDING',
      },
      foreignOrder: {
        symbol: position.foreignLeg.symbol,
        side: closeForeignSide,
        volume: position.foreignLeg.volume,
        filledVolume: 0,
        price: orderType === 'MARKET' ? (closeForeignSide === 'BUY' ? quote.foreign.ask : quote.foreign.bid) : limitPrice!,
        status: 'PENDING',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 保存订单
    await dbService.saveOrder(order)

    // 执行撮合
    const fillResult = await this.executeOrderWithPartialFill(order, position.pairId)

    if (fillResult.success) {
      const realizedPnl = await this.processCloseFill(order, fillResult, position, pair)
      
      return {
        success: true,
        order,
        realizedPnl,
      }
    } else {
      order.overallStatus = 'FAILED'
      order.domesticOrder.errorMsg = fillResult.message
      order.foreignOrder.errorMsg = fillResult.message
      await dbService.saveOrder(order)
      
      return {
        success: false,
        order,
        message: fillResult.message,
      }
    }
  }

  // 撤单
  async cancelOrder(userId: string, orderId: string): Promise<{ success: boolean; message?: string }> {
    // 获取订单
    const order = await dbService.getOrderById(orderId)
    if (!order) {
      return { success: false, message: '订单不存在' }
    }

    if (order.userId !== userId) {
      return { success: false, message: '无权操作此订单' }
    }

    if (order.overallStatus === 'FILLED') {
      return { success: false, message: '订单已成交，无法撤销' }
    }

    if (order.overallStatus === 'CANCELLED') {
      return { success: false, message: '订单已撤销' }
    }

    const cancelled = await dbService.cancelOrder(orderId)
    
    if (cancelled) {
      return { success: true, message: '订单撤销成功' }
    } else {
      return { success: false, message: '撤单失败' }
    }
  }

  // 获取订单簿
  getOrderBook(pairId: string): { bids: OrderBookEntry[], asks: OrderBookEntry[] } {
    const quote = mockMarketData.getQuote(pairId)
    if (quote) {
      orderBookSimulator.updateOrderBook(pairId, quote)
    }
    return orderBookSimulator.getOrderBook(pairId)
  }

  // 获取用户订单历史
  async getOrders(userId: string, limit: number = 100): Promise<Order[]> {
    return dbService.getOrders(userId, limit)
  }

  // 获取订单详情
  async getOrderById(orderId: string): Promise<Order | null> {
    return dbService.getOrderById(orderId)
  }

  // 私有方法：执行订单撮合（支持部分成交）
  private async executeOrderWithPartialFill(
    order: Order,
    pairId: string
  ): Promise<{
    success: boolean
    domestic?: { filledVolume: number; avgPrice: number; status: 'FILLED' | 'PARTIAL' }
    foreign?: { filledVolume: number; avgPrice: number; status: 'FILLED' | 'PARTIAL' }
    message?: string
  }> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150))

    // 模拟极小概率失败
    if (Math.random() < 0.005) {
      return { success: false, message: '网络超时，请重试' }
    }

    // 双边撮合
    const domesticResult = orderBookSimulator.matchOrder(
      pairId,
      order.domesticOrder.side,
      order.domesticOrder.volume,
      order.orderType || 'MARKET',
      order.limitPrice
    )

    const foreignResult = orderBookSimulator.matchOrder(
      pairId,
      order.foreignOrder.side,
      order.foreignOrder.volume,
      order.orderType || 'MARKET',
      order.limitPrice
    )

    // 如果两边都完全没成交，失败
    if (domesticResult.filledVolume === 0 && foreignResult.filledVolume === 0) {
      return { 
        success: false, 
        message: domesticResult.message || foreignResult.message || '撮合失败' 
      }
    }

    // 价差套利要求双边同时成交，如果一边完全没成交，另一边也不能成交
    if (domesticResult.filledVolume === 0 || foreignResult.filledVolume === 0) {
      return { 
        success: false, 
        message: '价差套利要求双边同时成交，单边成交失败' 
      }
    }

    return {
      success: true,
      domestic: {
        filledVolume: domesticResult.filledVolume,
        avgPrice: domesticResult.avgPrice,
        status: domesticResult.filledVolume >= order.domesticOrder.volume ? 'FILLED' : 'PARTIAL',
      },
      foreign: {
        filledVolume: foreignResult.filledVolume,
        avgPrice: foreignResult.avgPrice,
        status: foreignResult.filledVolume >= order.foreignOrder.volume ? 'FILLED' : 'PARTIAL',
      },
    }
  }

  // 私有方法：处理开仓成交结果
  private async processFillResult(
    order: Order,
    fillResult: any,
    pair: any,
    openSpreadValue: number
  ): Promise<Position> {
    const isDomesticFilled = fillResult.domestic.status === 'FILLED'
    const isForeignFilled = fillResult.foreign.status === 'FILLED'
    const isFullyFilled = isDomesticFilled && isForeignFilled

    // 更新订单腿状态
    order.domesticOrder.filledVolume = fillResult.domestic.filledVolume
    order.domesticOrder.avgFilledPrice = fillResult.domestic.avgPrice
    order.domesticOrder.status = fillResult.domestic.status
    order.domesticOrder.filledPrice = fillResult.domestic.avgPrice
    order.domesticOrder.filledAt = new Date().toISOString()

    order.foreignOrder.filledVolume = fillResult.foreign.filledVolume
    order.foreignOrder.avgFilledPrice = fillResult.foreign.avgPrice
    order.foreignOrder.status = fillResult.foreign.status
    order.foreignOrder.filledPrice = fillResult.foreign.avgPrice
    order.foreignOrder.filledAt = new Date().toISOString()

    order.overallStatus = isFullyFilled ? 'FILLED' : 'PARTIAL'
    order.updatedAt = new Date().toISOString()

    await dbService.saveOrder(order)

    // 创建持仓
    const position: Position = {
      id: order.positionId!,
      userId: order.userId,
      pairId: order.pairId,
      direction: order.direction,
      openSpreadValue,
      currentSpreadValue: openSpreadValue,
      domesticLeg: {
        symbol: pair.domesticSymbol,
        side: order.domesticOrder.side,
        volume: order.domesticOrder.volume,
        filledVolume: fillResult.domestic.filledVolume,
        openPrice: fillResult.domestic.avgPrice,
        currentPrice: fillResult.domestic.avgPrice,
        pnl: 0,
        margin: this.calculateMargin(fillResult.domestic.avgPrice, fillResult.domestic.filledVolume, pair.domesticContractSize, pair.domesticMarginRate),
      },
      foreignLeg: {
        symbol: pair.foreignSymbol,
        side: order.foreignOrder.side,
        volume: order.foreignOrder.volume,
        filledVolume: fillResult.foreign.filledVolume,
        openPrice: fillResult.foreign.avgPrice,
        currentPrice: fillResult.foreign.avgPrice,
        pnl: 0,
        margin: this.calculateMargin(fillResult.foreign.avgPrice, fillResult.foreign.filledVolume, pair.foreignContractSize, pair.foreignMarginRate),
      },
      totalPnl: 0,
      totalMargin: 0,
      openedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    position.totalMargin = position.domesticLeg.margin + position.foreignLeg.margin

    // 只有完全成交才创建持仓
    if (isFullyFilled) {
      await dbService.savePosition(position)
      await this.updateAccountMargins(order.userId)
    }

    return position
  }

  // 私有方法：处理平仓成交结果
  private async processCloseFill(
    order: Order,
    fillResult: any,
    position: Position,
    pair: any
  ): Promise<number> {
    const isDomesticFilled = fillResult.domestic.status === 'FILLED'
    const isForeignFilled = fillResult.foreign.status === 'FILLED'
    const isFullyFilled = isDomesticFilled && isForeignFilled

    // 更新订单腿状态
    order.domesticOrder.filledVolume = fillResult.domestic.filledVolume
    order.domesticOrder.avgFilledPrice = fillResult.domestic.avgPrice
    order.domesticOrder.status = fillResult.domestic.status
    order.domesticOrder.filledPrice = fillResult.domestic.avgPrice
    order.domesticOrder.filledAt = new Date().toISOString()

    order.foreignOrder.filledVolume = fillResult.foreign.filledVolume
    order.foreignOrder.avgFilledPrice = fillResult.foreign.avgPrice
    order.foreignOrder.status = fillResult.foreign.status
    order.foreignOrder.filledPrice = fillResult.foreign.avgPrice
    order.foreignOrder.filledAt = new Date().toISOString()

    order.overallStatus = isFullyFilled ? 'FILLED' : 'PARTIAL'
    order.updatedAt = new Date().toISOString()

    await dbService.saveOrder(order)

    // 计算实现盈亏
    const domesticRealizedPnl = position.domesticLeg.side === 'BUY'
      ? (fillResult.domestic.avgPrice - position.domesticLeg.openPrice) * fillResult.domestic.filledVolume * pair.domesticContractSize
      : (position.domesticLeg.openPrice - fillResult.domestic.avgPrice) * fillResult.domestic.filledVolume * pair.domesticContractSize

    const foreignRealizedPnl = position.foreignLeg.side === 'BUY'
      ? (fillResult.foreign.avgPrice - position.foreignLeg.openPrice) * fillResult.foreign.filledVolume * pair.foreignContractSize
      : (position.foreignLeg.openPrice - fillResult.foreign.avgPrice) * fillResult.foreign.filledVolume * pair.foreignContractSize

    const realizedPnl = domesticRealizedPnl + foreignRealizedPnl * 7.2

    // 只有完全成交才关闭持仓
    if (isFullyFilled) {
      await dbService.closePosition(position.id, realizedPnl)
      await this.updateAccountMargins(order.userId)
    }

    return realizedPnl
  }

  // 私有方法：计算保证金
  private calculateMargin(price: number, volume: number, contractSize: number, marginRate: number): number {
    return price * volume * contractSize * marginRate
  }

  // 私有方法：更新账户保证金
  private async updateAccountMargins(userId: string): Promise<void> {
    const positions = await dbService.getPositions(userId, 'OPEN')
    
    let domesticMargin = 0
    let foreignMargin = 0

    for (const pos of positions) {
      domesticMargin += pos.domesticLeg.margin
      foreignMargin += pos.foreignLeg.margin
    }

    await dbService.updateAccountMargins(userId, domesticMargin, foreignMargin)
    accountDataService.clearCache(userId)
  }
}

export const tradeService = new TradeService()
