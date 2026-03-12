import { MarketDataAdapter } from './market-adapter'
import type { PairQuote } from '../types/shared'

// MT5 ZeroMQ 行情适配器（简化版 - 模拟模式）
// 实际生产环境通过 ZeroMQ 连接到 MT5 的 MQL5 EA 脚本

export interface MT5Config {
  host?: string
  port?: number
  timeout?: number
}

export class MT5Adapter implements MarketDataAdapter {
  private connected = false
  private callback: ((quote: PairQuote) => void) | null = null
  private subscribedSymbols: string[] = []
  private mockInterval: NodeJS.Timeout | null = null
  private mockMode = true
  
  // 模拟行情基础价格
  private basePrices: Record<string, number> = {
    'XAUUSD': 2650.0, // 伦敦金基准价（美元/盎司）
    'XAGUSD': 31.0,
    'HG': 4.2,
  }

  constructor(config?: MT5Config) {
    // 暂时只用模拟模式
    this.mockMode = true
  }

  async connect(): Promise<void> {
    if (this.mockMode) {
      console.log('MT5 Adapter: 模拟模式启动')
      this.startMockData()
      this.connected = true
      return
    }
  }

  async disconnect(): Promise<void> {
    if (this.mockInterval) {
      clearInterval(this.mockInterval)
      this.mockInterval = null
    }
    this.connected = false
    console.log('MT5 Adapter: 已断开')
  }

  subscribe(symbols: string[]): void {
    console.log('MT5 订阅:', symbols)
    this.subscribedSymbols = [...new Set([...this.subscribedSymbols, ...symbols])]
    
    symbols.forEach(symbol => {
      if (!this.basePrices[symbol]) {
        this.basePrices[symbol] = 100 + Math.random() * 2000
      }
    })
  }

  unsubscribe(symbols: string[]): void {
    console.log('MT5 取消订阅:', symbols)
    this.subscribedSymbols = this.subscribedSymbols.filter(s => !symbols.includes(s))
  }

  onQuote(callback: (quote: PairQuote) => void): void {
    this.callback = callback
  }

  isConnected(): boolean {
    return this.connected
  }

  isMockMode(): boolean {
    return this.mockMode
  }

  // 私有方法：启动模拟行情
  private startMockData(): void {
    // 模拟 MT5 Tick 级行情（每秒 2 次）
    this.mockInterval = setInterval(() => {
      this.subscribedSymbols.forEach(symbol => {
        const quote = this.generateMockQuote(symbol)
        if (this.callback) {
          this.callback(quote)
        }
      })
    }, 500)
  }

  // 私有方法：生成模拟行情
  private generateMockQuote(symbol: string): PairQuote {
    const basePrice = this.basePrices[symbol] || 100
    
    // 模拟高频波动
    const changePercent = (Math.random() - 0.5) * 0.04
    const change = basePrice * (changePercent / 100)
    const lastPrice = basePrice + change
    
    this.basePrices[symbol] = lastPrice
    
    const tickSize = symbol === 'XAUUSD' ? 0.01 : 0.001
    const spread = tickSize * (1 + Math.floor(Math.random() * 5))
    
    const bid = lastPrice - spread / 2
    const ask = lastPrice + spread / 2
    
    return {
      pairId: symbol === 'XAUUSD' ? 'AU_SPREAD' : symbol,
      timestamp: Date.now(),
      domestic: {
        symbol: 'AU',
        exchange: 'SHFE',
        bid: 0,
        ask: 0,
        last: 0,
        change: 0,
        changePercent: 0,
        volume: 0,
      },
      foreign: {
        symbol: symbol,
        exchange: 'LME',
        bid: parseFloat(bid.toFixed(symbol === 'XAUUSD' ? 2 : 3)),
        ask: parseFloat(ask.toFixed(symbol === 'XAUUSD' ? 2 : 3)),
        last: parseFloat(lastPrice.toFixed(symbol === 'XAUUSD' ? 2 : 3)),
        change: parseFloat(change.toFixed(symbol === 'XAUUSD' ? 2 : 3)),
        changePercent: parseFloat(changePercent.toFixed(4)),
        volume: Math.floor(Math.random() * 5000),
      },
      spread: {
        value: 0,
        longValue: 0,
        shortValue: 0,
        change: 0,
        changePercent: 0,
      },
    }
  }
}
