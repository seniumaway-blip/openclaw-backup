#!/bin/bash

# 黄金跨市套利交易系统 - 启动脚本

echo "🚀 启动交易系统..."

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd "$(dirname "$0")"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi

# 启动后端
echo -e "${BLUE}▶ 启动后端服务...${NC}"
cd backend

if [ ! -d "node_modules" ]; then
    echo "📦 安装后端依赖..."
    npm install
fi

# 后台启动后端
npm run dev &
BACKEND_PID=$!

echo -e "${GREEN}✓ 后端启动成功 (PID: $BACKEND_PID)${NC}"
echo -e "${YELLOW}  API: http://localhost:3001${NC}"

# 等待后端启动
sleep 2

# 启动前端
echo -e "${BLUE}▶ 启动前端服务...${NC}"
cd ../frontend

if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
fi

# 启动前端
echo -e "${GREEN}✓ 前端启动中...${NC}"
echo -e "${YELLOW}  App: http://localhost:3000${NC}"
npm run dev

# 捕获 Ctrl+C 信号
trap "echo -e '${BLUE}▶ 关闭服务...${NC}'; kill $BACKEND_PID 2>/dev/null; exit" INT

wait
