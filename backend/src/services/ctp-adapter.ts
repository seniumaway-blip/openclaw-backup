import { MarketDataAdapter } from './market-adapter'
import type { PairQuote } from '../types/shared'

// CTP 行情适配器
// 实际生产环境需要使用 @yuants/vendor-ctp 或自建 C++ 桥接
// 这里提供框架实现，支持两种模式：
// 1. 模拟模式（开发测试）
// 2. 真实模式（需要配置 CTP 账户和桥接服务）

export interface CTPConfig {
  // 模拟模式开关
  mockMode?: boolean
  
  // 真实 CTP 配置（需要桥接服务）
  brokerId?: string
  userId?: string
  password?: string
  marketFrontAddr?: string // 行情前置地址，如 tcp://180.168.146.187:10131
  
  // ZeroMQ 桥接配置
  zmqPushUrl?: string  // Node.js 发送请求给 C++ 桥接
  zmqPullUrl?: string  // Node.js 接收 C++ 桥接推送
}

export class CTPAdapter implements MarketDataAdapter {
  private connected = false
  private callback: ((quote: PairQuote) => void) | null = null
  private config: CTPConfig
  private subscribedSymbols: string[] = []
  private mockInterval: NodeJS.Timeout | null = null
  
  // 模拟行情基础价格
  private basePrices: Record<string, number> = {
    'AU': 580.0,  // 沪金主力合约基准价（元/克）
    'AG': 7000.0, // 沪银主力合约基准价（元/千克）
    'CU': 75000.0, // 沪铜主力合约基准价（元/吨）
  }

  constructor(config: CTPConfig = { mockMode: true }) {
    this.config = config
  }

  async connect(): Promise<void> {
    if (this.config.mockMode) {
      console.log('CTP Adapter: 模拟模式启动')
      this.startMockData()
      this.connected = true
      return
    }

    // 真实模式：连接 ZeroMQ 桥接服务
    console.log('CTP Adapter: 连接真实 CTP 行情...')
    console.log('注意：真实 CTP 接入需要运行 C++ 桥接服务')
    
    // TODO: 实现 ZeroMQ 连接
    // const zmq = require('zeromq')
    // this.socket = zmq.socket('pull')
    // this.socket.connect(this.config.zmqPullUrl)
    // this.socket.on('message', (msg) => this.handleRealQuote(msg))
    
    this.connected = true
  }

  async disconnect(): Promise<void> {
    if (this.mockInterval) {
      clearInterval(this.mockInterval)
      this.mockInterval = null
    }
    this.connected = false
    console.log('CTP Adapter: 已断开')
  }

  subscribe(symbols: string[]): void {
    console.log('CTP 订阅:', symbols)
    this.subscribedSymbols = [...new Set([...this.subscribedSymbols, ...symbols])]
    
    // 为每个合约初始化基础价格
    symbols.forEach(symbol => {
      if (!this.basePrices[symbol]) {
        this.basePrices[symbol] = 500 + Math.random() * 500
      }
    })
  }

  unsubscribe(symbols: string[]): void {
    console.log('CTP 取消订阅:', symbols)
    this.subscribedSymbols = this.subscribedSymbols.filter(s => !symbols.includes(s))
  }

  onQuote(callback: (quote: PairQuote) => void): void {
    this.callback = callback
  }

  isConnected(): boolean {
    return this.connected
  }

  // 私有方法：启动模拟行情
  private startMockData(): void {
    // 模拟 CTP 3秒切片行情推送
    this.mockInterval = setInterval(() => {
      this.subscribedSymbols.forEach(symbol => {
        const quote = this.generateMockQuote(symbol)
        if (this.callback) {
          this.callback(quote)
        }
      })
    }, 3000)
  }

  // 私有方法：生成模拟行情
  private generateMockQuote(symbol: string): PairQuote {
    const basePrice = this.basePrices[symbol] || 500
    
    // 模拟价格波动（±0.05%）
    const changePercent = (Math.random() - 0.5) * 0.1
    const change = basePrice * (changePercent / 100)
    const lastPrice = basePrice + change
    
    // 更新基础价格（随机游走）
    this.basePrices[symbol] = lastPrice
    
    // 生成买卖盘
    const tickSize = symbol === 'AU' ? 0.02 : (symbol === 'AG' ? 1 : 10)
    const spread = tickSize * (1 + Math.floor(Math.random() * 3))
    
    const bid = lastPrice - spread / 2
    const ask = lastPrice + spread / 2
    
    return {
      pairId: symbol === 'AU' ? 'AU_SPREAD' : symbol,
      timestamp: Date.now(),
      domestic: {
        symbol: symbol,
        exchange: 'SHFE',
        bid: parseFloat(bid.toFixed(symbol === 'AU' ? 2 : 0)),
        ask: parseFloat(ask.toFixed(symbol === 'AU' ? 2 : 0)),
        last: parseFloat(lastPrice.toFixed(symbol === 'AU' ? 2 : 0)),
        change: parseFloat(change.toFixed(symbol === 'AU' ? 2 : 0)),
        changePercent: parseFloat(changePercent.toFixed(3)),
        volume: Math.floor(Math.random() * 10000),
        openInterest: Math.floor(Math.random() * 100000),
      },
      foreign: {
        symbol: 'XAUUSD',
        exchange: 'LME',
        bid: 0, // CTP 不推外盘
        ask: 0,
        last: 0,
        change: 0,
        changePercent: 0,
        volume: 0,
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

  // 私有方法：处理真实行情（预留）
  private handleRealQuote(msg: Buffer): void {
    try {
      // const data = JSON.parse(msg.toString())
      // 解析 CTP 行情结构
      // if (this.callback) {
      //   this.callback(transformedQuote)
      // }
    } catch (err) {
      console.error('CTP 行情解析错误:', err)
    }
  }
}
