import { useEffect } from 'react'
import { wsService } from './websocket'
import { useTradeStore } from './store'

export function useWebSocket() {
  const { selectedPair, setQuote } = useTradeStore()
  
  useEffect(() => {
    // 连接 WebSocket
    wsService.connect()
    
    // 监听行情推送
    const handleQuote = (quote: any) => {
      setQuote(quote.pairId, quote)
    }
    
    wsService.on('quote', handleQuote)
    
    return () => {
      wsService.off('quote', handleQuote)
    }
  }, [setQuote])
  
  useEffect(() => {
    // 订阅选中的交易对
    if (selectedPair) {
      wsService.subscribe(selectedPair)
    }
    
    return () => {
      if (selectedPair) {
        wsService.unsubscribe(selectedPair)
      }
    }
  }, [selectedPair])
  
  return {
    isConnected: wsService.isConnected()
  }
}
