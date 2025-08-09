// 容错版本的usageService

import { usageService } from './usageService';
import { safeCall, ServiceWrapper } from '../utils/errorHandler';

// 默认用户统计信息
const defaultUserStats = {
  userType: 'trial' as const,
  totalQuota: 600, // 10 minutes in seconds
  usedMinutes: 0,
  remainingMinutes: 10,
  quotaMinutes: 10
};

// 默认用户配额
const defaultUserQuota = {
  totalMinutes: 10,
  usedMinutes: 0,
  remainingMinutes: 10,
  status: 'trial' as const,
  trialUsed: 0,
  paidMinutesUsed: 0
};

// 容错版本的服务
export const safeUsageService = {
  // 安全的获取用户统计
  getUserStats: async () => {
    return await safeCall(
      () => usageService.getUserStats(),
      { fallbackValue: defaultUserStats }
    ) || defaultUserStats;
  },
  
  // 安全的获取用户配额
  getUserQuota: async () => {
    return await safeCall(
      () => usageService.getUserQuota(),
      { fallbackValue: defaultUserQuota }
    ) || defaultUserQuota;
  },
  
  // 安全的记录使用量
  recordUsage: async (audioFile: File, transcriptionText: string) => {
    return await safeCall(
      () => usageService.recordUsage(audioFile, transcriptionText),
      { fallbackValue: undefined }
    );
  },
  
  // 安全的检查使用限制
  checkUsageLimit: async (audioFile: File) => {
    const defaultResult = {
      allowed: true,
      remainingMinutes: 10,
      message: '使用默认限制'
    };
    
    return await safeCall(
      () => usageService.checkUsageLimit(audioFile),
      { fallbackValue: defaultResult }
    ) || defaultResult;
  },
  
  // 安全的检查录音限制
  checkRecordingLimit: async (recordingDurationMinutes: number) => {
    const defaultResult = {
      allowed: true,
      remainingMinutes: 10,
      message: '使用默认限制'
    };
    
    return await safeCall(
      () => usageService.checkRecordingLimit(recordingDurationMinutes),
      { fallbackValue: defaultResult }
    ) || defaultResult;
  },
  
  // 安全的获取音频时长
  getAudioDuration: async (file: File) => {
    const estimatedDuration = Math.min(file.size / 16000 / 60, 60); // 粗略估算
    
    return await safeCall(
      () => usageService.getAudioDuration(file),
      { fallbackValue: estimatedDuration }
    ) || estimatedDuration;
  },
  
  // 安全的获取使用统计
  getUsageStats: async (days: number = 7) => {
    return await safeCall(
      () => usageService.getUsageStats(days),
      { fallbackValue: [] }
    ) || [];
  }
};

// 为了向后兼容，也导出原始服务的包装版本
const serviceWrapper = new ServiceWrapper(usageService, {
  showConsoleLog: true,
  retryCount: 2,
  retryDelay: 500
});

// 创建所有安全方法
export const wrappedUsageService = {
  getUserStats: serviceWrapper.createSafeMethod('getUserStats', defaultUserStats),
  getUserQuota: serviceWrapper.createSafeMethod('getUserQuota', defaultUserQuota),
  recordUsage: serviceWrapper.createSafeMethod('recordUsage'),
  checkUsageLimit: serviceWrapper.createSafeMethod('checkUsageLimit', { allowed: true, remainingMinutes: 10 }),
  checkRecordingLimit: serviceWrapper.createSafeMethod('checkRecordingLimit', { allowed: true, remainingMinutes: 10 }),
  getAudioDuration: serviceWrapper.createSafeMethod('getAudioDuration', 1), // 1分钟默认值
  getUsageStats: serviceWrapper.createSafeMethod('getUsageStats', [])
};