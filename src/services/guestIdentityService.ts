import FingerprintJS from '@fingerprintjs/fingerprintjs';

export interface GuestIdentity {
  visitorId: string;        // localStorage UUID
  fingerprint: string;     // FingerprintJS ID
  deviceInfo?: {
    userAgent: string;
    language: string;
    timezone: string;
    screen: string;
  };
  usageInfo: {
    totalMinutesUsed: number;
    sessionsCount: number;
    lastUsedAt: string;
    createdAt: string;
  };
}

export interface GuestValidationResult {
  isAllowed: boolean;
  remainingMinutes: number;
  identity: GuestIdentity;
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
}

class GuestIdentityService {
  private readonly VISITOR_ID_KEY = 'visitor_id';
  private readonly GUEST_USAGE_KEY = 'guestUsedMinutes';
  private readonly GUEST_IDENTITY_KEY = 'guest_identity';
  private readonly GUEST_SESSIONS_KEY = 'guest_sessions';
  private readonly GUEST_LIMIT_MINUTES = 5;
  
  private fingerprintPromise: Promise<any> | null = null;

  constructor() {
    this.initializeFingerprint();
  }

  private async initializeFingerprint() {
    if (!this.fingerprintPromise) {
      this.fingerprintPromise = FingerprintJS.load();
    }
    return this.fingerprintPromise;
  }

  /**
   * 生成或获取访客 UUID
   */
  private getOrCreateVisitorId(): string {
    let visitorId = localStorage.getItem(this.VISITOR_ID_KEY);
    
    if (!visitorId) {
      visitorId = this.generateUUID();
      localStorage.setItem(this.VISITOR_ID_KEY, visitorId);
      console.log('🆔 生成新的访客ID:', visitorId);
    }
    
    return visitorId;
  }

  /**
   * 生成 UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 获取浏览器指纹
   */
  private async getBrowserFingerprint(): Promise<string> {
    try {
      const fp = await this.initializeFingerprint();
      const result = await fp.get();
      console.log('🔍 浏览器指纹获取成功:', result.visitorId);
      return result.visitorId;
    } catch (error) {
      console.error('❌ 获取浏览器指纹失败:', error);
      // 降级方案：使用简单的设备信息生成指纹
      return this.generateFallbackFingerprint();
    }
  }

  /**
   * 降级指纹生成方案
   */
  private generateFallbackFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Browser fingerprint', 2, 2);
    }
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|');
    
    // 生成简单哈希
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  /**
   * 获取设备信息
   */
  private getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}`
    };
  }

  /**
   * 获取或创建访客身份
   */
  async getGuestIdentity(): Promise<GuestIdentity> {
    const visitorId = this.getOrCreateVisitorId();
    const fingerprint = await this.getBrowserFingerprint();
    const deviceInfo = this.getDeviceInfo();
    
    // 从本地存储获取现有身份信息
    const existingIdentity = localStorage.getItem(this.GUEST_IDENTITY_KEY);
    const totalMinutesUsed = Number(localStorage.getItem(this.GUEST_USAGE_KEY) || '0');
    const sessionsData = JSON.parse(localStorage.getItem(this.GUEST_SESSIONS_KEY) || '[]');
    
    let identity: GuestIdentity;
    
    if (existingIdentity) {
      identity = JSON.parse(existingIdentity);
      // 更新使用量信息
      identity.usageInfo.totalMinutesUsed = totalMinutesUsed;
      identity.usageInfo.lastUsedAt = new Date().toISOString();
    } else {
      // 创建新的身份记录
      identity = {
        visitorId,
        fingerprint,
        deviceInfo,
        usageInfo: {
          totalMinutesUsed,
          sessionsCount: sessionsData.length,
          lastUsedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
      };
    }
    
    // 保存身份信息
    localStorage.setItem(this.GUEST_IDENTITY_KEY, JSON.stringify(identity));
    
    return identity;
  }

  /**
   * 记录新的会话
   */
  recordSession() {
    const sessions = JSON.parse(localStorage.getItem(this.GUEST_SESSIONS_KEY) || '[]');
    const newSession = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      ip: 'unknown' // 将由后端记录真实IP
    };
    
    sessions.push(newSession);
    
    // 只保留最近50次会话记录
    if (sessions.length > 50) {
      sessions.splice(0, sessions.length - 50);
    }
    
    localStorage.setItem(this.GUEST_SESSIONS_KEY, JSON.stringify(sessions));
  }

  /**
   * 验证访客身份并检查是否允许使用
   */
  async validateGuestAccess(): Promise<GuestValidationResult> {
    const identity = await this.getGuestIdentity();
    const warnings: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    
    // 检查使用量是否超限
    const remainingMinutes = Math.max(0, this.GUEST_LIMIT_MINUTES - identity.usageInfo.totalMinutesUsed);
    const isAllowed = remainingMinutes > 0;
    
    // 风险评估
    if (identity.usageInfo.totalMinutesUsed >= this.GUEST_LIMIT_MINUTES) {
      riskLevel = 'high';
      warnings.push('已达到访客用户使用上限');
    } else if (identity.usageInfo.totalMinutesUsed >= this.GUEST_LIMIT_MINUTES * 0.8) {
      riskLevel = 'medium';
      warnings.push('接近访客用户使用上限');
    }
    
    // 检查异常会话模式
    const sessions = JSON.parse(localStorage.getItem(this.GUEST_SESSIONS_KEY) || '[]');
    if (sessions.length > 20) {
      riskLevel = riskLevel === 'low' ? 'medium' : 'high';
      warnings.push('访问频率异常');
    }
    
    return {
      isAllowed,
      remainingMinutes,
      identity,
      riskLevel,
      warnings
    };
  }

  /**
   * 向后端报告访客信息并获取权威使用量数据
   */
  async reportGuestIdentity(identity: GuestIdentity): Promise<any> {
    try {
      const response = await fetch('/api/guest/identity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visitorId: identity.visitorId,
          fingerprint: identity.fingerprint,
          deviceInfo: identity.deviceInfo,
          usageInfo: identity.usageInfo,
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        console.warn('⚠️ 上报访客身份信息失败:', response.statusText);
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      console.log('📊 访客身份信息上报成功，服务器返回数据:', result.userData);
      
      // 强制使用服务器端的权威数据更新本地存储
      if (result.userData) {
        const serverUsage = result.userData.totalMinutesUsed;
        const localUsage = Number(localStorage.getItem(this.GUEST_USAGE_KEY) || '0');
        
        // 使用服务器数据作为权威源
        if (serverUsage !== localUsage) {
          console.log(`🔄 同步服务器使用量数据: ${localUsage} -> ${serverUsage}`);
          localStorage.setItem(this.GUEST_USAGE_KEY, serverUsage.toString());
          
          // 更新身份信息
          const updatedIdentity = {
            ...identity,
            usageInfo: {
              ...identity.usageInfo,
              totalMinutesUsed: serverUsage,
              sessionsCount: result.userData.sessionsCount,
              lastUsedAt: result.userData.lastUsedAt
            }
          };
          localStorage.setItem(this.GUEST_IDENTITY_KEY, JSON.stringify(updatedIdentity));
        }
      }
      
      return result;
    } catch (error) {
      console.warn('⚠️ 上报访客身份信息失败:', error);
      throw error;
    }
  }

  /**
   * 更新使用量
   */
  updateUsage(minutesUsed: number) {
    const currentUsage = Number(localStorage.getItem(this.GUEST_USAGE_KEY) || '0');
    const newUsage = currentUsage + minutesUsed;
    localStorage.setItem(this.GUEST_USAGE_KEY, newUsage.toString());
    
    // 更新身份信息中的使用量
    const identity = localStorage.getItem(this.GUEST_IDENTITY_KEY);
    if (identity) {
      const identityData = JSON.parse(identity);
      identityData.usageInfo.totalMinutesUsed = newUsage;
      identityData.usageInfo.lastUsedAt = new Date().toISOString();
      localStorage.setItem(this.GUEST_IDENTITY_KEY, JSON.stringify(identityData));
    }
  }

  /**
   * 清除访客数据（用于测试或重置）
   */
  clearGuestData() {
    localStorage.removeItem(this.VISITOR_ID_KEY);
    localStorage.removeItem(this.GUEST_USAGE_KEY);
    localStorage.removeItem(this.GUEST_IDENTITY_KEY);
    localStorage.removeItem(this.GUEST_SESSIONS_KEY);
    console.log('🧹 访客数据已清除');
  }

  /**
   * 获取访客使用统计
   */
  getGuestStats() {
    const identity = localStorage.getItem(this.GUEST_IDENTITY_KEY);
    const sessions = JSON.parse(localStorage.getItem(this.GUEST_SESSIONS_KEY) || '[]');
    
    if (!identity) {
      return null;
    }
    
    const identityData = JSON.parse(identity);
    
    return {
      visitorId: identityData.visitorId,
      totalMinutesUsed: identityData.usageInfo.totalMinutesUsed,
      remainingMinutes: Math.max(0, this.GUEST_LIMIT_MINUTES - identityData.usageInfo.totalMinutesUsed),
      sessionsCount: sessions.length,
      createdAt: identityData.usageInfo.createdAt,
      lastUsedAt: identityData.usageInfo.lastUsedAt
    };
  }
}

// 导出单例实例
export const guestIdentityService = new GuestIdentityService();
export default guestIdentityService;