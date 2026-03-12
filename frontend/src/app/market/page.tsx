'use client'

import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts'
import BottomNav from '@/components/BottomNav'
import { useTradeStore, api, useWebSocket } from '@/lib'
import { useAccountPolling, useTrade } from '@/lib/hooks'
import OrderConfirmModal from '@/components/OrderConfirmModal'
import RiskAlerts from '@/components/RiskAlerts'
import { AlertCircle } from 'lucide-react'

export default function MarketPage() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  
  const { 
    selectedPair, 
    quotes, 
    setSelectedPair, 
    isLoggedIn, 
    canTrade,
    error,
    setError
  } = useTradeStore()
  
  const { isConnected } = useWebSocket()
  const { openPosition } = useTrade()
  
  // 账户数据轮询
  useAccountPolling(5000)
  
  const [timeframe, setTimeframe] = useState('1m')
  const [loading, setLoading] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingDirection, setPendingDirection] = useState<'LONG_SPREAD' | 'SHORT_SPREAD' | null>(null)
  
  const currentQuote = quotes[selectedPair]

  // 初始化图表
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0F172A' },
        textColor: '#94A3B8',
      },
      grid: {
        vertLines: { color: '#1E293B' },
        horzLines: { color: '#1E293B' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#334155' },
      timeScale: { borderColor: '#334155' },
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderUpColor: '#22C55E',
      borderDownColor: '#EF4444',
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
    })

    chartRef.current = chart
    seriesRef.current = candleSeries

    // 加载历史K线
    loadKlineData()

    return () => {
      chart.remove()
    }
  }, [selectedPair, timeframe])

  const loadKlineData = async () => {
    try {
      const data = await api.getKline(selectedPair, timeframe, 100)
      const formatted = data.map((d: any) => ({
        time: d.timestamp / 1000,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
      seriesRef.current?.setData(formatted)
      chartRef.current?.timeScale().fitContent()
    } catch (error) {
      console.error('Failed to load kline:', error)
    }
  }

  const handleOpenClick = (direction: 'LONG_SPREAD' | 'SHORT_SPREAD') => {
    if (!isLoggedIn) {
      setError('请先登录')
      return
    }
    if (!canTrade) {
      setError('当前无法交易，请检查风控状态')
      return
    }
    setPendingDirection(direction)
    setShowConfirmModal(true)
  }

  const handleConfirmTrade = async (volume: number) => {
    if (!pendingDirection) return
    
    setLoading(true)
    const result = await openPosition(selectedPair, pendingDirection, volume)
    setLoading(false)
    
    if (result.success) {
      setShowConfirmModal(false)
      setPendingDirection(null)
    }
  }

  const spread = currentQuote?.spread?.value || 0
  const spreadChange = currentQuote?.spread?.change || 0
  const isUp = spreadChange >= 0

  return (
    <main className="pb-20 h-screen flex flex-col">
      <RiskAlerts />
      
      <header className="p-4 border-b border-trade-border">
        <div className="flex items-center gap-2 mb-4">
          <select 
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
            className="bg-trade-card border border-trade-border rounded px-3 py-2 text-lg font-bold"
          >
            <option value="AU_SPREAD">沪金-伦敦金</option>
          </select>
          <span className={`text-xs px-2 py-1 rounded ${isConnected ? 'bg-trade-up/20 text-trade-up' : 'bg-trade-down/20 text-trade-down'}`}>
            {isConnected ? '实时' : '断开'}
          </span>
          {!isLoggedIn && (
            <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-500 flex items-center gap-1">
              <AlertCircle size={12} /> 未登录
            </span>
          )}
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => handleOpenClick('LONG_SPREAD')}
            disabled={loading || !canTrade || !isLoggedIn}
            className="flex-1 bg-trade-up text-white py-3 rounded-lg font-bold active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            做升
          </button>
          <button 
            onClick={() => handleOpenClick('SHORT_SPREAD')}
            disabled={loading || !canTrade || !isLoggedIn}
            className="flex-1 bg-trade-down text-white py-3 rounded-lg font-bold active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            做降
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className={`text-3xl font-bold font-mono ${isUp ? 'text-trade-up' : 'text-trade-down'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(spread).toFixed(2)}
          </span>
          <span className={`text-sm ${isUp ? 'text-trade-up' : 'text-trade-down'}`}>
            {spreadChange >= 0 ? '+' : ''}{spreadChange.toFixed(2)} ({currentQuote?.spread?.changePercent?.toFixed(2) || '0.00'}%)
          </span>
        </div>

        {currentQuote && (
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-trade-muted">{currentQuote.domestic?.symbol} 主力合约</span>
              <span className="font-mono">
                {currentQuote.domestic?.bid?.toFixed(2)}/{currentQuote.domestic?.ask?.toFixed(2)}/
                <span className={currentQuote.domestic?.change >= 0 ? 'text-trade-up' : 'text-trade-down'}>
                  {currentQuote.domestic?.change >= 0 ? '+' : ''}{currentQuote.domestic?.change?.toFixed(2)}
                </span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-trade-muted">{currentQuote.foreign?.symbol} 现货</span>
              <span className="font-mono">
                {currentQuote.foreign?.bid?.toFixed(2)}/{currentQuote.foreign?.ask?.toFixed(2)}/
                <span className={currentQuote.foreign?.change >= 0 ? 'text-trade-up' : 'text-trade-down'}>
                  {currentQuote.foreign?.change >= 0 ? '+' : ''}{currentQuote.foreign?.change?.toFixed(2)}
                </span>
              </span>
            </div>
          </div>
        )}
      </header>

      <div className="flex gap-2 p-2 border-b border-trade-border overflow-x-auto">
        {['周线', '日线', '1小时', '30分钟', '5分钟', '1分钟', '分时'].map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf === '分时' ? '1m' : tf)}
            className={`px-3 py-1 text-sm rounded whitespace-nowrap ${
              (tf === '分时' && timeframe === '1m') || timeframe === tf 
                ? 'bg-trade-primary text-white' 
                : 'text-trade-muted hover:bg-trade-card'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div ref={chartContainerRef} className="flex-1 min-h-0" />

      {error && (
        <div className="fixed bottom-24 left-4 right-4 bg-red-600 text-white p-3 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-white/80 hover:text-white">✕</button>
          </div>
        </div>
      )}

      <OrderConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false)
          setPendingDirection(null)
        }}
        direction={pendingDirection}
        pairId={selectedPair}
        onConfirm={handleConfirmTrade}
      />

      <BottomNav active="market" />
    </main>
  )
}
