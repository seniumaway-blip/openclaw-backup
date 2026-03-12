import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { tradeService } from '../services/trade-service'
import { accountDataService } from '../services/account-data'
import { dbService } from '../services/db-service'
import { authMiddleware } from '../middleware/auth'

export async function tradeRoutes(app: FastifyInstance) {
  // 开仓 - 需要认证
  app.post('/open', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    const userId = request.user?.userId
    if (!userId) {
      reply.code(401)
      return { error: '未认证' }
    }

    const { pairId, direction, volume, orderType = 'MARKET', limitPrice } = request.body as any
    
    if (!pairId || !direction || !volume) {
      reply.code(400)
      return { error: '缺少必要参数' }
    }
    
    if (direction !== 'LONG_SPREAD' && direction !== 'SHORT_SPREAD') {
      reply.code(400)
      return { error: '方向必须是 LONG_SPREAD 或 SHORT_SPREAD' }
    }

    // 确保用户存在
    let user = await dbService.getUser(userId)
    if (!user) {
      await accountDataService.initUser(userId, 1000000)
    }
    
    const result = await tradeService.openPosition(
      userId,
      pairId,
      direction,
      parseFloat(volume),
      orderType,
      limitPrice ? parseFloat(limitPrice) : undefined
    )
    
    if (!result.success) {
      reply.code(400)
      return { error: result.message || '开仓失败', order: result.order }
    }
    
    return result
  })

  // 平仓 - 需要认证
  app.post('/close', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    const userId = request.user?.userId
    if (!userId) {
      reply.code(401)
      return { error: '未认证' }
    }

    const { positionId, orderType = 'MARKET', limitPrice } = request.body as any
    
    if (!positionId) {
      reply.code(400)
      return { error: '缺少必要参数' }
    }
    
    const result = await tradeService.closePosition(
      userId,
      positionId,
      orderType,
      limitPrice ? parseFloat(limitPrice) : undefined
    )
    
    if (!result.success) {
      reply.code(400)
      return { error: result.message || '平仓失败', order: result.order }
    }
    
    return result
  })

  // 撤单 - 需要认证
  app.post('/cancel', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    const userId = request.user?.userId
    if (!userId) {
      reply.code(401)
      return { error: '未认证' }
    }

    const { orderId } = request.body as any
    
    if (!orderId) {
      reply.code(400)
      return { error: '缺少必要参数' }
    }
    
    const result = await tradeService.cancelOrder(userId, orderId)
    
    if (!result.success) {
      reply.code(400)
      return { error: result.message || '撤单失败' }
    }
    
    return result
  })

  // 获取订单簿 - 公开
  app.get('/orderbook/:pairId', async (request) => {
    const { pairId } = request.params as { pairId: string }
    return tradeService.getOrderBook(pairId)
  })

  // 获取订单历史 - 需要认证
  app.get('/orders', {
    preHandler: [authMiddleware]
  }, async (request) => {
    const userId = request.user?.userId!
    const { limit = '100' } = request.query as any
    return tradeService.getOrders(userId, parseInt(limit))
  })

  // 获取单个订单详情 - 需要认证
  app.get('/orders/:orderId', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    const userId = request.user?.userId
    const { orderId } = request.params as { orderId: string }
    
    const order = await tradeService.getOrderById(orderId)
    
    if (!order) {
      reply.code(404)
      return { error: '订单不存在' }
    }
    
    // 检查权限
    if (order.userId !== userId) {
      reply.code(403)
      return { error: '无权查看此订单' }
    }
    
    return order
  })
}
