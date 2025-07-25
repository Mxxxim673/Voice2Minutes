import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { checkRecordingLimit } from '../../services/usageService';
import './RecordingModal.css';

interface RecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (audioBlob: Blob) => void;
}

const RecordingModal: React.FC<RecordingModalProps> = ({ isOpen, onClose, onRecordingComplete }) => {
  const { t } = useTranslation();
  const { user, isGuest } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioData, setAudioData] = useState<number[]>(Array(32).fill(0));
  const [hasRecording, setHasRecording] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const visualizationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedAudioBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (visualizationIntervalRef.current) {
      clearInterval(visualizationIntervalRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  const startRecording = async () => {
    try {
      console.log('Starting recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      streamRef.current = stream;

      // Set up audio analysis for waveform visualization
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.1;
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;
      
      source.connect(analyserRef.current);

      // Set up MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        console.log('🎬 MediaRecorder onstop 事件触发');
        console.log('📊 AudioChunks 数量:', audioChunksRef.current.length);
        
        if (audioChunksRef.current.length === 0) {
          console.error('⚠️ 没有录音数据chunks');
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        recordedAudioBlobRef.current = audioBlob;
        setHasRecording(true);
        
        console.log('📦 录音完成，数据大小:', audioBlob.size, 'bytes');
        console.log('✅ hasRecording 状态已设置为 true');
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // Start timer with usage limit checking
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          const newTimeMinutes = newTime / 60;
          
          // 检查用户剩余配额
          const userQuotaMinutes = user?.quotaMinutes || 10;
          const userUsedMinutes = user?.usedMinutes || 0;
          const remainingMinutes = userQuotaMinutes - userUsedMinutes;
          
          // 如果录音时长超过剩余配额，自动停止录音
          if (newTimeMinutes >= remainingMinutes) {
            setLimitReached(true);
            // Auto-stop recording when limit reached
            setTimeout(stopRecording, 100);
            return newTime;
          }
          
          return newTime;
        });
      }, 1000);

      // Start audio visualization
      startAudioVisualization();
    } catch (error) {
      console.error('Error starting recording:', error);
      alert(t('audioToText.microphoneError'));
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
          
          // 检查用户剩余配额
          const userQuotaMinutes = user?.quotaMinutes || 10;
          const userUsedMinutes = user?.usedMinutes || 0;
          const remainingMinutes = userQuotaMinutes - userUsedMinutes;
          
          // 如果录音时长超过剩余配额，自动停止录音
          if (newTimeMinutes >= remainingMinutes) {
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
    if (hasRecording && recordedAudioBlobRef.current) {
      console.log('🎤 开始转录录音，数据大小:', recordedAudioBlobRef.current.size, 'bytes');
      onRecordingComplete(recordedAudioBlobRef.current);
      handleClose();
    } else if (hasRecording && audioChunksRef.current.length > 0) {
      // 备用方案：如果 ref 中没有数据，从 chunks 重新创建
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      console.log('🎤 备用方案：从chunks创建录音，数据大小:', audioBlob.size, 'bytes');
      onRecordingComplete(audioBlob);
      handleClose();
    } else {
      console.error('❌ 没有录音数据可以转录');
      alert(t('audioToText.noRecordingData'));
    }
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
          <h2>{t('audioToText.liveRecording')}</h2>
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
            {formatTime(recordingTime)}
          </div>
          
          {/* Usage limit warning */}
          {isGuest && (
            <div className="usage-limit-info">
              <p className="limit-text">
                {t('auth.guestLimitations.timeLimit')} ({Math.max(0, 5 - Math.floor(recordingTime / 60))} {t('usage.minutes')} {t('usage.remainingTime').toLowerCase()})
              </p>
            </div>
          )}
          
          {/* User quota limit info */}
          {!isGuest && user && (
            <div className="usage-limit-info">
              <p className="limit-text">
                剩余配额: {Math.max(0, ((user.quotaMinutes || 10) - (user.usedMinutes || 0) - Math.floor(recordingTime / 60))).toFixed(1)} 分钟
              </p>
            </div>
          )}
          
          {limitReached && (
            <div className="limit-reached-warning" style={{ 
              backgroundColor: '#ff6b35', 
              color: 'white', 
              padding: '10px', 
              borderRadius: '5px',
              marginTop: '10px'
            }}>
              <p>⏰ 您的试用时长已结束! 录音已自动停止。</p>
              <p style={{ fontSize: '14px', marginTop: '5px' }}>
                💡 请购买更多时长继续使用录音功能。
              </p>
            </div>
          )}

          {/* Control buttons */}
          <div className="modal-controls">
            {!isRecording && !hasRecording && (
              <button onClick={startRecording} className="button button-primary">
                <span className="mic-icon">◉</span>
                {t('common.start')}
              </button>
            )}
            
            {isRecording && !isPaused && (
              <>
                <button onClick={pauseRecording} className="button button-secondary">
                  {t('common.stop')}
                </button>
                <button onClick={stopRecording} className="button button-warning">
                  完成录制
                </button>
              </>
            )}
            
            {isRecording && isPaused && (
              <>
                <button onClick={resumeRecording} className="button button-primary">
                  继续录制
                </button>
                <button onClick={stopRecording} className="button button-warning">
                  完成录制
                </button>
              </>
            )}
            
            {!isRecording && hasRecording && (
              <>
                <button onClick={startRecording} className="button button-secondary">
                  重新录制
                </button>
                <button 
                  onClick={handleStartTranscription} 
                  className="button button-primary button-highlighted"
                >
                  {t('audioToText.startTranscription')}
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