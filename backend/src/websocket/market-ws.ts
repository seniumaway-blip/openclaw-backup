import { FastifyInstance } from 'fastify'
import { Server } from 'socket.io'
import { marketDataService } from '../services/market-data'

export async function setupWebSocket(app: FastifyInstance) {
  // 确保行情服务已初始化
  await marketDataService.init()

  const io = new Server(app.server, {
    cors: {
      origin: '*',
    },
  })

  // 行情推送命名空间
  const marketNamespace = io.of('/market')

  // 监听聚合器行情推送
  marketDataService.onQuote((quote) => {
    // 推送到所有订阅了该交易对的客户端
    marketNamespace.to(quote.pairId).emit('quote', quote)
  })

  marketNamespace.on('connection', (socket) => {
    console.log('📡 Client connected to market feed')

    // 当前订阅的交易对
    let subscribedPair: string | null = null

    socket.on('subscribe', (pairId: string) => {
      console.log(`📈 Subscribing to ${pairId}`)
      
      // 如果已订阅其他交易对，先取消
      if (subscribedPair && subscribedPair !== pairId) {
        socket.leave(subscribedPair)
      }
      
      subscribedPair = pairId
      socket.join(pairId)
      
      // 立即发送一次数据
      const quote = marketDataService.getQuote(pairId)
      if (quote) {
        socket.emit('quote', quote)
      } else {
        socket.emit('error', { message: 'Quote not available' })
      }
    })

    socket.on('unsubscribe', (pairId: string) => {
      socket.leave(pairId)
      if (subscribedPair === pairId) {
        subscribedPair = null
      }
    })

    socket.on('disconnect', () => {
      console.log('📡 Client disconnected')
    })
  })

  console.log('✅ WebSocket server ready on /market namespace')
}