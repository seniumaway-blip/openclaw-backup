import { FastifyInstance } from 'fastify'
import { marketDataService } from '../services/market-data'
import { tradeService } from '../services/trade-service'

export async function marketRoutes(app: FastifyInstance) {
  // 获取行情服务状态
  app.get('/status', async () => {
    return marketDataService.getStatus()
  })

  // 初始化行情服务（启动时调用）
  app.post('/init', async () => {
    await marketDataService.init()
    return { success: true, status: marketDataService.getStatus() }
  })

  // 获取交易对列表
  app.get('/pairs', async () => {
    return [
      {
        id: 'AU_SPREAD',
        name: '黄金极差',
        domesticSymbol: 'AU',
        foreignSymbol: 'XAUUSD',
        domesticExchange: 'SHFE',
        foreignExchange: 'LME',
        isActive: true,
      },
    ]
  })

  // 获取实时报价
  app.get('/quote/:pairId', async (request, reply) => {
    const { pairId } = request.params as { pairId: string }
    const quote = marketDataService.getQuote(pairId)
    
    if (!quote) {
      reply.code(404)
      return { error: '行情数据不可用' }
    }
    
    return quote
  })

  // 获取 K线数据
  app.get('/kline/:pairId', async (request) => {
    const { pairId } = request.params as { pairId: string }
    const { timeframe = '1m', limit = '100' } = request.query as any
    return marketDataService.getKline(pairId, timeframe, parseInt(limit))
  })

  // 获取订单簿
  app.get('/orderbook/:pairId', async (request) => {
    const { pairId } = request.params as { pairId: string }
    const { depth = '5' } = request.query as any
    const orderBook = tradeService.getOrderBook(pairId)
    
    return {
      bids: orderBook.bids.slice(0, parseInt(depth)),
      asks: orderBook.asks.slice(0, parseInt(depth)),
      timestamp: Date.now(),
    }
  })
}