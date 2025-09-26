/**
 * Adapter to bridge the existing CrossfadeController interface with AudiophileCrossfadeController
 * Now uses IPC for audio analysis in Electron main process
 */

import { AudiophileCrossfadeController, AudiophileTrack, AudiophileOptions } from './AudiophileCrossfadeController';

// Types from main process
interface AudioAnalysisResult {
  lufs: {
    integratedLUFS: number;
    shortTermLUFS: number;
    momentaryLUFS: number;
    loudnessRange: number;
    truePeak: number;
    replayGainDB: number;
  };
  silence: {
    startSilence: number;
    endSilence: number;
    startFadeIn: number;
    endFadeOut: number;
    hasGaplessMarkers: boolean;
    encoderDelay: number;
    encoderPadding: number;
  };
  beats: {
    bpm: number;
    confidence: number;
    beatPositions: number[];
    downbeats: number[];
    timeSignature: string;
    firstDownbeat: number;
    phaseShift: number;
  };
  timestamp: number;
  fileHash: string;
}

export interface CrossfadeTrack {
  id: number;
  filePath: string;
  duration: number;
}

export interface CrossfadeOptions {
  crossfadeDuration: number;
  volume: number;
  onTrackEnd: () => void;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onError: (error: Error) => void;
  onCrossfadeStart?: (nextTrack: CrossfadeTrack) => void;
  onCrossfadeComplete?: () => void;
}

export class AudiophileCrossfadeAdapter {
  private controller: AudiophileCrossfadeController;
  private analysisCache: Map<string, AudioAnalysisResult> = new Map();

  private volume: number = 1;
  private isMuted: boolean = false;

  // Crossfade state
  private crossfadeInProgress: boolean = false;
  private crossfadeAnimation: number | null = null;
  private crossfadeTimeout: NodeJS.Timeout | null = null;
  private crossfadeLock: boolean = false; // Prevent race conditions
  private crossfadeCompleteResolver: (() => void) | null = null; // Resolver for crossfade completion promise

  // Callback storage
  private onTrackEnd?: () => void;
  private onTimeUpdate?: (currentTime: number, duration: number) => void;
  private onError?: (error: Error) => void;
  private onCrossfadeStart?: (nextTrack: CrossfadeTrack) => void;
  private onCrossfadeComplete?: () => void;

  constructor() {
    this.controller = new AudiophileCrossfadeController();
  }

  /**
   * Schedule a crossfade transition using AudiophileCrossfadeController
   */
  async scheduleCrossfade(nextTrack: CrossfadeTrack): Promise<void> {
    // Use lock to prevent race conditions
    if (this.crossfadeLock || this.crossfadeInProgress) {
      return;
    }

    // Acquire lock immediately
    this.crossfadeLock = true;

    try {
      // Mark crossfade as in progress
      this.crossfadeInProgress = true;

      // Notify crossfade is starting
      if (this.onCrossfadeStart) {
        this.onCrossfadeStart(nextTrack);
      }

      // Try to get audio analysis from main process
      let analysis: AudioAnalysisResult | null = null;
      if (this.hasIPCSupport()) {
        try {
          analysis = await this.getAudioAnalysis(nextTrack.filePath);
        } catch (error) {
        }
      }

      // Prepare metadata for AudiophileCrossfadeController
      const metadata = analysis ? {
        replayGain: analysis.lufs.replayGainDB ? Math.pow(10, analysis.lufs.replayGainDB / 20) : undefined,
        lufs: analysis.lufs.integratedLUFS,
        bpm: analysis.beats.bpm,
        key: undefined
      } : undefined;

      // Create AudiophileTrack for the controller
      const audiophileTrack: AudiophileTrack = {
        id: nextTrack.id,
        filePath: nextTrack.filePath,
        duration: nextTrack.duration,
        metadata
      };

      // Create a promise that will resolve when crossfade completes
      const crossfadeCompletePromise = new Promise<void>((resolve) => {
        this.crossfadeCompleteResolver = resolve;
      });

      // Start the crossfade (this returns immediately)
      await this.controller.scheduleCrossfade(audiophileTrack);

      // Wait for the actual crossfade to complete (takes ~5 seconds)
      // The controller will call onCrossfadeComplete when done, which will resolve this promise
      await crossfadeCompletePromise;

    } catch (error) {
      this.crossfadeInProgress = false;
      if (this.onError) {
        this.onError(error as Error);
      }
      throw error;
    } finally {
      // Always release lock
      this.crossfadeLock = false;
    }
  }



  /**
   * Check if IPC support is available
   */
  private hasIPCSupport(): boolean {
    return typeof window !== 'undefined' &&
           (window as any).ipc &&
           typeof (window as any).ipc.invoke === 'function';
  }

  /**
   * Get audio analysis from main process
   */
  private async getAudioAnalysis(filePath: string): Promise<AudioAnalysisResult | null> {
    // Check cache first
    if (this.analysisCache.has(filePath)) {
      return this.analysisCache.get(filePath)!;
    }

    if (!this.hasIPCSupport()) {
      return null;
    }

    try {
      const result = await (window as any).ipc.invoke('analyze-audio', filePath);

      // Cache the result
      if (result) {
        this.analysisCache.set(filePath, result);
      }

      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Batch analyze tracks
   */
  private async batchAnalyze(filePaths: string[]): Promise<AudioAnalysisResult[]> {
    if (!this.hasIPCSupport()) {
      return filePaths.map(() => null as any);
    }

    try {
      const results = await (window as any).ipc.invoke('analyze-audio-batch', filePaths);

      // Cache all results
      filePaths.forEach((path, index) => {
        if (results[index]) {
          this.analysisCache.set(path, results[index]);
        }
      });

      return results;
    } catch (error) {
      return filePaths.map(() => null as any);
    }
  }

  /**
   * Abort any in-progress crossfade
   */
  abortCrossfade(): void {
    // Clear any pending timeouts
    if (this.crossfadeTimeout) {
      clearTimeout(this.crossfadeTimeout);
      this.crossfadeTimeout = null;
    }

    if (this.crossfadeAnimation) {
      cancelAnimationFrame(this.crossfadeAnimation);
      this.crossfadeAnimation = null;
    }

    this.crossfadeInProgress = false;
    this.crossfadeLock = false;
  }

  /**
   * Get current playback time
   */
  getCurrentTime(): number {
    return this.controller.getCurrentTime();
  }

  /**
   * Get current track duration
   */
  getCurrentDuration(): number {
    return this.controller.getCurrentDuration();
  }

  /**
   * Check if currently playing
   */
  isPlaying(): boolean {
    return this.controller.isPlaying();
  }

  /**
   * Play current track
   */
  async play(): Promise<void> {
    await this.controller.play();
  }

  /**
   * Pause current track
   */
  pause(): void {
    this.controller.pause();
  }

  /**
   * Seek to specific time
   */
  seek(time: number): void {
    this.controller.seek(time);
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.controller.setVolume(this.isMuted ? 0 : this.volume);
  }

  /**
   * Set muted state
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.controller.setMuted(muted);
  }

  /**
   * Set audio enhancement (audiophile feature)
   */
  setAudioEnhancement(enabled: boolean): void {
    // Enable advanced audio processing features
    this.controller.setOptions({
      enableTruePeak: enabled,
      enableBeatMatching: enabled,
      targetLUFS: enabled ? -16 : -14 // Audiophile vs streaming standard
    });
  }

  /**
   * Preload next track for smooth transition using controller
   */
  async preloadNextTrack(track: CrossfadeTrack): Promise<void> {
    try {
      // Try to get audio analysis
      let analysis: AudioAnalysisResult | null = null;
      if (this.hasIPCSupport()) {
        try {
          analysis = await this.getAudioAnalysis(track.filePath);
        } catch (error) {
        }
      }

      // Prepare metadata
      const metadata = analysis ? {
        replayGain: analysis.lufs.replayGainDB ? Math.pow(10, analysis.lufs.replayGainDB / 20) : undefined,
        lufs: analysis.lufs.integratedLUFS,
        bpm: analysis.beats.bpm,
        key: undefined
      } : undefined;

      // Create AudiophileTrack
      const audiophileTrack: AudiophileTrack = {
        id: track.id,
        filePath: track.filePath,
        duration: track.duration,
        metadata
      };

      // Use controller to preload
      await this.controller.preloadNextTrack(audiophileTrack);
    } catch (error) {
      // Preloading is optional
    }
  }

  /**
   * Schedule gapless transition for seamless playback
   */
  async scheduleGaplessTransition(nextTrack: CrossfadeTrack): Promise<void> {
    // For now, use standard crossfade
    // Full gapless implementation requires backend audio analysis
    await this.scheduleCrossfade(nextTrack);
  }

  /**
   * Load a track for playback using AudiophileCrossfadeController
   */
  async loadTrack(track: CrossfadeTrack, options?: CrossfadeOptions): Promise<void> {
    try {
      // Reset crossfade state when loading a new track
      this.crossfadeInProgress = false;
      this.crossfadeAnimation = null;

      // Store callbacks if provided
      if (options) {
        this.onTrackEnd = options.onTrackEnd;
        this.onTimeUpdate = options.onTimeUpdate;
        this.onError = options.onError;
        this.onCrossfadeStart = options.onCrossfadeStart;
        this.onCrossfadeComplete = options.onCrossfadeComplete;

        // Store volume from options
        if (options.volume !== undefined) {
          this.setVolume(options.volume);
        }
      }

      // Try to get audio analysis
      let analysis: AudioAnalysisResult | null = null;
      if (this.hasIPCSupport()) {
        try {
          analysis = await this.getAudioAnalysis(track.filePath);
        } catch (error) {
        }
      }

      // Prepare metadata for controller
      const metadata = analysis ? {
        replayGain: analysis.lufs.replayGainDB ? Math.pow(10, analysis.lufs.replayGainDB / 20) : undefined,
        lufs: analysis.lufs.integratedLUFS,
        bpm: analysis.beats.bpm,
        key: undefined
      } : undefined;

      // Create AudiophileTrack
      const audiophileTrack: AudiophileTrack = {
        id: track.id,
        filePath: track.filePath,
        duration: track.duration,
        metadata
      };

      // Set controller callbacks
      this.controller.setCallbacks({
        onTrackEnd: this.onTrackEnd,
        onTimeUpdate: this.onTimeUpdate,
        onCrossfadeStart: (nextTrack) => {
          if (this.onCrossfadeStart) {
            const crossfadeTrack: CrossfadeTrack = {
              id: nextTrack.id,
              filePath: nextTrack.filePath,
              duration: nextTrack.duration
            };
            this.onCrossfadeStart(crossfadeTrack);
          }
        },
        onCrossfadeComplete: () => {
          // Clear the flag when crossfade actually completes
          this.crossfadeInProgress = false;

          // Resolve the promise if waiting
          if (this.crossfadeCompleteResolver) {
            this.crossfadeCompleteResolver();
            this.crossfadeCompleteResolver = null;
          }

          // Call the adapter's callback
          if (this.onCrossfadeComplete) {
            this.onCrossfadeComplete();
          }
        },
        onError: this.onError
      });

      // Configure audiophile options
      const audiophileOptions: Partial<AudiophileOptions> = {
        crossfadeDuration: options?.crossfadeDuration || 5,
        crossfadeCurve: 'sCurve', // Use S-curve for smooth transitions
        targetLUFS: -16, // Audiophile standard
        enableTruePeak: true,
        enableBeatMatching: false, // Can enable based on preference
        gaplessThreshold: 50,
        updateInterval: 10,
        bufferSize: 512
      };

      // Load track using AudiophileCrossfadeController
      await this.controller.loadTrack(audiophileTrack, audiophileOptions);

      // Apply volume
      this.controller.setVolume(this.isMuted ? 0 : this.volume);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.abortCrossfade();
    this.controller.destroy();
    this.analysisCache.clear();

    // Clear callbacks
    this.onTrackEnd = undefined;
    this.onTimeUpdate = undefined;
    this.onError = undefined;
    this.onCrossfadeStart = undefined;
    this.onCrossfadeComplete = undefined;

    // Clear cache in main process if available
    if (this.hasIPCSupport()) {
      (window as any).ipc.invoke('clear-audio-analysis-cache').catch(() => {});
    }
  }
}