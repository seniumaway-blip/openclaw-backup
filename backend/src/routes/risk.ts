import { FastifyInstance } from 'fastify'
import { riskService } from '../services/risk-service'
import { authMiddleware } from '../middleware/auth'

export async function riskRoutes(app: FastifyInstance) {
  // 获取风控状态 - 需要认证
  app.get('/status', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    const userId = request.user?.userId
    if (!userId) {
      reply.code(401)
      return { error: '未认证' }
    }

    const status = await riskService.checkUserRisk(userId)
    return status
  })

  // 检查是否可以交易 - 需要认证
  app.post('/can-trade', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    const userId = request.user?.userId
    if (!userId) {
      reply.code(401)
      return { error: '未认证' }
    }

    const { orderVolume } = request.body as { orderVolume?: number }
    const result = await riskService.canTrade(userId, orderVolume)
    return result
  })

  // 检查开仓价差 - 需要认证
  app.post('/check-spread', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    const { pairId, spread } = request.body as { pairId: string; spread: number }
    
    if (!pairId || spread === undefined) {
      reply.code(400)
      return { error: '缺少必要参数' }
    }

    const result = await riskService.checkOpenSpreadAnomaly(pairId, spread)
    return result
  })

  // 获取行情源状态 - 公开
  app.get('/market-status', async () => {
    return riskService.checkMarketDataStatus()
  })

  // 获取风控配置 - 公开（只读）
  app.get('/config', async () => {
    return riskService.getConfig()
  })

  // 清除预警 - 需要认证
  app.post('/clear-alert', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    const userId = request.user?.userId
    if (!userId) {
      reply.code(401)
      return { error: '未认证' }
    }

    const { alertId } = request.body as { alertId: string }
    riskService.clearAlert(userId, alertId)
    return { success: true }
  })

  // 获取用户预警列表 - 需要认证
  app.get('/alerts', {
    preHandler: [authMiddleware]
  }, async (request) => {
    const userId = request.user?.userId!
    const alerts = riskService.getUserAlerts(userId)
    return { alerts }
  })
}
