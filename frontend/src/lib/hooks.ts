import { useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useTradeStore } from '@/lib/store'

// 账户数据轮询 Hook
export function useAccountPolling(interval = 5000) {
  const { setAccount, setPositions, setOrders, setCanTrade, setBlockedReason, isLoggedIn } = useTradeStore()

  const fetchData = useCallback(async () => {
    if (!isLoggedIn) return

    try {
      // 并行获取账户数据
      const [account, positions, orders, riskStatus] = await Promise.all([
        api.getAccount().catch(() => null),
        api.getPositions().catch(() => []),
        api.getOrders(20).catch(() => []),
        api.getRiskStatus().catch(() => null),
      ])

      if (account) setAccount(account)
      if (positions) setPositions(positions)
      if (orders) setOrders(orders)
      
      // 更新风控状态
      if (riskStatus) {
        setCanTrade(riskStatus.canTrade)
        if (!riskStatus.canTrade && riskStatus.blockedReason) {
          setBlockedReason(riskStatus.blockedReason)
        }
      }
    } catch (err) {
      console.error('轮询数据失败:', err)
    }
  }, [isLoggedIn, setAccount, setPositions, setOrders, setCanTrade, setBlockedReason])

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, interval)
    return () => clearInterval(timer)
  }, [fetchData, interval])

  return { refresh: fetchData }
}

// 风控检查 Hook
export function useRiskCheck() {
  const { setRiskAlerts, setCanTrade, setBlockedReason } = useTradeStore()

  const checkRisk = useCallback(async () => {
    try {
      const status = await api.getRiskStatus()
      setRiskAlerts(status.alerts || [])
      setCanTrade(status.canTrade)
      setBlockedReason(status.blockedReason)
      return status
    } catch (err) {
      console.error('风控检查失败:', err)
      return null
    }
  }, [setRiskAlerts, setCanTrade, setBlockedReason])

  const checkCanTrade = useCallback(async (orderVolume?: number) => {
    try {
      const result = await api.checkCanTrade(orderVolume)
      return result
    } catch (err) {
      console.error('交易权限检查失败:', err)
      return { allowed: false, alerts: [], reason: '检查失败' }
    }
  }, [])

  const checkSpreadAnomaly = useCallback(async (pairId: string, spread: number) => {
    try {
      const result = await api.checkSpreadAnomaly(pairId, spread)
      return result
    } catch (err) {
      console.error('价差检查失败:', err)
      return { normal: true }
    }
  }, [])

  return { checkRisk, checkCanTrade, checkSpreadAnomaly }
}

// 交易执行 Hook
export function useTrade() {
  const { addOrder, addPosition, updatePosition, closePosition, setError } = useTradeStore()
  const { checkCanTrade, checkSpreadAnomaly } = useRiskCheck()

  const openPosition = useCallback(async (
    pairId: string,
    direction: 'LONG_SPREAD' | 'SHORT_SPREAD',
    volume: number
  ) => {
    try {
      // 1. 检查交易权限
      const canTradeResult = await checkCanTrade(volume)
      if (!canTradeResult.allowed) {
        setError(canTradeResult.reason || '当前无法交易')
        return { success: false, error: canTradeResult.reason }
      }

      // 2. 检查价差异常
      const quote = await api.getQuote(pairId)
      const spreadCheck = await checkSpreadAnomaly(pairId, quote.spread.value)
      if (!spreadCheck.normal) {
        // 警告但不阻止，由用户确认
        console.warn('价差异常:', spreadCheck.warning)
      }

      // 3. 执行开仓
      const result = await api.openPosition(pairId, direction, volume)
      
      if (result.success) {
        if (result.order) addOrder(result.order)
        if (result.position) addPosition(result.position)
        return { success: true, data: result }
      } else {
        setError(result.message || '开仓失败')
        return { success: false, error: result.message }
      }
    } catch (err: any) {
      setError(err.message || '开仓失败')
      return { success: false, error: err.message }
    }
  }, [checkCanTrade, checkSpreadAnomaly, addOrder, addPosition, setError])

  const closePosition = useCallback(async (positionId: string) => {
    try {
      const result = await api.closePosition(positionId)
      
      if (result.success) {
        if (result.order) addOrder(result.order)
        closePosition(positionId)
        return { success: true, data: result }
      } else {
        setError(result.message || '平仓失败')
        return { success: false, error: result.message }
      }
    } catch (err: any) {
      setError(err.message || '平仓失败')
      return { success: false, error: err.message }
    }
  }, [addOrder, closePosition, setError])

  const cancelOrder = useCallback(async (orderId: string) => {
    try {
      const result = await api.cancelOrder(orderId)
      return { success: true, data: result }
    } catch (err: any) {
      setError(err.message || '撤单失败')
      return { success: false, error: err.message }
    }
  }, [setError])

  return { openPosition, closePosition, cancelOrder }
}
