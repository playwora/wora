/**
 * Beat Detection and BPM Analysis for tempo-matched mixing
 * Implements onset detection and tempo tracking algorithms
 */

export interface BeatMetrics {
  bpm: number;                    // Beats per minute
  confidence: number;              // Confidence level (0-1)
  beatPositions: number[];         // Beat positions in seconds
  downbeats: number[];            // Downbeat positions (first beat of bar)
  timeSignature: string;          // Estimated time signature (e.g., "4/4")
  firstDownbeat: number;          // Position of first downbeat
  phaseShift: number;             // Phase shift for beat alignment
}

export interface SpectralFlux {
  time: number;
  magnitude: number;
}

export class BeatDetector {
  private audioContext: OfflineAudioContext | null = null;
  private analysisCache = new Map<string, BeatMetrics>();

  private readonly config = {
    sampleRate: 44100,
    hopSize: 512,            // Samples between analysis frames
    frameSize: 2048,          // FFT size
    minBPM: 60,
    maxBPM: 200,
    smoothingWindow: 0.1,     // Seconds for onset smoothing
    peakPickingThreshold: 1.5 // Multiplier for dynamic threshold
  };

  /**
   * Analyze track for beat information
   */
  async analyzeTrack(filePath: string): Promise<BeatMetrics> {
    const cached = this.analysisCache.get(filePath);
    if (cached) {
      return cached;
    }

    try {
      const audioBuffer = await this.loadAudioBuffer(filePath);
      const metrics = await this.detectBeats(audioBuffer);

      this.analysisCache.set(filePath, metrics);
      return metrics;
    } catch (error) {
      console.error('Beat detection failed:', error);

      // Return default values
      return {
        bpm: 120,
        confidence: 0,
        beatPositions: [],
        downbeats: [],
        timeSignature: "4/4",
        firstDownbeat: 0,
        phaseShift: 0
      };
    }
  }

  /**
   * Load and decode audio
   */
  private async loadAudioBuffer(filePath: string): Promise<AudioBuffer> {
    const response = await fetch(`wora://${encodeURIComponent(filePath)}`);
    const arrayBuffer = await response.arrayBuffer();

    this.audioContext = new OfflineAudioContext({
      numberOfChannels: 1, // Mono for analysis
      length: 1,
      sampleRate: this.config.sampleRate
    });

    return await this.audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Main beat detection algorithm
   */
  private async detectBeats(audioBuffer: AudioBuffer): Promise<BeatMetrics> {
    // Convert to mono if needed
    const monoBuffer = this.convertToMono(audioBuffer);

    // Calculate spectral flux (onset detection function)
    const spectralFlux = this.calculateSpectralFlux(monoBuffer);

    // Apply adaptive threshold and peak picking
    const onsets = this.detectOnsets(spectralFlux);

    // Estimate tempo using autocorrelation
    const { bpm, confidence } = this.estimateTempo(onsets);

    // Track beats using dynamic programming
    const beatPositions = this.trackBeats(onsets, bpm, audioBuffer.duration);

    // Detect downbeats and time signature
    const { downbeats, timeSignature } = this.detectDownbeats(beatPositions, spectralFlux);

    // Calculate phase shift for beat alignment
    const phaseShift = this.calculatePhaseShift(beatPositions);

    return {
      bpm,
      confidence,
      beatPositions,
      downbeats,
      timeSignature,
      firstDownbeat: downbeats[0] || 0,
      phaseShift
    };
  }

  /**
   * Convert audio buffer to mono
   */
  private convertToMono(audioBuffer: AudioBuffer): Float32Array {
    const length = audioBuffer.length;
    const mono = new Float32Array(length);

    if (audioBuffer.numberOfChannels === 1) {
      return audioBuffer.getChannelData(0).slice();
    }

    // Mix channels to mono
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        mono[i] += channelData[i] / audioBuffer.numberOfChannels;
      }
    }

    return mono;
  }

  /**
   * Calculate spectral flux (onset detection function)
   */
  private calculateSpectralFlux(samples: Float32Array): SpectralFlux[] {
    const flux: SpectralFlux[] = [];
    const hopSize = this.config.hopSize;
    const frameSize = this.config.frameSize;
    const numFrames = Math.floor((samples.length - frameSize) / hopSize);

    let previousSpectrum = new Float32Array(frameSize / 2);

    for (let frame = 0; frame < numFrames; frame++) {
      const start = frame * hopSize;
      const end = start + frameSize;

      // Get frame samples
      const frameSamples = samples.slice(start, end) as Float32Array;

      // Apply Hamming window
      const windowed = this.applyWindow(frameSamples);

      // Compute FFT (using optimized fallback for now)
      const spectrum = this.computeFFTFallback(windowed);

      // Calculate spectral flux
      let fluxValue = 0;
      for (let i = 0; i < spectrum.length; i++) {
        const diff = spectrum[i] - previousSpectrum[i];
        if (diff > 0) {
          fluxValue += diff;
        }
      }

      flux.push({
        time: start / this.config.sampleRate,
        magnitude: fluxValue
      });

      previousSpectrum = spectrum.slice();
    }

    return flux;
  }

  /**
   * Apply Hamming window
   */
  private applyWindow(samples: Float32Array): Float32Array {
    const windowed = new Float32Array(samples.length);
    const N = samples.length;

    for (let i = 0; i < N; i++) {
      const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1));
      windowed[i] = samples[i] * window;
    }

    return windowed;
  }

  /**
   * Compute FFT magnitude spectrum using Web Audio API
   */
  private async computeFFT(samples: Float32Array): Promise<Float32Array> {
    // Use Web Audio API's AnalyserNode for FFT
    const fftSize = Math.min(samples.length, 8192); // Max FFT size is 32768, but 8192 is more practical

    // Create temporary offline context for analysis
    const offlineContext = new OfflineAudioContext({
      numberOfChannels: 1,
      length: fftSize,
      sampleRate: this.config.sampleRate
    });

    // Create analyser node
    const analyser = offlineContext.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = 0;

    // Create buffer source
    const buffer = offlineContext.createBuffer(1, samples.length, this.config.sampleRate);
    buffer.getChannelData(0).set(samples);

    const source = offlineContext.createBufferSource();
    source.buffer = buffer;

    // Connect nodes
    source.connect(analyser);
    analyser.connect(offlineContext.destination);

    // Start playback
    source.start(0);

    // Get frequency data
    const spectrum = new Float32Array(analyser.frequencyBinCount);

    // For offline processing, we need a different approach
    // Use simpler but more efficient FFT approximation
    return this.computeFFTFallback(samples);
  }

  /**
   * Fallback FFT implementation - optimized version
   */
  private computeFFTFallback(samples: Float32Array): Float32Array {
    const N = samples.length;
    const halfN = Math.floor(N / 2);
    const spectrum = new Float32Array(halfN);

    // Use faster approximation for beat detection
    // We don't need perfect frequency accuracy, just energy levels
    const step = Math.max(1, Math.floor(halfN / 512)); // Limit to 512 bins max

    for (let k = 0; k < halfN; k += step) {
      let energy = 0;

      // Sample a subset of points for faster computation
      const sampleStep = Math.max(1, Math.floor(N / 256));

      for (let n = 0; n < N; n += sampleStep) {
        const angle = -2 * Math.PI * k * n / N;
        energy += Math.abs(samples[n] * Math.sin(angle));
      }

      // Fill in the skipped bins
      for (let i = k; i < Math.min(k + step, halfN); i++) {
        spectrum[i] = energy / Math.sqrt(N);
      }
    }

    return spectrum;
  }

  /**
   * Detect onsets using adaptive thresholding
   */
  private detectOnsets(spectralFlux: SpectralFlux[]): number[] {
    const onsets: number[] = [];

    // Calculate moving average for adaptive threshold
    const windowSize = Math.floor(this.config.smoothingWindow * this.config.sampleRate / this.config.hopSize);
    const threshold = new Float32Array(spectralFlux.length);

    for (let i = 0; i < spectralFlux.length; i++) {
      let sum = 0;
      let count = 0;

      for (let j = Math.max(0, i - windowSize); j < Math.min(spectralFlux.length, i + windowSize); j++) {
        sum += spectralFlux[j].magnitude;
        count++;
      }

      threshold[i] = (sum / count) * this.config.peakPickingThreshold;
    }

    // Peak picking
    for (let i = 1; i < spectralFlux.length - 1; i++) {
      const current = spectralFlux[i].magnitude;
      const previous = spectralFlux[i - 1].magnitude;
      const next = spectralFlux[i + 1].magnitude;

      if (current > threshold[i] && current > previous && current > next) {
        onsets.push(spectralFlux[i].time);
      }
    }

    return onsets;
  }

  /**
   * Estimate tempo using autocorrelation
   */
  private estimateTempo(onsets: number[]): { bpm: number, confidence: number } {
    if (onsets.length < 10) {
      return { bpm: 120, confidence: 0 };
    }

    // Calculate inter-onset intervals
    const intervals: number[] = [];
    for (let i = 1; i < onsets.length; i++) {
      intervals.push(onsets[i] - onsets[i - 1]);
    }

    // Build histogram of intervals
    const minInterval = 60 / this.config.maxBPM;
    const maxInterval = 60 / this.config.minBPM;
    const numBins = 100;
    const binSize = (maxInterval - minInterval) / numBins;
    const histogram = new Float32Array(numBins);

    for (const interval of intervals) {
      if (interval >= minInterval && interval <= maxInterval) {
        const bin = Math.floor((interval - minInterval) / binSize);
        if (bin >= 0 && bin < numBins) {
          histogram[bin]++;
        }
      }
    }

    // Find peak in histogram
    let maxBin = 0;
    let maxCount = 0;
    for (let i = 0; i < numBins; i++) {
      if (histogram[i] > maxCount) {
        maxCount = histogram[i];
        maxBin = i;
      }
    }

    // Calculate BPM from peak
    const peakInterval = minInterval + (maxBin + 0.5) * binSize;
    const bpm = peakInterval > 0 ? 60 / peakInterval : 120; // Default to 120 BPM if invalid

    // Calculate confidence based on peak prominence
    const totalCount = intervals.length;
    const confidence = totalCount > 0 ? maxCount / totalCount : 0;

    return { bpm: Math.round(bpm), confidence };
  }

  /**
   * Track beats using dynamic programming
   */
  private trackBeats(onsets: number[], bpm: number, duration: number): number[] {
    const beatInterval = 60 / bpm;
    const beats: number[] = [];

    // Find best starting phase
    let bestPhase = 0;
    let bestScore = -Infinity;

    for (let phase = 0; phase < beatInterval; phase += 0.01) {
      let score = 0;

      for (let beatTime = phase; beatTime < duration; beatTime += beatInterval) {
        // Find closest onset
        let minDistance = Infinity;
        for (const onset of onsets) {
          const distance = Math.abs(onset - beatTime);
          if (distance < minDistance) {
            minDistance = distance;
          }
        }

        // Score based on proximity to onset
        if (minDistance < 0.05) { // Within 50ms
          score += 1 / (1 + minDistance);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestPhase = phase;
      }
    }

    // Generate beat grid
    for (let beatTime = bestPhase; beatTime < duration; beatTime += beatInterval) {
      beats.push(beatTime);
    }

    return beats;
  }

  /**
   * Detect downbeats and time signature
   */
  private detectDownbeats(beats: number[], spectralFlux: SpectralFlux[]):
    { downbeats: number[], timeSignature: string } {

    const downbeats: number[] = [];

    // Analyze spectral energy at beat positions
    const beatEnergies: number[] = [];
    for (const beat of beats) {
      // Find closest spectral flux value
      let energy = 0;
      for (const flux of spectralFlux) {
        if (Math.abs(flux.time - beat) < 0.01) {
          energy = flux.magnitude;
          break;
        }
      }
      beatEnergies.push(energy);
    }

    // Look for patterns (every 3rd or 4th beat typically has more energy)
    let pattern4 = 0; // 4/4 time
    let pattern3 = 0; // 3/4 time

    for (let i = 0; i < beatEnergies.length; i++) {
      const slice4 = beatEnergies.slice(i, Math.min(i + 4, beatEnergies.length));
      const slice3 = beatEnergies.slice(i, Math.min(i + 3, beatEnergies.length));

      if (i % 4 === 0 && slice4.length > 0) {
        const avg4 = slice4.reduce((a, b) => a + b, 0) / slice4.length;
        if (avg4 > 0 && beatEnergies[i] > avg4) {
          pattern4++;
        }
      }
      if (i % 3 === 0 && slice3.length > 0) {
        const avg3 = slice3.reduce((a, b) => a + b, 0) / slice3.length;
        if (avg3 > 0 && beatEnergies[i] > avg3) {
          pattern3++;
        }
      }
    }

    const timeSignature = pattern4 > pattern3 ? "4/4" : "3/4";
    const beatsPerBar = timeSignature === "4/4" ? 4 : 3;

    // Mark downbeats
    for (let i = 0; i < beats.length; i += beatsPerBar) {
      downbeats.push(beats[i]);
    }

    return { downbeats, timeSignature };
  }

  /**
   * Calculate phase shift for beat alignment
   */
  private calculatePhaseShift(beats: number[]): number {
    if (beats.length === 0) return 0;

    // Calculate average offset from grid
    const firstBeat = beats[0];
    const beatInterval = beats.length > 1 ? beats[1] - beats[0] : 0.5;

    // Find optimal phase shift to align with a common grid
    const gridOffset = firstBeat % beatInterval;
    return gridOffset < beatInterval / 2 ? -gridOffset : beatInterval - gridOffset;
  }

  /**
   * Find optimal crossfade point based on beat alignment
   */
  findCrossfadePoint(currentBPM: number, nextBPM: number, crossfadeDuration: number):
    { startTime: number, tempoAdjustment: number } {

    // Calculate tempo adjustment needed
    const tempoRatio = nextBPM / currentBPM;
    const tempoAdjustment = Math.log2(tempoRatio); // Semitones of pitch shift

    // Find beat-aligned crossfade point
    const currentBeatInterval = 60 / currentBPM;
    const beatsInCrossfade = Math.ceil(crossfadeDuration / currentBeatInterval);
    const alignedCrossfadeDuration = beatsInCrossfade * currentBeatInterval;

    return {
      startTime: alignedCrossfadeDuration,
      tempoAdjustment
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.analysisCache.clear();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.audioContext) {
      this.audioContext = null;
    }
    this.clearCache();
  }
}