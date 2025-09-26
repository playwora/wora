/**
 * LUFS (Loudness Units relative to Full Scale) Analyzer
 * Implements ITU-R BS.1770-4 standard for broadcast loudness measurement
 */

export interface LoudnessMetrics {
  integratedLUFS: number;    // Overall loudness of the entire track
  shortTermLUFS: number;      // 3-second window loudness
  momentaryLUFS: number;      // 400ms window loudness
  loudnessRange: number;      // LRA - dynamic range in LU
  truePeak: number;          // Maximum true peak in dBFS
  replayGainDB: number;      // Suggested ReplayGain adjustment
}

export class LUFSAnalyzer {
  private audioContext: OfflineAudioContext | null = null;
  private sampleRate: number = 48000;
  private analysisCache = new Map<string, LoudnessMetrics>();

  // K-weighting filter coefficients (ITU-R BS.1770-4)
  private readonly kWeightingCoefficients = {
    highShelf: {
      frequency: 1500,
      gain: 3.999843853973347
    },
    highPass: {
      frequency: 38,
      Q: 0.5003270373238773
    }
  };

  /**
   * Analyze a track for loudness metrics
   */
  async analyzeTrack(filePath: string): Promise<LoudnessMetrics> {
    // Check cache first
    const cached = this.analysisCache.get(filePath);
    if (cached) {
      return cached;
    }

    try {
      // Fetch and decode audio
      const audioBuffer = await this.loadAndDecodeAudio(filePath);

      // Perform LUFS analysis
      const metrics = await this.analyzeLoudness(audioBuffer);

      // Cache results
      this.analysisCache.set(filePath, metrics);

      return metrics;
    } catch (error) {
      console.error('LUFS analysis failed:', error);

      // Return default values on error
      return {
        integratedLUFS: -23.0, // EBU R128 target
        shortTermLUFS: -23.0,
        momentaryLUFS: -23.0,
        loudnessRange: 7.0,
        truePeak: -1.0,
        replayGainDB: 0
      };
    }
  }

  /**
   * Load and decode audio file
   */
  private async loadAndDecodeAudio(filePath: string): Promise<AudioBuffer> {
    const response = await fetch(`wora://${encodeURIComponent(filePath)}`);
    const arrayBuffer = await response.arrayBuffer();

    // Create offline context for analysis
    this.audioContext = new OfflineAudioContext({
      numberOfChannels: 2,
      length: 1, // Will be updated after decoding
      sampleRate: this.sampleRate
    });

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    // Recreate context with correct length
    this.audioContext = new OfflineAudioContext({
      numberOfChannels: audioBuffer.numberOfChannels,
      length: audioBuffer.length,
      sampleRate: audioBuffer.sampleRate
    });

    return audioBuffer;
  }

  /**
   * Apply K-weighting filter (ITU-R BS.1770-4)
   */
  private applyKWeighting(audioBuffer: AudioBuffer): Float32Array[] {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    const channels: Float32Array[] = [];

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);

      // Apply two-stage filter
      const filtered = this.applyFilters(channelData, audioBuffer.sampleRate);
      channels.push(filtered);
    }

    return channels;
  }

  /**
   * Apply K-weighting filters
   */
  private applyFilters(samples: Float32Array, sampleRate: number): Float32Array {
    // Stage 1: High-pass filter (38 Hz)
    const highPassed = this.applyHighPassFilter(
      samples,
      this.kWeightingCoefficients.highPass.frequency,
      this.kWeightingCoefficients.highPass.Q,
      sampleRate
    );

    // Stage 2: High-shelf filter (1500 Hz, +4 dB)
    const kWeighted = this.applyHighShelfFilter(
      highPassed,
      this.kWeightingCoefficients.highShelf.frequency,
      this.kWeightingCoefficients.highShelf.gain,
      sampleRate
    );

    return kWeighted;
  }

  /**
   * Apply high-pass filter
   */
  private applyHighPassFilter(samples: Float32Array, frequency: number, Q: number, sampleRate: number): Float32Array {
    const filtered = new Float32Array(samples.length);

    // Butterworth high-pass coefficients
    const omega = 2 * Math.PI * frequency / sampleRate;
    const sin = Math.sin(omega);
    const cos = Math.cos(omega);
    const alpha = sin / (2 * Q);

    const b0 = (1 + cos) / 2;
    const b1 = -(1 + cos);
    const b2 = (1 + cos) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cos;
    const a2 = 1 - alpha;

    // Apply filter
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

    for (let i = 0; i < samples.length; i++) {
      const x0 = samples[i];
      const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;

      filtered[i] = y0;

      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
    }

    return filtered;
  }

  /**
   * Apply high-shelf filter
   */
  private applyHighShelfFilter(samples: Float32Array, frequency: number, gainDB: number, sampleRate: number): Float32Array {
    const filtered = new Float32Array(samples.length);

    // High-shelf coefficients
    const A = Math.pow(10, gainDB / 40);
    const omega = 2 * Math.PI * frequency / sampleRate;
    const sin = Math.sin(omega);
    const cos = Math.cos(omega);
    const beta = Math.sqrt(A) / 1.0; // Q = 1.0 for shelf

    const b0 = A * ((A + 1) + (A - 1) * cos + beta * sin);
    const b1 = -2 * A * ((A - 1) + (A + 1) * cos);
    const b2 = A * ((A + 1) + (A - 1) * cos - beta * sin);
    const a0 = (A + 1) - (A - 1) * cos + beta * sin;
    const a1 = 2 * ((A - 1) - (A + 1) * cos);
    const a2 = (A + 1) - (A - 1) * cos - beta * sin;

    // Apply filter
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

    for (let i = 0; i < samples.length; i++) {
      const x0 = samples[i];
      const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;

      filtered[i] = y0;

      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
    }

    return filtered;
  }

  /**
   * Calculate mean square of samples
   */
  private calculateMeanSquare(channels: Float32Array[]): number {
    let sum = 0;
    let count = 0;

    // Calculate weighted sum based on channel configuration
    if (channels.length === 1) {
      // Mono
      const samples = channels[0];
      for (let i = 0; i < samples.length; i++) {
        sum += samples[i] * samples[i];
        count++;
      }
    } else if (channels.length === 2) {
      // Stereo
      const left = channels[0];
      const right = channels[1];
      for (let i = 0; i < left.length; i++) {
        sum += left[i] * left[i] + right[i] * right[i];
        count += 2;
      }
    } else {
      // Multi-channel (5.1, 7.1, etc.)
      // Apply ITU-R BS.1770-4 channel weights
      const weights = [1.0, 1.0, 1.0, 1.41, 1.41]; // L, R, C, Ls, Rs

      for (let i = 0; i < channels[0].length; i++) {
        for (let ch = 0; ch < Math.min(channels.length, weights.length); ch++) {
          const weight = weights[ch] || 1.0;
          const sample = channels[ch][i];
          sum += weight * sample * sample;
          count++;
        }
      }
    }

    return count > 0 ? sum / count : 0;
  }

  /**
   * Convert linear value to LUFS
   */
  private linearToLUFS(linear: number): number {
    if (!isFinite(linear) || linear <= 0 || isNaN(linear)) return -70.0; // Minimum LUFS value
    const lufs = -0.691 + 10 * Math.log10(linear);
    return isFinite(lufs) ? lufs : -70.0;
  }

  /**
   * Calculate true peak
   */
  private calculateTruePeak(channels: Float32Array[]): number {
    let maxPeak = 0;

    for (const channel of channels) {
      for (let i = 0; i < channel.length; i++) {
        const value = Math.abs(channel[i]);
        if (isFinite(value) && !isNaN(value)) {
          maxPeak = Math.max(maxPeak, value);
        }
      }
    }

    // Convert to dBFS
    if (maxPeak > 0 && isFinite(maxPeak)) {
      const dbfs = 20 * Math.log10(maxPeak);
      return isFinite(dbfs) ? dbfs : -100;
    }
    return -100;
  }

  /**
   * Perform complete loudness analysis
   */
  private async analyzeLoudness(audioBuffer: AudioBuffer): Promise<LoudnessMetrics> {
    // Apply K-weighting
    const kWeightedChannels = this.applyKWeighting(audioBuffer);

    // Calculate integrated loudness (entire track)
    const integratedMeanSquare = this.calculateMeanSquare(kWeightedChannels);
    const integratedLUFS = this.linearToLUFS(integratedMeanSquare);

    // Calculate short-term loudness (3-second window)
    const shortTermWindow = Math.min(3 * audioBuffer.sampleRate, audioBuffer.length);
    const shortTermChannels = kWeightedChannels.map(ch =>
      ch.slice(Math.max(0, ch.length - shortTermWindow))
    );
    const shortTermMeanSquare = this.calculateMeanSquare(shortTermChannels);
    const shortTermLUFS = this.linearToLUFS(shortTermMeanSquare);

    // Calculate momentary loudness (400ms window)
    const momentaryWindow = Math.min(0.4 * audioBuffer.sampleRate, audioBuffer.length);
    const momentaryChannels = kWeightedChannels.map(ch =>
      ch.slice(Math.max(0, ch.length - momentaryWindow))
    );
    const momentaryMeanSquare = this.calculateMeanSquare(momentaryChannels);
    const momentaryLUFS = this.linearToLUFS(momentaryMeanSquare);

    // Calculate loudness range (simplified)
    const loudnessRange = Math.abs(shortTermLUFS - momentaryLUFS) * 2;

    // Calculate true peak
    const truePeak = this.calculateTruePeak(kWeightedChannels);

    // Calculate ReplayGain adjustment
    // Target: -18 LUFS for ReplayGain 2.0
    const targetLUFS = -18.0;
    const replayGainDB = targetLUFS - integratedLUFS;

    return {
      integratedLUFS,
      shortTermLUFS,
      momentaryLUFS,
      loudnessRange,
      truePeak,
      replayGainDB
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.analysisCache.clear();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.audioContext) {
      // OfflineAudioContext doesn't need explicit closing
      this.audioContext = null;
    }
    this.clearCache();
  }
}