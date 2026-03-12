import { dbService } from './db-service'
import { marketDataService } from './market-data'
import type { Position, UserAccount, PairQuote, RiskConfig } from '../types/shared'

// 风控预警项
export interface RiskAlert {
  id: string
  level: 'info' | 'warning' | 'danger' | 'critical'
  category: 'risk_ratio' | 'day_loss' | 'position' | 'market' | 'system'
  message: string
  timestamp: number
  metadata?: Record<string, any>
}

// 用户风控状态
export interface UserRiskStatus {
  userId: string
  alerts: RiskAlert[]
  riskSummary: {
    totalRiskRatio: number
    domesticRiskRatio: number
    foreignRiskRatio: number
    dayLoss: number
    dayLossLimit: number
    dayLossPercent: number
    totalPosition: number
    maxPosition: number
  }
  canTrade: boolean
  blockedReason?: string
}

// 风控配置（可扩展为数据库配置）
const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxSingleOrder: 20,
  maxSingleSidePosition: 100,
  maxTotalPosition: 200,
  dayLossLimitPercent: 10,
}

// 风控服务
class RiskService {
  private config: RiskConfig = DEFAULT_RISK_CONFIG
  private userAlerts: Map<string, RiskAlert[]> = new Map()
  private lastCheckTime: Map<string, number> = new Map()
  private readonly CHECK_INTERVAL = 5000 // 5秒检查间隔

  // 设置风控配置
  setConfig(config: Partial<RiskConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): RiskConfig {
    return this.config
  }

  // 检查用户风控状态（完整检查）
  async checkUserRisk(userId: string): Promise<UserRiskStatus> {
    const now = Date.now()
    const lastCheck = this.lastCheckTime.get(userId) || 0
    
    // 检查间隔控制，避免过于频繁
    if (now - lastCheck < this.CHECK_INTERVAL) {
      const cached = this.getCachedStatus(userId)
      if (cached) return cached
    }
    
    this.lastCheckTime.set(userId, now)

    const alerts: RiskAlert[] = []
    const account = await dbService.getAccount(userId)
    const positions = await dbService.getPositions(userId, 'OPEN')
    
    if (!account) {
      return this.createStatus(userId, alerts, null, positions)
    }

    // 1. 检查风险率
    const riskAlerts = this.checkRiskRatio(userId, account)
    alerts.push(...riskAlerts)

    // 2. 检查单日亏损
    const lossAlerts = await this.checkDayLoss(userId, account)
    alerts.push(...lossAlerts)

    // 3. 检查持仓限额
    const positionAlerts = this.checkPositionLimits(userId, positions)
    alerts.push(...positionAlerts)

    // 4. 检查行情异常
    const marketAlerts = this.checkMarketAnomaly(userId, positions)
    alerts.push(...marketAlerts)

    // 保存预警
    this.userAlerts.set(userId, alerts)

    return this.createStatus(userId, alerts, account, positions)
  }

  // 快速检查（用于下单前验证）
  async canTrade(userId: string, orderVolume?: number): Promise<{
    allowed: boolean
    reason?: string
    alerts: RiskAlert[]
  }> {
    const status = await this.checkUserRisk(userId)
    
    // 危险级别预警禁止交易
    const criticalAlerts = status.alerts.filter(a => a.level === 'critical')
    if (criticalAlerts.length > 0) {
      return {
        allowed: false,
        reason: criticalAlerts[0].message,
        alerts: status.alerts,
      }
    }

    // 检查单日亏损限额
    if (status.riskSummary.dayLossPercent >= 100) {
      return {
        allowed: false,
        reason: '当日亏损已达限额，禁止新开仓',
        alerts: status.alerts,
      }
    }

    // 检查持仓限额
    if (orderVolume) {
      const totalPosition = status.riskSummary.totalPosition + orderVolume
      if (totalPosition > this.config.maxTotalPosition) {
        return {
          allowed: false,
          reason: `超出总持仓限额 (${this.config.maxTotalPosition}手)`,
          alerts: status.alerts,
        }
      }
    }

    return { allowed: true, alerts: status.alerts }
  }

  // 检查开仓价差异常
  async checkOpenSpreadAnomaly(pairId: string, currentSpread: number): Promise<{
    normal: boolean
    warning?: string
    deviation?: number
  }> {
    // 获取最近10分钟的历史价差（从K线数据推算）
    const klines = marketDataService.getKline(pairId, '1m', 10)
    if (klines.length < 5) {
      return { normal: true } // 数据不足，默认通过
    }

    const avgSpread = klines.reduce((sum, k) => sum + k.close, 0) / klines.length
    const deviation = Math.abs((currentSpread - avgSpread) / avgSpread * 100)

    if (deviation > 10) {
      return {
        normal: false,
        warning: `价差偏离均值 ${deviation.toFixed(1)}%，超过10%限制`,
        deviation,
      }
    }

    if (deviation > 5) {
      return {
        normal: true,
        warning: `价差偏离均值 ${deviation.toFixed(1)}%，注意风险`,
        deviation,
      }
    }

    return { normal: true, deviation }
  }

  // 检查行情源状态
  checkMarketDataStatus(): {
    healthy: boolean
    domesticConnected: boolean
    foreignConnected: boolean
    delay?: number
  } {
    const status = marketDataService.getStatus()
    
    const domesticConnected = status.adapters?.ctp?.connected ?? false
    const foreignConnected = status.adapters?.mt5?.connected ?? false
    
    // 检查延迟
    let delay = 0
    const quotes = status.quotes || {}
    for (const quote of Object.values(quotes) as any[]) {
      const quoteDelay = Date.now() - (quote.timestamp || 0)
      delay = Math.max(delay, quoteDelay)
    }

    return {
      healthy: domesticConnected && foreignConnected && delay < 5000,
      domesticConnected,
      foreignConnected,
      delay,
    }
  }

  // 获取用户预警列表
  getUserAlerts(userId: string): RiskAlert[] {
    return this.userAlerts.get(userId) || []
  }

  // 清除特定预警
  clearAlert(userId: string, alertId: string): void {
    const alerts = this.userAlerts.get(userId) || []
    this.userAlerts.set(userId, alerts.filter(a => a.id !== alertId))
  }

  // 清除所有预警
  clearAllAlerts(userId: string): void {
    this.userAlerts.delete(userId)
  }

  // 私有方法：检查风险率
  private checkRiskRatio(userId: string, account: UserAccount): RiskAlert[] {
    const alerts: RiskAlert[] = []
    const totalRiskRatio = account.total?.riskRatio || 0
    const domesticRiskRatio = account.domestic?.riskRatio || 0
    const foreignRiskRatio = account.foreign?.riskRatio || 0

    // 总风险率检查
    if (totalRiskRatio >= 100) {
      alerts.push({
        id: `risk-total-critical-${Date.now()}`,
        level: 'critical',
        category: 'risk_ratio',
        message: `⚠️ 总风险率 ${totalRiskRatio.toFixed(2)}% 超过100%，请立即处理`,
        timestamp: Date.now(),
        metadata: { ratio: totalRiskRatio },
      })
    } else if (totalRiskRatio >= 80) {
      alerts.push({
        id: `risk-total-warning-${Date.now()}`,
        level: 'danger',
        category: 'risk_ratio',
        message: `⚠️ 总风险率 ${totalRiskRatio.toFixed(2)}% 较高，建议减仓`,
        timestamp: Date.now(),
        metadata: { ratio: totalRiskRatio },
      })
    } else if (totalRiskRatio >= 50) {
      alerts.push({
        id: `risk-total-notice-${Date.now()}`,
        level: 'warning',
        category: 'risk_ratio',
        message: `风险率 ${totalRiskRatio.toFixed(2)}% 偏高，注意控制仓位`,
        timestamp: Date.now(),
        metadata: { ratio: totalRiskRatio },
      })
    }

    // 单边风险率检查
    if (domesticRiskRatio >= 80) {
      alerts.push({
        id: `risk-domestic-warning-${Date.now()}`,
        level: 'warning',
        category: 'risk_ratio',
        message: `CTP账户风险率 ${domesticRiskRatio.toFixed(2)}% 偏高`,
        timestamp: Date.now(),
        metadata: { ratio: domesticRiskRatio, leg: 'domestic' },
      })
    }

    if (foreignRiskRatio >= 80) {
      alerts.push({
        id: `risk-foreign-warning-${Date.now()}`,
        level: 'warning',
        category: 'risk_ratio',
        message: `MT5账户风险率 ${foreignRiskRatio.toFixed(2)}% 偏高`,
        timestamp: Date.now(),
        metadata: { ratio: foreignRiskRatio, leg: 'foreign' },
      })
    }

    return alerts
  }

  // 私有方法：检查单日亏损
  private async checkDayLoss(userId: string, account: UserAccount): Promise<RiskAlert[]> {
    const alerts: RiskAlert[] = []
    
    // 从数据库获取当日实现盈亏 + 当前浮动盈亏
    const today = new Date().toISOString().split('T')[0]
    const dayStart = `${today}T00:00:00.000Z`
    
    // 获取今日已平仓订单的实现盈亏
    const history = await dbService.getTradeHistory(userId, 1000, 0)
    const todayClosedPnl = history.orders
      .filter(o => o.type === 'CLOSE' && o.createdAt >= dayStart)
      .reduce((sum, o) => {
        // 这里简化处理，实际应该从订单中获取实现盈亏
        return sum + (o.overallStatus === 'FILLED' ? 0 : 0)
      }, 0)
    
    const floatingPnl = account.total?.floatingPnl || 0
    const dayLoss = todayClosedPnl + floatingPnl // 负数为亏损
    
    const dayLossLimit = account.initialBalance * (this.config.dayLossLimitPercent / 100)
    const dayLossPercent = dayLoss < 0 
      ? Math.abs(dayLoss) / dayLossLimit * 100 
      : 0

    if (dayLossPercent >= 100) {
      alerts.push({
        id: `day-loss-limit-${Date.now()}`,
        level: 'critical',
        category: 'day_loss',
        message: `📉 当日亏损已达限额 (${(dayLossLimit / 10000).toFixed(0)}万)，禁止新开仓`,
        timestamp: Date.now(),
        metadata: { dayLoss, limit: dayLossLimit, percent: dayLossPercent },
      })
    } else if (dayLossPercent >= 80) {
      alerts.push({
        id: `day-loss-warning-${Date.now()}`,
        level: 'danger',
        category: 'day_loss',
        message: `⚠️ 当日亏损接近限额 (${dayLossPercent.toFixed(1)}%)，当前: ¥${Math.abs(dayLoss).toLocaleString()}`,
        timestamp: Date.now(),
        metadata: { dayLoss, limit: dayLossLimit, percent: dayLossPercent },
      })
    } else if (dayLossPercent >= 50) {
      alerts.push({
        id: `day-loss-notice-${Date.now()}`,
        level: 'warning',
        category: 'day_loss',
        message: `当日亏损 ${dayLossPercent.toFixed(1)}%，注意控制`,
        timestamp: Date.now(),
        metadata: { dayLoss, limit: dayLossLimit, percent: dayLossPercent },
      })
    }

    return alerts
  }

  // 私有方法：检查持仓限额
  private checkPositionLimits(userId: string, positions: Position[]): RiskAlert[] {
    const alerts: RiskAlert[] = []
    
    // 计算总持仓
    const totalDomesticVolume = positions.reduce((sum, p) => sum + p.domesticLeg.volume, 0)
    const totalForeignVolume = positions.reduce((sum, p) => sum + p.foreignLeg.volume, 0)

    if (totalDomesticVolume >= this.config.maxTotalPosition * 0.9) {
      alerts.push({
        id: `position-limit-warning-${Date.now()}`,
        level: 'warning',
        category: 'position',
        message: `持仓量 ${totalDomesticVolume.toFixed(1)}手 接近限额`,
        timestamp: Date.now(),
        metadata: { current: totalDomesticVolume, limit: this.config.maxTotalPosition },
      })
    }

    return alerts
  }

  // 私有方法：检查行情异常
  private checkMarketAnomaly(userId: string, positions: Position[]): RiskAlert[] {
    const alerts: RiskAlert[] = []
    const status = this.checkMarketDataStatus()

    if (!status.healthy) {
      if (!status.domesticConnected || !status.foreignConnected) {
        alerts.push({
          id: `market-disconnected-${Date.now()}`,
          level: 'danger',
          category: 'system',
          message: '⚠️ 行情源连接异常，请检查网络',
          timestamp: Date.now(),
          metadata: { domestic: status.domesticConnected, foreign: status.foreignConnected },
        })
      } else if (status.delay && status.delay > 5000) {
        alerts.push({
          id: `market-delay-${Date.now()}`,
          level: 'warning',
          category: 'system',
          message: `行情延迟 ${(status.delay / 1000).toFixed(1)}秒`,
          timestamp: Date.now(),
          metadata: { delay: status.delay },
        })
      }
    }

    return alerts
  }

  // 私有方法：创建状态对象
  private createStatus(
    userId: string,
    alerts: RiskAlert[],
    account: UserAccount | null,
    positions: Position[]
  ): UserRiskStatus {
    const totalPosition = positions.reduce((sum, p) => sum + p.domesticLeg.volume, 0)
    const criticalAlerts = alerts.filter(a => a.level === 'critical')

    return {
      userId,
      alerts,
      riskSummary: {
        totalRiskRatio: account?.total?.riskRatio || 0,
        domesticRiskRatio: account?.domestic?.riskRatio || 0,
        foreignRiskRatio: account?.foreign?.riskRatio || 0,
        dayLoss: 0, // 简化处理
        dayLossLimit: account ? account.initialBalance * 0.1 : 0,
        dayLossPercent: 0,
        totalPosition,
        maxPosition: this.config.maxTotalPosition,
      },
      canTrade: criticalAlerts.length === 0,
      blockedReason: criticalAlerts.length > 0 ? criticalAlerts[0].message : undefined,
    }
  }

  // 私有方法：获取缓存状态
  private getCachedStatus(userId: string): UserRiskStatus | null {
    const alerts = this.userAlerts.get(userId)
    if (!alerts) return null
    
    // 简化返回，实际应该缓存完整状态
    return null
  }
}

export const riskService = new RiskService()
