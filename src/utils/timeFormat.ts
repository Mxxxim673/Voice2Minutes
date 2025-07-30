// 时间格式化工具函数
import i18n from '../i18n/config';

/**
 * 将分钟转换为直观的时间格式
 * @param minutes 分钟数
 * @returns 格式化的时间字符串 (例: "1h 23m 45s", "5m 30s", "45s")
 */
export const formatDuration = (minutes: number): string => {
  const totalSeconds = Math.floor(minutes * 60);
  
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  const parts: string[] = [];
  
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  
  if (mins > 0) {
    parts.push(`${mins}m`);
  }
  
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs}s`);
  }
  
  return parts.join(' ');
};

/**
 * 将秒转换为直观的时间格式
 * @param seconds 秒数
 * @returns 格式化的时间字符串
 */
export const formatDurationFromSeconds = (seconds: number): string => {
  return formatDuration(seconds / 60);
};

/**
 * 将录音时间格式化为 MM:SS 格式（录音弹窗专用）
 * @param seconds 秒数
 * @returns MM:SS 格式的字符串
 */
export const formatRecordingTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * 获取剩余时间的简短描述
 * @param minutes 分钟数
 * @returns 简短的时间描述 (格式: "2h 2m 30s")
 */
export const formatRemainingTime = (minutes: number): string => {
  if (minutes <= 0) {
    return '0s';
  }
  
  if (minutes < 1) {
    return `${Math.floor(minutes * 60)}s`;
  }
  
  if (minutes < 60) {
    const wholeMins = Math.floor(minutes);
    const remainingSecs = Math.floor((minutes - wholeMins) * 60);
    
    if (remainingSecs === 0) {
      return `${wholeMins}m`;
    } else {
      return `${wholeMins}m ${remainingSecs}s`;
    }
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  
  if (mins === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${mins}m`;
  }
};

/**
 * 获取剩余时间的本地化描述（用于剩余时间显示板块）
 * @param minutes 分钟数
 * @returns 本地化的时间描述
 */
export const formatRemainingTimeLocalized = (minutes: number): string => {
  const currentLanguage = i18n.language;
  
  if (minutes <= 0) {
    if (currentLanguage === 'zh') {
      return '0秒';
    } else if (currentLanguage === 'ja') {
      return '0秒';
    } else {
      return '0s';
    }
  }
  
  if (minutes < 1) {
    const secs = Math.floor(minutes * 60);
    if (currentLanguage === 'zh') {
      return `${secs}秒`;
    } else if (currentLanguage === 'ja') {
      return `${secs}秒`;
    } else {
      return `${secs}s`;
    }
  }
  
  if (minutes < 60) {
    const wholeMins = Math.floor(minutes);
    const remainingSecs = Math.floor((minutes - wholeMins) * 60);
    
    if (remainingSecs === 0) {
      if (currentLanguage === 'zh') {
        return `${wholeMins}分钟`;
      } else if (currentLanguage === 'ja') {
        return `${wholeMins}分`;
      } else {
        return `${wholeMins}m`;
      }
    } else {
      if (currentLanguage === 'zh') {
        return `${wholeMins}分钟${remainingSecs}秒`;
      } else if (currentLanguage === 'ja') {
        return `${wholeMins}分${remainingSecs}秒`;
      } else {
        return `${wholeMins}m ${remainingSecs}s`;
      }
    }
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  
  if (mins === 0) {
    if (currentLanguage === 'zh') {
      return `${hours}小时`;
    } else if (currentLanguage === 'ja') {
      return `${hours}時間`;
    } else {
      return `${hours}h`;
    }
  } else {
    if (currentLanguage === 'zh') {
      return `${hours}小时${mins}分钟`;
    } else if (currentLanguage === 'ja') {
      return `${hours}時間${mins}分`;
    } else {
      return `${hours}h ${mins}m`;
    }
  }
};