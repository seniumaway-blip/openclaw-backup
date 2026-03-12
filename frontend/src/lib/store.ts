import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PairQuote, Position, UserAccount, Order, RiskAlert } from '../../../shared/types'

interface AuthState {
  user: { id: string; username: string; email?: string } | null
  accessToken: string | null
  refreshToken: string | null
  isLoggedIn: boolean
  setAuth: (auth: { user: any; tokens: { accessToken: string; refreshToken: string } }) => void
  clearAuth: () => void
}

interface TradeState extends AuthState {
  // 账户数据
  account: UserAccount | null
  setAccount: (account: UserAccount) => void
  updateAccount: (updates: Partial<UserAccount>) => void
  
  // 行情数据
  quotes: Record<string, PairQuote>
  setQuote: (pairId: string, quote: PairQuote) => void
  getQuote: (pairId: string) => PairQuote | undefined
  
  // 持仓数据
  positions: Position[]
  setPositions: (positions: Position[]) => void
  addPosition: (position: Position) => void
  updatePosition: (id: string, updates: Partial<Position>) => void
  closePosition: (id: string) => void
  
  // 订单数据
  orders: Order[]
  setOrders: (orders: Order[]) => void
  addOrder: (order: Order) => void
  updateOrder: (id: string, updates: Partial<Order>) => void
  
  // 风控数据
  riskAlerts: RiskAlert[]
  setRiskAlerts: (alerts: RiskAlert[]) => void
  addRiskAlert: (alert: RiskAlert) => void
  removeRiskAlert: (id: string) => void
  clearRiskAlerts: () => void
  canTrade: boolean
  setCanTrade: (canTrade: boolean) => void
  blockedReason?: string
  setBlockedReason: (reason?: string) => void
  
  // 选中交易对
  selectedPair: string
  setSelectedPair: (pairId: string) => void
  
  // 加载状态
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  
  // 错误信息
  error: string | null
  setError: (error: string | null) => void
}

export const useTradeStore = create<TradeState>()(
  persist(
    (set, get) => ({
      // 初始状态
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoggedIn: false,
      account: null,
      quotes: {},
      positions: [],
      orders: [],
      riskAlerts: [],
      canTrade: true,
      blockedReason: undefined,
      selectedPair: 'AU_SPREAD',
      isLoading: false,
      error: null,
      
      // Auth Actions
      setAuth: ({ user, tokens }) => set({ 
        user, 
        accessToken: tokens.accessToken, 
        refreshToken: tokens.refreshToken,
        isLoggedIn: true 
      }),
      clearAuth: () => set({ 
        user: null, 
        accessToken: null, 
        refreshToken: null, 
        isLoggedIn: false,
        account: null,
        positions: [],
        orders: [],
      }),
      
      // Account Actions
      setAccount: (account) => set({ account }),
      updateAccount: (updates) => set((state) => ({
        account: state.account ? { ...state.account, ...updates } : null
      })),
      
      // Quote Actions
      setQuote: (pairId, quote) => set((state) => ({
        quotes: { ...state.quotes, [pairId]: quote }
      })),
      getQuote: (pairId) => get().quotes[pairId],
      
      // Position Actions
      setPositions: (positions) => set({ positions }),
      addPosition: (position) => set((state) => ({
        positions: [...state.positions, position]
      })),
      updatePosition: (id, updates) => set((state) => ({
        positions: state.positions.map(p => 
          p.id === id ? { ...p, ...updates } : p
        )
      })),
      closePosition: (id) => set((state) => ({
        positions: state.positions.filter(p => p.id !== id)
      })),
      
      // Order Actions
      setOrders: (orders) => set({ orders }),
      addOrder: (order) => set((state) => ({
        orders: [order, ...state.orders]
      })),
      updateOrder: (id, updates) => set((state) => ({
        orders: state.orders.map(o => 
          o.id === id ? { ...o, ...updates } : o
        )
      })),
      
      // Risk Actions
      setRiskAlerts: (alerts) => set({ riskAlerts: alerts }),
      addRiskAlert: (alert) => set((state) => ({
        riskAlerts: [...state.riskAlerts.filter(a => a.id !== alert.id), alert]
      })),
      removeRiskAlert: (id) => set((state) => ({
        riskAlerts: state.riskAlerts.filter(a => a.id !== id)
      })),
      clearRiskAlerts: () => set({ riskAlerts: [] }),
      setCanTrade: (canTrade) => set({ canTrade }),
      setBlockedReason: (reason) => set({ blockedReason: reason }),
      
      // Other Actions
      setSelectedPair: (pairId) => set({ selectedPair: pairId }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'trade-storage',
      partialize: (state) => ({ 
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        selectedPair: state.selectedPair 
      }),
    }
  )
)
