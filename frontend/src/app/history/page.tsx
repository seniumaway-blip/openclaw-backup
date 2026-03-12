'use client'

import { useEffect, useState } from 'react'
import { useTradeStore, api } from '@/lib'
import BottomNav from '@/components/BottomNav'

interface TradeRecord {
  id: string
  pairId: string
  type: 'OPEN' | 'CLOSE'
  direction: 'LONG_SPREAD' | 'SHORT_SPREAD'
  overallStatus: string
  createdAt: string
  realizedPnl?: number
}

export default function HistoryPage() {
  const { userId } = useTradeStore()
  const [records, setRecords] = useState<TradeRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all') // all, open, close

  useEffect(() => {
    if (userId) {
      loadHistory()
    }
  }, [userId])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const data = await api.getOrders(userId!)
      setRecords(data)
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredRecords = records.filter(r => {
    if (filter === 'open') return r.type === 'OPEN'
    if (filter === 'close') return r.type === 'CLOSE'
    return true
  })

  const formatTime = (ts: string) => {
    const date = new Date(ts)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <main className="pb-20">
      <header className="p-4 border-b border-trade-border">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold">交易记录</h1>
          <button 
            onClick={loadHistory}
            className="text-sm text-trade-primary"
          >
            刷新
          </button>
        </div>
      </header>

      {/* 筛选标签 */}
      <div className="flex gap-2 p-4 border-b border-trade-border">
        {[
          { key: 'all', label: '全部' },
          { key: 'open', label: '开仓' },
          { key: 'close', label: '平仓' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`px-4 py-1.5 rounded-full text-sm ${
              filter === item.key
                ? 'bg-trade-primary text-white'
                : 'bg-trade-card text-trade-muted'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-20 text-trade-muted">加载中...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-20 text-trade-muted">暂无记录</div>
        ) : (
          filteredRecords.map((record) => (
            <div 
              key={record.id} 
              className="bg-trade-card rounded-lg p-4 border border-trade-border"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      {record.pairId === 'AU_SPREAD' ? '黄金极差' : record.pairId}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      record.type === 'OPEN' 
                        ? 'bg-trade-primary/20 text-trade-primary' 
                        : 'bg-trade-muted/20 text-trade-muted'
                    }`}>
                      {record.type === 'OPEN' ? '开仓' : '平仓'}
                    </span>
                  </div>
                  <div className="text-sm text-trade-muted mt-1">
                    {formatTime(record.createdAt)}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-sm px-2 py-1 rounded ${
                    record.direction === 'LONG_SPREAD' 
                      ? 'bg-trade-up/20 text-trade-up' 
                      : 'bg-trade-down/20 text-trade-down'
                  }`}>
                    {record.direction === 'LONG_SPREAD' ? '做升' : '做降'}
                  </span>
                  <div className={`text-sm font-mono mt-1 ${
                    record.type === 'CLOSE' && record.realizedPnl >= 0 
                      ? 'text-trade-up' 
                      : record.type === 'CLOSE' && record.realizedPnl < 0
                        ? 'text-trade-down'
                        : 'text-trade-muted'
                  }`}>
                    {record.type === 'CLOSE' && record.realizedPnl !== undefined
                      ? `${record.realizedPnl >= 0 ? '+' : ''}¥${record.realizedPnl.toLocaleString()}`
                      : record.overallStatus === 'FILLED' 
                        ? '已成交' 
                        : record.overallStatus
                    }
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav active="profile" />
    </main>
  )
}
