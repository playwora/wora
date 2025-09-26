export interface SilenceInfo {
  startTrim: number;  // Seconds to skip at start
  endTrim: number;    // Seconds to trim from end
}

export class SimpleSilenceDetector {
  private silenceCache = new Map<string, SilenceInfo>();
  
  async detectSilence(filePath: string): Promise<SilenceInfo> {
    const cached = this.silenceCache.get(filePath);
    if (cached) {
      return cached;
    }

    const defaultInfo: SilenceInfo = {
      startTrim: 0,
      endTrim: 0
    };

    try {
      // Create temporary audio element
      const audio = new Audio();
      audio.src = `wora://${encodeURIComponent(filePath)}`;
      audio.volume = 0; // Mute during analysis
      
      // Wait for metadata
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Metadata timeout'));
        }, 3000);
        
        audio.addEventListener('loadedmetadata', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
        
        audio.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load audio'));
        }, { once: true });
      });

      const duration = audio.duration;
      
      if (duration < 10) {
        audio.src = '';
        return defaultInfo;
      }

      let startTrim = 0;
      let endTrim = 0;
      
      const startChecks = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
      for (const time of startChecks) {
        audio.currentTime = time;
        await new Promise(resolve => {
          audio.addEventListener('seeked', resolve, { once: true });
        });
        
        if (audio.readyState >= 3) {
          startTrim = Math.max(0, time - 0.5); // Back up a bit
          break;
        }
      }
      
      if (duration > 30) {
        const endTime = duration - 3;
        audio.currentTime = endTime;
        await new Promise(resolve => {
          audio.addEventListener('seeked', resolve, { once: true });
        });
        
        if (audio.readyState < 3) {
          endTrim = 3; // Trim last 3 seconds
        }
      }

      audio.pause();
      audio.src = '';

      const result: SilenceInfo = {
        startTrim: Math.min(startTrim, 3), // Max 3 seconds trim
        endTrim: Math.min(endTrim, 3)      // Max 3 seconds trim
      };

      this.silenceCache.set(filePath, result);
      return result;

    } catch (error) {
      console.warn('Silence detection failed, using defaults:', error);
      return defaultInfo;
    }
  }

  clearCache(): void {
    this.silenceCache.clear();
  }
}