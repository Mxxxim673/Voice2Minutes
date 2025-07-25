// Mock API service for demonstrating usage limits and user management
// In production, these would be real backend API calls

export interface ApiQuotaLimits {
  guestLimitMinutes: number;
  trialLimitMinutes: number;
  enforceLimits: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  remainingQuota?: number;
}

// Configuration for different user types
const API_LIMITS: ApiQuotaLimits = {
  guestLimitMinutes: 5,      // 5 minutes for guests
  trialLimitMinutes: 10,     // 10 minutes for trial users
  enforceLimits: true        // Enable quota enforcement
};

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const enforceApiQuotaLimits = async (
  durationMinutes: number,
  userType: 'guest' | 'trial' | 'paid' | 'subscription' | 'admin',
  currentUsage: number
): Promise<ApiResponse<{ allowed: boolean; message?: string }>> => {
  await delay(200); // Simulate network delay
  
  if (!API_LIMITS.enforceLimits) {
    return {
      success: true,
      data: { allowed: true }
    };
  }
  
  let userLimit: number;
  
  // 获取用户的实际配额，而不是使用硬编码值
  try {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const user = JSON.parse(userData);
      userLimit = user.quotaMinutes || API_LIMITS.trialLimitMinutes;
      // 使用用户的实际已使用分钟数
      currentUsage = user.usedMinutes || 0;
    } else {
      // 回退到默认值
      switch (userType) {
        case 'guest':
          userLimit = API_LIMITS.guestLimitMinutes;
          break;
        case 'trial':
          userLimit = API_LIMITS.trialLimitMinutes;
          break;
        case 'paid':
        case 'subscription':
          userLimit = 300;
          break;
        default:
          userLimit = API_LIMITS.trialLimitMinutes;
      }
    }
  } catch (error) {
    console.error('Error getting user quota:', error);
    userLimit = API_LIMITS.trialLimitMinutes;
  }
  
  const remainingQuota = userLimit - currentUsage;
  
  if (durationMinutes > remainingQuota) {
    let message: string;
    if (remainingQuota <= 0) {
      message = '您的试用时长已结束! 请购买更多时长继续使用。';
    } else if (userType === 'guest') {
      message = `Guest users are limited to ${userLimit} minutes total. You have ${remainingQuota.toFixed(1)} minutes remaining. Please register for more quota.`;
    } else {
      message = `您还剩余 ${remainingQuota.toFixed(1)} 分钟配额，无法处理 ${durationMinutes.toFixed(1)} 分钟的音频。`;
    }
    
    return {
      success: true,
      data: { 
        allowed: false, 
        message 
      },
      remainingQuota
    };
  }
  
  return {
    success: true,
    data: { allowed: true },
    remainingQuota
  };
};

export const preprocessAudioForLimits = async (
  audioFile: File,
  userType: 'guest' | 'trial' | 'paid' | 'subscription' | 'admin',
  currentUsage: number
): Promise<ApiResponse<{ 
  processedFile: File; 
  wasTruncated: boolean; 
  originalDuration: number;
  processedDuration: number;
}>> => {
  await delay(300); // Simulate processing time
  
  try {
    // Get audio duration (simplified - in production use proper audio analysis)
    const duration = await getAudioDurationMinutes(audioFile);
    
    // Check quota limits
    const quotaCheck = await enforceApiQuotaLimits(duration, userType, currentUsage);
    
    if (!quotaCheck.data?.allowed) {
      // Calculate how much we can process
      const remainingQuota = quotaCheck.remainingQuota || 0;
      
      if (remainingQuota <= 0) {
        return {
          success: false,
          error: quotaCheck.data?.message || 'Usage quota exceeded'
        };
      }
      
      // 实现简化的音频截断逻辑
      // 通过时间比例估算需要保留的文件大小
      const truncationRatio = remainingQuota / duration;
      const estimatedTruncatedSize = Math.floor(audioFile.size * truncationRatio);
      
      try {
        // 创建截断的音频文件 (简化实现)
        const arrayBuffer = await audioFile.arrayBuffer();
        const truncatedBuffer = arrayBuffer.slice(0, estimatedTruncatedSize);
        const truncatedFile = new File([truncatedBuffer], audioFile.name, { 
          type: audioFile.type 
        });
        
        console.log(`🔪 音频截断: ${duration.toFixed(1)}分钟 → ${remainingQuota.toFixed(1)}分钟`);
        
        return {
          success: true,
          data: {
            processedFile: truncatedFile,
            wasTruncated: true,
            originalDuration: duration,
            processedDuration: remainingQuota
          }
        };
      } catch (error) {
        console.error('音频截断失败:', error);
        // 截断失败时返回原文件，但标记为需要截断
        return {
          success: true,
          data: {
            processedFile: audioFile,
            wasTruncated: true,
            originalDuration: duration,
            processedDuration: remainingQuota
          }
        };
      }
    }
    
    return {
      success: true,
      data: {
        processedFile: audioFile,
        wasTruncated: false,
        originalDuration: duration,
        processedDuration: duration
      }
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to process audio file'
    };
  }
};

export const recordApiUsage = async (
  audioFile: File,
  transcriptionText: string,
  userType: 'guest' | 'trial' | 'paid' | 'subscription' | 'admin',
  userId?: string
): Promise<ApiResponse<{ usageRecorded: boolean }>> => {
  await delay(100); // Simulate network delay
  
  try {
    const duration = await getAudioDurationMinutes(audioFile);
    
    // In production, this would make a real API call to record usage
    const usageRecord = {
      userId: userId || 'guest',
      userType,
      duration,
      fileName: audioFile.name,
      fileSize: audioFile.size,
      transcriptionLength: transcriptionText.length,
      timestamp: new Date().toISOString()
    };
    
    console.log('Recording API usage:', usageRecord);
    
    // Update local storage for guests
    if (userType === 'guest') {
      const currentUsage = Number(localStorage.getItem('guestUsedMinutes') || '0');
      localStorage.setItem('guestUsedMinutes', (currentUsage + duration).toString());
    }
    
    return {
      success: true,
      data: { usageRecorded: true }
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to record usage'
    };
  }
};

// Helper function to get audio duration
const getAudioDurationMinutes = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration / 60); // Convert to minutes
    });
    
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load audio file'));
    });
    
    audio.src = url;
  });
};

// API configuration
export const updateApiLimits = (newLimits: Partial<ApiQuotaLimits>) => {
  Object.assign(API_LIMITS, newLimits);
};

export const getApiLimits = (): ApiQuotaLimits => {
  return { ...API_LIMITS };
};

// Real-time quota monitoring (would be WebSocket in production)
export const startQuotaMonitoring = (
  userId: string,
  onQuotaUpdate: (remainingMinutes: number) => void
) => {
  // Mock implementation - in production this would use WebSocket
  const interval = setInterval(() => {
    // Simulate quota updates
    const mockRemainingMinutes = Math.max(0, Math.random() * 100);
    onQuotaUpdate(mockRemainingMinutes);
  }, 30000); // Check every 30 seconds
  
  return () => clearInterval(interval);
};

// Mock backend health check
export const checkApiHealth = async (): Promise<ApiResponse<{ status: string }>> => {
  await delay(100);
  
  return {
    success: true,
    data: { status: 'healthy' }
  };
};

export default {
  enforceApiQuotaLimits,
  preprocessAudioForLimits,
  recordApiUsage,
  updateApiLimits,
  getApiLimits,
  startQuotaMonitoring,
  checkApiHealth
};