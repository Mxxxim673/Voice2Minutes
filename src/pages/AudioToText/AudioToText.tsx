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
  const { user, isGuest, isAuthenticated, updateUserQuota } = useAuth();
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      // Check if guests can upload files
      if (isGuest) {
        setError(t('auth.guestLimitations.noUpload'));
        return;
      }
      
      try {
        // Check usage limits
        const limitCheck = await checkUsageLimit(file);
        if (!limitCheck.allowed) {
          setError(limitCheck.message || 'Usage limit exceeded');
          setUsageLimitWarning(limitCheck.message || null);
          return;
        }
        
        // If file is too long for user's quota, truncate it
        const userQuota = user?.quotaMinutes || 10;
        const remainingMinutes = (user?.quotaMinutes || 10) - (user?.usedMinutes || 0);
        const { file: processedFile, wasTruncated } = await truncateAudioForLimit(file, remainingMinutes);
        
        if (wasTruncated) {
          setUsageLimitWarning(t('audioToText.fileTruncated', { minutes: remainingMinutes.toFixed(1) }));
        }
        
        setUploadedFile(processedFile);
        setError(null);
      } catch (error) {
        console.error('File processing error:', error);
        setError(t('audioToText.fileProcessingError'));
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
      // Check usage limits before transcription
      const limitCheck = await checkUsageLimit(audioFile);
      if (!limitCheck.allowed) {
        setError(limitCheck.message || '您的试用时长已结束!');
        setIsProcessing(false);
        return;
      }
      
      const userType = isGuest ? 'guest' : (user?.userType || 'trial');
      const currentUsage = user?.usedMinutes || 0;
      
      // 获取音频时长并检查是否需要截断
      const originalDuration = await getAudioDuration(audioFile);
      const remainingMinutes = (user?.quotaMinutes || 10) - (user?.usedMinutes || 0);
      
      let actualAudioFile = audioFile;
      let actualDuration = originalDuration;
      let wasTruncated = false;
      
      // 如果音频时长超过剩余配额，进行截断处理
      if (originalDuration > remainingMinutes) {
        const truncateResult = await truncateAudioForLimit(audioFile, remainingMinutes);
        actualAudioFile = truncateResult.file;
        actualDuration = Math.min(originalDuration, remainingMinutes);
        wasTruncated = truncateResult.wasTruncated;
        
        if (wasTruncated) {
          setUsageLimitWarning(`⚠️ 音频文件过长，仅转换前 ${remainingMinutes.toFixed(1)} 分钟内容`);
        }
      }
      
      const transcriptionText = await transcribeAudio(actualAudioFile, userType, currentUsage);
      
      // 更新使用量 - 通过 AuthContext 同步状态
      if (!isGuest && user) {
        const newUsedMinutes = (user.usedMinutes || 0) + actualDuration;
        updateUserQuota(newUsedMinutes);
        
        // 检查是否已经用完配额
        if (newUsedMinutes >= (user.quotaMinutes || 10)) {
          setUsageLimitWarning('您的试用时长已结束! 请购买更多时长继续使用。');
        } else if ((user.quotaMinutes || 10) - newUsedMinutes <= 1) {
          setUsageLimitWarning(t('audioToText.quotaLowWarning'));
        }
      }
      
      // 同时记录到服务端（如果需要）
      await recordUsage(actualAudioFile, transcriptionText);
      
      const result: TranscriptionData = {
        text: transcriptionText,
        audioFile: audioFile
      };
      
      setTranscriptionResult(result);
      // Store transcription in localStorage
      localStorage.setItem('transcriptionResult', result.text);
      
      console.log(`✅ 转录完成，实际使用时长: ${actualDuration.toFixed(2)} 分钟${wasTruncated ? ' (已截断)' : ''}`);
      
    } catch (error) {
      console.error('Transcription error:', error);
      setError(t('audioToText.error') || 'An error occurred during transcription');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartTranscription = () => {
    if (uploadedFile) {
      handleTranscription(uploadedFile);
    }
  };

  const handleRecordingComplete = (audioBlob: Blob) => {
    console.log('🎙️ handleRecordingComplete 被调用，音频数据大小:', audioBlob.size, 'bytes');
    
    if (audioBlob.size === 0) {
      console.error('❌ 音频数据为空，无法进行转录');
      setError('录音数据为空，请重新录制');
      return;
    }
    
    const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
    console.log('📁 已创建音频文件:', audioFile.name, '大小:', audioFile.size, 'bytes');
    
    console.log('🚀 准备开始转录...');
    handleTranscription(audioFile);
  };

  const handleOpenRecordingModal = () => {
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
            {isGuest 
              ? t('audioToText.guestModeSubtitle')
              : t('audioToText.remainingTime', { 
                  minutes: user ? Math.max(0, (user.quotaMinutes || 10) - (user.usedMinutes || 0)).toFixed(1) : 10 
                })
            }
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
                    if (isGuest) {
                      alert(t('auth.guestLimitations.noCopy'));
                      return;
                    }
                    transcriptionResult && navigator.clipboard.writeText(transcriptionResult.text);
                  }}
                  className={`button action-button button-secondary ${isGuest ? 'button-disabled' : ''}`}
                  disabled={!transcriptionResult}
                  title={isGuest ? t('auth.guestLimitations.noCopy') : ''}
                >
                  {t('common.copy')}
                </button>
                <button
                  onClick={() => {
                    if (isGuest) {
                      alert(t('auth.guestLimitations.noExport'));
                      return;
                    }
                    handleExportToWord();
                  }}
                  className={`button action-button button-secondary ${isGuest ? 'button-disabled' : ''}`}
                  disabled={!transcriptionResult}
                  title={isGuest ? t('auth.guestLimitations.noExport') : ''}
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