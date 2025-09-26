/**
 * Audio Analysis Service for Electron Main Process
 * Provides native audio analysis capabilities for audiophile features
 */

import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import {
  decodeAudioFile,
  analyzeLoudness,
  detectSilence,
  detectBeats
} from './audio-decoder';

// Types for audio analysis
export interface AudioAnalysisResult {
  lufs: LoudnessMetrics;
  silence: SilenceMetrics;
  beats: BeatMetrics;
  timestamp: number;
  fileHash: string;
}

export interface LoudnessMetrics {
  integratedLUFS: number;
  shortTermLUFS: number;
  momentaryLUFS: number;
  loudnessRange: number;
  truePeak: number;
  replayGainDB: number;
}

export interface SilenceMetrics {
  startSilence: number;
  endSilence: number;
  startFadeIn: number;
  endFadeOut: number;
  hasGaplessMarkers: boolean;
  encoderDelay: number;
  encoderPadding: number;
}

export interface BeatMetrics {
  bpm: number;
  confidence: number;
  beatPositions: number[];
  downbeats: number[];
  timeSignature: string;
  firstDownbeat: number;
  phaseShift: number;
}

class AudioAnalysisService {
  private db: Database.Database | null = null;
  private cacheDir: string;
  private analysisQueue: Map<string, Promise<AudioAnalysisResult>> = new Map();
  private dbMutex: boolean = false; // Simple mutex for SQLite operations

  constructor() {
    // Setup cache directory
    const userData = process.env.APPDATA ||
                    (process.platform == 'darwin' ?
                      process.env.HOME + '/Library/Application Support' :
                      process.env.HOME + '/.local/share');

    this.cacheDir = path.join(userData, 'wora', 'audio-analysis-cache');

    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    // Initialize database for caching
    this.initDatabase();

    // Setup IPC handlers
    this.setupIPCHandlers();
  }

  /**
   * Initialize SQLite database for caching analysis results
   */
  private initDatabase(): void {
    const dbPath = path.join(this.cacheDir, 'analysis.db');

    try {
      this.db = new Database(dbPath);

      // Create analysis cache table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS audio_analysis (
          file_path TEXT PRIMARY KEY,
          file_hash TEXT NOT NULL,
          analysis_data TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          file_size INTEGER,
          last_modified INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_file_hash ON audio_analysis(file_hash);
        CREATE INDEX IF NOT EXISTS idx_timestamp ON audio_analysis(timestamp);
      `);

      // Clean up old entries (older than 30 days)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      this.db.prepare('DELETE FROM audio_analysis WHERE timestamp < ?').run(thirtyDaysAgo);

    } catch (error) {
    }
  }

  /**
   * Setup IPC handlers for renderer process communication
   */
  private setupIPCHandlers(): void {
    // Main analysis handler
    ipcMain.handle('analyze-audio', async (event, filePath: string) => {
      return this.analyzeAudio(filePath);
    });

    // Batch analysis handler
    ipcMain.handle('analyze-audio-batch', async (event, filePaths: string[]) => {
      return Promise.all(filePaths.map(fp => this.analyzeAudio(fp)));
    });

    // Clear cache handler
    ipcMain.handle('clear-audio-analysis-cache', async () => {
      return this.clearCache();
    });

    // Get cache statistics
    ipcMain.handle('get-audio-cache-stats', async () => {
      return this.getCacheStats();
    });
  }

  /**
   * Main audio analysis function
   */
  async analyzeAudio(filePath: string): Promise<AudioAnalysisResult> {
    // Check if analysis is already in progress
    if (this.analysisQueue.has(filePath)) {
      return this.analysisQueue.get(filePath)!;
    }

    // Create analysis promise
    const analysisPromise = this.performAnalysis(filePath)
      .catch(error => {
        // Ensure failed analyses are removed from queue

        // Return default result on error
        return {
          lufs: this.getDefaultLoudness(),
          silence: this.getDefaultSilence(),
          beats: this.getDefaultBeats(),
          timestamp: Date.now(),
          fileHash: ''
        } as AudioAnalysisResult;
      });

    this.analysisQueue.set(filePath, analysisPromise);

    try {
      const result = await analysisPromise;
      return result;
    } finally {
      // Always clean up queue, even on error
      setTimeout(() => {
        this.analysisQueue.delete(filePath);
      }, 100); // Small delay to handle race conditions
    }
  }

  /**
   * Perform actual audio analysis
   */
  private async performAnalysis(filePath: string): Promise<AudioAnalysisResult> {
    // Check cache first
    const cached = await this.getCachedAnalysis(filePath);
    if (cached) {
      return cached;
    }

    try {
      // Get file stats
      const stats = fs.statSync(filePath);
      const fileHash = await this.getFileHash(filePath);

      // Check if we have analysis for this file hash
      const cachedByHash = await this.getCachedAnalysisByHash(fileHash);
      if (cachedByHash) {
        // Update cache with new file path
        await this.updateCachePath(filePath, fileHash, cachedByHash);
        return cachedByHash;
      }

      // Perform actual analysis
      const audioBuffer = await this.loadAudioFile(filePath);

      // Run analysis algorithms
      const [lufs, silence, beats] = await Promise.all([
        this.analyzeLoudness(audioBuffer),
        this.analyzeSilence(audioBuffer),
        this.analyzeBeats(audioBuffer)
      ]);

      const result: AudioAnalysisResult = {
        lufs,
        silence,
        beats,
        timestamp: Date.now(),
        fileHash
      };

      // Cache the result
      await this.cacheAnalysis(filePath, result, stats);

      return result;

    } catch (error) {

      // Return default values on error
      return {
        lufs: this.getDefaultLoudness(),
        silence: this.getDefaultSilence(),
        beats: this.getDefaultBeats(),
        timestamp: Date.now(),
        fileHash: ''
      };
    }
  }

  /**
   * Load audio file into buffer (using Node.js native capabilities)
   */
  private async loadAudioFile(filePath: string): Promise<Float32Array> {
    try {
      const audioData = await decodeAudioFile(filePath, true);
      return audioData.samples || new Float32Array(0);
    } catch (error) {
      return new Float32Array(0);
    }
  }

  /**
   * Analyze loudness (LUFS)
   */
  private async analyzeLoudness(audioBuffer: Float32Array): Promise<LoudnessMetrics> {
    if (audioBuffer.length === 0) {
      return this.getDefaultLoudness();
    }

    const analysis = analyzeLoudness(audioBuffer);

    // Calculate ReplayGain (target: -18 LUFS for ReplayGain 2.0)
    const targetLUFS = -18.0;
    const replayGainDB = targetLUFS - analysis.estimatedLUFS;

    // Convert peak to dBFS
    const truePeak = analysis.peak > 0 ? 20 * Math.log10(analysis.peak) : -100;

    return {
      integratedLUFS: analysis.estimatedLUFS,
      shortTermLUFS: analysis.estimatedLUFS + 0.5, // Approximate
      momentaryLUFS: analysis.estimatedLUFS + 1.2, // Approximate
      loudnessRange: 7.0, // Default LRA
      truePeak,
      replayGainDB: Math.max(-20, Math.min(20, replayGainDB))
    };
  }

  /**
   * Analyze silence
   */
  private async analyzeSilence(audioBuffer: Float32Array): Promise<SilenceMetrics> {
    if (audioBuffer.length === 0) {
      return this.getDefaultSilence();
    }

    const sampleRate = 44100; // Standard sample rate for analysis
    const silence = detectSilence(audioBuffer, sampleRate, -60);

    // Detect fades (simplified)
    const fadeIn = Math.min(silence.startSilence * 2, 0.5);
    const fadeOut = Math.min(silence.endSilence * 2, 0.5);

    // Check for gapless markers (if track ends abruptly)
    const lastSamples = audioBuffer.slice(Math.max(0, audioBuffer.length - 100));
    const avgAmplitude = Array.from(lastSamples).reduce((sum, val) => sum + Math.abs(val), 0) / lastSamples.length;
    const hasGaplessMarkers = avgAmplitude > 0.01;

    return {
      startSilence: silence.startSilence,
      endSilence: silence.endSilence,
      startFadeIn: fadeIn,
      endFadeOut: fadeOut,
      hasGaplessMarkers,
      encoderDelay: 576, // Common LAME encoder delay
      encoderPadding: 1152 // Common encoder padding
    };
  }

  /**
   * Analyze beats
   */
  private async analyzeBeats(audioBuffer: Float32Array): Promise<BeatMetrics> {
    if (audioBuffer.length === 0) {
      return this.getDefaultBeats();
    }

    const sampleRate = 44100; // Standard sample rate for analysis
    const beatAnalysis = detectBeats(audioBuffer, sampleRate);

    // Calculate beat positions (simplified grid)
    const duration = audioBuffer.length / sampleRate;
    const beatInterval = 60 / beatAnalysis.estimatedBPM;
    const beatPositions: number[] = [];
    const downbeats: number[] = [];

    for (let time = 0; time < duration; time += beatInterval) {
      beatPositions.push(time);
      if (beatPositions.length % 4 === 1) {
        downbeats.push(time);
      }
    }

    return {
      bpm: beatAnalysis.estimatedBPM,
      confidence: beatAnalysis.confidence,
      beatPositions: beatPositions.slice(0, 1000), // Limit to first 1000 beats
      downbeats: downbeats.slice(0, 250), // Limit to first 250 downbeats
      timeSignature: "4/4", // Default to 4/4
      firstDownbeat: downbeats[0] || 0,
      phaseShift: 0
    };
  }

  /**
   * Get file hash for cache validation
   */
  private async getFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath, {
        start: 0,
        end: 65536 // First 64KB for performance
      });

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Get cached analysis with mutex protection
   */
  private async getCachedAnalysis(filePath: string): Promise<AudioAnalysisResult | null> {
    if (!this.db) return null;

    // Wait for mutex if another operation is in progress
    while (this.dbMutex) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.dbMutex = true;

    try {
      const row = this.db.prepare(`
        SELECT analysis_data, file_hash, file_size, last_modified
        FROM audio_analysis
        WHERE file_path = ?
      `).get(filePath) as any;

      if (row) {
        const stats = fs.statSync(filePath);

        // Validate cache is still valid
        if (stats.size === row.file_size &&
            stats.mtimeMs === row.last_modified) {
          return JSON.parse(row.analysis_data);
        }
      }
    } catch (error) {
    } finally {
      this.dbMutex = false;
    }

    return null;
  }

  /**
   * Get cached analysis by file hash
   */
  private async getCachedAnalysisByHash(fileHash: string): Promise<AudioAnalysisResult | null> {
    if (!this.db) return null;

    try {
      const row = this.db.prepare(`
        SELECT analysis_data
        FROM audio_analysis
        WHERE file_hash = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `).get(fileHash) as any;

      if (row) {
        return JSON.parse(row.analysis_data);
      }
    } catch (error) {
    }

    return null;
  }

  /**
   * Cache analysis result with transaction
   */
  private async cacheAnalysis(
    filePath: string,
    result: AudioAnalysisResult,
    stats: fs.Stats
  ): Promise<void> {
    if (!this.db) return;

    // Wait for mutex
    while (this.dbMutex) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.dbMutex = true;

    try {
      // Use transaction for atomic operation
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO audio_analysis
        (file_path, file_hash, analysis_data, timestamp, file_size, last_modified)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const transaction = this.db.transaction(() => {
        stmt.run(
          filePath,
          result.fileHash,
          JSON.stringify(result),
          result.timestamp,
          stats.size,
          stats.mtimeMs
        );
      });

      transaction();
    } catch (error) {
    } finally {
      this.dbMutex = false;
    }
  }

  /**
   * Update cache with new file path
   */
  private async updateCachePath(
    filePath: string,
    fileHash: string,
    result: AudioAnalysisResult
  ): Promise<void> {
    if (!this.db) return;

    try {
      const stats = fs.statSync(filePath);

      this.db.prepare(`
        INSERT OR REPLACE INTO audio_analysis
        (file_path, file_hash, analysis_data, timestamp, file_size, last_modified)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        filePath,
        fileHash,
        JSON.stringify(result),
        Date.now(),
        stats.size,
        stats.mtimeMs
      );
    } catch (error) {
    }
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    if (this.db) {
      this.db.exec('DELETE FROM audio_analysis');
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    if (!this.db) {
      return { entries: 0, totalSize: 0 };
    }

    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as entries,
        SUM(file_size) as totalSize,
        MIN(timestamp) as oldestEntry,
        MAX(timestamp) as newestEntry
      FROM audio_analysis
    `).get();

    return stats;
  }

  /**
   * Get default loudness metrics
   */
  private getDefaultLoudness(): LoudnessMetrics {
    return {
      integratedLUFS: -23.0,
      shortTermLUFS: -23.0,
      momentaryLUFS: -23.0,
      loudnessRange: 7.0,
      truePeak: -1.0,
      replayGainDB: 0
    };
  }

  /**
   * Get default silence metrics
   */
  private getDefaultSilence(): SilenceMetrics {
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

  /**
   * Get default beat metrics
   */
  private getDefaultBeats(): BeatMetrics {
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

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.analysisQueue.clear();
  }
}

// Export singleton instance
export const audioAnalysisService = new AudioAnalysisService();

// Initialize service when module is loaded
export function initializeAudioAnalysis(): void {
}