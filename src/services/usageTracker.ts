import { guestIdentityService } from './guestIdentityService';

export interface UsageRecord {
  id: string;
  userId: string; // visitorId for guests, email for logged users
  userType: 'guest' | 'trial' | 'paid' | 'admin';
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO string
  duration: number; // in seconds (changed from minutes)
  fileName: string;
  audioFileSize?: number;
  transcriptionLength?: number;
}

export interface DailyUsageStats {
  date: string;
  duration: number; // in seconds (changed from minutes)
  files: string[];
  records: UsageRecord[];
}

class UsageTracker {
  private readonly USAGE_RECORDS_KEY = 'usage_records';
  private readonly USER_TOTAL_USAGE_KEY = 'user_total_usage';

  /**
   * 获取当前用户标识符
   */
  private async getCurrentUserId(): Promise<string> {
    // 优先使用登录用户的邮箱
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.email) {
          return user.email;
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }

    // 使用访客身份
    const guestIdentity = await guestIdentityService.getGuestIdentity();
    return guestIdentity.visitorId;
  }

  /**
   * 获取当前用户类型
   */
  private getCurrentUserType(): 'guest' | 'trial' | 'paid' | 'admin' {
    const userData = localStorage.getItem('userData');
    const isGuest = localStorage.getItem('guestMode') === 'true';
    
    if (isGuest) {
      return 'guest';
    }

    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.email === 'max.z.software@gmail.com') {
          return 'admin';
        }
        return user.userType || 'trial';
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }

    return 'guest';
  }

  /**
   * 记录使用量
   * @param duration 音频时长（秒）
   */
  async recordUsage(duration: number, fileName: string, audioFileSize?: number, transcriptionLength?: number): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      const userType = this.getCurrentUserType();
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const record: UsageRecord = {
        id: `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        userType,
        date: dateStr,
        timestamp: now.toISOString(),
        duration,
        fileName,
        audioFileSize,
        transcriptionLength
      };

      // 获取现有记录
      const existingRecords = this.getAllUsageRecords();
      existingRecords.push(record);

      // 保存更新后的记录
      localStorage.setItem(this.USAGE_RECORDS_KEY, JSON.stringify(existingRecords));

      // 更新总使用量
      await this.updateTotalUsage(userId, duration);

      console.log('📊 使用量记录已保存:', {
        用户ID: userId.substring(0, 8) + '...',
        用户类型: userType,
        时长秒: duration.toFixed(3) + 's',
        时长分钟: (duration / 60).toFixed(4) + 'min',
        文件: fileName,
        时间戳: now.toISOString(),
        记录ID: record.id
      });
      
      // 添加调用堆栈以便调试
      console.trace('📍 使用量记录调用堆栈:');

    } catch (error) {
      console.error('❌ 记录使用量失败:', error);
    }
  }

  /**
   * 更新用户总使用量 - 从实际记录重新计算并同步
   */
  private async updateTotalUsage(userId: string, additionalMinutes: number): Promise<void> {
    // 从实际记录重新计算总使用量，而不是简单累加
    const allRecords = this.getAllUsageRecords();
    const userRecords = allRecords.filter(record => record.userId === userId);
    const actualTotal = userRecords.reduce((sum, record) => sum + record.duration, 0);
    
    // 更新缓存的总使用量数据
    const totalUsageData = this.getTotalUsageData();
    totalUsageData[userId] = actualTotal;
    localStorage.setItem(this.USER_TOTAL_USAGE_KEY, JSON.stringify(totalUsageData));

    // 同步更新相关的使用量存储
    if (this.getCurrentUserType() === 'guest') {
      const totalMinutes = actualTotal / 60; // 转换为分钟存储
      localStorage.setItem('guestUsedMinutes', totalMinutes.toString());
    }
    
    console.log('🔄 总使用量已同步:', {
      用户ID: userId.substring(0, 8) + '...',
      实际总量秒: actualTotal.toFixed(3) + 's',
      实际总量分钟: (actualTotal / 60).toFixed(4) + 'min',
      记录数: userRecords.length
    });
  }

  /**
   * 获取所有使用记录
   */
  private getAllUsageRecords(): UsageRecord[] {
    try {
      const records = localStorage.getItem(this.USAGE_RECORDS_KEY);
      return records ? JSON.parse(records) : [];
    } catch (error) {
      console.error('Error parsing usage records:', error);
      return [];
    }
  }

  /**
   * 获取总使用量数据
   */
  private getTotalUsageData(): Record<string, number> {
    try {
      const data = localStorage.getItem(this.USER_TOTAL_USAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error parsing total usage data:', error);
      return {};
    }
  }

  /**
   * 获取当前用户的使用统计
   */
  async getUserUsageStats(days: number = 7): Promise<DailyUsageStats[]> {
    try {
      const userId = await this.getCurrentUserId();
      const allRecords = this.getAllUsageRecords();
      
      // 筛选当前用户的记录
      const userRecords = allRecords.filter(record => record.userId === userId);
      
      // 计算日期范围
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days + 1);

      // 按日期分组
      const dailyStats: Record<string, DailyUsageStats> = {};
      
      // 初始化日期范围
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        dailyStats[dateStr] = {
          date: dateStr,
          duration: 0,
          files: [],
          records: []
        };
      }

      // 填充实际数据
      userRecords.forEach(record => {
        const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
        if (dailyStats[recordDate]) {
          dailyStats[recordDate].duration += record.duration;
          dailyStats[recordDate].files.push(record.fileName);
          dailyStats[recordDate].records.push(record);
        }
      });

      // 转换为数组并排序
      const result = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
      
      const totalSeconds = result.reduce((sum, day) => sum + day.duration, 0);
      console.log('📈 用户使用统计已生成:', {
        用户ID: userId.substring(0, 8) + '...',
        天数: days,
        记录数: userRecords.length,
        总时长秒: totalSeconds.toFixed(3) + 's',
        总时长分钟: (totalSeconds / 60).toFixed(4) + 'min'
      });

      return result;
      
    } catch (error) {
      console.error('❌ 获取使用统计失败:', error);
      return [];
    }
  }

  /**
   * 获取当前用户总使用量 - 从实际记录重新计算
   */
  async getCurrentUserTotalUsage(): Promise<number> {
    try {
      const userId = await this.getCurrentUserId();
      const allRecords = this.getAllUsageRecords();
      
      // 筛选当前用户的记录并计算总使用量
      const userRecords = allRecords.filter(record => record.userId === userId);
      const totalUsage = userRecords.reduce((sum, record) => sum + record.duration, 0);
      
      console.log('📊 重新计算用户总使用量:', {
        用户ID: userId.substring(0, 8) + '...',
        记录数: userRecords.length,
        总使用量秒: totalUsage.toFixed(3) + 's',
        总使用量分钟: (totalUsage / 60).toFixed(4) + 'min'
      });
      
      return totalUsage / 60; // 返回分钟单位供现有代码兼容
    } catch (error) {
      console.error('❌ 获取用户总使用量失败:', error);
      return 0;
    }
  }

  /**
   * 清除用户使用记录（仅供测试）
   */
  async clearUserUsageRecords(): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      const allRecords = this.getAllUsageRecords();
      const otherUserRecords = allRecords.filter(record => record.userId !== userId);
      
      localStorage.setItem(this.USAGE_RECORDS_KEY, JSON.stringify(otherUserRecords));
      
      const totalUsageData = this.getTotalUsageData();
      delete totalUsageData[userId];
      localStorage.setItem(this.USER_TOTAL_USAGE_KEY, JSON.stringify(totalUsageData));

      // 清除相关的localStorage数据
      if (this.getCurrentUserType() === 'guest') {
        localStorage.setItem('guestUsedMinutes', '0');
      }

      console.log('🗑️ 用户使用记录已清除:', userId.substring(0, 8) + '...');
    } catch (error) {
      console.error('❌ 清除使用记录失败:', error);
    }
  }

  /**
   * 清除所有使用记录（仅供测试）
   */
  clearAllUsageRecords(): void {
    localStorage.removeItem(this.USAGE_RECORDS_KEY);
    localStorage.removeItem(this.USER_TOTAL_USAGE_KEY);
    localStorage.removeItem('guestUsedMinutes');
    console.log('🗑️ 所有使用记录已清除');
  }

  /**
   * 获取详细的使用量统计（测试用）
   */
  async getDetailedUsageStats(): Promise<{
    totalRecords: number;
    totalSeconds: number;
    totalMinutes: number;
    records: UsageRecord[];
  }> {
    const userId = await this.getCurrentUserId();
    const allRecords = this.getAllUsageRecords();
    const userRecords = allRecords.filter(record => record.userId === userId);
    const totalSeconds = userRecords.reduce((sum, record) => sum + record.duration, 0);
    
    return {
      totalRecords: userRecords.length,
      totalSeconds,
      totalMinutes: totalSeconds / 60,
      records: userRecords
    };
  }
}

export const usageTracker = new UsageTracker();