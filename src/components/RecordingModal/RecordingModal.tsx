import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './RecordingModal.css';

interface RecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (audioBlob: Blob) => void;
}

const RecordingModal: React.FC<RecordingModalProps> = ({ isOpen, onClose, onRecordingComplete }) => {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioData, setAudioData] = useState<number[]>(Array(32).fill(0));
  const [hasRecording, setHasRecording] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const visualizationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setHasRecording(true);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Start audio visualization
      startAudioVisualization();
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Unable to access microphone. Please check permissions.');
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
      
      // Restart timer
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      
      // Restart visualization
      startAudioVisualization();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && 
        (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
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
    if (hasRecording && audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      onRecordingComplete(audioBlob);
      handleClose();
    }
  };

  const handleClose = () => {
    cleanup();
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    setAudioData(Array(32).fill(0));
    setHasRecording(false);
    audioChunksRef.current = [];
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

          {/* Recording time */}
          <div className="recording-time">{formatTime(recordingTime)}</div>

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