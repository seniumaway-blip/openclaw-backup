import { EventEmitter } from 'events'
import { CTPAdapter, CTPConfig } from './ctp-adapter'
import { MT5Adapter, MT5Config } from './mt5-adapter'
import type { PairQuote } from '../types/shared'

// 交易对配置
interface PairConfig {
  pairId: string
  domesticSymbol: string  // CTP 合约代码，如 AU
  foreignSymbol: string   // MT5 品种代码，如 XAUUSD
  sizeRatio: number       // 手数换算比例
  // 价格换算因子（统一单位后的换算）
  // 沪金: 元/克，伦敦金: 美元/盎司
  // 1 盎司 = 31.1035 克，汇率 7.2
  // 外盘转内盘等价价格 = 外盘价 * 31.1035 * 汇率 / 1000 (转换为元/克)
  priceConversionFactor: number
}

// 行情聚合器 - 合并 CTP + MT5 计算价差
export class MarketDataAggregator extends EventEmitter {
  private ctpAdapter: CTPAdapter
  private mt5Adapter: MT5Adapter
  private pairConfigs: Map<string, PairConfig> = new Map()
  
  // 原始行情缓存
  private domesticQuotes: Map<string, any> = new Map()  // CTP 行情
  private foreignQuotes: Map<string, any> = new Map()   // MT5 行情
  
  // 合并后的价差行情
  private spreadQuotes: Map<string, PairQuote> = new Map()
  
  // 最后更新时间
  private lastUpdateTime: Map<string, number> = new Map()
  
  // 行情有效期（毫秒）- 超过此时间未更新则认为数据过期
  private readonly QUOTE_TTL = 10000

  constructor(
    ctpConfig: CTPConfig = { mockMode: true },
    mt5Config: MT5Config = {}
  ) {
    super()
    this.ctpAdapter = new CTPAdapter(ctpConfig)
    this.mt5Adapter = new MT5Adapter(mt5Config)
    
    // 初始化交易对配置
    this.initPairConfigs()
    
    // 设置行情回调
    this.setupCallbacks()
  }

  // 初始化交易对配置
  private initPairConfigs(): void {
    // 黄金极差：沪金(AU) vs 伦敦金(XAUUSD)
    // 价格换算：XAUUSD(美元/盎司) → 元/克
    // 1 盎司 = 31.1035 克，假设汇率 7.2
    // 换算公式：外盘价格 * 31.1035 * 7.2 / 1000 = 元/克
    const goldConversionFactor = 31.1035 * 7.2 / 1000 // ≈ 0.2239
    
    this.pairConfigs.set('AU_SPREAD', {
      pairId: 'AU_SPREAD',
      domesticSymbol: 'AU',
      foreignSymbol: 'XAUUSD',
      sizeRatio: 3.11,
      priceConversionFactor: goldConversionFactor,
    })
  }

  // 设置行情回调
  private setupCallbacks(): void {
    // CTP 行情回调（内盘）
    this.ctpAdapter.onQuote((quote: PairQuote) => {
      const symbol = quote.domestic.symbol
      this.domesticQuotes.set(symbol, quote.domestic)
      this.lastUpdateTime.set(`domestic:${symbol}`, Date.now())
      
      // 尝试合并行情
      this.tryMergeQuote(symbol, 'domestic')
    })

    // MT5 行情回调（外盘）
    this.mt5Adapter.onQuote((quote: PairQuote) => {
      const symbol = quote.foreign.symbol
      this.foreignQuotes.set(symbol, quote.foreign)
      this.lastUpdateTime.set(`foreign:${symbol}`, Date.now())
      
      // 尝试合并行情
      this.tryMergeQuote(symbol, 'foreign')
    })
  }

  // 尝试合并行情
  private tryMergeQuote(symbol: string, source: 'domestic' | 'foreign'): void {
    // 找到对应的交易对配置
    for (const [, config] of this.pairConfigs) {
      const matchDomestic = source === 'domestic' && config.domesticSymbol === symbol
      const matchForeign = source === 'foreign' && config.foreignSymbol === symbol
      
      if (matchDomestic || matchForeign) {
        this.mergePairQuote(config)
      }
    }
  }

  // 合并交易对行情并计算价差
  private mergePairQuote(config: PairConfig): void {
    const domesticQuote = this.domesticQuotes.get(config.domesticSymbol)
    const foreignQuote = this.foreignQuotes.get(config.foreignSymbol)
    
    // 两边都有数据才能计算价差
    if (!domesticQuote || !foreignQuote) {
      return
    }
    
    // 检查数据是否过期
    const now = Date.now()
    const domesticTime = this.lastUpdateTime.get(`domestic:${config.domesticSymbol}`) || 0
    const foreignTime = this.lastUpdateTime.get(`foreign:${config.foreignSymbol}`) || 0
    
    if (now - domesticTime > this.QUOTE_TTL || now - foreignTime > this.QUOTE_TTL) {
      return
    }
    
    // 将外盘价格转换为内盘单位（元/克）
    const foreignPriceConverted = foreignQuote.last * config.priceConversionFactor
    const foreignBidConverted = foreignQuote.bid * config.priceConversionFactor
    const foreignAskConverted = foreignQuote.ask * config.priceConversionFactor
    
    // 计算价差
    // 做多价差 = 外盘买价 - 内盘卖价（外盘便宜时做多）
    const longSpread = foreignBidConverted - domesticQuote.ask
    // 做空价差 = 外盘卖价 - 内盘买价（外盘贵时做空）
    const shortSpread = foreignAskConverted - domesticQuote.bid
    // 中间价差
    const spreadValue = foreignPriceConverted - domesticQuote.last
    
    // 计算涨跌幅（基于上一 tick 的价差）
    const lastQuote = this.spreadQuotes.get(config.pairId)
    const lastSpread = lastQuote?.spread.value || spreadValue
    const spreadChange = spreadValue - lastSpread
    const spreadChangePercent = lastSpread !== 0 ? (spreadChange / Math.abs(lastSpread)) * 100 : 0
    
    // 构建合并行情
    const mergedQuote: PairQuote = {
      pairId: config.pairId,
      timestamp: Date.now(),
      domestic: {
        symbol: domesticQuote.symbol,
        exchange: domesticQuote.exchange,
        bid: domesticQuote.bid,
        ask: domesticQuote.ask,
        last: domesticQuote.last,
        change: domesticQuote.change,
        changePercent: domesticQuote.changePercent,
        volume: domesticQuote.volume,
        openInterest: domesticQuote.openInterest,
      },
      foreign: {
        symbol: foreignQuote.symbol,
        exchange: foreignQuote.exchange,
        bid: foreignQuote.bid,
        ask: foreignQuote.ask,
        last: foreignQuote.last,
        change: foreignQuote.change,
        changePercent: foreignQuote.changePercent,
        volume: foreignQuote.volume,
      },
      spread: {
        value: parseFloat(spreadValue.toFixed(4)),
        longValue: parseFloat(longSpread.toFixed(4)),
        shortValue: parseFloat(shortSpread.toFixed(4)),
        change: parseFloat(spreadChange.toFixed(4)),
        changePercent: parseFloat(spreadChangePercent.toFixed(3)),
      },
    }
    
    // 保存并推送
    this.spreadQuotes.set(config.pairId, mergedQuote)
    this.emit('quote', mergedQuote)
  }

  // 连接两个行情源
  async connect(): Promise<void> {
    console.log('🔄 连接行情源...')
    
    await Promise.all([
      this.ctpAdapter.connect(),
      this.mt5Adapter.connect(),
    ])
    
    console.log('✅ 行情源连接完成')
  }

  // 断开连接
  async disconnect(): Promise<void> {
    await Promise.all([
      this.ctpAdapter.disconnect(),
      this.mt5Adapter.disconnect(),
    ])
    
    this.removeAllListeners()
    console.log('🔌 行情源已断开')
  }

  // 订阅交易对
  subscribe(pairId: string): void {
    const config = this.pairConfigs.get(pairId)
    if (!config) {
      console.warn(`未知的交易对: ${pairId}`)
      return
    }
    
    console.log(`订阅交易对: ${pairId}`)
    this.ctpAdapter.subscribe([config.domesticSymbol])
    this.mt5Adapter.subscribe([config.foreignSymbol])
  }

  // 取消订阅
  unsubscribe(pairId: string): void {
    const config = this.pairConfigs.get(pairId)
    if (!config) return
    
    this.ctpAdapter.unsubscribe([config.domesticSymbol])
    this.mt5Adapter.unsubscribe([config.foreignSymbol])
  }

  // 获取价差行情
  getQuote(pairId: string): PairQuote | null {
    return this.spreadQuotes.get(pairId) || null
  }

  // 获取所有价差行情
  getAllQuotes(): Record<string, PairQuote> {
    return Object.fromEntries(this.spreadQuotes)
  }

  // 获取连接状态
  isConnected(): boolean {
    return this.ctpAdapter.isConnected() && this.mt5Adapter.isConnected()
  }

  // 获取适配器状态
  getAdapterStatus(): {
    ctp: { connected: boolean; mockMode?: boolean }
    mt5: { connected: boolean; mockMode?: boolean }
  } {
    return {
      ctp: { 
        connected: this.ctpAdapter.isConnected(),
        mockMode: (this.ctpAdapter as any).config?.mockMode || false,
      },
      mt5: { 
        connected: this.mt5Adapter.isConnected(),
        mockMode: (this.mt5Adapter as any).mockMode || false,
      },
    }
  }
}

// 单例实例
let aggregator: MarketDataAggregator | null = null

export function getMarketAggregator(
  ctpConfig?: CTPConfig,
  mt5Config?: MT5Config
): MarketDataAggregator {
  if (!aggregator) {
    aggregator = new MarketDataAggregator(ctpConfig, mt5Config)
  }
  return aggregator
}

export function resetMarketAggregator(): void {
  aggregator = null
}
