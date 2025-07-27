import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { UserProfile, UsageMinutes } from '../lib/supabase'

export interface AuthUser {
  id: string
  email: string
  isEmailVerified: boolean
  userType: 'guest' | 'trial' | 'paid'
  planType?: string
  quotaMinutes: number
  usedMinutes: number
  trialMinutes?: number
  subscriptionType?: 'monthly' | 'yearly' | 'one-time'
  createdAt: string
}

export class AuthService {
  
  /**
   * 用户注册
   */
  static async register(email: string, password: string, language: string = 'ja'): Promise<{ user: User | null, error: Error | null }> {
    try {
      // 使用Supabase Auth注册
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            lang: language,
            timezone: 'Asia/Tokyo'
          }
        }
      })

      if (error) {
        console.error('注册失败:', error)
        return { user: null, error }
      }

      console.log('✅ 用户注册成功:', email)
      return { user: data.user, error: null }
    } catch (error) {
      console.error('注册过程中发生错误:', error)
      return { user: null, error }
    }
  }

  /**
   * 用户登录
   */
  static async login(email: string, password: string): Promise<{ user: AuthUser | null, error: Error | null }> {
    try {
      // 使用Supabase Auth登录
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        console.error('登录失败:', error)
        return { user: null, error }
      }

      if (!data.user) {
        return { user: null, error: new Error('用户数据为空') }
      }

      // 获取用户完整信息
      const authUser = await this.getUserWithProfile(data.user.id)
      
      console.log('✅ 用户登录成功:', email)
      return { user: authUser, error: null }
    } catch (error) {
      console.error('登录过程中发生错误:', error)
      return { user: null, error }
    }
  }

  /**
   * 用户登出
   */
  static async logout(): Promise<{ error: Error | null }> {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  /**
   * 获取当前用户
   */
  static async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return null
      }

      return await this.getUserWithProfile(user.id)
    } catch (error) {
      console.error('获取当前用户失败:', error)
      return null
    }
  }

  /**
   * 获取用户完整信息（包含配置和用量）
   */
  static async getUserWithProfile(userId: string): Promise<AuthUser | null> {
    try {
      // 获取当前用户基本信息
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user || user.id !== userId) {
        console.error('获取用户信息失败:', userError)
        return null
      }

      // 获取用户配置
      const { data: profile, error: profileError } = await supabase
        .from('users_profile')
        .select('*')
        .eq('user_id', userId)
        .single()

      // 获取用量信息
      const { data: usage, error: usageError } = await supabase
        .from('usage_minutes')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (profileError || usageError) {
        console.error('获取用户配置或用量失败:', { profileError, usageError })
        
        // 如果是新用户或数据不存在，创建默认配置
        if (profileError?.code === 'PGRST116' || usageError?.code === 'PGRST116') {
          console.log('🔧 检测到新用户，使用默认配置')
          
          // 创建基本用户对象（使用默认配置）
          const authUser: AuthUser = {
            id: user.id,
            email: user.email || '',
            isEmailVerified: !!user.email_confirmed_at,
            userType: 'trial',
            planType: undefined,
            quotaMinutes: 10, // 默认试用10分钟
            usedMinutes: 0,
            trialMinutes: 10,
            subscriptionType: 'one-time',
            createdAt: user.created_at || ''
          }
          
          console.log('✅ 使用默认配置登录成功:', user.email)
          return authUser
        }
        
        return null
      }

      // 组装返回数据
      const authUser: AuthUser = {
        id: user.id,
        email: user.email || '',
        isEmailVerified: !!user.email_confirmed_at,
        userType: this.determineUserType(usage, profile),
        planType: profile?.plan_id,
        quotaMinutes: usage.total_minutes,
        usedMinutes: usage.used_minutes,
        trialMinutes: usage.total_minutes <= 10 ? usage.total_minutes : undefined,
        subscriptionType: profile?.plan_id?.includes('sub_') ? 
          (profile.plan_id.includes('monthly') ? 'monthly' : 
           profile.plan_id.includes('yearly') ? 'yearly' : 'one-time') : 'one-time',
        createdAt: user.created_at || ''
      }

      return authUser
    } catch (error) {
      console.error('获取用户完整信息失败:', error)
      return null
    }
  }

  /**
   * 确定用户类型
   */
  private static determineUserType(usage: UsageMinutes, profile: UserProfile): 'guest' | 'trial' | 'paid' {
    if (!usage || !profile) return 'guest'
    
    // 如果有付费套餐，则为付费用户
    if (profile.plan_id && !profile.plan_id.includes('trial')) {
      return 'paid'
    }
    
    // 如果总时长大于10分钟，说明是付费用户
    if (usage.total_minutes > 10) {
      return 'paid'
    }
    
    // 默认为试用用户
    return 'trial'
  }

  /**
   * 监听认证状态变化
   */
  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const authUser = await this.getUserWithProfile(session.user.id)
        callback(authUser)
      } else {
        callback(null)
      }
    })
  }
}