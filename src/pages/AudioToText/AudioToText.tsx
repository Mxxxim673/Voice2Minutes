import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import RecordingModal from '../../components/RecordingModal/RecordingModal';
import TranscriptionResult from '../../components/TranscriptionResult/TranscriptionResult';
import { transcribeAudio } from '../../services/audioService';
import { exportToWord } from '../../utils/exportUtils';
import './AudioToText.css';

interface TranscriptionData {
  text: string;
  audioFile?: File;
}

const AudioToText: React.FC = () => {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);

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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      setError(null);
    }
  }, []);

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
    
    try {
      const transcriptionText = await transcribeAudio(audioFile);
      
      const result: TranscriptionData = {
        text: transcriptionText,
        audioFile: audioFile
      };
      
      setTranscriptionResult(result);
      // Store transcription in localStorage
      localStorage.setItem('transcriptionResult', result.text);
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
    const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
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
        </div>

        <div className="main-content">
          {/* Left side - Input section */}
          <div className="input-section">
            <div className="card">
              <h2 style={{ marginBottom: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--text-primary)', fontSize: 'var(--font-size-title3)' }}>
                {t('audioToText.audioInputMethod')}
              </h2>
              
              {/* Upload Section */}
              <div className="audio-upload-area">
                <h3 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-subhead)' }}>
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
                      <div className="upload-icon" style={{ fontSize: '48px', color: 'var(--primary-blue)' }}>↑</div>
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
                <h3 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-subhead)' }}>
                  {t('audioToText.liveRecording')}
                </h3>
                <div className="record-controls">
                  <button 
                    onClick={handleOpenRecordingModal}
                    className="button button-primary start-recording-button"
                  >
                    <span className="mic-icon">◉</span>
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
                  placeholder={transcriptionResult ? t('audioToText.transcriptionComplete') : ''}
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
                  onClick={() => transcriptionResult && navigator.clipboard.writeText(transcriptionResult.text)}
                  className="button action-button button-secondary"
                  disabled={!transcriptionResult}
                >
                  {t('common.copy')}
                </button>
                <button
                  onClick={handleExportToWord}
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