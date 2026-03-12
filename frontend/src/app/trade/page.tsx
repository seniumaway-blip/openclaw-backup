'use client'

import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { useTradeStore, api } from '@/lib'
import type { Position } from '../../../../shared/types'

export default function TradePage() {
  const { positions, setPositions, userId } = useTradeStore()
  const [loading, setLoading] = useState(false)
  const [closingId, setClosingId] = useState<string | null>(null)

  useEffect(() => {
    if (userId) {
      loadPositions()
    }
  }, [userId])

  const loadPositions = async () => {
    try {
      const data = await api.getPositions(userId!)
      setPositions(data)
    } catch (error) {
      console.error('Failed to load positions:', error)
    }
  }

  const handleClose = async (id: string) => {
    setClosingId(id)
    try {
      await api.closePosition(userId!, id)
      alert('平仓成功!')
      loadPositions()
    } catch (error: any) {
      alert(`平仓失败: ${error.message}`)
    } finally {
      setClosingId(null)
    }
  }

  return (
    <main className="pb-20">
      <header className="p-4 border-b border-trade-border flex justify-between">
        <h1 className="text-lg font-bold">当前持仓</h1>
        <button className="text-sm text-trade-muted">历史</button>
      </header>

      <div className="p-4 space-y-4">
        {positions.map((pos: Position) => (
          <div key={pos.id} className="bg-trade-card rounded-lg p-4 border border-trade-border">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-trade-muted text-sm">{pos.pairName || '黄金极差'}</span>
                <span className={`ml-2 px-2 py-0.5 text-xs rounded ${
                  pos.direction === 'LONG_SPREAD' ? 'bg-trade-up/20 text-trade-up' : 'bg-trade-down/20 text-trade-down'
                }`}>
                  {pos.direction === 'LONG_SPREAD' ? '做升' : '做降'}
                </span>
              </div>
              <div className={`font-mono font-bold ${pos.totalPnl >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
                {pos.totalPnl >= 0 ? '+' : ''}¥{pos.totalPnl?.toLocaleString()}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
              <div>
                <div className="text-trade-muted text-xs">开仓价差</div>
                <div className="font-mono">{pos.openSpreadValue?.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-trade-muted text-xs">当前价差</div>
                <div className="font-mono">{pos.currentSpreadValue?.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-trade-muted text-xs">价差变化</div>
                <div className={`font-mono ${(pos.currentSpreadValue - pos.openSpreadValue) >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
                  {(pos.currentSpreadValue - pos.openSpreadValue) >= 0 ? '+' : ''}{(pos.currentSpreadValue - pos.openSpreadValue)?.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-trade-bg rounded p-3">
                <div className="text-trade-primary text-sm font-bold mb-2">CTP {pos.domesticLeg?.volume}手</div>
                <div className="text-sm">{pos.domesticLeg?.side === 'BUY' ? '买入' : '卖出'} {pos.domesticLeg?.openPrice?.toFixed(2)}</div>
                <div className="text-trade-muted text-xs">现价 {pos.domesticLeg?.currentPrice?.toFixed(2)}</div>
                <div className={`text-sm font-mono mt-1 ${pos.domesticLeg?.pnl >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
                  盈亏 {pos.domesticLeg?.pnl >= 0 ? '+' : ''}{pos.domesticLeg?.pnl?.toLocaleString()}
                </div>
              </div>

              <div className="bg-trade-bg rounded p-3">
                <div className="text-trade-primary text-sm font-bold mb-2">MT5 {pos.foreignLeg?.volume?.toFixed(2)}手</div>
                <div className="text-sm">{pos.foreignLeg?.side === 'BUY' ? '买入' : '卖出'} {pos.foreignLeg?.openPrice?.toFixed(2)}</div>
                <div className="text-trade-muted text-xs">现价 {pos.foreignLeg?.currentPrice?.toFixed(2)}</div>
                <div className={`text-sm font-mono mt-1 ${pos.foreignLeg?.pnl >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
                  盈亏 {pos.foreignLeg?.pnl >= 0 ? '+' : ''}{pos.foreignLeg?.pnl?.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleClose(pos.id)}
                disabled={closingId === pos.id}
                className="flex-1 bg-trade-down text-white py-2 rounded font-bold active:scale-95 transition-transform disabled:opacity-50"
              >
                {closingId === pos.id ? '平仓中...' : '平仓'}
              </button>
            </div>
          </div>
        ))}

        {positions.length === 0 && (
          <div className="text-center py-20 text-trade-muted">
            <div className="text-4xl mb-4">📊</div>
            暂无持仓，去行情页下单吧
          </div>
        )}
      </div>

      <BottomNav active="trade" />
    </main>
  )
}
