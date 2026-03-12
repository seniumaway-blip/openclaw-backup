import { getMarketAggregator, MarketDataAggregator } from './market-aggregator'
import type { PairQuote, PairKline } from '../types/shared'

// 行情数据服务 - 使用聚合器（CTP + MT5）
class MarketDataService {
  private aggregator: MarketDataAggregator | null = null
  private klineData: Map<string, PairKline[]> = new Map()
  private isInitialized = false

  // 初始化连接
  async init(): Promise<void> {
    if (this.isInitialized) return

    // 创建聚合器（默认使用模拟模式）
    this.aggregator = getMarketAggregator(
      { mockMode: true },  // CTP 模拟
      { host: 'localhost', port: 5555 }  // MT5 连接配置（会回退到模拟）
    )

    // 监听行情推送
    this.aggregator.on('quote', (quote: PairQuote) => {
      this.updateKline(quote)
    })

    // 连接行情源
    await this.aggregator.connect()
    
    // 订阅默认交易对
    this.aggregator.subscribe('AU_SPREAD')

    this.isInitialized = true
    console.log('✅ 行情数据服务初始化完成')
  }

  // 获取实时报价
  getQuote(pairId: string): PairQuote | null {
    if (!this.aggregator) {
      // 未初始化时返回 mock 数据
      return this.getMockQuote(pairId)
    }
    return this.aggregator.getQuote(pairId)
  }

  // 获取所有报价
  getAllQuotes(): Record<string, PairQuote> {
    if (!this.aggregator) {
      return {}
    }
    return this.aggregator.getAllQuotes()
  }

  // 获取 K线数据
  getKline(pairId: string, timeframe: string, limit: number): any[] {
    // 从缓存获取
    const key = `${pairId}:${timeframe}`
    const data = this.klineData.get(key) || []
    
    if (data.length > 0) {
      return data.slice(-limit)
    }

    // 没有缓存时生成 mock K线
    return this.generateMockKline(pairId, timeframe, limit)
  }

  // 获取行情源状态
  getStatus() {
    if (!this.aggregator) {
      return {
        initialized: false,
        connected: false,
        adapters: { ctp: { connected: false }, mt5: { connected: false } },
      }
    }

    return {
      initialized: this.isInitialized,
      connected: this.aggregator.isConnected(),
      adapters: this.aggregator.getAdapterStatus(),
      quotes: this.aggregator.getAllQuotes(),
    }
  }

  // 订阅交易对
  subscribe(pairId: string): void {
    if (this.aggregator) {
      this.aggregator.subscribe(pairId)
    }
  }

  // 监听行情推送（用于 WebSocket）
  onQuote(callback: (quote: PairQuote) => void): void {
    if (this.aggregator) {
      this.aggregator.on('quote', callback)
    }
  }

  // 私有方法：更新 K线缓存
  private updateKline(quote: PairQuote): void {
    const key = `${quote.pairId}:1m`
    const data = this.klineData.get(key) || []
    
    const now = Date.now()
    const minuteStart = Math.floor(now / 60000) * 60000
    
    // 找到或创建当前分钟的 K线
    let currentKline = data.find(k => k.timestamp === minuteStart)
    
    if (!currentKline) {
      // 创建新 K线
      const price = quote.spread.value
      currentKline = {
        pairId: quote.pairId,
        timeframe: '1m',
        timestamp: minuteStart,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0,
        domesticVolume: quote.domestic.volume,
        foreignVolume: quote.foreign.volume,
      }
      data.push(currentKline)
      
      // 限制缓存大小
      if (data.length > 1000) {
        data.shift()
      }
    }
    
    // 更新当前 K线
    const price = quote.spread.value
    currentKline.high = Math.max(currentKline.high, price)
    currentKline.low = Math.min(currentKline.low, price)
    currentKline.close = price
    currentKline.volume += Math.floor(Math.random() * 10) // 模拟成交量
    currentKline.domesticVolume = quote.domestic.volume
    currentKline.foreignVolume = quote.foreign.volume
    
    this.klineData.set(key, data)
  }

  // 私有方法：生成模拟报价（兼容旧代码）
  private getMockQuote(pairId: string): PairQuote | null {
    const basePrices: Record<string, { domestic: number; foreign: number }> = {
      AU_SPREAD: { domestic: 580, foreign: 2650 },
    }
    
    const base = basePrices[pairId]
    if (!base) return null

    // 模拟价格波动
    const domesticNoise = (Math.random() - 0.5) * 0.2
    const foreignNoise = (Math.random() - 0.5) * 0.5
    
    const domesticPrice = base.domestic + domesticNoise
    const foreignPrice = base.foreign + foreignNoise
    
    // 外盘转内盘单位（简化计算）
    const foreignConverted = foreignPrice * 0.224 // 盎司→克 汇率换算
    const spreadValue = foreignConverted - domesticPrice

    return {
      pairId,
      timestamp: Date.now(),
      domestic: {
        symbol: 'AU',
        exchange: 'SHFE',
        bid: parseFloat((domesticPrice - 0.02).toFixed(2)),
        ask: parseFloat((domesticPrice + 0.02).toFixed(2)),
        last: parseFloat(domesticPrice.toFixed(2)),
        change: parseFloat(domesticNoise.toFixed(2)),
        changePercent: parseFloat(((domesticNoise / base.domestic) * 100).toFixed(3)),
        volume: Math.floor(Math.random() * 10000),
      },
      foreign: {
        symbol: 'XAUUSD',
        exchange: 'LME',
        bid: parseFloat((foreignPrice - 0.1).toFixed(2)),
        ask: parseFloat((foreignPrice + 0.1).toFixed(2)),
        last: parseFloat(foreignPrice.toFixed(2)),
        change: parseFloat(foreignNoise.toFixed(2)),
        changePercent: parseFloat(((foreignNoise / base.foreign) * 100).toFixed(3)),
        volume: Math.floor(Math.random() * 5000),
      },
      spread: {
        value: parseFloat(spreadValue.toFixed(4)),
        longValue: parseFloat((spreadValue - 0.01).toFixed(4)),
        shortValue: parseFloat((spreadValue + 0.01).toFixed(4)),
        change: 0,
        changePercent: 0,
      },
    }
  }

  // 私有方法：生成模拟 K线
  private generateMockKline(pairId: string, timeframe: string, limit: number): any[] {
    const data: any[] = []
    let price = 4.5
    const now = Date.now()
    
    const interval = this.getTimeframeMs(timeframe)
    
    for (let i = 0; i < limit; i++) {
      const timestamp = now - (limit - i) * interval
      const open = price
      const close = price + (Math.random() - 0.5) * 0.5
      const high = Math.max(open, close) + Math.random() * 0.3
      const low = Math.min(open, close) - Math.random() * 0.3
      
      data.push({
        timestamp,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: Math.floor(Math.random() * 1000),
      })
      
      price = close
    }
    
    return data
  }

  // 私有方法：时间帧转毫秒
  private getTimeframeMs(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '1d': 86400000,
    }
    return map[timeframe] || 60000
  }
}

export const marketDataService = new MarketDataService()

// 兼容旧接口
export const mockMarketData = {
  getQuote: (pairId: string) => marketDataService.getQuote(pairId),
  getKline: (pairId: string, timeframe: string, limit: number) => 
    marketDataService.getKline(pairId, timeframe, limit),
}
