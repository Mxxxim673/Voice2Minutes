/**
 * 将分钟转换为直观的时间格式
 * @param minutes 分钟数
 * @returns 格式化的时间字符串 (例: "1小时23分45秒", "5分30秒", "45秒")
 */
export const formatDuration = (minutes: number): string => {
  const totalSeconds = Math.floor(minutes * 60);
  
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  const parts: string[] = [];
  
  if (hours > 0) {
    parts.push(`${hours}小时`);
  }
  
  if (mins > 0) {
    parts.push(`${mins}分`);
  }
  
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs}秒`);
  }
  
  return parts.join('');
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
 * @returns 简短的时间描述
 */
export const formatRemainingTime = (minutes: number): string => {
  if (minutes <= 0) {
    return '0秒';
  }
  
  if (minutes < 1) {
    return `${Math.floor(minutes * 60)}秒`;
  }
  
  if (minutes < 60) {
    const wholeMins = Math.floor(minutes);
    const remainingSecs = Math.floor((minutes - wholeMins) * 60);
    
    if (remainingSecs === 0) {
      return `${wholeMins}分`;
    } else {
      return `${wholeMins}分${remainingSecs}秒`;
    }
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  
  if (mins === 0) {
    return `${hours}小时`;
  } else {
    return `${hours}小时${mins}分`;
  }
};