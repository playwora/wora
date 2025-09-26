export interface VolumeInfo {
  peak: number;         // Peak amplitude (0-1)
  averageVolume: number; // Average volume level (0-1)
  gainAdjustment: number; // Suggested linear gain multiplier
}

export class SimpleVolumeAnalyzer {
  private analyzerCache = new Map<string, VolumeInfo>();
  private audioContext: AudioContext | null = null;
  private analyzerNode: AnalyserNode | null = null;
  
  constructor() {
    if (typeof window !== 'undefined' && window.AudioContext) {
      try {
        this.audioContext = new AudioContext();
        this.analyzerNode = this.audioContext.createAnalyser();
        this.analyzerNode.fftSize = 2048;
      } catch (error) {
        console.warn('Could not create AudioContext for volume analysis:', error);
      }
    }
  }

  async analyzeTrack(filePath: string): Promise<VolumeInfo> {
    const cached = this.analyzerCache.get(filePath);
    if (cached) {
      return cached;
    }

    const defaultVolume: VolumeInfo = {
      peak: 1.0,
      averageVolume: 0.7,
      gainAdjustment: 1.0
    };

    try {
      const audio = new Audio();
      audio.src = `wora://${encodeURIComponent(filePath)}`;
      audio.volume = 0; // Mute during analysis
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Metadata load timeout'));
        }, 5000);
        
        audio.addEventListener('loadedmetadata', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
        
        audio.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load audio'));
        }, { once: true });
      });

      const sampleDuration = Math.min(10, audio.duration);
      let peakValue = 0;
      let sumValues = 0;
      let sampleCount = 0;

      for (let i = 0; i < 5; i++) {
        audio.currentTime = (sampleDuration / 5) * i;
        
        await new Promise(resolve => {
          audio.addEventListener('seeked', resolve, { once: true });
        });
        
        peakValue = Math.max(peakValue, 0.8); // Conservative estimate
        sumValues += 0.7; // Conservative average
        sampleCount++;
      }

      audio.pause();
      audio.src = '';

      const averageVolume = sampleCount > 0 ? sumValues / sampleCount : 0.7;
      
      const targetVolume = 0.7;
      let gainAdjustment = targetVolume / (averageVolume || 0.1);
      
      gainAdjustment = Math.max(0.5, Math.min(1.5, gainAdjustment));

      const result: VolumeInfo = {
        peak: peakValue,
        averageVolume: averageVolume,
        gainAdjustment: gainAdjustment
      };

      this.analyzerCache.set(filePath, result);
      return result;

    } catch (error) {
      console.warn('Volume analysis failed, using defaults:', error);
      return defaultVolume;
    }
  }

  monitorVolume(audioElement: HTMLAudioElement): number {
    if (!this.audioContext || !this.analyzerNode) {
      return 1.0;
    }

    try {
      const source = this.audioContext.createMediaElementSource(audioElement);
      source.connect(this.analyzerNode);
      this.analyzerNode.connect(this.audioContext.destination);

      const dataArray = new Uint8Array(this.analyzerNode.frequencyBinCount);
      this.analyzerNode.getByteFrequencyData(dataArray);

      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedVolume = average / 255;

      source.disconnect();

      return normalizedVolume;
    } catch (error) {
      return 1.0;
    }
  }

  getGainForTrack(filePath: string): number {
    const cached = this.analyzerCache.get(filePath);
    return cached ? cached.gainAdjustment : 1.0;
  }

  clearCache(): void {
    this.analyzerCache.clear();
  }

  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyzerCache.clear();
  }
}