# 黄金跨市套利交易系统 - 快速开始

## 环境要求

- Node.js 18+
- PostgreSQL 14+ (可选，使用 mock 数据可不安装)
- Redis 7+ (可选，使用内存缓存可不安装)

## 安装步骤

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

### 2. 配置环境变量

```bash
# backend/.env
PORT=3001
NODE_ENV=development

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001/market
```

### 3. 启动服务

```bash
# 启动后端 (端口 3001)
cd backend
npm run dev

# 新终端 - 启动前端 (端口 3000)
cd frontend
npm run dev
```

### 4. 访问系统

打开浏览器访问: http://localhost:3000

## API 文档

### 行情接口

```
GET /api/market/pairs              # 获取交易对列表
GET /api/market/quote/:pairId      # 获取实时报价
GET /api/market/kline/:pairId      # 获取K线数据
```

### 账户接口

```
GET  /api/account/:userId          # 获取账户信息
GET  /api/account/:userId/positions # 获取持仓列表
POST /api/account/:userId/balance  # 设置初始资金
```

### 交易接口

```
POST /api/trade/open               # 开仓
POST /api/trade/close              # 平仓
GET  /api/trade/orders/:userId     # 获取订单历史
```

### WebSocket

```javascript
const socket = io('ws://localhost:3001/market')

// 订阅行情
socket.emit('subscribe', 'AU_SPREAD')

// 接收报价
socket.on('quote', (data) => {
  console.log(data)
})

// 取消订阅
socket.emit('unsubscribe', 'AU_SPREAD')
```

## 项目结构

```
trading-system/
├── frontend/          # Next.js 前端
│   ├── src/
│   │   ├── app/           # 页面
│   │   ├── components/    # 组件
│   │   └── lib/           # 工具函数
│   └── package.json
├── backend/           # Node.js API
│   ├── src/
│   │   ├── routes/        # 路由
│   │   ├── services/      # 业务逻辑
│   │   └── websocket/     # WebSocket
│   └── package.json
├── shared/            # 共享类型
└── docs/              # 文档
```

## 开发计划

- [x] 项目骨架搭建
- [x] UI 原型设计
- [x] Mock 数据服务
- [ ] 真实行情接入
- [ ] 交易引擎实现
- [ ] 用户认证系统
- [ ] 数据库持久化
- [ ] 真实账户 API 对接
