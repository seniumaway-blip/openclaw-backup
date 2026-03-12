# 黄金跨市套利交易系统 - 项目总览

## ✅ 已完成功能

### 1. 前端界面 (Next.js + React + Tailwind CSS)

| 页面 | 功能 |
|------|------|
| **首页** | 三栏账户概览（汇总/CTP/MT5）、权益/余额/风险率显示 |
| **行情页** | K线图表、实时行情推送、做升/做降下单、价差显示 |
| **交易页** | 持仓列表、双边持仓详情、一键平仓、浮动盈亏 |
| **个人中心** | 资金设置、风控配置、真实账户接入预留 |
| **历史记录** | 交易记录列表、开仓/平仓筛选、盈亏统计 |

### 2. 后端服务 (Node.js + Fastify + WebSocket)

| 模块 | 功能 |
|------|------|
| **行情服务** | Mock数据生成、K线数据、WebSocket实时推送 |
| **账户服务** | 虚拟账户管理、持仓查询、资金设置 |
| **交易服务** | 开仓/平仓、订单管理、双边同时成交 |
| **数据持久化** | 内存存储（预留PostgreSQL接口） |

### 3. 核心功能

- ✅ **双账户虚拟盘**：CTP（国内）+ MT5（境外）
- ✅ **黄金极差交易**：沪金 vs 伦敦金价差套利
- ✅ **实时行情**：WebSocket推送，秒级更新
- ✅ **风控提示**：风险率、单日亏损限额预警
- ✅ **下单确认**：双边持仓详情、预估保证金计算
- ✅ **交易历史**：完整记录，支持筛选

### 4. 技术特性

- ✅ **响应式设计**：适配桌面端和移动端
- ✅ **状态管理**：Zustand + 本地存储
- ✅ **类型安全**：TypeScript全栈
- ✅ **Docker部署**：一键启动
- ✅ **真实API预留**：CTP/MT5接入框架

---

## 📁 项目结构

```
trading-system/
├── frontend/              # Next.js 前端
│   ├── src/app/           # 页面路由
│   │   ├── page.tsx       # 首页/账户概览
│   │   ├── market/        # 行情页
│   │   ├── trade/         # 交易页
│   │   ├── profile/       # 个人中心
│   │   └── history/       # 历史记录
│   ├── src/components/    # 组件
│   │   ├── BottomNav.tsx  # 底部导航
│   │   ├── AccountSummary.tsx
│   │   ├── RiskAlerts.tsx # 风控提示
│   │   └── OrderConfirmModal.tsx # 下单确认
│   └── src/lib/           # 工具库
│       ├── store.ts       # Zustand状态管理
│       ├── api.ts         # API客户端
│       └── websocket.ts   # WebSocket服务
├── backend/               # Node.js 后端
│   ├── src/routes/        # API路由
│   ├── src/services/      # 业务逻辑
│   │   ├── market-data.ts # 行情数据
│   │   ├── market-adapter.ts # 行情适配器
│   │   ├── account-data.ts
│   │   ├── trade-service.ts
│   │   └── db-service.ts  # 数据持久化
│   └── src/websocket/     # WebSocket服务
├── shared/types.ts        # 共享类型
└── docs/                  # 文档
```

---

## 🚀 快速启动

```bash
cd trading-system

# 方式1：一键启动（推荐）
./start-dev.sh

# 方式2：Docker
docker-compose up -d

# 方式3：手动启动
cd backend && npm run dev  # 端口3001
cd frontend && npm run dev # 端口3000
```

访问：http://localhost:3000

---

## 📊 交易逻辑确认

根据你的要求，交易逻辑如下：

```
价差 = 沪金价格 - 伦敦金价格（统一单位后）

【价差为正数时】预期价差回归（缩小）
• CTP: 做空沪金 (SELL AU)
• MT5: 做多伦敦金 (BUY XAUUSD)

【价差为负数时】预期价差回归（扩大至0或转正）
• CTP: 做多沪金 (BUY AU)
• MT5: 做空伦敦金 (SELL XAUUSD)
```

---

## 🛡️ 风控规则确认

| 规则 | 设置 |
|------|------|
| 风险率处理 | 仅提示，不强制平仓 |
| 单日亏损限额 | 10% |
| 虚拟盘手续费 | 无 |
| 持仓限额 | 可配置（默认单边100手/总200手） |
| 平仓规则 | 双边同时平仓 |
| 初始资金 | 50-3000万人民币可配置 |

---

## 🔮 下一步开发

1. **真实行情接入**
   - CTP期货行情API接入
   - MT5外汇行情API接入

2. **用户认证系统**
   - 注册/登录/密码重置
   - JWT Token认证

3. **数据库迁移**
   - PostgreSQL接入
   - 时序数据库（行情数据）

4. **多品种支持**
   - 铜极差、原油等新品种
   - 品种配置管理后台

5. **策略优化**
   - 自动套利策略
   - 风控自动减仓

---

## 📝 文档清单

| 文档 | 路径 |
|------|------|
| 系统设计 | `docs/trading-system-design.md` |
| 风控规则 | `docs/risk-and-pnl-rules.md` |
| UI原型 | `trading-system/docs/ui-prototype.md` |
| 快速开始 | `trading-system/docs/quickstart.md` |
| 项目总览 | `trading-system/docs/project-overview.md` （本文件） |

---

*最后更新：2025年3月11日*
