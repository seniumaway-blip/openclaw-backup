import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { dbService } from './db-service'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const JWT_EXPIRES_IN = '7d'
const REFRESH_TOKEN_EXPIRES_IN = '30d'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface TokenPayload {
  userId: string
  username: string
  type: 'access' | 'refresh'
}

// 认证服务
class AuthService {
  // 注册用户
  async register(
    username: string,
    password: string,
    email?: string,
    initialBalance: number = 1000000
  ): Promise<{ success: boolean; user?: any; message?: string }> {
    // 验证参数
    if (!username || !password) {
      return { success: false, message: '用户名和密码不能为空' }
    }

    if (username.length < 3 || username.length > 50) {
      return { success: false, message: '用户名长度必须在 3-50 个字符之间' }
    }

    if (password.length < 6) {
      return { success: false, message: '密码长度至少 6 位' }
    }

    // 检查用户名是否已存在
    const existingUser = await this.findUserByUsername(username)
    if (existingUser) {
      return { success: false, message: '用户名已存在' }
    }

    // 生成用户ID
    const userId = `U${Date.now()}${Math.random().toString(36).substr(2, 4)}`

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10)

    // 创建用户
    const user = await dbService.createUserWithAuth(userId, username, passwordHash, email, initialBalance)

    return { success: true, user }
  }

  // 登录
  async login(
    username: string,
    password: string
  ): Promise<{ success: boolean; tokens?: AuthTokens; user?: any; message?: string }> {
    // 查找用户
    const user = await this.findUserByUsername(username)
    if (!user) {
      return { success: false, message: '用户名或密码错误' }
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
    if (!isPasswordValid) {
      return { success: false, message: '用户名或密码错误' }
    }

    // 生成 Token
    const tokens = this.generateTokens(user.id, user.username)

    // 更新最后登录时间
    await dbService.updateUserLastLogin(user.id)

    return {
      success: true,
      tokens,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        initialBalance: user.initialBalance,
        tradingMode: user.tradingMode,
      },
    }
  }

  // 刷新 Token
  async refreshToken(refreshToken: string): Promise<{ success: boolean; tokens?: AuthTokens; message?: string }> {
    try {
      const payload = jwt.verify(refreshToken, JWT_SECRET) as TokenPayload

      if (payload.type !== 'refresh') {
        return { success: false, message: '无效的刷新令牌' }
      }

      // 检查用户是否存在
      const user = await dbService.getUser(payload.userId)
      if (!user) {
        return { success: false, message: '用户不存在' }
      }

      // 生成新 Token
      const tokens = this.generateTokens(payload.userId, payload.username)

      return { success: true, tokens }
    } catch (err) {
      return { success: false, message: '令牌已过期或无效' }
    }
  }

  // 验证 Access Token
  verifyAccessToken(token: string): TokenPayload | null {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as TokenPayload
      if (payload.type !== 'access') {
        return null
      }
      return payload
    } catch (err) {
      return null
    }
  }

  // 修改密码
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string }> {
    if (newPassword.length < 6) {
      return { success: false, message: '新密码长度至少 6 位' }
    }

    // 获取用户
    const user = await dbService.getUserWithPassword(userId)
    if (!user) {
      return { success: false, message: '用户不存在' }
    }

    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash)
    if (!isPasswordValid) {
      return { success: false, message: '原密码错误' }
    }

    // 加密新密码
    const newPasswordHash = await bcrypt.hash(newPassword, 10)

    // 更新密码
    await dbService.updateUserPassword(userId, newPasswordHash)

    return { success: true, message: '密码修改成功' }
  }

  // 私有方法：查找用户
  private async findUserByUsername(username: string): Promise<any | null> {
    return dbService.getUserByUsername(username)
  }

  // 私有方法：生成 Token
  private generateTokens(userId: string, username: string): AuthTokens {
    const accessToken = jwt.sign(
      { userId, username, type: 'access' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    const refreshToken = jwt.sign(
      { userId, username, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    )

    // 解析过期时间（秒）
    const decoded = jwt.decode(accessToken) as any
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000)

    return {
      accessToken,
      refreshToken,
      expiresIn,
    }
  }
}

export const authService = new AuthService()
