'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, X, Shield, TrendingDown, Activity } from 'lucide-react'
import { useTradeStore } from '@/lib/store'
import { api } from '@/lib/api'
import type { RiskAlert } from '../../../shared/types'

interface AlertItem extends RiskAlert {
  icon?: React.ReactNode
}

export default function RiskAlerts() {
  const { riskAlerts, setRiskAlerts, canTrade, blockedReason, removeRiskAlert } = useTradeStore()
  const [isLoading, setIsLoading] = useState(false)

  // 获取风控状态
  const fetchRiskStatus = useCallback(async () => {
    try {
      const status = await api.getRiskStatus()
      setRiskAlerts(status.alerts || [])
    } catch (err) {
      console.error('获取风控状态失败:', err)
    }
  }, [setRiskAlerts])

  // 定时轮询风控状态
  useEffect(() => {
    fetchRiskStatus()
    const interval = setInterval(fetchRiskStatus, 10000) // 10秒轮询
    return () => clearInterval(interval)
  }, [fetchRiskStatus])

  // 清除预警
  const handleDismiss = async (alertId: string) => {
    try {
      await api.clearRiskAlert(alertId)
      removeRiskAlert(alertId)
    } catch (err) {
      console.error('清除预警失败:', err)
    }
  }

  // 获取预警图标
  const getAlertIcon = (category: string) => {
    switch (category) {
      case 'risk_ratio':
        return <Activity size={18} />
      case 'day_loss':
        return <TrendingDown size={18} />
      case 'position':
        return <Shield size={18} />
      default:
        return <AlertTriangle size={18} />
    }
  }

  // 获取预警样式
  const getAlertStyles = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-600 text-white border-red-700'
      case 'danger':
        return 'bg-red-500/90 text-white border-red-600'
      case 'warning':
        return 'bg-amber-500/90 text-black border-amber-600'
      default:
        return 'bg-blue-500/90 text-white border-blue-600'
    }
  }

  if (riskAlerts.length === 0 && canTrade) return null

  return (
    <div className="fixed top-16 left-4 right-4 z-50 space-y-2">
      {/* 交易被禁止提示 */}
      {!canTrade && blockedReason && (
        <div className="flex items-center gap-3 p-4 rounded-lg shadow-lg bg-red-600 text-white border-2 border-red-700 animate-pulse">
          <AlertTriangle size={24} />
          <div className="flex-1">
            <div className="font-bold text-lg">⚠️ 交易已暂停</div>
            <div className="text-sm opacity-90">{blockedReason}</div>
          </div>
        </div>
      )}

      {/* 预警列表 */}
      {riskAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center gap-3 p-3 rounded-lg shadow-lg animate-slide-in border ${getAlertStyles(alert.level)}`}
        >
          {getAlertIcon(alert.category)}
          <span className="flex-1 text-sm font-medium">{alert.message}</span>
          <button
            onClick={() => handleDismiss(alert.id)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
