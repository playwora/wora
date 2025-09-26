/**
 * Audio Decoder for Electron Main Process
 * Uses music-metadata for file parsing and native Node.js for audio processing
 */

import * as fs from 'fs';
import * as mm from 'music-metadata';
import { spawn } from 'child_process';
import * as path from 'path';

export interface DecodedAudioData {
  sampleRate: number;
  numberOfChannels: number;
  duration: number;
  format: string;
  bitrate?: number;
  lossless: boolean;
  samples?: Float32Array;
}

/**
 * Decode audio file metadata and optionally extract PCM samples
 */
export async function decodeAudioFile(
  filePath: string,
  extractSamples: boolean = false
): Promise<DecodedAudioData> {
  try {
    // Parse metadata using music-metadata
    const metadata = await mm.parseFile(filePath);

    const audioData: DecodedAudioData = {
      sampleRate: metadata.format.sampleRate || 44100,
      numberOfChannels: metadata.format.numberOfChannels || 2,
      duration: metadata.format.duration || 0,
      format: metadata.format.codec || 'unknown',
      bitrate: metadata.format.bitrate,
      lossless: metadata.format.lossless || false
    };

    // If samples are needed, use ffmpeg to extract PCM data
    if (extractSamples && audioData.duration > 0) {
      audioData.samples = await extractPCMSamples(filePath, audioData);
    }

    return audioData;

  } catch (error) {
    throw error;
  }
}

/**
 * Extract PCM samples using ffmpeg (if available)
 * Falls back to basic analysis if ffmpeg is not available
 */
async function extractPCMSamples(
  filePath: string,
  audioData: DecodedAudioData
): Promise<Float32Array> {
  // Check if ffmpeg is available
  const ffmpegAvailable = await checkFFmpegAvailable();

  if (!ffmpegAvailable) {
    // Return empty samples array
    return new Float32Array(Math.floor(audioData.sampleRate * audioData.duration));
  }

  return new Promise((resolve, reject) => {
    const sampleRate = 44100; // Standardize to 44.1kHz for analysis
    const channels = 1; // Convert to mono for analysis
    let ffmpegProcess: any = null;
    let processKilled = false;

    try {
      // Use ffmpeg to extract PCM samples
      ffmpegProcess = spawn('ffmpeg', [
        '-i', filePath,
        '-f', 'f32le', // 32-bit float PCM
        '-ar', sampleRate.toString(), // Sample rate
        '-ac', channels.toString(), // Channels (mono)
        '-' // Output to stdout
      ]);

      const chunks: Buffer[] = [];
      const maxChunkSize = 100 * 1024 * 1024; // 100MB limit
      let totalSize = 0;

      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        if (ffmpegProcess && !processKilled) {
          processKilled = true;
          ffmpegProcess.kill('SIGTERM');
          resolve(new Float32Array(Math.floor(sampleRate * audioData.duration)));
        }
      }, 30000); // 30 second timeout

      ffmpegProcess.stdout.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > maxChunkSize) {
          // Kill process if output is too large
          if (!processKilled) {
            processKilled = true;
            ffmpegProcess.kill('SIGTERM');
          }
          return;
        }
        chunks.push(chunk);
      });

      ffmpegProcess.stderr.on('data', (data: any) => {
        // FFmpeg outputs progress to stderr, ignore it
      });

      ffmpegProcess.on('close', (code: number) => {
        clearTimeout(timeout);

        if (processKilled) {
          // Process was killed, return empty samples
          resolve(new Float32Array(Math.floor(sampleRate * audioData.duration)));
          return;
        }

        if (code === 0) {
          // Combine all chunks
          const buffer = Buffer.concat(chunks);

          // Convert to Float32Array
          const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);

          resolve(samples);
        } else {
          // Return empty samples on error
          resolve(new Float32Array(Math.floor(sampleRate * audioData.duration)));
        }
      });

      ffmpegProcess.on('error', (error: Error) => {
        clearTimeout(timeout);

        // Kill the process if it's still running
        if (ffmpegProcess && !processKilled) {
          processKilled = true;
          try {
            ffmpegProcess.kill('SIGTERM');
          } catch (e) {
            // Ignore kill errors
          }
        }

        // Return empty samples on error
        resolve(new Float32Array(Math.floor(sampleRate * audioData.duration)));
      });

    } catch (error) {

      // Ensure process is killed
      if (ffmpegProcess && !processKilled) {
        try {
          ffmpegProcess.kill('SIGTERM');
        } catch (e) {
          // Ignore kill errors
        }
      }

      resolve(new Float32Array(Math.floor(sampleRate * audioData.duration)));
    }
  });
}

/**
 * Check if ffmpeg is available on the system
 */
async function checkFFmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);

    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });

    ffmpeg.on('error', () => {
      resolve(false);
    });

    // Timeout after 2 seconds
    setTimeout(() => {
      ffmpeg.kill();
      resolve(false);
    }, 2000);
  });
}

/**
 * Analyze audio loudness (simplified LUFS calculation)
 */
export function analyzeLoudness(samples: Float32Array): {
  rms: number;
  peak: number;
  estimatedLUFS: number;
} {
  if (samples.length === 0) {
    return { rms: 0, peak: 0, estimatedLUFS: -70 };
  }

  let sum = 0;
  let peak = 0;

  for (let i = 0; i < samples.length; i++) {
    const absValue = Math.abs(samples[i]);
    peak = Math.max(peak, absValue);
    sum += samples[i] * samples[i];
  }

  const rms = Math.sqrt(sum / samples.length);

  // Simplified LUFS estimation (not ITU-R BS.1770-4 compliant)
  // For accurate LUFS, implement proper K-weighting filters
  const estimatedLUFS = rms > 0 ? -0.691 + 10 * Math.log10(rms) : -70;

  return {
    rms,
    peak,
    estimatedLUFS: Math.max(-70, Math.min(0, estimatedLUFS))
  };
}

/**
 * Detect silence in audio
 */
export function detectSilence(
  samples: Float32Array,
  sampleRate: number,
  thresholdDB: number = -60
): {
  startSilence: number;
  endSilence: number;
} {
  if (samples.length === 0) {
    return { startSilence: 0, endSilence: 0 };
  }

  const threshold = Math.pow(10, thresholdDB / 20);
  const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows

  // Find start silence
  let startSilence = 0;
  for (let i = 0; i < samples.length; i += windowSize) {
    let maxInWindow = 0;
    for (let j = i; j < Math.min(i + windowSize, samples.length); j++) {
      maxInWindow = Math.max(maxInWindow, Math.abs(samples[j]));
    }
    if (maxInWindow > threshold) {
      startSilence = i / sampleRate;
      break;
    }
  }

  // Find end silence
  let endSilence = 0;
  for (let i = samples.length - windowSize; i >= 0; i -= windowSize) {
    let maxInWindow = 0;
    for (let j = i; j < Math.min(i + windowSize, samples.length); j++) {
      maxInWindow = Math.max(maxInWindow, Math.abs(samples[j]));
    }
    if (maxInWindow > threshold) {
      endSilence = (samples.length - i - windowSize) / sampleRate;
      break;
    }
  }

  return {
    startSilence: Math.max(0, startSilence),
    endSilence: Math.max(0, endSilence)
  };
}

/**
 * Simple beat detection (energy-based)
 */
export function detectBeats(
  samples: Float32Array,
  sampleRate: number
): {
  estimatedBPM: number;
  confidence: number;
} {
  if (samples.length === 0) {
    return { estimatedBPM: 120, confidence: 0 };
  }

  // Simplified beat detection
  // For accurate beat detection, implement spectral flux and onset detection

  const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
  const energies: number[] = [];

  // Calculate energy in each window
  for (let i = 0; i < samples.length - windowSize; i += windowSize) {
    let energy = 0;
    for (let j = i; j < i + windowSize; j++) {
      energy += samples[j] * samples[j];
    }
    energies.push(energy);
  }

  // Find peaks in energy (potential beats)
  const peaks: number[] = [];
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
      if (energies[i] > energies.reduce((a, b) => a + b) / energies.length * 1.5) {
        peaks.push(i);
      }
    }
  }

  // Calculate intervals between peaks
  if (peaks.length < 2) {
    return { estimatedBPM: 120, confidence: 0 };
  }

  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push((peaks[i] - peaks[i - 1]) * windowSize / sampleRate);
  }

  // Find most common interval (mode)
  intervals.sort((a, b) => a - b);
  const medianInterval = intervals[Math.floor(intervals.length / 2)];

  // Convert to BPM
  const estimatedBPM = Math.round(60 / medianInterval);

  // Calculate confidence based on interval consistency
  let variance = 0;
  for (const interval of intervals) {
    variance += Math.pow(interval - medianInterval, 2);
  }
  const stdDev = Math.sqrt(variance / intervals.length);
  const confidence = Math.max(0, Math.min(1, 1 - (stdDev / medianInterval)));

  return {
    estimatedBPM: Math.max(60, Math.min(200, estimatedBPM)),
    confidence
  };
}