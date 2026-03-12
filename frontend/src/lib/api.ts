const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// 获取存储的 Token
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('accessToken')
}

class ApiClient {
  private async request(path: string, options: RequestInit = {}) {
    const url = `${API_URL}${path}`
    const token = getAuthToken()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }))
      throw new Error(error.error || error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // ============ 认证 API ============
  async login(username: string, password: string) {
    const result = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    
    // 保存 Token
    if (result.tokens?.accessToken) {
      localStorage.setItem('accessToken', result.tokens.accessToken)
      localStorage.setItem('refreshToken', result.tokens.refreshToken)
    }
    
    return result
  }

  async register(username: string, password: string, email?: string) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    })
  }

  async refreshToken(refreshToken: string) {
    const result = await this.request('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })
    
    if (result.tokens?.accessToken) {
      localStorage.setItem('accessToken', result.tokens.accessToken)
    }
    
    return result
  }

  logout() {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
  }

  // ============ 行情 API ============
  async getPairs() {
    return this.request('/api/market/pairs')
  }

  async getQuote(pairId: string) {
    return this.request(`/api/market/quote/${pairId}`)
  }

  async getKline(pairId: string, timeframe = '1m', limit = 100) {
    return this.request(`/api/market/kline/${pairId}?timeframe=${timeframe}&limit=${limit}`)
  }

  async getMarketStatus() {
    return this.request('/api/market/status')
  }

  async getOrderBook(pairId: string, depth = 5) {
    return this.request(`/api/market/orderbook/${pairId}?depth=${depth}`)
  }

  // ============ 账户 API ============
  async getAccount() {
    return this.request('/api/account')
  }

  async getPositions() {
    return this.request('/api/account/positions')
  }

  async setBalance(amount: number) {
    return this.request('/api/account/balance', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    })
  }

  async getHistory(limit = 50, offset = 0) {
    return this.request(`/api/account/history?limit=${limit}&offset=${offset}`)
  }

  async refreshAccountCache() {
    return this.request('/api/account/refresh', {
      method: 'POST',
    })
  }

  // ============ 交易 API ============
  async openPosition(pairId: string, direction: 'LONG_SPREAD' | 'SHORT_SPREAD', volume: number, orderType = 'MARKET', limitPrice?: number) {
    return this.request('/api/trade/open', {
      method: 'POST',
      body: JSON.stringify({ pairId, direction, volume, orderType, limitPrice }),
    })
  }

  async closePosition(positionId: string, orderType = 'MARKET', limitPrice?: number) {
    return this.request('/api/trade/close', {
      method: 'POST',
      body: JSON.stringify({ positionId, orderType, limitPrice }),
    })
  }

  async cancelOrder(orderId: string) {
    return this.request('/api/trade/cancel', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    })
  }

  async getOrders(limit = 100) {
    return this.request(`/api/trade/orders?limit=${limit}`)
  }

  async getOrderDetail(orderId: string) {
    return this.request(`/api/trade/orders/${orderId}`)
  }

  // ============ 风控 API ============
  async getRiskStatus() {
    return this.request('/api/risk/status')
  }

  async getRiskConfig() {
    return this.request('/api/risk/config')
  }

  async checkCanTrade(orderVolume?: number) {
    return this.request('/api/risk/can-trade', {
      method: 'POST',
      body: JSON.stringify({ orderVolume }),
    })
  }

  async checkSpreadAnomaly(pairId: string, spread: number) {
    return this.request('/api/risk/check-spread', {
      method: 'POST',
      body: JSON.stringify({ pairId, spread }),
    })
  }

  async getMarketDataStatus() {
    return this.request('/api/risk/market-status')
  }

  async getRiskAlerts() {
    return this.request('/api/risk/alerts')
  }

  async clearRiskAlert(alertId: string) {
    return this.request('/api/risk/clear-alert', {
      method: 'POST',
      body: JSON.stringify({ alertId }),
    })
  }
}

export const api = new ApiClient()
