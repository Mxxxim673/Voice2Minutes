import { enforceApiQuotaLimits, recordApiUsage, preprocessAudioForLimits } from './apiService';

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const WHISPER_API_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

if (!API_KEY) {
  console.error('OpenAI API key not found in environment variables');
}

// Function to format transcription with timestamps only
const formatTranscriptionWithSpeakers = (data: any): string => {
  if (!data.segments || !Array.isArray(data.segments)) {
    return data.text || '';
  }

  const segments = data.segments;
  let formattedTranscription = '';
  let lastTimestamp = -1;
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const timestamp = formatTimestamp(segment.start);
    
    // Add timestamp every 30 seconds or at the beginning
    if (i === 0 || segment.start - lastTimestamp >= 30) {
      if (i > 0) {
        formattedTranscription += '\n\n';
      }
      formattedTranscription += `[${timestamp}]\n`;
      lastTimestamp = segment.start;
    }
    
    // Add the text
    formattedTranscription += segment.text.trim() + ' ';
    
    // Add line breaks for better readability every few segments
    if ((i + 1) % 3 === 0 && i < segments.length - 1) {
      formattedTranscription += '\n';
    }
  }
  
  return formattedTranscription.trim();
};

// Helper function to format timestamp
const formatTimestamp = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Function to combine segment transcriptions with timestamps
const combineSegmentTranscriptions = (transcriptions: string[]): string => {
  if (transcriptions.length === 0) return '';
  if (transcriptions.length === 1) return transcriptions[0];
  
  let combined = '';
  
  for (let i = 0; i < transcriptions.length; i++) {
    const transcription = transcriptions[i].trim();
    if (!transcription) continue;
    
    // Add timestamp for each segment
    const segmentTime = i * 3; // Assuming 3-minute segments
    const timestamp = formatTimestamp(segmentTime * 60);
    
    if (i > 0) {
      combined += '\n\n';
    }
    
    combined += `[${timestamp}]\n`;
    combined += transcription;
    
    if (i < transcriptions.length - 1) {
      combined += '\n';
    }
  }
  
  return combined;
};

export const transcribeAudio = async (
  audioFile: File, 
  userType: 'guest' | 'trial' | 'paid' | 'subscription' | 'admin' = 'guest',
  currentUsage: number = 0
): Promise<string> => {
  if (!API_KEY) {
    throw new Error('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your .env file.');
  }

  console.log(`Processing audio file: ${audioFile.name}, size: ${(audioFile.size / 1024 / 1024).toFixed(2)}MB`);

  // Check API quota limits before processing
  try {
    const preprocessResult = await preprocessAudioForLimits(audioFile, userType, currentUsage);
    
    if (!preprocessResult.success) {
      throw new Error(preprocessResult.error || 'Usage quota exceeded');
    }

    const { processedFile, wasTruncated, processedDuration } = preprocessResult.data!;
    
    if (wasTruncated) {
      console.warn(`Audio file truncated to ${processedDuration.toFixed(1)} minutes due to usage limits`);
    }

    // For files larger than 25MB, we need to use Web Audio API for proper audio segmentation
    // Simple byte slicing doesn't work for audio files as it breaks the file structure
    let transcriptionResult: string;
    if (processedFile.size > MAX_FILE_SIZE) {
      console.log('File is larger than 25MB, attempting Web Audio API segmentation');
      transcriptionResult = await transcribeWithWebAudioAPI(processedFile);
    } else {
      console.log('Using direct processing');
      transcriptionResult = await transcribeFile(processedFile);
    }

    // Record usage after successful transcription
    await recordApiUsage(processedFile, transcriptionResult, userType);

    // Add truncation notice if applicable
    if (wasTruncated) {
      transcriptionResult += `\n\n[${processedDuration.toFixed(1)} minutes processed - Usage limit reached]`;
    }

    return transcriptionResult;
  } catch (error) {
    console.error('Transcription failed:', error);
    throw error;
  }
};

const transcribeFile = async (audioFile: File): Promise<string> => {
  console.log(`Transcribing file: ${audioFile.name}, size: ${(audioFile.size / 1024 / 1024).toFixed(2)}MB, type: ${audioFile.type}`);
  
  // Validate file size
  if (audioFile.size > MAX_FILE_SIZE) {
    throw new Error(`File size ${(audioFile.size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  
  // Validate file type - OpenAI API 支持的格式
  const validTypes = [
    'audio/flac', 'audio/m4a', 'audio/mp3', 'audio/mp4', 
    'audio/mpeg', 'audio/mpga', 'audio/oga', 'audio/ogg', 
    'audio/wav', 'audio/webm'
  ];
  
  console.log(`🔍 验证文件格式: ${audioFile.type}`);
  
  // 检查文件类型是否被支持
  const isSupported = validTypes.some(type => {
    // 完全匹配或包含匹配（处理如 audio/webm;codecs=opus 的情况）
    return audioFile.type === type || audioFile.type.startsWith(type);
  });
  
  if (!isSupported) {
    console.error(`❌ 不支持的文件格式: ${audioFile.type}`);
    console.log('✅ 支持的格式:', validTypes.join(', '));
    throw new Error(`文件格式 ${audioFile.type} 不被支持。支持的格式包括: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm`);
  }
  
  console.log(`✅ 文件格式验证通过: ${audioFile.type}`);

  const formData = new FormData();
  formData.append('file', audioFile);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');

  try {
    console.log('Sending request to OpenAI Whisper API...');
    const response = await fetch(WHISPER_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: formData,
    });

    console.log(`API Response status: ${response.status}`);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
        console.error('API Error details:', errorData);
      } catch (parseError) {
        console.error('Could not parse error response:', parseError);
        const responseText = await response.text().catch(() => 'Unable to read response');
        console.error('Raw error response:', responseText);
      }
      throw new Error(`OpenAI API Error: ${errorMessage}`);
    }

    const data = await response.json();
    console.log(`Transcription successful, segments: ${data.segments?.length || 0}`);
    
    // Format transcription with speaker detection and timestamps
    return formatTranscriptionWithSpeakers(data);
  } catch (error) {
    console.error('Transcription error:', error);
    if (error instanceof Error) {
      throw new Error(`Transcription failed: ${error.message}`);
    } else {
      throw new Error('Unknown transcription error occurred');
    }
  }
};

// New function to handle large files using Web Audio API
const transcribeWithWebAudioAPI = async (audioFile: File): Promise<string> => {
  try {
    console.log('Starting Web Audio API processing...');
    
    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Convert file to array buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    
    // Decode the audio file
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    console.log(`Audio decoded: ${audioBuffer.duration.toFixed(2)} seconds, ${audioBuffer.sampleRate}Hz`);
    
    // Calculate optimal segment duration based on file size
    // WAV files are much larger than compressed formats, so we need smaller segments
    const totalDuration = audioBuffer.duration;
    const estimatedWavSizePerSecond = (audioBuffer.sampleRate * audioBuffer.numberOfChannels * 2) / 1024 / 1024; // MB per second for 16-bit
    const estimatedTotalWavSize = totalDuration * estimatedWavSizePerSecond;
    
    console.log(`Estimated WAV size: ${estimatedTotalWavSize.toFixed(2)}MB`);
    
    // Start with 3-minute segments and adjust if needed
    let maxSegmentDuration = 3 * 60; // 3 minutes in seconds
    let numberOfSegments = Math.ceil(totalDuration / maxSegmentDuration);
    
    // If estimated segment size is still too large, reduce further
    const estimatedSegmentSize = estimatedTotalWavSize / numberOfSegments;
    if (estimatedSegmentSize > 20) { // Target 20MB max per segment
      maxSegmentDuration = Math.min(maxSegmentDuration, (20 / estimatedWavSizePerSecond));
      numberOfSegments = Math.ceil(totalDuration / maxSegmentDuration);
    }
    
    console.log(`Segment duration: ${maxSegmentDuration.toFixed(1)}s, Will create ${numberOfSegments} segments`);
    
    const transcriptions: string[] = [];
    
    for (let i = 0; i < numberOfSegments; i++) {
      const startTime = i * maxSegmentDuration;
      const endTime = Math.min((i + 1) * maxSegmentDuration, totalDuration);
      const segmentDuration = endTime - startTime;
      
      console.log(`Processing segment ${i + 1}/${numberOfSegments}: ${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s`);
      
      // Create a new buffer for this segment
      const segmentBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        Math.floor(segmentDuration * audioBuffer.sampleRate),
        audioBuffer.sampleRate
      );
      
      // Copy audio data for this segment
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const originalChannelData = audioBuffer.getChannelData(channel);
        const segmentChannelData = segmentBuffer.getChannelData(channel);
        const startSample = Math.floor(startTime * audioBuffer.sampleRate);
        
        for (let sample = 0; sample < segmentBuffer.length; sample++) {
          segmentChannelData[sample] = originalChannelData[startSample + sample] || 0;
        }
      }
      
      // Convert segment to WAV blob, with quality reduction if needed
      let segmentBlob = await audioBufferToWav(segmentBuffer, false);
      let segmentFile = new File([segmentBlob], `segment_${i}.wav`, { type: 'audio/wav' });
      
      console.log(`Segment ${i + 1} initial size: ${(segmentFile.size / 1024 / 1024).toFixed(2)}MB`);
      
      // If segment is too large, try with reduced quality
      if (segmentFile.size > MAX_FILE_SIZE) {
        console.log(`Segment ${i + 1} too large, trying with reduced quality...`);
        segmentBlob = await audioBufferToWav(segmentBuffer, true);
        segmentFile = new File([segmentBlob], `segment_${i}_reduced.wav`, { type: 'audio/wav' });
        console.log(`Segment ${i + 1} reduced size: ${(segmentFile.size / 1024 / 1024).toFixed(2)}MB`);
        
        // If still too large, throw error
        if (segmentFile.size > MAX_FILE_SIZE) {
          throw new Error(`Even with quality reduction, segment ${i + 1} is ${(segmentFile.size / 1024 / 1024).toFixed(2)}MB, which exceeds the 25MB limit. Please use a shorter audio file or convert to a more compressed format.`);
        }
      }
      
      // Transcribe this segment
      const segmentTranscription = await transcribeFile(segmentFile);
      transcriptions.push(segmentTranscription);
      
      // Add delay between segments
      if (i < numberOfSegments - 1) {
        console.log('Waiting 2 seconds before next segment...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Close audio context
    await audioContext.close();
    
    console.log(`Successfully processed all ${numberOfSegments} segments`);
    
    // Combine transcriptions with speaker detection
    return combineSegmentTranscriptions(transcriptions);
    
  } catch (error) {
    console.error('Web Audio API processing failed:', error);
    
    // Fallback: suggest file size reduction
    if (error instanceof Error && error.message.includes('decodeAudioData')) {
      throw new Error(`Cannot process this audio file format. Please try converting to MP3 or WAV format, or reduce the file size to under 25MB.`);
    }
    
    throw new Error(`Large file processing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try reducing the file size to under 25MB.`);
  }
};




// Convert AudioBuffer to WAV blob with quality reduction options
const audioBufferToWav = async (audioBuffer: AudioBuffer, reduceQuality: boolean = false): Promise<Blob> => {
  // For large files, reduce quality to save space
  const numberOfChannels = reduceQuality ? 1 : audioBuffer.numberOfChannels; // Convert to mono if needed
  const targetSampleRate = reduceQuality ? Math.min(audioBuffer.sampleRate, 22050) : audioBuffer.sampleRate; // Reduce sample rate
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = targetSampleRate * blockAlign;
  
  // Calculate output length based on potential downsampling
  const downsampleRatio = audioBuffer.sampleRate / targetSampleRate;
  const samplesCount = Math.floor(audioBuffer.length / downsampleRatio);
  const dataSize = samplesCount * blockAlign;
  const bufferSize = 44 + dataSize;
  
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const dataView = new DataView(arrayBuffer);
  
  // WAV header
  let offset = 0;
  
  // RIFF chunk descriptor
  writeString(dataView, offset, 'RIFF'); offset += 4;
  dataView.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString(dataView, offset, 'WAVE'); offset += 4;
  
  // FMT sub-chunk
  writeString(dataView, offset, 'fmt '); offset += 4;
  dataView.setUint32(offset, 16, true); offset += 4; // Sub-chunk size
  dataView.setUint16(offset, format, true); offset += 2; // Audio format
  dataView.setUint16(offset, numberOfChannels, true); offset += 2; // Number of channels
  dataView.setUint32(offset, targetSampleRate, true); offset += 4; // Sample rate
  dataView.setUint32(offset, byteRate, true); offset += 4; // Byte rate
  dataView.setUint16(offset, blockAlign, true); offset += 2; // Block align
  dataView.setUint16(offset, bitDepth, true); offset += 2; // Bits per sample
  
  // Data sub-chunk
  writeString(dataView, offset, 'data'); offset += 4;
  dataView.setUint32(offset, dataSize, true); offset += 4;
  
  // Write PCM samples with potential downsampling and channel reduction
  const originalChannels: Float32Array[] = [];
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    originalChannels.push(audioBuffer.getChannelData(i));
  }
  
  for (let i = 0; i < samplesCount; i++) {
    const sourceIndex = Math.floor(i * downsampleRatio);
    
    for (let channel = 0; channel < numberOfChannels; channel++) {
      let sample: number;
      
      if (reduceQuality && audioBuffer.numberOfChannels > 1) {
        // Mix down to mono
        sample = 0;
        for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
          sample += originalChannels[c][sourceIndex] || 0;
        }
        sample /= audioBuffer.numberOfChannels;
      } else {
        sample = originalChannels[channel][sourceIndex] || 0;
      }
      
      sample = Math.max(-1, Math.min(1, sample));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      dataView.setInt16(offset, intSample, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
};

// Helper function to write string to DataView
const writeString = (dataView: DataView, offset: number, string: string): void => {
  for (let i = 0; i < string.length; i++) {
    dataView.setUint8(offset + i, string.charCodeAt(i));
  }
};

// Helper function to validate audio file
export const validateAudioFile = (file: File): { isValid: boolean; error?: string } => {
  const validTypes = [
    'audio/mpeg',
    'audio/mp3', 
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/m4a',
    'audio/mp4',
    'audio/flac',
    'audio/ogg',
    'audio/webm'
  ];

  if (!validTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Unsupported file type. Please use MP3, WAV, M4A, FLAC, or OGG format.'
    };
  }

  // Note: We allow files larger than 25MB since we handle chunking
  const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total limit
  if (file.size > MAX_TOTAL_SIZE) {
    return {
      isValid: false,
      error: 'File too large. Maximum file size is 100MB.'
    };
  }

  return { isValid: true };
};