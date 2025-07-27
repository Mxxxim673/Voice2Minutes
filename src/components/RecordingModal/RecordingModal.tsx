import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { usageTracker } from '../../services/usageTracker';
import { formatRemainingTime, formatRecordingTime } from '../../utils/timeFormat';
import './RecordingModal.css';

interface RecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (audioBlob: Blob) => void;
}

const RecordingModal: React.FC<RecordingModalProps> = ({ isOpen, onClose, onRecordingComplete }) => {
  const { t } = useTranslation();
  const { user, isGuest, ensureGuestMode } = useAuth();
  
  // 安全的翻译函数，带有默认值
  const safeT = (key: string, defaultValue: string, options?: Record<string, unknown>): string => {
    try {
      const result = t(key, options);
      return typeof result === 'string' && result !== key ? result : defaultValue;
    } catch (error) {
      console.error(`Translation error for key: ${key}`, error);
      return defaultValue;
    }
  };
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioData, setAudioData] = useState<number[]>(Array(32).fill(0));
  const [hasRecording, setHasRecording] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [currentUsedMinutes, setCurrentUsedMinutes] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const visualizationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedAudioBlobRef = useRef<Blob | null>(null);

  // 更新使用量数据
  const updateUsageData = async () => {
    try {
      const realUsedMinutes = await usageTracker.getCurrentUserTotalUsage();
      setCurrentUsedMinutes(realUsedMinutes);
      console.log('🔄 录音弹窗使用量数据已更新:', realUsedMinutes.toFixed(2), '分钟');
    } catch (error) {
      console.error('❌ 更新使用量数据失败:', error);
      // 回退到localStorage数据
      const fallbackUsage = Number(localStorage.getItem('guestUsedMinutes') || '0');
      setCurrentUsedMinutes(fallbackUsage);
    }
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // 确保在模态框打开时访客模式状态正确，并更新使用量数据
  useEffect(() => {
    if (isOpen) {
      // 更新使用量数据
      updateUsageData();
      
      // 确保访客模式状态正确
      if (!user && localStorage.getItem('guestMode') === 'true') {
        console.log('🎙️ 录音模态框打开，已有访客模式标识，更新访客状态...');
        ensureGuestMode().catch(error => {
          console.error('❌ 访客模式更新失败:', error);
        });
      }
    }
  }, [isOpen, user, ensureGuestMode]);

  const cleanup = () => {
    console.log('🧹 清理录音资源...');
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (visualizationIntervalRef.current) {
      clearInterval(visualizationIntervalRef.current);
      visualizationIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 停止音频轨道:', track.kind);
      });
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(err => {
        console.warn('⚠️ 音频上下文关闭失败:', err);
      });
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current = null;
    }
    
    console.log('✅ 录音资源清理完成');
  };

  // 统一的配额检查函数
  const getUserQuotaInfo = () => {
    let totalMinutes = 0;
    let usedMinutes = 0;
    
    // 检查是否为游客用户（包括未登录用户）
    const isGuestUser = isGuest || !user || user.userType === 'guest';
    
    if (isGuestUser) {
      totalMinutes = 5; // 所有游客用户5分钟
      // 使用真实使用量数据
      usedMinutes = currentUsedMinutes;
    } else if (user) {
      // 认证用户（试用或付费用户）
      totalMinutes = user.quotaMinutes || 10;
      // 使用真实使用量数据
      usedMinutes = currentUsedMinutes;
    }
    
    const remainingMinutes = Math.max(0, totalMinutes - usedMinutes);
    
    return { totalMinutes, usedMinutes, remainingMinutes };
  };

  // 获取用户类型显示文本
  const getUserTypeText = () => {
    // 优先检查是否为访客登录模式
    if (isGuest && localStorage.getItem('guestMode') === 'true') {
      return safeT('audioToText.guestUser', '访客用户');
    }
    
    // 检查是否为认证用户
    if (user && localStorage.getItem('authToken')) {
      if (user.email === 'max.z.software@gmail.com') {
        return safeT('audioToText.adminUser', '管理员');
      } else if (user.userType === 'paid') {
        return safeT('audioToText.paidUser', '付费用户');
      } else if (user.userType === 'trial') {
        return safeT('audioToText.trialUser', '试用用户');
      }
    }
    
    // 完全未登录的情况 - 显示"未登录"而不是"访客用户"
    if (!localStorage.getItem('authToken') && !isGuest) {
      return safeT('audioToText.unauthenticated', '未登录');
    }
    
    // 兜底情况
    return safeT('audioToText.guestUser', '访客用户');
  };

  const startRecording = async () => {
    try {
      // 检查用户剩余配额
      const { remainingMinutes } = getUserQuotaInfo();
      if (remainingMinutes <= 0) {
        const message = `⏰ ${safeT('audioToText.recordingQuotaExhausted', '您的配额已用完，无法开始录音')}`;
        alert(message);
        return;
      }

      // 检查浏览器是否支持媒体录制
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('您的浏览器不支持录音功能，请使用Chrome、Firefox或Safari浏览器');
      }

      if (!window.MediaRecorder) {
        throw new Error('您的浏览器不支持MediaRecorder API，请更新您的浏览器');
      }

      console.log('🎤 开始请求麦克风权限...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      console.log('✅ 麦克风权限获取成功');
      streamRef.current = stream;

      // Set up audio analysis for waveform visualization
      audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.1;
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;
      
      source.connect(analyserRef.current);

      // 检查MediaRecorder支持的格式，优先选择OpenAI API兼容的格式
      const mimeTypes = [
        // OpenAI API直接支持的格式（优先级最高）
        'audio/wav',
        'audio/mp4',
        'audio/mpeg',
        'audio/webm', // 虽然支持，但可能需要转换
        'audio/ogg;codecs=opus', // 支持，但需要正确的扩展名
        'audio/ogg',
        'audio/webm;codecs=opus',
        // 其他格式作为备选
        'audio/mp3'
      ];
      
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log('✅ 找到支持的格式:', mimeType);
          break;
        }
      }
      
      if (!selectedMimeType) {
        throw new Error('您的浏览器不支持任何音频录制格式');
      }
      
      console.log('🎵 选择的音频格式:', selectedMimeType);
      
      // Set up MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000
      });
      audioChunksRef.current = [];
      
      console.log('📱 MediaRecorder 初始化完成');

      mediaRecorderRef.current.ondataavailable = (event) => {
        console.log('📊 收到录音数据:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onerror = (event) => {
        console.error('🚫 MediaRecorder 错误:', event);
        alert('录制过程中发生错误，请重试');
      };
      
      mediaRecorderRef.current.onstart = () => {
        console.log('🎬 录制开始');
      };
      
      mediaRecorderRef.current.onpause = () => {
        console.log('⏸️ 录制暂停');
      };
      
      mediaRecorderRef.current.onresume = () => {
        console.log('▶️ 录制恢复');
      };

      mediaRecorderRef.current.onstop = () => {
        console.log('🎬 MediaRecorder onstop 事件触发');
        console.log('📊 AudioChunks 数量:', audioChunksRef.current.length);
        
        if (audioChunksRef.current.length === 0) {
          console.error('⚠️ 没有录音数据chunks');
          return;
        }
        
        // 使用录制时的实际MIME类型
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        recordedAudioBlobRef.current = audioBlob;
        setHasRecording(true);
        
        console.log('📦 录音完成，数据大小:', audioBlob.size, 'bytes');
        console.log('✅ hasRecording 状态已设置为 true');
      };

      // 开始录制，每秒收集一次数据
      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      console.log('🎙️ 录制已启动');
      setIsPaused(false);
      setRecordingTime(0);

      // Start timer with usage limit checking
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          const newTimeMinutes = newTime / 60;
          
          // 获取用户配额信息
          const { remainingMinutes } = getUserQuotaInfo();
          
          // 检查录制时长是否超过剩余配额
          if (newTimeMinutes >= remainingMinutes) {
            setLimitReached(true);
            setTimeout(stopRecording, 100);
            return newTime;
          }
          
          // 额外检查：防止单次录音超过10分钟（技术限制）
          const MAX_SINGLE_RECORDING_MINUTES = 10;
          if (newTimeMinutes >= MAX_SINGLE_RECORDING_MINUTES) {
            setLimitReached(true);
            setTimeout(stopRecording, 100);
            return newTime;
          }
          
          return newTime;
        });
      }, 1000);

      // Start audio visualization
      startAudioVisualization();
    } catch (error) {
      console.error('🚫 录音启动失败:', error);
      
      let errorMessage = '';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
          errorMessage = '🚫 麦克风权限被拒绝。请在浏览器设置中允许麦克风访问权限，然后刷新页面重试。';
        } else if (error.name === 'NotFoundError') {
          errorMessage = '🎤 未找到麦克风设备。请检查您的麦克风是否已连接。';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = '🌐 您的浏览器不支持录音功能。请使用Chrome、Firefox或Safari浏览器。';
        } else if (error.message.includes('MediaRecorder')) {
          errorMessage = '📱 您的浏览器版本过旧，不支持录音功能。请更新您的浏览器。';
        } else {
          errorMessage = `❌ 录音启动失败: ${error.message}`;
        }
      } else {
        errorMessage = '❌ 未知错误，录音功能无法启动。';
      }
      
      alert(errorMessage);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (visualizationIntervalRef.current) {
        clearInterval(visualizationIntervalRef.current);
      }
      setAudioData(Array(32).fill(0));
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      // Restart timer with usage limit checking
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          const newTimeMinutes = newTime / 60;
          
          // 获取用户配额信息
          const { remainingMinutes } = getUserQuotaInfo();
          
          // 检查录制时长是否超过剩余配额
          if (newTimeMinutes >= remainingMinutes) {
            setLimitReached(true);
            setTimeout(stopRecording, 100);
            return newTime;
          }
          
          // 额外检查：防止单次录音超过10分钟（技术限制）
          const MAX_SINGLE_RECORDING_MINUTES = 10;
          if (newTimeMinutes >= MAX_SINGLE_RECORDING_MINUTES) {
            setLimitReached(true);
            setTimeout(stopRecording, 100);
            return newTime;
          }
          
          return newTime;
        });
      }, 1000);
      
      // Restart visualization
      startAudioVisualization();
    }
  };

  const stopRecording = () => {
    console.log('🛑 停止录音');
    console.log('📊 当前 MediaRecorder 状态:', mediaRecorderRef.current?.state);
    
    if (mediaRecorderRef.current && 
        (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
      console.log('⏹️ 调用 MediaRecorder.stop()');
      mediaRecorderRef.current.stop();
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (visualizationIntervalRef.current) {
      clearInterval(visualizationIntervalRef.current);
    }

    setIsRecording(false);
    setIsPaused(false);
    setAudioData(Array(32).fill(0));
    
    console.log('✅ 录音状态已清理');
  };

  const startAudioVisualization = () => {
    visualizationIntervalRef.current = setInterval(() => {
      if (!analyserRef.current || (!isRecording || isPaused)) {
        return;
      }

      try {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const averageVolume = sum / bufferLength;
        const normalizedVolume = Math.min(1, averageVolume / 128);

        // Generate bars
        const bars = [];
        const barCount = 32;
        
        for (let i = 0; i < barCount; i++) {
          const freqIndex = Math.floor((i / barCount) * bufferLength);
          let barHeight = dataArray[freqIndex] / 255;
          
          barHeight = Math.max(barHeight, normalizedVolume * 0.3);
          barHeight = Math.min(1, barHeight * 2);
          
          const randomVariation = (Math.random() - 0.5) * 0.1 * barHeight;
          barHeight = Math.max(0.05, Math.min(1, barHeight + randomVariation));
          
          bars.push(barHeight);
        }
        
        setAudioData(bars);
      } catch (error) {
        console.error('Error in visualization:', error);
      }
    }, 100);
  };

  const handleStartTranscription = () => {
    console.log('🚀 开始转文字处理...');
    console.log('📊 hasRecording:', hasRecording);
    console.log('📊 recordedAudioBlobRef 是否有数据:', !!recordedAudioBlobRef.current);
    console.log('📊 audioChunks 数量:', audioChunksRef.current.length);
    
    // 优先使用已保存的录音 Blob
    if (hasRecording && recordedAudioBlobRef.current) {
      console.log('✅ 使用已保存的录音数据，大小:', recordedAudioBlobRef.current.size, 'bytes');
      onRecordingComplete(recordedAudioBlobRef.current);
      handleClose();
      return;
    }
    
    // 备用方案：从 chunks 重新创建
    if (hasRecording && audioChunksRef.current.length > 0) {
      console.log('🔄 从chunks重新创建音频数据');
      // 使用录制时的实际MIME类型
      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      console.log('📦 重新创建的音频数据，大小:', audioBlob.size, 'bytes, 类型:', mimeType);
      onRecordingComplete(audioBlob);
      handleClose();
      return;
    }
    
    // 没有录音数据
    console.error('❌ 没有找到录音数据');
    alert(safeT('audioToText.noRecordingData', '没有录音数据，请先录制音频'));
  };

  const handleClose = () => {
    cleanup();
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    setAudioData(Array(32).fill(0));
    setHasRecording(false);
    setLimitReached(false);
    audioChunksRef.current = [];
    recordedAudioBlobRef.current = null;
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="recording-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{safeT('audioToText.liveRecording', '实时录制')}</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        
        <div className="modal-content">
          {/* Waveform visualization */}
          <div className="waveform-container">
            <div className="waveform">
              {audioData.map((height, i) => (
                <div
                  key={i}
                  className="waveform-bar"
                  style={{
                    height: `${Math.max(8, height * 60)}px`,
                    backgroundColor: isRecording && !isPaused ? 'var(--primary-blue)' : 'var(--light-gray)',
                    opacity: Math.max(0.3, 0.5 + height * 0.5),
                    transition: 'height 0.1s ease-out, opacity 0.1s ease-out'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Recording time and limit info */}
          <div className="recording-time">
            {formatRecordingTime(recordingTime)}
          </div>
          
          {/* Universal quota display */}
          <div className="usage-limit-info">
            <p className="limit-text">
              総利用可能残り: {formatRemainingTime(getUserQuotaInfo().remainingMinutes)} | 現在の録音: {formatRecordingTime(recordingTime)}
            </p>
            <p className="user-type-info" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              ユーザータイプ: {getUserTypeText()} | 
              総利用枠: {formatRemainingTime(getUserQuotaInfo().totalMinutes)}
            </p>
          </div>
          
          {limitReached && (
            <div className="limit-reached-warning" style={{ 
              backgroundColor: '#ff6b35', 
              color: 'white', 
              padding: '10px', 
              borderRadius: '5px',
              marginTop: '10px'
            }}>
              {/* 根据用户状态显示不同的提示 */}
              {!isGuest && !localStorage.getItem('authToken') ? (
                // 未登录用户的提示
                <div>
                  <p>{safeT('audioToText.guestQuotaReachedTitle', '⏰ 已达到使用上限，录音已自动停止。')}</p>
                  <p style={{ fontSize: '14px', marginTop: '5px' }}>
                    {safeT('audioToText.guestTrialComplete', '🎉 访客体验已结束！注册账户可获得10分钟试用时长。')}
                  </p>
                </div>
              ) : (
                // 已登录用户的原有提示
                <div>
                  <p>⏰ 録音が自動停止されました</p>
                  <p style={{ fontSize: '14px', marginTop: '5px' }}>
                    {getUserQuotaInfo().remainingMinutes <= 0 
                      ? `📢 利用枠を使い切りました。録音時間: ${formatRecordingTime(recordingTime)}`
                      : `📢 単回録音が10分の技術上限に達しました。録音時間: ${formatRecordingTime(recordingTime)}`
                    }
                  </p>
                  <p style={{ fontSize: '14px', marginTop: '5px' }}>
                    💡 この録音を文字起こしするか、新しく録音を開始できます。文字起こし時は残り利用枠に応じて処理されます。
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Control buttons */}
          <div className="modal-controls">
            {!isRecording && !hasRecording && (
              <button onClick={startRecording} className="button button-primary">
                <span className="mic-icon">◉</span>
                {safeT('common.start', '开始')}
              </button>
            )}
            
            {isRecording && !isPaused && (
              <>
                <button onClick={pauseRecording} className="button button-secondary">
                  {safeT('common.stop', '停止')}
                </button>
                <button onClick={stopRecording} className="button button-warning">
                  {safeT('audioToText.completeRecording', '完成录制')}
                </button>
              </>
            )}
            
            {isRecording && isPaused && (
              <>
                <button onClick={resumeRecording} className="button button-primary">
                  {safeT('audioToText.continueRecording', '继续录制')}
                </button>
                <button onClick={stopRecording} className="button button-warning">
                  {safeT('audioToText.completeRecording', '完成录制')}
                </button>
              </>
            )}
            
            {!isRecording && hasRecording && (
              <>
                <button onClick={startRecording} className="button button-secondary">
                  {safeT('audioToText.reRecord', '重新录制')}
                </button>
                <button 
                  onClick={handleStartTranscription} 
                  className="button button-primary button-highlighted"
                >
                  {safeT('audioToText.startTranscription', '开始转写')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordingModal;