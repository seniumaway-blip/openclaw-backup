'use client'

import { Home, BarChart3, User } from 'lucide-react'
import { TradeArrows } from './icons'
import Link from 'next/link'

const navItems = [
  { id: 'home', label: '首页', icon: Home, href: '/' },
  { id: 'market', label: '行情', icon: BarChart3, href: '/market' },
  { id: 'trade', label: '交易', icon: TradeArrows, href: '/trade' },
  { id: 'profile', label: '我的', icon: User, href: '/profile' },
]

export default function BottomNav({ active }: { active: string }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-trade-card border-t border-trade-border">
      <div className="flex justify-around items-center h-16 max-w-4xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-6 py-2 ${
                isActive ? 'text-trade-primary' : 'text-trade-muted'
              }`}
            >
              <Icon size={20} />
              <span className="text-xs">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
