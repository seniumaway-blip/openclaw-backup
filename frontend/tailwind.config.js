/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 交易专用色板
        trade: {
          bg: '#0F172A',           // 深蓝黑背景
          card: '#1E293B',         // 卡片背景
          border: '#334155',       // 边框
          text: '#F8FAFC',         // 主文字
          muted: '#94A3B8',        // 次文字
          up: '#22C55E',           // 涨 - 柔和绿
          down: '#EF4444',         // 跌 - 柔和红
          primary: '#3B82F6',      // 主色 - 蓝
          warning: '#F59E0B',      // 警告
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
