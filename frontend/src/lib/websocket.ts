import { io, Socket } from 'socket.io-client'
import type { PairQuote } from '../../../shared/types'

class WebSocketService {
  private socket: Socket | null = null
  private listeners: Map<string, Set<(data: any) => void>> = new Map()
  private subscribedPairs: Set<string> = new Set()
  
  connect(url: string = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/market') {
    if (this.socket?.connected) return
    
    this.socket = io(url, {
      transports: ['websocket'],
      autoConnect: true,
    })
    
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected')
      // 重新订阅之前订阅的交易对
      this.subscribedPairs.forEach(pairId => {
        this.socket?.emit('subscribe', pairId)
      })
    })
    
    this.socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected')
    })
    
    this.socket.on('quote', (quote: PairQuote) => {
      this.emit('quote', quote)
    })
    
    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error)
      this.emit('error', error)
    })
  }
  
  disconnect() {
    this.socket?.disconnect()
    this.socket = null
  }
  
  subscribe(pairId: string) {
    this.subscribedPairs.add(pairId)
    this.socket?.emit('subscribe', pairId)
  }
  
  unsubscribe(pairId: string) {
    this.subscribedPairs.delete(pairId)
    this.socket?.emit('unsubscribe', pairId)
  }
  
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }
  
  off(event: string, callback: (data: any) => void) {
    this.listeners.get(event)?.delete(callback)
  }
  
  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(callback => callback(data))
  }
  
  isConnected() {
    return this.socket?.connected ?? false
  }
}

export const wsService = new WebSocketService()
