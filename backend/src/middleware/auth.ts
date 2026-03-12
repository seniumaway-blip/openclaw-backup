import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { authService } from '../services/auth-service'

// 声明扩展 Fastify 请求类型
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string
      username: string
    }
  }
}

// JWT 认证中间件
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization
  
  if (!authHeader) {
    reply.code(401)
    return { error: '缺少认证令牌' }
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    reply.code(401)
    return { error: '认证格式错误，应为: Bearer <token>' }
  }

  const token = parts[1]
  const payload = authService.verifyAccessToken(token)

  if (!payload) {
    reply.code(401)
    return { error: '无效的认证令牌' }
  }

  // 将用户信息附加到请求
  request.user = {
    userId: payload.userId,
    username: payload.username,
  }
}

// 可选认证中间件（不阻止请求，但如果有 token 会解析）
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization
  
  if (!authHeader) {
    return
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return
  }

  const token = parts[1]
  const payload = authService.verifyAccessToken(token)

  if (payload) {
    request.user = {
      userId: payload.userId,
      username: payload.username,
    }
  }
}

// 注册认证钩子
export function registerAuthHooks(app: FastifyInstance) {
  // 添加装饰器
  app.decorateRequest('user', undefined)
}
