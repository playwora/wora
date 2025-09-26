/**
 * Audiophile-grade crossfade controller using Web Audio API
 * Implements industry-standard loudness normalization and advanced crossfade curves
 */

export type CrossfadeCurve = 'linear' | 'equalPower' | 'sCurve' | 'logarithmic' | 'exponential';

export interface AudiophileTrack {
  id: number;
  filePath: string;
  duration: number;
  metadata?: {
    replayGain?: number;
    lufs?: number;
    bpm?: number;
    key?: string;
  };
}

export interface AudiophileOptions {
  crossfadeDuration: number;
  crossfadeCurve: CrossfadeCurve;
  targetLUFS: number; // Target loudness in LUFS (typically -14 for streaming, -16 for audiophile)
  enableTruePeak: boolean; // Prevent clipping with true peak limiting
  enableBeatMatching: boolean;
  gaplessThreshold: number; // ms of silence before considering gapless
  updateInterval: number; // ms between updates (lower = smoother, 10-20ms recommended)
  bufferSize: number; // Web Audio buffer size (256-2048, lower = less latency)
}

export class AudiophileCrossfadeController {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private limiter: DynamicsCompressorNode;
  private destroyed: boolean = false; // Track destruction state

  // Dual voice architecture with Web Audio nodes
  private voice1: {
    source: MediaElementAudioSourceNode | null;
    element: HTMLAudioElement | null;
    gainNode: GainNode;
    analyser: AnalyserNode;
    isActive: boolean;
    metadata?: AudiophileTrack['metadata'];
  };

  private voice2: {
    source: MediaElementAudioSourceNode | null;
    element: HTMLAudioElement | null;
    gainNode: GainNode;
    analyser: AnalyserNode;
    isActive: boolean;
    metadata?: AudiophileTrack['metadata'];
  };

  private options: AudiophileOptions = {
    crossfadeDuration: 5,
    crossfadeCurve: 'sCurve',
    targetLUFS: -16, // Audiophile standard
    enableTruePeak: true,
    enableBeatMatching: false,
    gaplessThreshold: 50,
    updateInterval: 10, // 10ms for smooth transitions
    bufferSize: 512 // Balance between latency and quality
  };

  private crossfadeStartTime: number | null = null;
  private crossfadeInProgress: boolean = false;
  private animationFrameId: number | null = null;

  // Callbacks
  private onTrackEnd?: () => void;
  private onTimeUpdate?: (currentTime: number, duration: number) => void;
  private onCrossfadeStart?: (nextTrack: AudiophileTrack) => void;
  private onCrossfadeComplete?: () => void;
  private onError?: (error: Error) => void;

  constructor() {
    // Create high-quality audio context
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      latencyHint: 'playback',
      sampleRate: 48000 // Use 48kHz for quality
    });

    // Create master gain for overall volume control
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 1.0;

    // Create limiter to prevent clipping
    this.limiter = this.audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = -0.5;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.05;

    // Connect audio graph
    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.audioContext.destination);

    // Initialize voices
    this.voice1 = this.createVoice();
    this.voice2 = this.createVoice();
    this.voice1.isActive = true;
    this.voice2.isActive = false;
  }

  private createVoice() {
    const gainNode = this.audioContext.createGain();
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    gainNode.connect(analyser);
    analyser.connect(this.masterGain);

    return {
      source: null,
      element: null,
      gainNode,
      analyser,
      isActive: false,
      metadata: undefined
    };
  }

  private getActiveVoice() {
    return this.voice1.isActive ? this.voice1 : this.voice2;
  }

  private getInactiveVoice() {
    return this.voice1.isActive ? this.voice2 : this.voice1;
  }

  /**
   * Calculate crossfade gain based on selected curve
   */
  private calculateCrossfadeGain(progress: number, curve: CrossfadeCurve): { fadeOut: number, fadeIn: number } {
    // Clamp progress between 0 and 1
    progress = Math.max(0, Math.min(1, progress));

    switch (curve) {
      case 'linear':
        return {
          fadeOut: 1 - progress,
          fadeIn: progress
        };

      case 'equalPower':
        // Industry standard equal power crossfade
        return {
          fadeOut: Math.cos(progress * Math.PI / 2),
          fadeIn: Math.sin(progress * Math.PI / 2)
        };

      case 'sCurve':
        // S-curve for smoother transitions
        const sCurveProgress = progress * progress * (3 - 2 * progress);
        return {
          fadeOut: 1 - sCurveProgress,
          fadeIn: sCurveProgress
        };

      case 'logarithmic':
        // Logarithmic curve (sounds more natural to human ear)
        const logIn = Math.log10(1 + progress * 9) / Math.log10(10);
        const logOut = Math.log10(1 + (1 - progress) * 9) / Math.log10(10);
        return {
          fadeOut: logOut,
          fadeIn: logIn
        };

      case 'exponential':
        // Exponential curve for DJ-style mixing
        const expIn = (Math.exp(progress * 2) - 1) / (Math.exp(2) - 1);
        const expOut = (Math.exp((1 - progress) * 2) - 1) / (Math.exp(2) - 1);
        return {
          fadeOut: expOut,
          fadeIn: expIn
        };

      default:
        // Default to equal power
        return {
          fadeOut: Math.cos(progress * Math.PI / 2),
          fadeIn: Math.sin(progress * Math.PI / 2)
        };
    }
  }

  /**
   * Apply ReplayGain/LUFS normalization
   */
  private calculateNormalizationGain(metadata?: AudiophileTrack['metadata']): number {
    if (!metadata) return 1.0;

    // Priority: LUFS > ReplayGain > Default
    if (metadata.lufs !== undefined) {
      // Calculate gain to reach target LUFS
      const gainDB = this.options.targetLUFS - metadata.lufs;
      return Math.pow(10, gainDB / 20);
    } else if (metadata.replayGain !== undefined) {
      return metadata.replayGain;
    }

    return 1.0;
  }

  /**
   * High-precision animation frame-based update loop
   */
  private startHighPrecisionUpdates(): void {
    const update = () => {
      // Stop updates if destroyed
      if (this.destroyed) {
        this.animationFrameId = null;
        return;
      }

      if (!this.crossfadeInProgress && !this.getActiveVoice().element) {
        this.animationFrameId = null;
        return;
      }

      const activeVoice = this.getActiveVoice();

      // Update time
      if (activeVoice.element && this.onTimeUpdate) {
        const currentTime = activeVoice.element.currentTime;
        const duration = activeVoice.element.duration;

        if (!isNaN(currentTime) && !isNaN(duration)) {
          this.onTimeUpdate(currentTime, duration);
        }
      }

      // Handle crossfade
      if (this.crossfadeInProgress && this.crossfadeStartTime) {
        const elapsed = (performance.now() - this.crossfadeStartTime) / 1000;
        const progress = Math.min(elapsed / this.options.crossfadeDuration, 1);

        const { fadeOut, fadeIn } = this.calculateCrossfadeGain(progress, this.options.crossfadeCurve);

        const activeVoice = this.getActiveVoice();
        const inactiveVoice = this.getInactiveVoice();

        // Use Web Audio API's parameter automation for smooth transitions
        const now = this.audioContext.currentTime;

        if (activeVoice.gainNode) {
          const normGain = this.calculateNormalizationGain(activeVoice.metadata);
          const activeGain = Math.max(0, Math.min(1, fadeOut * normGain)); // Clamp between 0 and 1
          activeVoice.gainNode.gain.linearRampToValueAtTime(activeGain, now + 0.01);
        }

        if (inactiveVoice.gainNode) {
          const normGain = this.calculateNormalizationGain(inactiveVoice.metadata);
          const inactiveGain = Math.max(0, Math.min(1, fadeIn * normGain)); // Clamp between 0 and 1
          inactiveVoice.gainNode.gain.linearRampToValueAtTime(inactiveGain, now + 0.01);
        }

        if (progress >= 1) {
          this.completeCrossfade();
        }
      }

      this.animationFrameId = requestAnimationFrame(update);
    };

    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame(update);
    }
  }

  private completeCrossfade(): void {
    const activeVoice = this.getActiveVoice();
    const inactiveVoice = this.getInactiveVoice();

    // Stop old track
    if (activeVoice.element) {
      activeVoice.element.pause();
      activeVoice.element.currentTime = 0;
    }

    // Switch active voice
    activeVoice.isActive = false;
    inactiveVoice.isActive = true;

    // Reset gains
    const now = this.audioContext.currentTime;
    inactiveVoice.gainNode.gain.linearRampToValueAtTime(
      this.calculateNormalizationGain(inactiveVoice.metadata),
      now + 0.01
    );

    this.crossfadeInProgress = false;
    this.crossfadeStartTime = null;

    if (this.onCrossfadeComplete) {
      this.onCrossfadeComplete();
    }
  }

  /**
   * Load a track with audiophile-grade preparation
   */
  async loadTrack(track: AudiophileTrack, options: Partial<AudiophileOptions> = {}): Promise<void> {
    this.options = { ...this.options, ...options };

    const activeVoice = this.getActiveVoice();

    // Clean up existing track
    if (activeVoice.element) {
      activeVoice.element.pause();
      activeVoice.element = null;
    }
    if (activeVoice.source) {
      activeVoice.source.disconnect();
      activeVoice.source = null;
    }

    // Create new audio element
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';

    // Enable high-quality playback hints
    if ('preservesPitch' in audio) {
      (audio as any).preservesPitch = false; // Better for tempo changes
    }

    const audioUrl = `wora://${encodeURIComponent(track.filePath)}`;
    audio.src = audioUrl;
    audio.volume = 1; // Web Audio API requires full volume on source

    // Wait for audio to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Load timeout')), 10000);

      audio.addEventListener('canplaythrough', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });

      audio.addEventListener('error', (e) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load audio: ${e}`));
      }, { once: true });
    });

    // Create Web Audio source
    const source = this.audioContext.createMediaElementSource(audio);
    source.connect(activeVoice.gainNode);

    activeVoice.element = audio;
    activeVoice.source = source;
    activeVoice.metadata = track.metadata;

    // Set initial gain based on normalization
    const normalizationGain = this.calculateNormalizationGain(track.metadata);
    activeVoice.gainNode.gain.value = normalizationGain;

    // Set up event handlers
    audio.addEventListener('ended', () => {
      if (activeVoice.isActive && !this.crossfadeInProgress) {
        if (this.onTrackEnd) {
          this.onTrackEnd();
        }
      }
    });

    // Start high-precision updates
    this.startHighPrecisionUpdates();
  }

  /**
   * Preload next track for gapless playback
   */
  async preloadNextTrack(track: AudiophileTrack): Promise<void> {
    const inactiveVoice = this.getInactiveVoice();

    // Clean up existing preloaded track
    if (inactiveVoice.element) {
      inactiveVoice.element.pause();
      inactiveVoice.element = null;
    }
    if (inactiveVoice.source) {
      inactiveVoice.source.disconnect();
      inactiveVoice.source = null;
    }

    // Create new audio element
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';

    const audioUrl = `wora://${encodeURIComponent(track.filePath)}`;
    audio.src = audioUrl;
    audio.volume = 1; // Web Audio API requires full volume on source

    // Wait for audio to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Preload timeout')), 10000);

      audio.addEventListener('canplay', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });

      audio.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('Preload failed'));
      }, { once: true });
    });

    // Create Web Audio source
    const source = this.audioContext.createMediaElementSource(audio);
    source.connect(inactiveVoice.gainNode);

    inactiveVoice.element = audio;
    inactiveVoice.source = source;
    inactiveVoice.metadata = track.metadata;

    // Set initial gain to 0 for preload
    inactiveVoice.gainNode.gain.value = 0;
  }

  /**
   * Start crossfade with precise timing
   */
  async scheduleCrossfade(nextTrack: AudiophileTrack): Promise<void> {
    if (this.crossfadeInProgress) {
      throw new Error('Crossfade already in progress');
    }

    const inactiveVoice = this.getInactiveVoice();

    if (!inactiveVoice.element) {
      await this.preloadNextTrack(nextTrack);
    }

    if (!inactiveVoice.element) {
      throw new Error('Failed to prepare next track');
    }

    // Start crossfade
    this.crossfadeInProgress = true;
    this.crossfadeStartTime = performance.now();

    // Start playing next track
    await inactiveVoice.element.play();

    if (this.onCrossfadeStart) {
      this.onCrossfadeStart(nextTrack);
    }

    this.startHighPrecisionUpdates();
  }

  /**
   * Schedule gapless transition for true audiophile experience
   */
  async scheduleGaplessTransition(nextTrack: AudiophileTrack): Promise<void> {
    const inactiveVoice = this.getInactiveVoice();

    if (!inactiveVoice.element) {
      await this.preloadNextTrack(nextTrack);
    }

    if (!inactiveVoice.element) {
      throw new Error('Failed to prepare next track');
    }

    const activeVoice = this.getActiveVoice();

    // Set up sample-accurate transition
    const now = this.audioContext.currentTime;

    // Fade out current track over 5ms (virtually inaudible)
    if (activeVoice.gainNode) {
      activeVoice.gainNode.gain.linearRampToValueAtTime(0, now + 0.005);
    }

    // Fade in next track immediately
    const normalizationGain = this.calculateNormalizationGain(nextTrack.metadata);
    inactiveVoice.gainNode.gain.setValueAtTime(0, now);
    inactiveVoice.gainNode.gain.linearRampToValueAtTime(normalizationGain, now + 0.005);

    // Start next track
    await inactiveVoice.element.play();

    // Switch active voice after brief overlap
    setTimeout(() => {
      if (activeVoice.element) {
        activeVoice.element.pause();
      }
      activeVoice.isActive = false;
      inactiveVoice.isActive = true;

      if (this.onCrossfadeComplete) {
        this.onCrossfadeComplete();
      }
    }, 10);
  }

  /**
   * Basic playback controls
   */
  async play(): Promise<void> {
    const activeVoice = this.getActiveVoice();
    if (activeVoice.element) {
      await activeVoice.element.play();
      this.startHighPrecisionUpdates();
    }
  }

  pause(): void {
    const activeVoice = this.getActiveVoice();
    if (activeVoice.element) {
      activeVoice.element.pause();
    }
  }

  seek(time: number): void {
    const activeVoice = this.getActiveVoice();
    if (activeVoice.element) {
      activeVoice.element.currentTime = Math.max(0, Math.min(time, activeVoice.element.duration || 0));
    }
  }

  /**
   * Update options
   */
  setOptions(options: Partial<AudiophileOptions>): void {
    this.options = { ...this.options, ...options };

    // Apply true peak limiting if enabled
    if (this.limiter) {
      if (options.enableTruePeak) {
        this.limiter.threshold.value = -1; // -1 dBFS for true peak
        this.limiter.knee.value = 2;
        this.limiter.ratio.value = 20;
        this.limiter.attack.value = 0.001;
        this.limiter.release.value = 0.05;
      } else {
        this.limiter.threshold.value = -3;
        this.limiter.knee.value = 5;
        this.limiter.ratio.value = 10;
        this.limiter.attack.value = 0.003;
        this.limiter.release.value = 0.1;
      }
    }
  }

  setVolume(volume: number): void {
    this.masterGain.gain.linearRampToValueAtTime(
      Math.max(0, Math.min(1, volume)),
      this.audioContext.currentTime + 0.01
    );
  }

  setMuted(muted: boolean): void {
    const targetGain = muted ? 0 : 1;
    this.masterGain.gain.linearRampToValueAtTime(
      targetGain,
      this.audioContext.currentTime + 0.01
    );
  }

  getCurrentTime(): number {
    const activeVoice = this.getActiveVoice();
    return activeVoice.element?.currentTime || 0;
  }

  getCurrentDuration(): number {
    const activeVoice = this.getActiveVoice();
    return activeVoice.element?.duration || 0;
  }

  isPlaying(): boolean {
    const activeVoice = this.getActiveVoice();
    return activeVoice.element ? !activeVoice.element.paused : false;
  }

  /**
   * Get real-time frequency data for visualizations
   */
  getFrequencyData(): Uint8Array {
    const activeVoice = this.getActiveVoice();
    const dataArray = new Uint8Array(activeVoice.analyser.frequencyBinCount);
    activeVoice.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * Get real-time waveform data
   */
  getWaveformData(): Uint8Array {
    const activeVoice = this.getActiveVoice();
    const dataArray = new Uint8Array(activeVoice.analyser.fftSize);
    activeVoice.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks: {
    onTrackEnd?: () => void;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    onCrossfadeStart?: (nextTrack: AudiophileTrack) => void;
    onCrossfadeComplete?: () => void;
    onError?: (error: Error) => void;
  }): void {
    this.onTrackEnd = callbacks.onTrackEnd;
    this.onTimeUpdate = callbacks.onTimeUpdate;
    this.onCrossfadeStart = callbacks.onCrossfadeStart;
    this.onCrossfadeComplete = callbacks.onCrossfadeComplete;
    this.onError = callbacks.onError;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Mark as destroyed first
    this.destroyed = true;

    // Cancel animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Clean up voice 1
    if (this.voice1.element) {
      this.voice1.element.pause();
      this.voice1.element.removeAttribute('src');
      this.voice1.element.load();
      this.voice1.element = null;
    }
    if (this.voice1.source) {
      try {
        this.voice1.source.disconnect();
      } catch (e) {
        // Ignore if already disconnected
      }
      this.voice1.source = null;
    }
    try {
      this.voice1.gainNode.disconnect();
      this.voice1.analyser.disconnect();
    } catch (e) {
      // Ignore if already disconnected
    }

    // Clean up voice 2
    if (this.voice2.element) {
      this.voice2.element.pause();
      this.voice2.element.removeAttribute('src');
      this.voice2.element.load();
      this.voice2.element = null;
    }
    if (this.voice2.source) {
      try {
        this.voice2.source.disconnect();
      } catch (e) {
        // Ignore if already disconnected
      }
      this.voice2.source = null;
    }
    try {
      this.voice2.gainNode.disconnect();
      this.voice2.analyser.disconnect();
    } catch (e) {
      // Ignore if already disconnected
    }

    // Close audio context if not already closed
    if (this.audioContext.state !== 'closed') {
      try {
        this.masterGain.disconnect();
        this.limiter.disconnect();
        this.audioContext.close();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }

    // Clear callbacks
    this.onTrackEnd = undefined;
    this.onTimeUpdate = undefined;
    this.onCrossfadeStart = undefined;
    this.onCrossfadeComplete = undefined;
    this.onError = undefined;
  }
}