# 黄金跨市套利交易系统 - Windows 部署指南

## 前置条件

1. **Node.js 18+**
   - 下载地址：https://nodejs.org/
   - 安装时勾选 "Add to PATH"

2. **Git**（可选，用于下载代码）
   - 下载地址：https://git-scm.com/download/win

## 快速开始（3步）

### 第1步：下载代码

**方式A - 有 Git：**
```cmd
git clone https://github.com/yourname/trading-system.git
cd trading-system
```

**方式B - 无 Git：**
1. 下载 ZIP 压缩包
2. 解压到 `C:\trading-system`（路径不要有空格和中文）

### 第2步：一键启动

双击运行：`start.bat`

等待自动完成：
- 安装依赖（首次较慢，约 2-5 分钟）
- 启动后端服务（端口 3001）
- 启动前端服务（端口 3000）

### 第3步：访问系统

浏览器打开：http://localhost:3000

---

## 手动启动（如果脚本失败）

### 1. 打开两个 CMD 窗口

**窗口1 - 后端：**
```cmd
cd C:\trading-system\backend
npm install
npm run dev
```

**窗口2 - 前端：**
```cmd
cd C:\trading-system\frontend
npm install
npm run dev
```

### 2. 等待显示

后端窗口看到：
```
🚀 Server running on http://localhost:3001
```

前端窗口看到：
```
✓ Ready in 1800ms
```

### 3. 浏览器访问
http://localhost:3000

---

## 测试账号

首次使用需要注册，或执行以下命令创建测试账号：

```cmd
curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"demo\",\"password\":\"123456\"}"
```

---

## 常见问题

### Q1: 'npm' 不是内部或外部命令
**解决：** Node.js 未正确安装或未添加到 PATH
1. 重新安装 Node.js
2. 安装时勾选 "Add to PATH"
3. 重启 CMD 窗口

### Q2: 端口被占用
**解决：** 修改端口

编辑 `frontend/package.json`：
```json
"dev": "next dev -p 3002"
```

编辑 `backend/src/index.ts`：
```typescript
await app.listen({ port: 3002 })
```

### Q3: 依赖安装失败
**解决：** 使用国内镜像
```cmd
npm config set registry https://registry.npmmirror.com
```

### Q4: 浏览器显示空白
**解决：** 
1. 按 F12 打开开发者工具
2. 查看 Console 是否有红色错误
3. 确保后端服务已启动（http://localhost:3001/health 能访问）

---

## 功能验证

| 测试项 | 操作 | 预期结果 |
|--------|------|---------|
| 行情显示 | 打开首页 | 看到实时价差数字跳动 |
| 注册登录 | 点击登录 → 注册 | 注册成功后自动登录 |
| 下单交易 | 行情页 → 做升/做降 | 弹出确认框，确认后下单成功 |
| 查看持仓 | 点击"持仓"标签 | 显示当前持仓和盈亏 |
| 风控预警 | 连续下单使风险率>80% | 顶部出现红色预警条 |

---

## 目录结构

```
C:\trading-system\
├── start.bat          <- 一键启动脚本
├── README.md          <- 本文件
├── backend\           <- 后端代码
│   ├── src\
│   ├── package.json
│   └── ...
├── frontend\          <- 前端代码
│   ├── src\
│   ├── package.json
│   └── ...
└── docs\              <- 设计文档
```

---

## 停止服务

关闭两个 CMD 窗口即可。

或者在 CMD 中按 `Ctrl + C` 两次。

---

**版本：Phase 2 完成（2026-03-12）**
