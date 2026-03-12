# 黄金跨市套利交易系统 - 本地部署指南

## 环境要求
- Node.js 18+
- PostgreSQL 15（可选，无则用内存模式）

## 1. 克隆代码
```bash
git clone <your-repo> trading-system
cd trading-system
```

## 2. 安装依赖
```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

## 3. 启动服务

### 方式 A：快速测试（内存模式，无需数据库）
```bash
# 终端 1 - 后端
cd backend
npm run dev

# 终端 2 - 前端
cd frontend
npm run dev
```

访问：http://localhost:3000

### 方式 B：完整部署（PostgreSQL）
```bash
# 1. 启动数据库
docker-compose up -d postgres

# 2. 后端自动建表
npm run dev

# 3. 启动前端
npm run dev
```

## 4. 测试账号
首次访问需要注册，或直接用以下接口创建用户：
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}'
```

## 5. 主要功能
- ✅ 行情：CTP + MT5 模拟行情
- ✅ 交易：开仓/平仓/撤单
- ✅ 风控：风险率/单日亏损/持仓限额
- ✅ 实时：WebSocket 推送

## 6. 配置文件
后端环境变量（`.env`）：
```
DATABASE_URL=postgresql://trading:trading123@localhost:5432/trading_db
JWT_SECRET=your-secret-key
```

前端环境变量（`frontend/.env.local`）：
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001/market
```

## 7. 真实行情接入（可选）
修改 `backend/src/index.ts`：
```typescript
// CTP 真实配置
const ctpConfig = {
  mockMode: false,
  brokerId: '9999',
  userId: 'your-ctp-user',
  password: 'your-password',
  marketFrontAddr: 'tcp://180.168.146.187:10131'
}

// MT5 真实配置
const mt5Config = {
  host: 'localhost',
  port: 5555
}
```

---
**当前版本：Phase 2 完成（模拟行情 + 内存模式）**
