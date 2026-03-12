import { FastifyInstance } from 'fastify'
import { authService } from '../services/auth-service'

export async function authRoutes(app: FastifyInstance) {
  // 注册
  app.post('/register', async (request, reply) => {
    const { username, password, email, initialBalance } = request.body as any
    
    const result = await authService.register(username, password, email, initialBalance)
    
    if (!result.success) {
      reply.code(400)
      return { error: result.message }
    }
    
    return { success: true, user: result.user }
  })

  // 登录
  app.post('/login', async (request, reply) => {
    const { username, password } = request.body as any
    
    if (!username || !password) {
      reply.code(400)
      return { error: '用户名和密码不能为空' }
    }
    
    const result = await authService.login(username, password)
    
    if (!result.success) {
      reply.code(401)
      return { error: result.message }
    }
    
    return {
      success: true,
      tokens: result.tokens,
      user: result.user,
    }
  })

  // 刷新 Token
  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as any
    
    if (!refreshToken) {
      reply.code(400)
      return { error: '缺少 refreshToken' }
    }
    
    const result = await authService.refreshToken(refreshToken)
    
    if (!result.success) {
      reply.code(401)
      return { error: result.message }
    }
    
    return {
      success: true,
      tokens: result.tokens,
    }
  })

  // 修改密码（需要认证）
  app.post('/change-password', async (request, reply) => {
    const { userId, oldPassword, newPassword } = request.body as any
    
    if (!userId || !oldPassword || !newPassword) {
      reply.code(400)
      return { error: '缺少必要参数' }
    }
    
    const result = await authService.changePassword(userId, oldPassword, newPassword)
    
    if (!result.success) {
      reply.code(400)
      return { error: result.message }
    }
    
    return { success: true, message: result.message }
  })
}
