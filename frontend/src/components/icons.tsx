'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'

// 这个组件修复了 lucide-react 中可能不存在的 TradeArrows 图标
export function TradeArrows({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7 17l5-5 5 5" />
      <path d="M7 7l5 5 5-5" />
    </svg>
  )
}

// 导出其他可能需要的图标
export { TrendingUp, TrendingDown }
