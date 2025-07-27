import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './AudioRecorder.css';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete }) => {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioData, setAudioData] = useState<number[]>(Array(32).fill(0));
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const visualizationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const currentAnimationRef = animationRef.current;
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (currentAnimationRef) {
        cancelAnimationFrame(currentAnimationRef);
      }
      if (visualizationIntervalRef.current) {
        clearInterval(visualizationIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      streamRef.current = stream;
      console.log('Microphone access granted');

      // Set up audio analysis for waveform visualization
      audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      // Configure analyser for real-time visualization
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.1;
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;
      
      source.connect(analyserRef.current);
      
      console.log('Audio analysis setup complete:', {
        fftSize: analyserRef.current.fftSize,
        frequencyBinCount: analyserRef.current.frequencyBinCount,
        sampleRate: audioContextRef.current.sampleRate
      });

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
        onRecordingComplete(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Start audio visualization with 100ms interval
      startAudioVisualization();
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (visualizationIntervalRef.current) {
      clearInterval(visualizationIntervalRef.current);
    }

    setIsRecording(false);
    setAudioData(Array(32).fill(0));
  };

  // New audio visualization function with 100ms interval
  const startAudioVisualization = () => {
    console.log('Starting audio visualization...');
    
    visualizationIntervalRef.current = setInterval(() => {
      if (!analyserRef.current || !isRecording) {
        console.log('Visualization stopped: no analyser or not recording');
        return;
      }

      try {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // Get frequency data
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume for overall level
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const averageVolume = sum / bufferLength;
        const normalizedVolume = Math.min(1, averageVolume / 128); // Normalize to 0-1
        
        // Debug: log volume occasionally
        if (Math.random() < 0.1) { // 10% chance to log
          console.log('Volume debug:', { averageVolume, normalizedVolume, bufferLength, firstFewValues: Array.from(dataArray.slice(0, 5)) });
        }
        
        // Generate 32 bars for visualization
        const bars = [];
        const barCount = 32;
        
        for (let i = 0; i < barCount; i++) {
          // Map each bar to a frequency range
          const freqIndex = Math.floor((i / barCount) * bufferLength);
          let barHeight = dataArray[freqIndex] / 255; // Normalize to 0-1
          
          // Boost the signal and add some baseline from overall volume
          barHeight = Math.max(barHeight, normalizedVolume * 0.3);
          barHeight = Math.min(1, barHeight * 2); // Amplify
          
          // Add some random variation for natural look
          const randomVariation = (Math.random() - 0.5) * 0.1 * barHeight;
          barHeight = Math.max(0.05, Math.min(1, barHeight + randomVariation));
          
          bars.push(barHeight);
        }
        
        setAudioData(bars);
        
      } catch (error) {
        console.error('Error in visualization:', error);
      }
    }, 100); // Update every 100ms as requested
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="audio-recorder">
      {isRecording ? (
        // Recording state: show waveform and controls
        <>
          <div className="waveform-container">
            <div className="waveform">
              {audioData.map((height, i) => (
                <div
                  key={i}
                  className="waveform-bar"
                  style={{
                    height: `${Math.max(8, height * 80)}px`,
                    backgroundColor: 'var(--primary-blue)',
                    opacity: Math.max(0.3, 0.5 + height * 0.5),
                    transition: 'height 0.1s ease-out, opacity 0.1s ease-out'
                  }}
                />
              ))}
            </div>
          </div>
          
          <div className="recording-controls">
            <div className="recording-info">
              <div className="recording-indicator">
                <div className="recording-dot"></div>
                <span>{t('audioToText.recording')}</span>
              </div>
              <div className="recording-time">{formatTime(recordingTime)}</div>
              <button
                onClick={stopRecording}
                className="button button-secondary stop-button"
              >
                {t('common.stop')}
              </button>
            </div>
          </div>
        </>
      ) : (
        // Initial state: only show start button
        <div className="recording-controls">
          <button
            onClick={startRecording}
            className="button button-primary start-recording-button"
          >
            <span className="mic-icon">◉</span>
            {t('audioToText.liveRecording')}
          </button>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;