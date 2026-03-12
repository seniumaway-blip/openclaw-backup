-- 数据库初始化脚本

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(32) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100),
    password_hash VARCHAR(255),
    initial_balance DECIMAL(15, 2) DEFAULT 1000000,
    currency VARCHAR(3) DEFAULT 'CNY',
    trading_mode VARCHAR(10) DEFAULT 'VIRTUAL',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 虚拟账户表
CREATE TABLE IF NOT EXISTS virtual_accounts (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(32) REFERENCES users(id) ON DELETE CASCADE,
    domestic_balance DECIMAL(15, 2) DEFAULT 0,
    domestic_equity DECIMAL(15, 2) DEFAULT 0,
    domestic_margin DECIMAL(15, 2) DEFAULT 0,
    foreign_balance DECIMAL(15, 2) DEFAULT 0,
    foreign_equity DECIMAL(15, 2) DEFAULT 0,
    foreign_margin DECIMAL(15, 2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 交易对表
CREATE TABLE IF NOT EXISTS trading_pairs (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    domestic_symbol VARCHAR(20) NOT NULL,
    foreign_symbol VARCHAR(20) NOT NULL,
    domestic_exchange VARCHAR(20),
    foreign_exchange VARCHAR(20),
    domestic_contract_size DECIMAL(10, 2) DEFAULT 1000,
    foreign_contract_size DECIMAL(10, 2) DEFAULT 100,
    domestic_tick_size DECIMAL(10, 4) DEFAULT 0.01,
    foreign_tick_size DECIMAL(10, 4) DEFAULT 0.01,
    domestic_margin_rate DECIMAL(10, 4) DEFAULT 0.1,
    foreign_margin_rate DECIMAL(10, 4) DEFAULT 0.05,
    size_ratio DECIMAL(10, 4) DEFAULT 3.11,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 持仓表
CREATE TABLE IF NOT EXISTS positions (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) REFERENCES users(id) ON DELETE CASCADE,
    pair_id VARCHAR(32) REFERENCES trading_pairs(id),
    direction VARCHAR(20) NOT NULL,
    open_spread_value DECIMAL(10, 4),
    current_spread_value DECIMAL(10, 4),
    domestic_symbol VARCHAR(20),
    domestic_side VARCHAR(4),
    domestic_volume DECIMAL(10, 2),
    domestic_filled_volume DECIMAL(10, 2) DEFAULT 0,
    domestic_open_price DECIMAL(10, 4),
    domestic_current_price DECIMAL(10, 4),
    foreign_symbol VARCHAR(20),
    foreign_side VARCHAR(4),
    foreign_volume DECIMAL(10, 2),
    foreign_filled_volume DECIMAL(10, 2) DEFAULT 0,
    foreign_open_price DECIMAL(10, 4),
    foreign_current_price DECIMAL(10, 4),
    total_pnl DECIMAL(15, 2) DEFAULT 0,
    total_margin DECIMAL(15, 2) DEFAULT 0,
    realized_pnl DECIMAL(15, 2),
    status VARCHAR(20) DEFAULT 'OPEN',
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP
);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) REFERENCES users(id) ON DELETE CASCADE,
    position_id VARCHAR(32) REFERENCES positions(id),
    pair_id VARCHAR(32) REFERENCES trading_pairs(id),
    type VARCHAR(10) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    order_type VARCHAR(10) DEFAULT 'MARKET',
    limit_price DECIMAL(10, 4),
    execution_mode VARCHAR(10) DEFAULT 'VIRTUAL',
    overall_status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 订单明细表
CREATE TABLE IF NOT EXISTS order_legs (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(32) REFERENCES orders(id) ON DELETE CASCADE,
    leg_type VARCHAR(10) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(4) NOT NULL,
    volume DECIMAL(10, 2),
    filled_volume DECIMAL(10, 2) DEFAULT 0,
    price DECIMAL(10, 4),
    avg_filled_price DECIMAL(10, 4),
    status VARCHAR(20) DEFAULT 'PENDING',
    filled_at TIMESTAMP,
    error_msg TEXT,
    UNIQUE(order_id, leg_type)
);

-- 订单簿表（模拟）
CREATE TABLE IF NOT EXISTS order_book (
    id SERIAL PRIMARY KEY,
    pair_id VARCHAR(32) REFERENCES trading_pairs(id),
    side VARCHAR(4) NOT NULL,
    price DECIMAL(10, 4) NOT NULL,
    volume DECIMAL(10, 2) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pair_id, side, price)
);

-- 成交记录表
CREATE TABLE IF NOT EXISTS trade_fills (
    id SERIAL PRIMARY KEY,
    order_leg_id INTEGER REFERENCES order_legs(id),
    filled_volume DECIMAL(10, 2) NOT NULL,
    filled_price DECIMAL(10, 4) NOT NULL,
    filled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初始化交易对数据
INSERT INTO trading_pairs (id, name, domestic_symbol, foreign_symbol, domestic_exchange, foreign_exchange, domestic_contract_size, foreign_contract_size, size_ratio, domestic_margin_rate, foreign_margin_rate, display_order)
VALUES 
    ('AU_SPREAD', '黄金极差', 'AU', 'XAUUSD', 'SHFE', 'LME', 1000, 100, 3.11, 0.12, 0.05, 1)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_position_id ON orders(position_id);
CREATE INDEX IF NOT EXISTS idx_order_legs_order_id ON order_legs(order_id);
CREATE INDEX IF NOT EXISTS idx_order_book_pair_id ON order_book(pair_id);
