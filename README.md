# 黄金跨市套利交易系统 - 本地运行指南

## 方式一：一键启动（推荐测试）

### 1. 下载代码
```bash
cd /tmp
git clone https://github.com/yourname/trading-system.git
cd trading-system
```

### 2. 启动后端
```bash
cd trading-system/backend
npm install
npm run dev
```

看到以下日志表示成功：
```
✅ 行情源连接完成
✅ WebSocket server ready
🚀 Server running on http://localhost:3001
```

### 3. 启动前端（新开终端）
```bash
cd trading-system/frontend
npm install
npm run dev
```

看到以下日志表示成功：
```
✓ Ready in 1800ms
```

### 4. 访问
浏览器打开：http://localhost:3000

---

## 方式二：带数据库（数据持久化）

### 前置条件
- Docker 已安装

### 1. 启动 PostgreSQL
```bash
cd trading-system
docker-compose up -d postgres
```

### 2. 启动后端（会自动建表）
```bash
cd backend
npm install
npm run dev
```

### 3. 启动前端
```bash
cd frontend
npm install
npm run dev
```

---

## 快速测试

### 1. 注册账号
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"123456"}'
```

### 2. 登录获取 Token
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"123456"}'
```

返回：
```json
{
  "tokens": {
    "accessToken": "eyJhbG...",
    "refreshToken": "..."
  },
  "user": {"id":"U...","username":"demo"}
}
```

### 3. 获取行情
```bash
curl http://localhost:3001/api/market/quote/AU_SPREAD
```

### 4. 下单（替换 YOUR_TOKEN）
```bash
curl -X POST http://localhost:3001/api/trade/open \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "pairId": "AU_SPREAD",
    "direction": "LONG_SPREAD",
    "volume": 1
  }'
```

---

## 项目结构

```
trading-system/
├── backend/           # Node.js + Fastify 后端
│   ├── src/
│   │   ├── services/  # 业务逻辑
│   │   ├── routes/    # API 路由
│   │   └── index.ts   # 入口
│   └── package.json
├── frontend/          # Next.js 前端
│   ├── src/
│   │   ├── app/       # 页面
│   │   ├── components/# 组件
│   │   └── lib/       # 工具库
│   └── package.json
├── shared/            # 共享类型定义
├── docs/              # 文档
└── docker-compose.yml # Docker 配置
```

---

## 常见问题

### Q1: 端口被占用
```bash
# 查找占用 3000 的进程
lsof -ti:3000 | xargs kill -9

# 或修改前端端口
npm run dev -- -p 3002
```

### Q2: 数据库连接失败
无需处理，系统会自动切换到内存模式，只是重启后数据会丢失。

### Q3: 行情不更新
检查 WebSocket 连接：
- 浏览器 F12 → Network → WS
- 应该有 ws://localhost:3001/market 连接

---

## 功能清单

| 功能 | 状态 | 说明 |
|------|------|------|
| 行情展示 | ✅ | CTP + MT5 模拟行情，实时价差计算 |
| K线图表 | ✅ | 支持多时间帧 |
| 下单交易 | ✅ | 市价单，支持做升/做降 |
| 持仓管理 | ✅ | 实时盈亏计算 |
| 风控预警 | ✅ | 风险率/单日亏损/持仓限额 |
| 用户认证 | ✅ | JWT Token |
| 数据持久化 | ⚠️ | 需配置 PostgreSQL |
| 真实行情 | ⏳ | 需配置 CTP/MT5 账号 |

---

**当前版本：Phase 2 完成（2026-03-12）**
