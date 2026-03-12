'use client'

import { RefreshCw, User, LogOut } from 'lucide-react'

export default function AccountSummary() {
  // Mock 数据
  const account = {
    total: {
      equity: 648890.16,
      balance: 648890.16,
      floatingPnl: 0,
      riskRatio: 0,
    },
    domestic: {
      name: '模拟CTP-001',
      equity: 485495.85,
      balance: 485495.85,
      floatingPnl: 0,
      riskRatio: 0,
      positions: 0,
    },
    foreign: {
      name: '模拟MT5-001',
      equity: 163394.31,
      balance: 163394.31,
      floatingPnl: 0,
      riskRatio: 0,
      positions: 0,
    },
  }

  const formatMoney = (n: number) => `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`

  return (
    <div className="p-4 space-y-4">
      {/* 刷新按钮 */}
      <div className="flex justify-between items-center">
        <button className="flex items-center gap-1 text-trade-muted text-sm">
          <RefreshCw size={14} /> 刷新
        </button>
        <div className="text-sm text-trade-muted">
          当前用户: bcg | <button className="text-trade-primary">退出</button>
        </div>
      </div>

      {/* 三栏账户卡片 */}
      <div className="grid grid-cols-3 gap-3">
        {/* 账户汇总 */}
        <div className="bg-trade-card rounded-lg p-4 border border-trade-border">
          <h3 className="text-trade-muted text-sm mb-3">账户汇总</h3>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-trade-muted">权益</div>
              <div className="text-trade-up font-mono font-bold">{formatMoney(account.total.equity)}</div>
            </div>
            <div>
              <div className="text-xs text-trade-muted">余额</div>
              <div className="text-trade-up font-mono">{formatMoney(account.total.balance)}</div>
            </div>
            <div>
              <div className="text-xs text-trade-muted">浮动盈亏</div>
              <div className="font-mono">{account.total.floatingPnl.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-trade-muted">风险率</div>
              <div className="font-mono">-</div>
            </div>
          </div>
        </div>

        {/* CTP 账户 */}
        <div className="bg-trade-card rounded-lg p-4 border border-trade-border">
          <h3 className="text-trade-primary text-sm mb-3">CTP</h3>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-trade-muted">权益</div>
              <div className="text-trade-up font-mono font-bold">{formatMoney(account.domestic.equity)}</div>
            </div>
            <div>
              <div className="text-xs text-trade-muted">余额</div>
              <div className="text-trade-up font-mono">{formatMoney(account.domestic.balance)}</div>
            </div>
            <div>
              <div className="text-xs text-trade-muted">风险率</div>
              <div className="text-trade-warning font-mono">{account.domestic.riskRatio.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-xs text-trade-muted">总持仓手数</div>
              <div className="font-mono">{account.domestic.positions.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* MT5 账户 */}
        <div className="bg-trade-card rounded-lg p-4 border border-trade-border">
          <h3 className="text-trade-primary text-sm mb-3">MT5</h3>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-trade-muted">权益</div>
              <div className="text-trade-up font-mono font-bold">{formatMoney(account.foreign.equity)}</div>
            </div>
            <div>
              <div className="text-xs text-trade-muted">余额</div>
              <div className="text-trade-up font-mono">{formatMoney(account.foreign.balance)}</div>
            </div>
            <div>
              <div className="text-xs text-trade-muted">风险率</div>
              <div className="text-trade-warning font-mono">{account.foreign.riskRatio.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-xs text-trade-muted">总持仓手数</div>
              <div className="font-mono">{account.foreign.positions.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
