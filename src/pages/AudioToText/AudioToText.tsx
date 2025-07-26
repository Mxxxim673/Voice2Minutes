import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../../contexts/AuthContext';
import RecordingModal from '../../components/RecordingModal/RecordingModal';
import TranscriptionResult from '../../components/TranscriptionResult/TranscriptionResult';
import { transcribeAudio } from '../../services/audioService';
import { exportToWord } from '../../utils/exportUtils';
import { checkUsageLimit, recordUsage, truncateAudioForLimit, getAudioDuration } from '../../services/usageService';
import './AudioToText.css';

interface TranscriptionData {
  text: string;
  audioFile?: File;
}

const AudioToText: React.FC = () => {
  const { t } = useTranslation();
  const { user, isGuest, isAuthenticated, updateUserQuota, ensureGuestMode } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [usageLimitWarning, setUsageLimitWarning] = useState<string | null>(null);

  // Restore transcription result on page load
  React.useEffect(() => {
    const storedTranscription = localStorage.getItem('transcriptionResult');
    if (storedTranscription) {
      setTranscriptionResult({
        text: storedTranscription,
        audioFile: undefined // File can't be serialized, so it's undefined on restore
      });
    }
  }, []);

  // Only ensure guest mode if explicitly in guest mode
  React.useEffect(() => {
    if (!user && localStorage.getItem('guestMode') === 'true') {
      console.log('📄 AudioToText页面加载，已有访客模式标识，更新访客状态...');
      ensureGuestMode().catch(error => {
        console.error('❌ 访客模式更新失败:', error);
      });
    }
  }, [user, ensureGuestMode]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      try {
        console.log('📁 上传文件:', file.name, '大小:', (file.size / 1024 / 1024).toFixed(2), 'MB');
        
        // 简化处理：直接接受文件，配额检查交给转录时处理
        setUploadedFile(file);
        setError(null);
        setUsageLimitWarning(null);
        
        // 预先检查并给出提示（但不阻止上传）
        try {
          const fileDuration = await getAudioDuration(file);
          // 统一的配额计算逻辑
          const isGuestUser = isGuest || !user || user?.userType === 'guest';
          const totalQuota = isGuestUser ? 5 : (user?.quotaMinutes || 10);
          const usedQuota = isGuestUser ? Number(localStorage.getItem('guestUsedMinutes') || '0') : (user?.usedMinutes || 0);
          const remainingMinutes = Math.max(0, totalQuota - usedQuota);
          
          if (fileDuration > remainingMinutes && remainingMinutes > 0) {
            setUsageLimitWarning(
              t('audioToText.audioDurationWarning', {
                duration: fileDuration.toFixed(1),
                remaining: remainingMinutes.toFixed(1)
              })
            );
          } else if (remainingMinutes <= 0) {
            setUsageLimitWarning(
              isGuestUser ? 
              t('audioToText.guestQuotaExhausted') :
              t('audioToText.quotaExhaustedGeneral')
            );
          }
        } catch (error) {
          console.warn('⚠️ 预检查失败，但文件已上传:', error);
        }
        
      } catch (error) {
        console.error('File processing error:', error);
        setError('文件处理错误，请检查文件格式是否正确');
      }
    }
  }, [isGuest, user, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.mp4', '.mpeg', '.mpga', '.webm']
    },
    multiple: false,
    // No maxSize limit - handle large files with chunking
  });

  const handleTranscription = async (audioFile: File) => {
    setIsProcessing(true);
    setError(null);
    setUsageLimitWarning(null);
    
    try {
      // 统一的用户类型和配额检查
      const isGuestUser = isGuest || !user || user?.userType === 'guest';
      const userType = isGuestUser ? 'guest' : (user?.userType || 'trial');
      
      // 获取当前使用量
      const currentUsage = isGuestUser ? Number(localStorage.getItem('guestUsedMinutes') || '0') : (user?.usedMinutes || 0);
      
      // 获取音频时长
      const originalDuration = await getAudioDuration(audioFile);
      
      // 计算剩余配额
      const totalQuota = isGuestUser ? 5 : (user?.quotaMinutes || 10);
      const remainingMinutes = Math.max(0, totalQuota - currentUsage);
      
      console.log(`🎵 音频时长: ${originalDuration.toFixed(2)}分钟, 剩余配额: ${remainingMinutes.toFixed(2)}分钟`);
      console.log(`👤 用户类型: ${userType}, 游客用户: ${isGuestUser}`);
      
      let actualAudioFile = audioFile;
      let actualDuration = originalDuration;
      let wasTruncated = false;
      
      // 智能处理：如果没有剩余配额，直接提示用户
      if (remainingMinutes <= 0) {
        setError(isGuestUser ? 
          t('audioToText.guestQuotaExhausted') : 
          t('audioToText.quotaExhaustedGeneral')
        );
        setIsProcessing(false);
        return;
      }
      
      // 如果音频时长超过剩余配额，进行截断处理（但仍然允许转写）
      if (originalDuration > remainingMinutes) {
        console.log(`⚠️ 音频超出剩余配额，将截断处理: ${originalDuration.toFixed(2)} -> ${remainingMinutes.toFixed(2)}分钟`);
        
        const truncateResult = await truncateAudioForLimit(audioFile, remainingMinutes);
        actualAudioFile = truncateResult.file;
        actualDuration = Math.min(originalDuration, remainingMinutes);
        wasTruncated = true;
        
        setUsageLimitWarning(
          `⚠️ 音频时长 ${originalDuration.toFixed(1)} 分钟超出剩余配额 ${remainingMinutes.toFixed(1)} 分钟，仅转换前 ${actualDuration.toFixed(1)} 分钟内容`
        );
      }
      
      // 执行转录（无论是否截断都允许进行）
      const transcriptionText = await transcribeAudio(actualAudioFile, userType, currentUsage);
      
      // 更新使用量（统一处理游客和认证用户）
      const newUsedMinutes = currentUsage + actualDuration;
      await updateUserQuota(newUsedMinutes);
      
      // 检查配额状态并给出相应提示
      const quotaLimit = isGuestUser ? 5 : (user?.quotaMinutes || 10);
      if (newUsedMinutes >= quotaLimit) {
        setUsageLimitWarning(
          isGuestUser ? 
          t('audioToText.guestTrialComplete') :
          t('audioToText.trialComplete')
        );
      } else if (quotaLimit - newUsedMinutes <= 1) {
        setUsageLimitWarning(`⏰ 注意：您还剩余 ${(quotaLimit - newUsedMinutes).toFixed(1)} 分钟配额`);
      }
      
      // 记录使用情况
      await recordUsage(actualAudioFile, transcriptionText);
      
      const result: TranscriptionData = {
        text: transcriptionText,
        audioFile: audioFile
      };
      
      setTranscriptionResult(result);
      localStorage.setItem('transcriptionResult', result.text);
      
      console.log(`✅ 转录完成，使用时长: ${actualDuration.toFixed(2)}分钟${wasTruncated ? ' (已截断)' : ''}`);
      
    } catch (error) {
      console.error('❌ 转录失败:', error);
      setError(error instanceof Error ? error.message : '转录过程中发生未知错误');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartTranscription = () => {
    if (uploadedFile) {
      handleTranscription(uploadedFile);
    }
  };

  // 音频格式转换函数
  const convertAudioToSupportedFormat = async (audioBlob: Blob): Promise<File> => {
    const originalMimeType = audioBlob.type || 'audio/webm';
    console.log('🎵 原始音频格式:', originalMimeType);
    
    // OpenAI API 支持的格式列表
    const supportedFormats = [
      'audio/flac', 'audio/m4a', 'audio/mp3', 'audio/mp4', 
      'audio/mpeg', 'audio/mpga', 'audio/oga', 'audio/ogg', 
      'audio/wav', 'audio/webm'
    ];
    
    // 检查当前格式是否被支持
    const isDirectlySupported = supportedFormats.some(format => 
      originalMimeType.startsWith(format)
    );
    
    if (isDirectlySupported) {
      // 格式已支持，直接使用
      const fileExtension = getFileExtension(originalMimeType);
      const cleanMimeType = getCleanMimeType(originalMimeType);
      console.log('✅ 格式已支持，直接使用:', cleanMimeType);
      return new File([audioBlob], `recording.${fileExtension}`, { type: cleanMimeType });
    }
    
    // 不支持的格式，转换为WAV（最兼容的格式）
    console.log('🔄 格式不支持，转换为 WAV...');
    try {
      const wavFile = await convertToWav(audioBlob);
      console.log('✅ 成功转换为 WAV 格式，大小:', wavFile.size, 'bytes');
      return wavFile;
    } catch (error) {
      console.error('❌ 格式转换失败:', error);
      // 转换失败，仍然尝试使用原始格式（可能API能处理）
      const fileExtension = getFileExtension(originalMimeType);
      return new File([audioBlob], `recording.${fileExtension}`, { type: 'audio/webm' });
    }
  };
  
  // 获取文件扩展名
  const getFileExtension = (mimeType: string): string => {
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('mpeg')) return 'mpeg';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('webm')) return 'webm';
    return 'webm'; // 默认
  };
  
  // 获取干净的MIME类型（去除codec信息）
  const getCleanMimeType = (mimeType: string): string => {
    if (mimeType.includes('wav')) return 'audio/wav';
    if (mimeType.includes('mp4')) return 'audio/mp4';
    if (mimeType.includes('mpeg')) return 'audio/mpeg';
    if (mimeType.includes('ogg')) return 'audio/ogg';
    if (mimeType.includes('webm')) return 'audio/webm';
    return 'audio/webm'; // 默认
  };
  
  // 转换为WAV格式
  const convertToWav = async (audioBlob: Blob): Promise<File> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(audioBlob);
      
      audio.onloadeddata = async () => {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // 转换为WAV
          const wavBlob = await audioBufferToWav(audioBuffer);
          const wavFile = new File([wavBlob], 'recording.wav', { type: 'audio/wav' });
          
          audioContext.close();
          URL.revokeObjectURL(url);
          resolve(wavFile);
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('无法解码音频数据'));
      };
      
      audio.src = url;
    });
  };
  
  // 将AudioBuffer转换为WAV Blob
  const audioBufferToWav = (audioBuffer: AudioBuffer): Promise<Blob> => {
    return new Promise((resolve) => {
      const numberOfChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      const format = 1; // PCM
      const bitDepth = 16;
      
      const bytesPerSample = bitDepth / 8;
      const blockAlign = numberOfChannels * bytesPerSample;
      const byteRate = sampleRate * blockAlign;
      const dataSize = audioBuffer.length * blockAlign;
      const bufferSize = 44 + dataSize;
      
      const arrayBuffer = new ArrayBuffer(bufferSize);
      const dataView = new DataView(arrayBuffer);
      
      // WAV 文件头
      let offset = 0;
      
      // RIFF chunk descriptor
      writeString(dataView, offset, 'RIFF'); offset += 4;
      dataView.setUint32(offset, 36 + dataSize, true); offset += 4;
      writeString(dataView, offset, 'WAVE'); offset += 4;
      
      // FMT sub-chunk
      writeString(dataView, offset, 'fmt '); offset += 4;
      dataView.setUint32(offset, 16, true); offset += 4;
      dataView.setUint16(offset, format, true); offset += 2;
      dataView.setUint16(offset, numberOfChannels, true); offset += 2;
      dataView.setUint32(offset, sampleRate, true); offset += 4;
      dataView.setUint32(offset, byteRate, true); offset += 4;
      dataView.setUint16(offset, blockAlign, true); offset += 2;
      dataView.setUint16(offset, bitDepth, true); offset += 2;
      
      // Data sub-chunk
      writeString(dataView, offset, 'data'); offset += 4;
      dataView.setUint32(offset, dataSize, true); offset += 4;
      
      // Write PCM samples
      for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
          const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          dataView.setInt16(offset, intSample, true);
          offset += 2;
        }
      }
      
      resolve(new Blob([arrayBuffer], { type: 'audio/wav' }));
    });
  };
  
  // 写入字符串到DataView
  const writeString = (dataView: DataView, offset: number, string: string): void => {
    for (let i = 0; i < string.length; i++) {
      dataView.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    console.log('🎙️ handleRecordingComplete 被调用，音频数据大小:', audioBlob.size, 'bytes');
    
    if (audioBlob.size === 0) {
      console.error('❌ 音频数据为空，无法进行转录');
      setError('录音数据为空，请重新录制');
      return;
    }
    
    try {
      // 转换为API支持的格式
      const audioFile = await convertAudioToSupportedFormat(audioBlob);
      console.log('📁 最终音频文件:', audioFile.name, '大小:', audioFile.size, 'bytes', '格式:', audioFile.type);
      
      console.log('🚀 准备开始转录...');
      handleTranscription(audioFile);
    } catch (error) {
      console.error('❌ 音频格式处理失败:', error);
      setError('音频格式处理失败，请重新录制');
    }
  };

  // 检查浏览器兼容性的函数
  const checkBrowserCompatibility = () => {
    const errors = [];
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      errors.push('❌ 您的浏览器不支持媒体设备访问 (getUserMedia)');
    }
    
    if (!window.MediaRecorder) {
      errors.push('❌ 您的浏览器不支持媒体录制 (MediaRecorder)');
    }
    
    if (!window.AudioContext && !(window as any).webkitAudioContext) {
      errors.push('❌ 您的浏览器不支持音频处理 (AudioContext)');
    }
    
    return errors;
  };

  const handleOpenRecordingModal = () => {
    // 在打开录音弹窗前检查浏览器兼容性
    const compatibilityErrors = checkBrowserCompatibility();
    if (compatibilityErrors.length > 0) {
      const errorMessage = '🚫 录音功能不可用:\n\n' + 
                          compatibilityErrors.join('\n') + 
                          '\n\n💡 建议使用以下浏览器:\n' +
                          '• Chrome 60+\n' +
                          '• Firefox 55+\n' +
                          '• Safari 14+\n' +
                          '• Edge 79+';
      alert(errorMessage);
      return;
    }
    
    setIsRecordingModalOpen(true);
  };

  const handleCloseRecordingModal = () => {
    setIsRecordingModalOpen(false);
  };

  const handleClearRecord = () => {
    setTranscriptionResult(null);
    setUploadedFile(null);
    setError(null);
    localStorage.removeItem('transcriptionResult');
  };

  const handleClearAll = () => {
    // Clear all content including uploaded file and transcription results
    setTranscriptionResult(null);
    setUploadedFile(null);
    setError(null);
    setIsProcessing(false);
    localStorage.removeItem('transcriptionResult');
  };

  const handleExportToWord = () => {
    if (transcriptionResult) {
      exportToWord(transcriptionResult.text, 'transcription');
    }
  };


  return (
    <div className="audio-to-text-page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">{t('audioToText.title')}</h1>
          <p className="page-subtitle">
            {user ? (
              (() => {
                const isGuestUser = isGuest || user.userType === 'guest';
                const totalQuota = isGuestUser ? 5 : (user.quotaMinutes || 10);
                const usedQuota = isGuestUser ? Number(localStorage.getItem('guestUsedMinutes') || '0') : (user.usedMinutes || 0);
                const remainingTime = Math.max(0, totalQuota - usedQuota);
                return t('audioToText.remainingTime', { minutes: remainingTime.toFixed(1) });
              })()
            ) : t('audioToText.subtitle')}
          </p>
        </div>

        <div className="main-content">
          {/* Left side - Input section */}
          <div className="input-section">
            <div className="card">
              <h2>
                {t('audioToText.audioInputMethod')}
              </h2>
              
              {/* Upload Section */}
              <div className="audio-upload-area">
                <h3>
                  {t('audioToText.uploadAudio')}
                </h3>
                <div
                  {...getRootProps()}
                  className={`dropzone ${isDragActive ? 'active' : ''} ${uploadedFile ? 'has-file' : ''}`}
                >
                  <input {...getInputProps()} />
                  {uploadedFile ? (
                    <div className="uploaded-file">
                      <div className="file-icon" style={{ fontSize: '32px', color: 'var(--success-green)' }}>♪</div>
                      <div className="file-info">
                        <div className="file-name">{uploadedFile.name}</div>
                        <div className="file-size">
                          {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </div>
                        <div className="file-status" style={{ color: 'var(--success-green)', fontSize: 'var(--font-size-footnote)', marginTop: 'var(--spacing-xs)' }}>
                          {t('audioToText.fileUploaded')}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="dropzone-content">
                      <div className="upload-icon">📁</div>
                      <p>{isDragActive ? t('audioToText.dragDropActiveText') : t('audioToText.dragDropText')}</p>
                      <p className="file-info">{t('audioToText.supportedFormats')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="input-divider">
                <div className="divider-line"></div>
                <span className="divider-text">{t('audioToText.dividerOr')}</span>
                <div className="divider-line"></div>
              </div>

              {/* Record Section */}
              <div className="audio-record-area">
                <h3>
                  {t('audioToText.liveRecording')}
                </h3>
                <div className="record-controls">
                  <button 
                    onClick={handleOpenRecordingModal}
                    className="button button-primary start-recording-button"
                  >
                    <span className="mic-icon">🎙️</span>
                    {t('audioToText.liveRecording')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Output section */}
          <div className="output-section">
            <div className="output-container">
              {/* Output textarea - always visible */}
              <div className="output-area card">
                <textarea
                  value={transcriptionResult?.text || ''}
                  readOnly
                  className="output-textarea"
                  placeholder={transcriptionResult ? t('audioToText.transcriptionComplete') : t('audioToText.outputPlaceholder')}
                />
              </div>
              
              {/* Control buttons outside the textarea */}
              <div className="output-controls">
                <button
                  onClick={handleStartTranscription}
                  className={`button action-button button-primary ${isProcessing ? 'button-processing' : ''}`}
                  disabled={!uploadedFile || isProcessing}
                >
                  {isProcessing ? t('audioToText.processing') : t('audioToText.startTranscription')}
                </button>
                <button
                  onClick={() => {
                    transcriptionResult && navigator.clipboard.writeText(transcriptionResult.text);
                  }}
                  className="button action-button button-secondary"
                  disabled={!transcriptionResult || isGuest}
                >
                  {t('common.copy')}
                </button>
                <button
                  onClick={() => {
                    handleExportToWord();
                  }}
                  className="button action-button button-secondary"
                  disabled={!transcriptionResult}
                >
                  {t('common.export')}
                </button>
                <button
                  onClick={handleClearAll}
                  className="button action-button button-warning"
                  disabled={!uploadedFile && !transcriptionResult}
                >
                  {t('common.clear')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {isProcessing && (
          <div className="processing-indicator card">
            <div className="loading-spinner"></div>
            <p>{t('audioToText.processing')}</p>
            {uploadedFile && uploadedFile.size > 25 * 1024 * 1024 && (
              <p style={{ fontSize: 'var(--font-size-footnote)', color: 'var(--text-secondary)', marginTop: 'var(--spacing-sm)' }}>
                大文件正在分段处理，这可能需要几分钟时间...
              </p>
            )}
          </div>
        )}

        {usageLimitWarning && (
          <div className="warning-message card" style={{ backgroundColor: 'var(--warning-orange)', color: 'white' }}>
            <p>{usageLimitWarning}</p>
          </div>
        )}

        {error && (
          <div className="error-message card" style={{ backgroundColor: 'var(--error-red)', color: 'white' }}>
            <p>{error}</p>
          </div>
        )}

        {/* Recording Modal */}
        <RecordingModal
          isOpen={isRecordingModalOpen}
          onClose={handleCloseRecordingModal}
          onRecordingComplete={handleRecordingComplete}
        />
      </div>
    </div>
  );
};

export default AudioToText;