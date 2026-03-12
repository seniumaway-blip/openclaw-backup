import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '黄金跨市套利交易系统',
  description: '专业虚拟套利交易模拟平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-trade-bg text-trade-text min-h-screen">
        {children}
      </body>
    </html>
  )
}
