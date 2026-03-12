import { FastifyInstance } from 'fastify'
import { accountDataService } from '../services/account-data'
import { dbService } from '../services/db-service'
import { authMiddleware } from '../middleware/auth'

export async function accountRoutes(app: FastifyInstance) {
  // 获取账户信息 - 需要认证
  app.get('/', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    const userId = request.user?.userId
    if (!userId) {
      reply.code(401)
      return { error: '未认证' }
    }
    
    // 先尝试获取账户
    let account = await accountDataService.getAccount(userId)
    
    if (!account) {
      // 账户不存在，创建默认账户
      try {
        account = await accountDataService.initUser(userId, 1000000)
      } catch (err) {
        reply.code(500)
        return { error: '创建账户失败', message: (err as Error).message }
      }
    }
    
    return account
  })

  // 获取持仓列表 - 需要认证
  app.get('/positions', {
    preHandler: [authMiddleware]
  }, async (request) => {
    const userId = request.user?.userId!
    const positions = await accountDataService.getPositions(userId, 'OPEN')
    return positions
  })

  // 获取交易历史 - 需要认证
  app.get('/history', {
    preHandler: [authMiddleware]
  }, async (request) => {
    const userId = request.user?.userId!
    const { limit = '50', offset = '0' } = request.query as any
    return dbService.getTradeHistory(userId, parseInt(limit), parseInt(offset))
  })

  // 设置初始资金 - 需要认证
  app.post('/balance', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    const userId = request.user?.userId
    if (!userId) {
      reply.code(401)
      return { error: '未认证' }
    }

    const { amount } = request.body as { amount: number }
    
    if (amount < 500000 || amount > 30000000) {
      reply.code(400)
      return { error: '初始资金必须在 50万-3000万 之间' }
    }
    
    // 确保用户存在
    const user = await dbService.getUser(userId)
    if (!user) {
      await accountDataService.initUser(userId, amount)
    }
    
    const account = await accountDataService.updateBalance(userId, amount)
    return account
  })

  // 刷新账户缓存 - 需要认证
  app.post('/refresh', {
    preHandler: [authMiddleware]
  }, async (request) => {
    const userId = request.user?.userId!
    accountDataService.clearCache(userId)
    const account = await accountDataService.getAccount(userId)
    return account
  })
}
