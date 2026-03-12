import Fastify from 'fastify'
import cors from '@fastify/cors'
import { marketRoutes } from './routes/market'
import { accountRoutes } from './routes/account'
import { tradeRoutes } from './routes/trade'
import { authRoutes } from './routes/auth'
import { riskRoutes } from './routes/risk'
import { setupWebSocket } from './websocket/market-ws'
import { dbService } from './services/db-service'
import { authService } from './services/auth-service'

const app = Fastify({
  logger: true
})

// 注册 CORS
app.register(cors, {
  origin: true,
  credentials: true
})

// 注册认证路由（公开）
app.register(authRoutes, { prefix: '/api/auth' })

// 注册其他路由
app.register(marketRoutes, { prefix: '/api/market' })
app.register(accountRoutes, { prefix: '/api/account' })
app.register(tradeRoutes, { prefix: '/api/trade' })
app.register(riskRoutes, { prefix: '/api/risk' })

// 设置 WebSocket
setupWebSocket(app).catch(err => {
  console.error('WebSocket 初始化失败:', err)
})

// 健康检查
app.get('/health', async () => {
  const dbConnected = await dbService.testConnection()
  return {
    status: 'ok',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  }
})

// 数据库详情检查
app.get('/health/db', async () => {
  const connected = await dbService.testConnection()
  return {
    connected,
    timestamp: new Date().toISOString(),
  }
})

const start = async () => {
  try {
    // 先检查数据库连接
    console.log('🔌 正在连接 PostgreSQL...')
    const dbConnected = await dbService.testConnection()
    
    if (!dbConnected) {
      console.log('⚠️ 数据库连接失败，使用内存模式运行（数据不会持久化）')
    } else {
      console.log('✅ 数据库连接成功')
    }
    
    await app.listen({ port: 3001, host: '0.0.0.0' })
    console.log('🚀 Server running on http://localhost:3001')
    console.log('📊 API 文档: http://localhost:3001/health')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
