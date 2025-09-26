/**
 * Advanced silence detector using actual amplitude analysis
 * Detects true silence at beginning and end of tracks for seamless playback
 */

export interface SilenceMetrics {
  startSilence: number;      // Seconds of silence at start
  endSilence: number;        // Seconds of silence at end
  startFadeIn: number;       // Seconds of fade-in detected
  endFadeOut: number;        // Seconds of fade-out detected
  hasGaplessMarkers: boolean; // Whether track has gapless playback markers
  encoderDelay: number;      // Detected encoder delay in samples
  encoderPadding: number;    // Detected encoder padding in samples
}

export class AdvancedSilenceDetector {
  private analysisCache = new Map<string, SilenceMetrics>();

  // Detection thresholds
  private readonly config = {
    silenceThresholdDB: -60,  // dB below which is considered silence
    fadeDectionDB: -40,        // dB for fade detection
    minSilenceDuration: 0.01,  // Minimum 10ms to be considered silence
    windowSize: 256,           // Samples per analysis window
    sampleRate: 48000
  };

  /**
   * Detect silence in a track
   */
  async detectSilence(filePath: string): Promise<SilenceMetrics> {
    // Check cache
    const cached = this.analysisCache.get(filePath);
    if (cached) {
      return cached;
    }

    try {
      // Load and decode audio
      const audioBuffer = await this.loadAudioBuffer(filePath);

      // Analyze for silence
      const metrics = this.analyzeBuffer(audioBuffer);

      // Cache results
      this.analysisCache.set(filePath, metrics);

      return metrics;
    } catch (error) {
      console.error('Silence detection failed:', error);

      // Return defaults on error
      return {
        startSilence: 0,
        endSilence: 0,
        startFadeIn: 0,
        endFadeOut: 0,
        hasGaplessMarkers: false,
        encoderDelay: 0,
        encoderPadding: 0
      };
    }
  }

  /**
   * Load audio buffer for analysis
   */
  private async loadAudioBuffer(filePath: string): Promise<AudioBuffer> {
    const response = await fetch(`wora://${encodeURIComponent(filePath)}`);
    const arrayBuffer = await response.arrayBuffer();

    // Create offline context for decoding
    const offlineContext = new OfflineAudioContext({
      numberOfChannels: 2,
      length: 1,
      sampleRate: this.config.sampleRate
    });

    return await offlineContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Analyze audio buffer for silence
   */
  private analyzeBuffer(audioBuffer: AudioBuffer): SilenceMetrics {
    const sampleRate = audioBuffer.sampleRate;
    const numberOfChannels = audioBuffer.numberOfChannels;

    // Get combined amplitude across all channels
    const amplitudes = this.getCombinedAmplitudes(audioBuffer);

    // Convert amplitude to dB
    const amplitudesDB = amplitudes.map(amp =>
      amp > 0 ? 20 * Math.log10(amp) : -100
    );

    // Detect silence at start
    const startMetrics = this.detectStartSilence(amplitudesDB, sampleRate);

    // Detect silence at end
    const endMetrics = this.detectEndSilence(amplitudesDB, sampleRate);

    // Detect encoder artifacts
    const encoderMetrics = this.detectEncoderArtifacts(audioBuffer);

    // Check for gapless markers
    const hasGaplessMarkers = this.checkGaplessMarkers(audioBuffer);

    return {
      startSilence: startMetrics.silence,
      endSilence: endMetrics.silence,
      startFadeIn: startMetrics.fadeIn,
      endFadeOut: endMetrics.fadeOut,
      hasGaplessMarkers,
      encoderDelay: encoderMetrics.delay,
      encoderPadding: encoderMetrics.padding
    };
  }

  /**
   * Get combined amplitudes across all channels
   */
  private getCombinedAmplitudes(audioBuffer: AudioBuffer): Float32Array {
    const length = audioBuffer.length;
    const windowSize = this.config.windowSize;
    const numWindows = Math.floor(length / windowSize);
    const amplitudes = new Float32Array(numWindows);

    for (let window = 0; window < numWindows; window++) {
      let maxAmplitude = 0;

      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        const startIdx = window * windowSize;
        const endIdx = Math.min(startIdx + windowSize, length);

        // Find peak amplitude in this window
        for (let i = startIdx; i < endIdx; i++) {
          maxAmplitude = Math.max(maxAmplitude, Math.abs(channelData[i]));
        }
      }

      amplitudes[window] = maxAmplitude;
    }

    return amplitudes;
  }

  /**
   * Detect silence at the start of the track
   */
  private detectStartSilence(amplitudesDB: Float32Array, sampleRate: number):
    { silence: number, fadeIn: number } {

    const silenceThreshold = this.config.silenceThresholdDB;
    const fadeThreshold = this.config.fadeDectionDB;
    const windowDuration = this.config.windowSize / sampleRate;

    let silenceEnd = 0;
    let fadeInEnd = 0;
    let foundAudio = false;

    for (let i = 0; i < amplitudesDB.length; i++) {
      const db = amplitudesDB[i];

      if (!foundAudio) {
        if (db > silenceThreshold) {
          // Found start of audio
          silenceEnd = i * windowDuration;
          foundAudio = true;
        }
      }

      // Check for fade-in
      if (foundAudio && fadeInEnd === 0 && db > fadeThreshold) {
        fadeInEnd = i * windowDuration;
        break; // We've found the end of fade-in
      }
    }

    return {
      silence: Math.min(silenceEnd, 5), // Max 5 seconds
      fadeIn: Math.max(0, fadeInEnd - silenceEnd)
    };
  }

  /**
   * Detect silence at the end of the track
   */
  private detectEndSilence(amplitudesDB: Float32Array, sampleRate: number):
    { silence: number, fadeOut: number } {

    const silenceThreshold = this.config.silenceThresholdDB;
    const fadeThreshold = this.config.fadeDectionDB;
    const windowDuration = this.config.windowSize / sampleRate;

    let silenceStart = amplitudesDB.length * windowDuration;
    let fadeOutStart = amplitudesDB.length * windowDuration;
    let foundAudio = false;

    // Scan backwards from end
    for (let i = amplitudesDB.length - 1; i >= 0; i--) {
      const db = amplitudesDB[i];

      if (!foundAudio) {
        if (db > silenceThreshold) {
          // Found end of audio
          silenceStart = (i + 1) * windowDuration;
          foundAudio = true;
        }
      }

      // Check for fade-out
      if (foundAudio && db > fadeThreshold) {
        fadeOutStart = i * windowDuration;
        break; // We've found the start of fade-out
      }
    }

    const totalDuration = amplitudesDB.length * windowDuration;

    return {
      silence: Math.min(totalDuration - silenceStart, 5), // Max 5 seconds
      fadeOut: Math.max(0, silenceStart - fadeOutStart)
    };
  }

  /**
   * Detect MP3/AAC encoder delay and padding
   */
  private detectEncoderArtifacts(audioBuffer: AudioBuffer):
    { delay: number, padding: number } {

    // Common encoder delays (in samples at 44.1kHz)
    const commonDelays = {
      lame: 576,      // LAME encoder
      fraunhofer: 1152, // Fraunhofer encoder
      iTunes: 2112,    // iTunes AAC encoder
    };

    // Check for zero samples at start (encoder delay)
    let delay = 0;
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < Math.min(3000, channelData.length); i++) {
      if (Math.abs(channelData[i]) < 0.00001) {
        delay++;
      } else {
        break;
      }
    }

    // Check for zero samples at end (encoder padding)
    let padding = 0;
    for (let i = channelData.length - 1; i >= Math.max(0, channelData.length - 3000); i--) {
      if (Math.abs(channelData[i]) < 0.00001) {
        padding++;
      } else {
        break;
      }
    }

    // Adjust for sample rate
    const sampleRateRatio = audioBuffer.sampleRate / 44100;
    delay = Math.round(delay / sampleRateRatio);
    padding = Math.round(padding / sampleRateRatio);

    return { delay, padding };
  }

  /**
   * Check for gapless playback markers
   */
  private checkGaplessMarkers(audioBuffer: AudioBuffer): boolean {
    // Check for LAME Info tag or iTunes gapless metadata
    // This is simplified - actual implementation would parse metadata

    const channelData = audioBuffer.getChannelData(0);
    const length = audioBuffer.length;

    // Check if track ends abruptly (sign of gapless album)
    const lastSamples = channelData.slice(Math.max(0, length - 100));
    const avgAmplitude = lastSamples.reduce((sum, val) => sum + Math.abs(val), 0) / lastSamples.length;

    // If last samples have significant amplitude, likely gapless
    return avgAmplitude > 0.01;
  }

  /**
   * Get optimal trim points for gapless playback
   */
  getTrimPoints(metrics: SilenceMetrics): { startTrim: number, endTrim: number } {
    let startTrim = 0;
    let endTrim = 0;

    // For gapless albums, only trim encoder artifacts
    if (metrics.hasGaplessMarkers) {
      startTrim = metrics.encoderDelay / this.config.sampleRate;
      endTrim = metrics.encoderPadding / this.config.sampleRate;
    } else {
      // For regular tracks, trim silence but preserve artistic fades
      startTrim = Math.min(metrics.startSilence, 2); // Max 2 seconds
      endTrim = Math.min(metrics.endSilence, 2);     // Max 2 seconds

      // Don't trim if there's a fade
      if (metrics.startFadeIn > 0.5) {
        startTrim = 0; // Preserve fade-in
      }
      if (metrics.endFadeOut > 0.5) {
        endTrim = 0; // Preserve fade-out
      }
    }

    return { startTrim, endTrim };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.analysisCache.clear();
  }
}