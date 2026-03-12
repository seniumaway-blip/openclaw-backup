'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useTradeStore, api } from '@/lib'

interface OrderConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  direction: 'LONG_SPREAD' | 'SHORT_SPREAD' | null
  pairId: string
  onConfirm?: (volume: number) => void
}

export default function OrderConfirmModal({
  isOpen,
  onClose,
  direction,
  pairId,
  onConfirm
}: OrderConfirmModalProps) {
  const { quotes, account, userId } = useTradeStore()
  const [volume, setVolume] = useState(1)
  const [loading, setLoading] = useState(false)

  const quote = quotes[pairId]
  const spread = quote?.spread

  // 计算预估数据
  const domesticMargin = quote?.domestic?.last * 1000 * volume * 0.15 // 15%保证金
  const foreignMargin = quote?.foreign?.last * 100 * volume * 3.11 * 0.15 / 7.2 // 换算成人民币
  const totalMargin = domesticMargin + foreignMargin
  const available = account?.domestic?.available || 0
  const riskRatioAfter = ((account?.domestic?.margin || 0) + domesticMargin) / (account?.domestic?.equity || 1) * 100

  const handleSubmit = async () => {
    if (!direction) return

    // 如果提供了 onConfirm 回调，使用它
    if (onConfirm) {
      onConfirm(volume)
      return
    }

    // 否则使用旧的 API 调用方式（向后兼容）
    if (!userId) return

    setLoading(true)
    try {
      const result = await api.openPosition(pairId, direction, volume)
      alert(`✅ 下单成功!\n订单ID: ${result.order.id}\n持仓ID: ${result.position.id}`)
      onClose()
    } catch (error: any) {
      alert(`❌ 下单失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !direction) return null

  const isLong = direction === 'LONG_SPREAD'
  const spreadPositive = (spread?.value || 0) >= 0

  // 根据价差正负和方向确定买卖
  const domesticSide = (isLong && !spreadPositive) || (!isLong && spreadPositive) ? 'BUY' : 'SELL'
  const foreignSide = domesticSide === 'BUY' ? 'SELL' : 'BUY'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-trade-card rounded-xl border border-trade-border w-full max-w-md mx-4 animate-slide-in">
        <div className="flex justify-between items-center p-4 border-b border-trade-border">
          <h3 className="text-lg font-bold">下单确认</h3>
          <button onClick={onClose} className="p-1 hover:bg-trade-bg rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 基本信息 */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-trade-muted">交易品种</span>
              <span>黄金极差 (AU_SPREAD)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-trade-muted">交易方向</span>
              <span className={isLong ? 'text-trade-up' : 'text-trade-down'}>
                {isLong ? '做升 (价差做多)' : '做降 (价差做空)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-trade-muted">当前价差</span>
              <span className="font-mono font-bold">{spread?.value?.toFixed(2)}</span>
            </div>
          </div>

          {/* 手数选择 */}
          <div>
            <label className="text-sm text-trade-muted">下单手数</label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setVolume(Math.max(0.1, volume - 0.1))}
                className="px-3 py-2 bg-trade-bg rounded hover:bg-trade-border">
                -
              </button>
              <input
                type="number"
                value={volume}
                onChange={(e) => setVolume(Math.max(0.1, Number(e.target.value)))}
                step={0.1}
                min={0.1}
                max={20}
                className="flex-1 bg-trade-bg border border-trade-border rounded px-3 text-center"
              />
              <button
                onClick={() => setVolume(Math.min(20, volume + 0.1))}
                className="px-3 py-2 bg-trade-bg rounded hover:bg-trade-border">
                +
              </button>
            </div>
          </div>

          {/* 双边持仓详情 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-trade-bg rounded-lg p-3">
              <div className="text-trade-primary font-bold mb-2">国内腿 (CTP)</div>
              <div className="space-y-1 text-sm">
                <div>品种: AU</div>
                <div>方向: {domesticSide === 'BUY' ? '买入 (做多)' : '卖出 (做空)'}</div>
                <div>手数: {volume} 手</div>
                <div>价格: {quote?.domestic?.last?.toFixed(2)}</div>
                <div className="text-trade-muted">预估保证金: ¥{domesticMargin.toLocaleString()}</div>
              </div>
            </div>

            <div className="bg-trade-bg rounded-lg p-3">
              <div className="text-trade-primary font-bold mb-2">境外腿 (MT5)</div>
              <div className="space-y-1 text-sm">
                <div>品种: XAUUSD</div>
                <div>方向: {foreignSide === 'BUY' ? '买入 (做多)' : '卖出 (做空)'}</div>
                <div>手数: {(volume * 3.11).toFixed(2)} 手</div>
                <div>价格: {quote?.foreign?.last?.toFixed(2)}</div>
                <div className="text-trade-muted">预估保证金: ${(foreignMargin / 7.2).toFixed(0)}</div>
              </div>
            </div>
          </div>

          {/* 汇总 */}
          <div className="border-t border-trade-border pt-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-trade-muted">总预估保证金</span>
              <span className="font-mono">¥{totalMargin.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-trade-muted">可用资金</span>
              <span className="font-mono">¥{available.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-trade-muted">下单后风险率</span>
              <span className={`font-mono font-bold ${
                riskRatioAfter > 80 ? 'text-trade-down' :
                riskRatioAfter > 50 ? 'text-trade-warning' : 'text-trade-up'
              }`}>
                {riskRatioAfter.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* 风险提示 */}
          {riskRatioAfter > 80 && (
            <div className="bg-trade-down/20 border border-trade-down rounded p-3 text-sm text-trade-down">
              ⚠️ 风险率将超过80%，请注意控制仓位
            </div>
          )}

          {/* 按钮 */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-trade-bg rounded-lg font-bold hover:bg-trade-border transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || totalMargin > available}
              className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                isLong
                  ? 'bg-trade-up hover:bg-trade-up/80'
                  : 'bg-trade-down hover:bg-trade-down/80'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? '提交中...' : '确认下单'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
