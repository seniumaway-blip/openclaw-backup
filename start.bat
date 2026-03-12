@echo off
chcp 65001 >nul
echo ==========================================
echo  黄金跨市套利交易系统 - Windows 启动脚本
echo ==========================================
echo.

:: 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装：https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] 检测到 Node.js 版本：
node --version
echo.

:: 获取项目路径
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

echo [2/4] 项目路径：%PROJECT_DIR%
echo.

:: 安装后端依赖
echo [3/4] 安装后端依赖...
cd backend
call npm install
if errorlevel 1 (
    echo [错误] 后端依赖安装失败
    pause
    exit /b 1
)
echo [✓] 后端依赖安装完成
echo.

:: 启动后端（新窗口）
echo [4/4] 启动后端服务...
start "交易后端 (端口3001)" cmd /k "cd /d %PROJECT_DIR%\backend && npm run dev"

:: 等待后端启动
timeout /t 3 /nobreak >nul

:: 安装前端依赖
cd /d "%PROJECT_DIR%\frontend"
echo [4/4] 安装前端依赖...
call npm install
if errorlevel 1 (
    echo [错误] 前端依赖安装失败
    pause
    exit /b 1
)
echo [✓] 前端依赖安装完成
echo.

:: 启动前端（新窗口）
echo [启动] 启动前端服务...
start "交易前端 (端口3000)" cmd /k "cd /d %PROJECT_DIR%\frontend && npm run dev"

echo.
echo ==========================================
echo  服务启动成功！
echo ==========================================
echo.
echo 请等待 5-10 秒后访问：
echo   前端页面：http://localhost:3000
echo   后端 API：http://localhost:3001
echo.
echo 按任意键关闭此窗口（服务继续在后台运行）
pause >nul
