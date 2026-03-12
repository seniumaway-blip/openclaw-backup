#!/bin/bash

# 黄金跨市套利交易系统 - 一键启动脚本

echo "🚀 启动交易系统..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cd "$(dirname "$0")"

# 检查端口占用
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}❌ 端口 3000 被占用，请关闭其他服务${NC}"
    exit 1
fi

if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}❌ 端口 3001 被占用，请关闭其他服务${NC}"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装，请先安装 Node.js 18+${NC}"
    exit 1
fi

echo -e "${BLUE}▶ 检查依赖...${NC}"

# 检查并安装后端依赖
if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}📦 安装后端依赖...${NC}"
    cd backend
    npm install
    cd ..
fi

# 检查并安装前端依赖
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}📦 安装前端依赖...${NC}"
    cd frontend
    npm install
    cd ..
fi

echo -e "${GREEN}✓ 依赖检查完成${NC}"
echo ""

# 启动后端
echo -e "${BLUE}▶ 启动后端服务...${NC}"
cd backend
npm run dev &
cd ..

echo -e "${GREEN}✓ 后端启动中...${NC}"
echo -e "${YELLOW}  API: http://localhost:3001${NC}"

# 等待后端启动
sleep 3

# 启动前端
echo ""
echo -e "${BLUE}▶ 启动前端服务...${NC}"
cd frontend
npm run dev &
cd ..

echo -e "${GREEN}✓ 前端启动中...${NC}"
echo -e "${YELLOW}  App: http://localhost:3000${NC}"
echo ""

# 等待前端启动
sleep 5

echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  系统启动完成！${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo -e "  前端: ${BLUE}http://localhost:3000${NC}"
echo -e "  后端: ${BLUE}http://localhost:3001${NC}"
echo ""
echo -e "${YELLOW}  按 Ctrl+C 停止所有服务${NC}"
echo ""

# 等待所有后台进程
wait
