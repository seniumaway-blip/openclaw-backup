'use client'

import { useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { useTradeStore, api } from '@/lib'

export default function ProfilePage() {
  const { account, userId, setAccount } = useTradeStore()
  const [balance, setBalance] = useState(1000000)
  const [saving, setSaving] = useState(false)
  
  const [riskSettings, setRiskSettings] = useState({
    maxSingleOrder: 20,
    maxPosition: 100,
    dayLossLimit: 10,
  })

  const handleSaveBalance = async () => {
    if (balance < 500000 || balance > 30000000) {
      alert('初始资金必须在 50万-3000万 之间')
      return
    }
    
    setSaving(true)
    try {
      const updated = await api.setBalance(userId!, balance)
      setAccount(updated)
      alert('资金设置已更新')
    } catch (error: any) {
      alert(`更新失败: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="pb-20">
      <header className="p-4 border-b border-trade-border">
        <h1 className="text-lg font-bold">我的</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* 用户信息 */}
        <div className="bg-trade-card rounded-lg p-4 border border-trade-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-trade-primary flex items-center justify-center text-xl">
              👤
            </div>
            <div>
              <div className="font-bold">{userId}</div>
              <div className="text-sm text-trade-muted">ID: 10001 | 虚拟盘</div>
            </div>
          </div>
        </div>

        {/* 资金设置 */}
        <div className="bg-trade-card rounded-lg p-4 border border-trade-border">
          <h3 className="font-bold mb-3">虚拟资金设置</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-trade-muted">初始资金 (50万-3000万)</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  value={balance}
                  onChange={(e) => setBalance(Number(e.target.value))}
                  className="flex-1 bg-trade-bg border border-trade-border rounded px-3 py-2 text-right"
                  min={500000}
                  max={30000000}
                  step={100000}
                />
                <button 
                  onClick={handleSaveBalance}
                  disabled={saving}
                  className="bg-trade-primary text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  {saving ? '保存中...' : '更新'}
                </button>
              </div>
            </div>
            <div className="text-xs text-trade-muted">
              境内账户: ¥{(balance * 0.75).toLocaleString()}
              <br />
              境外账户: ${(balance * 0.25 / 7.2).toFixed(2)}
            </div>
          </div>
        </div>

        {/* 风控设置 */}
        <div className="bg-trade-card rounded-lg p-4 border border-trade-border">
          <h3 className="font-bold mb-3">风控设置</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-trade-muted">单笔最大手数</span>
                <span>{riskSettings.maxSingleOrder} 手</span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                value={riskSettings.maxSingleOrder}
                onChange={(e) => setRiskSettings({ ...riskSettings, maxSingleOrder: Number(e.target.value) })}
                className="w-full mt-2 accent-trade-primary"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm">
                <span className="text-trade-muted">单边最大持仓</span>
                <span>{riskSettings.maxPosition} 手</span>
              </div>
              <input
                type="range"
                min={10}
                max={200}
                value={riskSettings.maxPosition}
                onChange={(e) => setRiskSettings({ ...riskSettings, maxPosition: Number(e.target.value) })}
                className="w-full mt-2 accent-trade-primary"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm">
                <span className="text-trade-muted">单日亏损限额</span>
                <span>{riskSettings.dayLossLimit}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={30}
                value={riskSettings.dayLossLimit}
                onChange={(e) => setRiskSettings({ ...riskSettings, dayLossLimit: Number(e.target.value) })}
                className="w-full mt-2 accent-trade-primary"
              />
            </div>
          </div>
        </div>

        {/* 真实账户接入（预留） */}
        <div className="bg-trade-card rounded-lg p-4 border border-trade-border">
          <h3 className="font-bold mb-3">真实账户接入</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-trade-bg rounded">
              <div>
                <div className="font-medium">CTP 实盘账户</div>
                <div className="text-sm text-trade-muted">未配置</div>
              </div>
              <button className="text-trade-primary text-sm border border-trade-primary px-3 py-1 rounded">配置</button>
            </div>
            <div className="flex justify-between items-center p-3 bg-trade-bg rounded">
              <div>
                <div className="font-medium">MT5 实盘账户</div>
                <div className="text-sm text-trade-muted">未配置</div>
              </div>
              <button className="text-trade-primary text-sm border border-trade-primary px-3 py-1 rounded">配置</button>
            </div>
          </div>
        </div>

        {/* 系统设置 */}
        <div className="bg-trade-card rounded-lg p-4 border border-trade-border">
          <h3 className="font-bold mb-3">系统</h3>
          <div className="space-y-2">
            <button 
              onClick={() => window.location.href = '/history'}
              className="w-full text-left p-3 bg-trade-bg rounded flex justify-between hover:bg-trade-border transition-colors"
            >
              <span>交易记录</span>
              <span className="text-trade-muted">→</span>
            </button>
            <button className="w-full text-left p-3 bg-trade-bg rounded flex justify-between hover:bg-trade-border transition-colors">
              <span>资金流水</span>
              <span className="text-trade-muted">→</span>
            </button>
            <button className="w-full text-left p-3 bg-trade-bg rounded flex justify-between hover:bg-trade-border transition-colors">
              <span>关于系统</span>
              <span className="text-trade-muted">→</span>
            </button>
          </div>
        </div>

        {/* 登出 */}
        <button className="w-full bg-trade-down text-white py-3 rounded-lg font-bold hover:opacity-90 transition-opacity">
          退出登录
        </button>
      </div>

      <BottomNav active="profile" />
    </main>
  )
}
