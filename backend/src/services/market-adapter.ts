import type { PairQuote } from '../types/shared'

// 行情适配器接口
export interface MarketDataAdapter {
  connect(): Promise<void>
  disconnect(): Promise<void>
  subscribe(symbols: string[]): void
  unsubscribe(symbols: string[]): void
  onQuote(callback: (quote: PairQuote) => void): void
  isConnected(): boolean
}
