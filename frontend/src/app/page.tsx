'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useTradeStore, api } from '@/lib'
import BottomNav from '@/components/BottomNav'
import RiskAlerts from '@/components/RiskAlerts'

export default function Home() {
  const { account, setAccount, userId } = useTradeStore()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (userId) {
      loadAccount()
    }
  }, [userId])

  const loadAccount = async () => {
    setLoading(true)
    try {
      const data = await api.getAccount(userId!)
      setAccount(data)
    } catch (error) {
      console.error('Failed to load account:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (n: number) => `¥${n?.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) || '0.00'}`

  return (
    <main className="pb-20">
      <RiskAlerts />
      
      <header className="flex justify-between items-center p-4 border-b border-trade-border">
        <h1 className="text-lg font-bold">账户概览</h1>
        <div className="text-sm text-trade-muted">
          {userId} <span className="text-trade-warning">未设置邮箱</span>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* 刷新按钮 */}
        <div className="flex justify-between items-center">
          <button 
            onClick={loadAccount}
            disabled={loading}
            className="flex items-center gap-1 text-trade-muted text-sm hover:text-trade-text"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 
            刷新
          </button>
          <div className="text-sm text-trade-muted">
            当前用户: {userId} | <button className="text-trade-primary">退出</button>
          </div>
        </div>

        {account ? (
          <div className="grid grid-cols-3 gap-3">
            {/* 账户汇总 */}
            <div className="bg-trade-card rounded-lg p-4 border border-trade-border">
              <h3 className="text-trade-muted text-sm mb-3">账户汇总</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-trade-muted">权益</div>
                  <div className="text-trade-up font-mono font-bold">{formatMoney(account.total?.equity)}</div>
                </div>
                <div>
                  <div className="text-xs text-trade-muted">余额</div>
                  <div className="text-trade-up font-mono">{formatMoney(account.domestic?.balance + account.foreign?.balance * 7.2)}</div>
                </div>
                <div>
                  <div className="text-xs text-trade-muted">浮动盈亏</div>
                  <div className={`font-mono ${account.total?.floatingPnl >= 0 ? 'text-trade-up' : 'text-trade-down'}`}>
                    {account.total?.floatingPnl >= 0 ? '+' : ''}{account.total?.floatingPnl?.toFixed(2) || '0.00'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-trade-muted">风险率</div>
                  <div className="font-mono">{account.total?.riskRatio?.toFixed(2) || '0.00'}%</div>
                </div>
              </div>
            </div>

            {/* CTP 账户 */}
            <div className="bg-trade-card rounded-lg p-4 border border-trade-border">
              <h3 className="text-trade-primary text-sm mb-3">CTP</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-trade-muted">权益</div>
                  <div className="text-trade-up font-mono font-bold">{formatMoney(account.domestic?.equity)}</div>
                </div>
                <div>
                  <div className="text-xs text-trade-muted">余额</div>
                  <div className="text-trade-up font-mono">{formatMoney(account.domestic?.balance)}</div>
                </div>
                <div>
                  <div className="text-xs text-trade-muted">风险率</div>
                  <div className={`font-mono ${account.domestic?.riskRatio > 80 ? 'text-trade-down' : 'text-trade-warning'}`}>
                    {account.domestic?.riskRatio?.toFixed(2) || '0.00'}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-trade-muted">总持仓手数</div>
                  <div className="font-mono">{account.domestic?.positions?.toFixed(2) || '0.00'}</div>
                </div>
              </div>
            </div>

            {/* MT5 账户 */}
            <div className="bg-trade-card rounded-lg p-4 border border-trade-border">
              <h3 className="text-trade-primary text-sm mb-3">MT5</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-trade-muted">权益</div>
                  <div className="text-trade-up font-mono font-bold">{formatMoney(account.foreign?.equity * 7.2)}</div>
                </div>
                <div>
                  <div className="text-xs text-trade-muted">余额</div>
                  <div className="text-trade-up font-mono">{formatMoney(account.foreign?.balance * 7.2)}</div>
                </div>
                <div>
                  <div className="text-xs text-trade-muted">风险率</div>
                  <div className={`font-mono ${account.foreign?.riskRatio > 80 ? 'text-trade-down' : 'text-trade-warning'}`}>
                    {account.foreign?.riskRatio?.toFixed(2) || '0.00'}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-trade-muted">总持仓手数</div>
                  <div className="font-mono">{account.foreign?.positions?.toFixed(2) || '0.00'}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-trade-muted">
            加载中...
          </div>
        )}
      </div>

      <BottomNav active="home" />
    </main>
  )
}
