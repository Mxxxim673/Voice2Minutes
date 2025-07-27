import { createClient } from '@supabase/supabase-js'

// Supabase配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

// 前端使用的普通客户端（匿名权限）
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 数据库类型定义
export interface UserProfile {
  user_id: string
  display_name?: string
  lang: string
  timezone: string
  plan_id?: string
  privacy_policy_version?: string
  terms_version?: string
  consent_at?: string
  created_at: string
  updated_at: string
}

export interface UsageMinutes {
  user_id: string
  total_minutes: number
  used_minutes: number
  reset_at?: string
  created_at: string
  updated_at: string
}

export interface Plan {
  plan_id: string
  name: string
  minutes: number
  price_jpy: number
  type: 'time_pack' | 'subscription'
  ios_sku?: string
  web_price_id?: string
  created_at: string
}

export interface Order {
  order_id: string
  user_id: string
  plan_id: string
  platform: 'ios' | 'web'
  amount_jpy: number
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  created_at: string
  paid_at?: string
}

// 数据库表名
export const TABLES = {
  USERS_PROFILE: 'users_profile',
  USAGE_MINUTES: 'usage_minutes',
  PLANS: 'plans',
  ORDERS: 'orders'
} as const