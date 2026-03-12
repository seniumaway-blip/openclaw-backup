// 共享类型定义

// 交易对定义
export interface TradingPair {
  id: string
  name: string
  domesticSymbol: string
  foreignSymbol: string
  domesticExchange: string
  foreignExchange: string
  domesticContractSize: number
  foreignContractSize: number
  sizeRatio: number
  domesticTickSize: number
  foreignTickSize: number
  domesticMarginRate: number
  foreignMarginRate: number
  isActive: boolean
  displayOrder: number
}

// 行情报价
export interface PairQuote {
  pairId: string
  timestamp: number
  domestic: {
    symbol: string
    exchange: string
    bid: number
    ask: number
    last: number
    change: number
    changePercent: number
    volume: number
    openInterest?: number
  }
  foreign: {
    symbol: string
    exchange: string
    bid: number
    ask: number
    last: number
    change: number
    changePercent: number
    volume: number
  }
  spread: {
    value: number
    longValue: number
    shortValue: number
    change: number
    changePercent: number
  }
}

// K线数据
export interface PairKline {
  pairId: string
  timeframe: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w'
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  domesticVolume: number
  foreignVolume: number
}

// 持仓
export interface Position {
  id: string
  userId: string
  pairId: string
  direction: 'LONG_SPREAD' | 'SHORT_SPREAD'
  openSpreadValue: number
  currentSpreadValue: number
  domesticLeg: PositionLeg
  foreignLeg: PositionLeg
  totalPnl: number
  totalMargin: number
  status?: 'OPEN' | 'CLOSED'
  realizedPnl?: number
  closedAt?: string
  openedAt: string
  updatedAt: string
}

export interface PositionLeg {
  symbol: string
  side: 'BUY' | 'SELL'
  volume: number
  filledVolume?: number
  openPrice: number
  currentPrice: number
  pnl: number
  margin: number
}

// 订单
export interface Order {
  id: string
  userId: string
  positionId?: string
  pairId: string
  type: 'OPEN' | 'CLOSE'
  direction: 'LONG_SPREAD' | 'SHORT_SPREAD'
  orderType?: 'MARKET' | 'LIMIT'
  limitPrice?: number
  domesticOrder: OrderLeg
  foreignOrder: OrderLeg
  overallStatus: 'PENDING' | 'PARTIAL' | 'FILLED' | 'FAILED' | 'CANCELLED'
  executionMode: 'VIRTUAL' | 'REAL'
  createdAt: string
  updatedAt: string
}

export interface OrderLeg {
  symbol: string
  side: 'BUY' | 'SELL'
  volume: number
  filledVolume?: number
  price: number
  avgFilledPrice?: number
  status: 'PENDING' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'REJECTED'
  filledPrice?: number
  filledAt?: string
  errorMsg?: string
}

// 订单簿
export interface OrderBookEntry {
  price: number
  volume: number
}

// 账户
export interface UserAccount {
  userId: string
  initialBalance: number
  virtualSettings: {
    currency: 'CNY' | 'USD'
  }
  domestic: AccountLeg
  foreign: AccountLeg
  total: {
    equity: number
    floatingPnl: number
    riskRatio: number
  }
}

export interface AccountLeg {
  name: string
  balance: number
  equity: number
  margin: number
  available: number
  riskRatio: number
  floatingPnl: number
}

// 风控配置
export interface RiskConfig {
  maxSingleOrder: number
  maxSingleSidePosition: number
  maxTotalPosition: number
  dayLossLimitPercent: number
}

// WebSocket 消息
export interface WSMessage {
  type: 'quote' | 'trade' | 'position' | 'alert'
  data: any
}
