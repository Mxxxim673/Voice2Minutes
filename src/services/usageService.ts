import { guestIdentityService } from './guestIdentityService';
import { usageTracker } from './usageTracker';

export interface UsageRecord {
  id: string;
  userId: string;
  date: string;
  duration: number; // in minutes
  audioFileName: string;
  audioFileSize: number;
  transcriptionLength: number;
  createdAt: string;
}

export interface UsageStats {
  date: string;
  duration: number;
  files: string[];
}

export interface UserQuota {
  totalMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  status: 'guest' | 'trial' | 'paid' | 'subscription';
  planType?: string;
  subscriptionPeriod?: 'monthly' | 'yearly';
  trialUsed?: number;
  paidMinutesUsed?: number;
}

// Guest usage limits
const GUEST_LIMIT_MINUTES = 5;
const TRIAL_LIMIT_MINUTES = 10;

// Admin detection helper function
export const isAdminUser = (): boolean => {
  try {
    // Method 1: Check specific admin email
    const userData = localStorage.getItem('userData');
    if (userData) {
      const user = JSON.parse(userData);
      if (user.email === 'max.z.software@gmail.com') {
        return true;
      }
    }
    
    // Method 2: Check admin token
    const token = localStorage.getItem('authToken');
    if (token === 'admin_token') {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

export const getAudioDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    console.log('🎵 开始计算真实音频时长:', {
      文件名: file.name,
      文件大小: file.size + ' bytes',
      文件类型: file.type
    });
    
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    
    const timeoutId = setTimeout(async () => {
      URL.revokeObjectURL(url);
      console.warn('⚠️ Audio元素加载超时 (5秒)，尝试Web Audio API');
      
      // 超时时也尝试Web Audio API
      try {
        const durationMinutes = await getAudioDurationWithWebAudio(file);
        resolve(durationMinutes);
      } catch (webAudioError) {
        console.error('❌ Web Audio API也超时/失败，最终使用估算:', webAudioError);
        const estimatedDurationMinutes = estimateAudioDuration(file);
        console.log('📊 最终回退到估算时长:', estimatedDurationMinutes.toFixed(4) + 'min');
        resolve(estimatedDurationMinutes);
      }
    }, 5000); // 增加超时时间到5秒
    
    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      
      const durationSeconds = audio.duration;
      const durationMinutes = durationSeconds / 60;
      
      console.log('✅ 真实音频时长检测成功:', {
        文件: file.name,
        时长秒: durationSeconds.toFixed(3) + 's',
        时长分钟: durationMinutes.toFixed(4) + 'min',
        文件大小: file.size + ' bytes'
      });
      
      resolve(durationMinutes);
    });
    
    audio.addEventListener('error', async (e) => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      console.warn('⚠️ Audio元素加载失败，尝试Web Audio API:', {
        文件: file.name,
        错误: e,
        文件大小: file.size + ' bytes'
      });
      
      // 使用Web Audio API作为备选方案
      try {
        const durationMinutes = await getAudioDurationWithWebAudio(file);
        resolve(durationMinutes);
      } catch (webAudioError) {
        console.error('❌ Web Audio API也失败，最终使用估算:', webAudioError);
        const estimatedDurationMinutes = estimateAudioDuration(file);
        console.log('📊 回退到估算时长:', estimatedDurationMinutes.toFixed(4) + 'min');
        resolve(estimatedDurationMinutes);
      }
    });
    
    audio.src = url;
  });
};

// 使用Web Audio API获取音频时长的备选方案
const getAudioDurationWithWebAudio = async (file: File): Promise<number> => {
  console.log('🎛️ 使用Web Audio API检测时长:', file.name);
  
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const durationSeconds = audioBuffer.duration;
    const durationMinutes = durationSeconds / 60;
    
    console.log('✅ Web Audio API时长检测成功:', {
      文件: file.name,
      时长秒: durationSeconds.toFixed(3) + 's',
      时长分钟: durationMinutes.toFixed(4) + 'min',
      采样率: audioBuffer.sampleRate + 'Hz',
      声道数: audioBuffer.numberOfChannels
    });
    
    audioContext.close();
    return durationMinutes;
  } catch (error) {
    console.error('❌ Web Audio API解码失败:', error);
    throw error;
  }
};

// 专门用于录音文件的时长估算（仅作备选方案）
const estimateRecordingDuration = (file: File): number => {
  // 录音文件通常使用比较标准的比特率
  // WebM/OGG 格式通常在 32-128 kbps
  let estimatedBitrate = 64; // kbps，比较保守的估算
  
  // 根据文件类型调整比特率估算
  if (file.type.includes('webm')) {
    estimatedBitrate = 64; // WebM 通常 64kbps
  } else if (file.type.includes('ogg')) {
    estimatedBitrate = 80; // OGG 通常稍高
  } else if (file.type.includes('wav')) {
    estimatedBitrate = 1411; // WAV 无压缩，约1411kbps
  }
  
  // 计算时长：文件大小(bytes) / (比特率(kbps) * 1024 / 8) / 60
  const fileSizeBytes = file.size;
  const bytesPerSecond = (estimatedBitrate * 1024) / 8;
  const durationSeconds = fileSizeBytes / bytesPerSecond;
  const durationMinutes = durationSeconds / 60;
  
  console.log('📊 基于文件大小的时长估算:', {
    文件: file.name,
    文件大小: fileSizeBytes + ' bytes',
    估算比特率: estimatedBitrate + ' kbps',
    估算时长秒: durationSeconds.toFixed(3) + 's',
    估算时长分钟: durationMinutes.toFixed(4) + 'min'
  });
  
  // 为录音文件设置合理的上限（一般不会超过10分钟）
  return Math.min(durationMinutes, 10);
};

// 通用音频文件时长估算（仅作备选方案）
const estimateAudioDuration = (file: File): number => {
  // 更保守的估算方式
  let estimatedBytesPerSecond = 16000; // 约128kbps
  let formatInfo = 'MP3 128kbps';
  
  // 根据文件类型调整
  if (file.type.includes('wav')) {
    estimatedBytesPerSecond = 176400; // WAV 44.1kHz 16bit stereo
    formatInfo = 'WAV 44.1kHz 16bit stereo';
  } else if (file.type.includes('flac')) {
    estimatedBytesPerSecond = 88200; // FLAC 压缩率约50%
    formatInfo = 'FLAC compressed';
  } else if (file.type.includes('mp3')) {
    estimatedBytesPerSecond = 16000; // MP3 128kbps
    formatInfo = 'MP3 128kbps';
  }
  
  const durationSeconds = file.size / estimatedBytesPerSecond;
  const durationMinutes = durationSeconds / 60;
  
  console.log('📊 通用音频文件时长估算:', {
    文件: file.name,
    文件类型: file.type,
    格式假设: formatInfo,
    文件大小: file.size + ' bytes',
    估算时长秒: durationSeconds.toFixed(3) + 's',
    估算时长分钟: durationMinutes.toFixed(4) + 'min'
  });
  
  // 设置合理上限
  return Math.min(durationMinutes, 60); // 最多60分钟
};

export const recordUsage = async (audioFile: File, transcriptionText: string): Promise<void> => {
  try {
    const duration = await getAudioDuration(audioFile);
    const token = localStorage.getItem('authToken');
    const isGuest = localStorage.getItem('guestMode') === 'true';
    
    if (isGuest) {
      // 更新访客身份服务中的使用量
      guestIdentityService.updateUsage(duration);
      
      // Record guest usage in localStorage (兼容性保留)
      const currentUsage = Number(localStorage.getItem('guestUsedMinutes') || '0');
      const newUsage = currentUsage + duration;
      localStorage.setItem('guestUsedMinutes', newUsage.toString());
      
      // Store usage record for potential conversion later
      const guestUsage = JSON.parse(localStorage.getItem('guestUsageHistory') || '[]');
      guestUsage.push({
        date: new Date().toISOString().split('T')[0],
        duration,
        fileName: audioFile.name,
        transcriptionLength: transcriptionText.length,
        timestamp: Date.now()
      });
      localStorage.setItem('guestUsageHistory', JSON.stringify(guestUsage));
      
      // 上报最新的使用量到后端
      try {
        const identity = await guestIdentityService.getGuestIdentity();
        await guestIdentityService.reportGuestIdentity(identity);
      } catch (error) {
        console.warn('⚠️ 上报访客使用量失败:', error);
      }
    } else if (token) {
      // Record usage for authenticated users (including admin)
      // First, try to update local userData
      try {
        const userData = localStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          const updatedUser = {
            ...user,
            usedMinutes: (user.usedMinutes || 0) + duration
          };
          
          // Update both userData and adminUserData if admin
          localStorage.setItem('userData', JSON.stringify(updatedUser));
          if (user.email === 'max.z.software@gmail.com') {
            localStorage.setItem('adminUserData', JSON.stringify(updatedUser));
          }
          
          console.log(`📊 使用量已更新: +${duration.toFixed(2)}分钟`);
        }
      } catch (error) {
        console.error('Error updating local usage:', error);
      }
      
      // Try API call for backend sync (optional for admin)
      try {
        await fetch('/api/usage/record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            duration,
            audioFileName: audioFile.name,
            audioFileSize: audioFile.size,
            transcriptionLength: transcriptionText.length,
            date: new Date().toISOString().split('T')[0]
          })
        });
      } catch (apiError) {
        console.warn('API call failed, but local usage recorded:', apiError);
      }
    }
  } catch (error) {
    console.error('Failed to record usage:', error);
  }
};

export const checkUsageLimit = async (audioFile: File): Promise<{
  allowed: boolean;
  remainingMinutes: number;
  message?: string;
  messageKey?: string; // 添加消息键用于多语言
  messageParams?: Record<string, string | number>; // 添加消息参数
}> => {
  try {
    const duration = await getAudioDuration(audioFile);
    const token = localStorage.getItem('authToken');
    const isGuest = localStorage.getItem('guestMode') === 'true';
    
    // 访客模式优先级最高，即使有token也要先检查访客状态
    if (isGuest) {
      // 使用新的访客身份验证服务
      const validationResult = await guestIdentityService.validateGuestAccess();
      
      if (!validationResult.isAllowed) {
        return {
          allowed: false,
          remainingMinutes: validationResult.remainingMinutes,
          message: `Guest access denied: ${validationResult.warnings.join(', ')}`,
          messageKey: 'audioToText.guestAccessDenied',
          messageParams: {
            reasons: validationResult.warnings.join(', '),
            remainingMinutes: validationResult.remainingMinutes.toFixed(1)
          }
        };
      }
      
      if (duration > validationResult.remainingMinutes) {
        return {
          allowed: false,
          remainingMinutes: validationResult.remainingMinutes,
          message: `Guest users can only use ${GUEST_LIMIT_MINUTES} minutes total. You have ${validationResult.remainingMinutes.toFixed(1)} minutes remaining.`,
          messageKey: 'audioToText.guestUserLimitMessage',
          messageParams: { 
            totalMinutes: GUEST_LIMIT_MINUTES.toFixed(1), 
            remainingMinutes: validationResult.remainingMinutes.toFixed(1) 
          }
        };
      }
      
      return { allowed: true, remainingMinutes: validationResult.remainingMinutes };
    } else if (token) {
      // For authenticated users (including admin), check local userData
      // 但要再次确保不是访客用户（双重检查）
      if (localStorage.getItem('guestMode') === 'true') {
        const currentUsage = Number(localStorage.getItem('guestUsedMinutes') || '0');
        const remaining = GUEST_LIMIT_MINUTES - currentUsage;
        
        if (duration > remaining) {
          return {
            allowed: false,
            remainingMinutes: remaining,
            message: `Guest users can only use ${GUEST_LIMIT_MINUTES} minutes total. You have ${remaining.toFixed(1)} minutes remaining.`,
            messageKey: 'audioToText.guestUserLimitMessage',
            messageParams: { 
              totalMinutes: GUEST_LIMIT_MINUTES.toFixed(1), 
              remainingMinutes: remaining.toFixed(1) 
            }
          };
        }
        return { allowed: true, remainingMinutes: remaining };
      }
      
      try {
        const userData = localStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          const totalMinutes = user.quotaMinutes || 10;
          const usedMinutes = user.usedMinutes || 0;
          const remaining = totalMinutes - usedMinutes;
          
          if (duration > remaining) {
            return {
              allowed: false,
              remainingMinutes: remaining,
              message: `You have ${remaining.toFixed(1)} minutes remaining in your current plan.`,
              messageKey: 'audioToText.userQuotaExceededMessage',
              messageParams: { 
                remainingMinutes: remaining.toFixed(1),
                requiredMinutes: duration.toFixed(1)
              }
            };
          }
          
          return { allowed: true, remainingMinutes: remaining };
        }
      } catch (error) {
        console.error('Error parsing userData:', error);
      }
      
      // Fallback: try API call for non-admin users
      try {
        const response = await fetch('/api/usage/check-limit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ requiredMinutes: duration })
        });
        
        if (response.ok) {
          return await response.json();
        }
      } catch {
        console.warn('API call failed, using localStorage fallback');
      }
      
      // Final fallback: use trial limits
      return { allowed: true, remainingMinutes: TRIAL_LIMIT_MINUTES };
    }
    
    // 未登录用户默认给予游客限制（5分钟）
    // 如果是访客模式，使用访客消息而不是未注册用户消息
    const isGuestMode = localStorage.getItem('guestMode') === 'true';
    
    const currentUsage = Number(localStorage.getItem('guestUsedMinutes') || '0');
    const remaining = GUEST_LIMIT_MINUTES - currentUsage;
    
    if (duration > remaining) {
      return {
        allowed: false,
        remainingMinutes: remaining,
        message: isGuestMode 
          ? `Guest users can only use ${GUEST_LIMIT_MINUTES} minutes total. You have ${remaining.toFixed(1)} minutes remaining.`
          : `Unregistered users can use ${GUEST_LIMIT_MINUTES} minutes total. You have ${remaining.toFixed(1)} minutes remaining.`,
        messageKey: 'audioToText.guestUserLimitMessage',
        messageParams: { 
          totalMinutes: GUEST_LIMIT_MINUTES.toFixed(1), 
          remainingMinutes: remaining.toFixed(1) 
        }
      };
    }
    
    return { allowed: true, remainingMinutes: remaining };
  } catch (error) {
    console.error('Failed to check usage limit:', error);
    return { allowed: false, remainingMinutes: 0, message: 'Failed to check usage limit' };
  }
};

export const checkRecordingLimit = async (recordingDurationMinutes: number): Promise<{
  allowed: boolean;
  remainingMinutes: number;
  message?: string;
  messageKey?: string;
  messageParams?: Record<string, string | number>;
}> => {
  const token = localStorage.getItem('authToken');
  const isGuest = localStorage.getItem('guestMode') === 'true';
  
  if (isGuest) {
    // 使用新的访客身份验证服务
    const validationResult = await guestIdentityService.validateGuestAccess();
    
    if (!validationResult.isAllowed) {
      return {
        allowed: false,
        remainingMinutes: validationResult.remainingMinutes,
        message: `Guest access denied: ${validationResult.warnings.join(', ')}`,
        messageKey: 'audioToText.guestAccessDenied',
        messageParams: {
          reasons: validationResult.warnings.join(', '),
          remainingMinutes: validationResult.remainingMinutes.toFixed(1)
        }
      };
    }
    
    if (recordingDurationMinutes > validationResult.remainingMinutes) {
      return {
        allowed: false,
        remainingMinutes: validationResult.remainingMinutes,
        message: `Guest users can only use ${GUEST_LIMIT_MINUTES} minutes total. You have ${validationResult.remainingMinutes.toFixed(1)} minutes remaining.`,
        messageKey: 'audioToText.guestUserLimitMessage',
        messageParams: { 
          totalMinutes: GUEST_LIMIT_MINUTES.toFixed(1), 
          remainingMinutes: validationResult.remainingMinutes.toFixed(1) 
        }
      };
    }
    
    return { allowed: true, remainingMinutes: validationResult.remainingMinutes };
  }
  
  // Admin users now follow the same rules as regular users
  // Get remaining minutes from real userData for all authenticated users including admin
  if (token) {
    try {
      const userData = localStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        const remaining = (user.quotaMinutes || 10) - (user.usedMinutes || 0);
        
        if (recordingDurationMinutes > remaining) {
          return {
            allowed: false,
            remainingMinutes: remaining,
            message: `You have ${remaining.toFixed(1)} minutes remaining in your current plan.`,
            messageKey: 'audioToText.userQuotaExceededMessage',
            messageParams: { 
              remainingMinutes: remaining.toFixed(1),
              requiredMinutes: recordingDurationMinutes.toFixed(1)
            }
          };
        }
        
        return { allowed: true, remainingMinutes: remaining };
      }
    } catch (error) {
      console.error('Error checking recording limit:', error);
    }
  }
  
  // Fallback for authenticated users without userData - use trial limit
  return { allowed: true, remainingMinutes: TRIAL_LIMIT_MINUTES };
};

export const getUsageStats = async (days: number = 7): Promise<UsageStats[]> => {
  console.log('📊 获取使用统计，天数:', days);
  
  try {
    // 使用新的 usageTracker 获取真实数据
    const dailyStats = await usageTracker.getUserUsageStats(days);
    
    // 转换为原有接口格式（将秒转换为分钟）
    const result: UsageStats[] = dailyStats.map(day => ({
      date: day.date,
      duration: day.duration / 60, // 转换为分钟
      files: day.files
    }));
    
    console.log('✅ 使用统计获取成功:', {
      天数: days,
      记录数: result.length,
      总时长: result.reduce((sum, day) => sum + day.duration, 0).toFixed(2) + '分钟'
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ 获取使用统计失败:', error);
    // 发生错误时返回空数组，不再使用模拟数据
    return [];
  }
};

export const getUserQuota = async (): Promise<UserQuota> => {
  const token = localStorage.getItem('authToken');
  const isGuest = localStorage.getItem('guestMode') === 'true';
  
  console.log('💰 获取用户配额信息, 是否访客:', isGuest);
  
  // 获取真实使用量
  const realUsedMinutes = await usageTracker.getCurrentUserTotalUsage();
  
  if (isGuest) {
    return {
      totalMinutes: GUEST_LIMIT_MINUTES,
      usedMinutes: realUsedMinutes,
      remainingMinutes: Math.max(0, GUEST_LIMIT_MINUTES - realUsedMinutes),
      status: 'guest'
    };
  }
  
  if (!token) {
    throw new Error('Authentication required');
  }
  
  try {
    const response = await fetch('/api/usage/quota', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user quota');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to get user quota:', error);
    
    // 对于所有登录用户，使用真实使用量数据
    const userData = localStorage.getItem('userData');
    if (userData) {
      const user = JSON.parse(userData);
      
      // 获取用户配额，默认试用用户为10分钟
      let totalMinutes = user.quotaMinutes || TRIAL_LIMIT_MINUTES;
      const userType = user.userType || 'trial';
      
      // 管理员账户有无限制使用量，但显示为一个合理的数值
      if (isAdminUser()) {
        totalMinutes = 9999; // 显示为9999分钟，实际无限制
      }
      
      console.log('💰 登录用户配额信息:', {
        邮箱: user.email,
        用户类型: userType,
        总配额: totalMinutes,
        真实使用量: realUsedMinutes
      });
      
      return {
        totalMinutes,
        usedMinutes: realUsedMinutes,
        remainingMinutes: Math.max(0, totalMinutes - realUsedMinutes),
        status: userType,
        planType: user.planType,
        trialUsed: userType === 'trial' ? realUsedMinutes : 0,
        paidMinutesUsed: userType === 'paid' ? realUsedMinutes : 0
      };
    }
    
    // 回退情况：返回基于真实使用量的默认配额
    return {
      totalMinutes: TRIAL_LIMIT_MINUTES,
      usedMinutes: realUsedMinutes,
      remainingMinutes: Math.max(0, TRIAL_LIMIT_MINUTES - realUsedMinutes),
      status: 'trial',
      trialUsed: realUsedMinutes,
      paidMinutesUsed: 0
    };
  }
};

export const truncateAudioForLimit = async (
  audioFile: File, 
  maxMinutes: number
): Promise<{ file: File; wasTruncated: boolean; originalDuration: number }> => {
  try {
    const originalDuration = await getAudioDuration(audioFile);
    
    if (originalDuration <= maxMinutes) {
      return {
        file: audioFile,
        wasTruncated: false,
        originalDuration
      };
    }
    
    // For actual implementation, you would use Web Audio API to truncate
    // For now, we'll return the original file with a flag
    return {
      file: audioFile,
      wasTruncated: true,
      originalDuration
    };
  } catch (error) {
    console.error('Failed to process audio file:', error);
    return {
      file: audioFile,
      wasTruncated: false,
      originalDuration: 0
    };
  }
};

// 这些函数已被 usageTracker 替代，不再需要模拟数据