import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { Song } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { getLyrics, getCurrentLyric } from '../lib/lyrics';
import { LyricLine } from '../types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type NowPlayingScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NowPlaying'>;
};

const NowPlayingScreen: React.FC<NowPlayingScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const player = usePlayer();
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isSynced, setIsSynced] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [currentLyric, setCurrentLyric] = useState<LyricLine | null>(null);

  useEffect(() => {
    const loadLyrics = async () => {
      if (player.song) {
        try {
          const { lyrics: fetchedLyrics, isSynced: synced } = await getLyrics(
            player.song.name,
            player.song.artist,
            player.song.duration,
            player.song.id
          );
          setLyrics(fetchedLyrics);
          setIsSynced(synced);
        } catch (error) {
          console.error('Error loading lyrics:', error);
        }
      }
    };

    loadLyrics();
  }, [player.song]);

  // Update current lyric when player position changes
  useEffect(() => {
    if (lyrics.length > 0 && player.song) {
      const current = getCurrentLyric(lyrics, player.seek);
      setCurrentLyric(current);
    }
  }, [player.seek, lyrics, player.song]);

  const handleLyricsPress = useCallback(() => {
    if (player.song) {
      navigation.navigate('Lyrics', {
        songId: player.song.id,
        playlistId: undefined,
      });
    }
  }, [navigation, player.song]);

  const formatTime = (seconds: number): string => {
    if (!seconds) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs}`;
    }
    return `${minutes}:${secs}`;
  };

  const handleSeek = useCallback((value: number) => {
    player.seekTo(value * player.song?.duration || 0);
  }, [player, player.song?.duration]);

  if (!player.song) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="musical-notes" size={60} color="#9ca3af" />
        <Text style={styles.emptyText}>No song playing</Text>
        <Text style={styles.emptySubtext}>Start playing a song to see it here</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e', '#1a1a2e']} style={styles.gradient}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-down" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Now Playing</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerAction}>
                <Ionicons name="share-social" size={22} color="#9ca3af" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerAction}>
                <Ionicons name="ellipsis-horizontal" size={22} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Album Art */}
          <View style={styles.albumArtContainer}>
            <View style={styles.albumArt}>
              {player.song.album?.cover ? (
                <Image
                  source={{ uri: player.song.album.cover }}
                  style={styles.albumArtImage}
                />
              ) : (
                <Ionicons name="albums" size={screenWidth * 0.6} color="#9ca3af" />
              )}
            </View>
          </View>

          {/* Song Info */}
          <View style={styles.songInfoContainer}>
            <Text style={styles.songTitle} numberOfLines={1}>
              {player.song.name}
            </Text>
            <Text style={styles.songArtist} numberOfLines={1}>
              {player.song.artist}
            </Text>
            <Text style={styles.songAlbum} numberOfLines={1}>
              {player.song.album?.name || 'Unknown Album'}
            </Text>
          </View>

          {/* Progress Slider */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressTime}>{formatTime(player.seek)}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={player.song.duration > 0 ? player.seek / player.song.duration : 0}
              onSlidingComplete={(value) => handleSeek(value)}
              minimumTrackTintColor="#6366f1"
              maximumTrackTintColor="#4b5563"
              thumbTintColor="#6366f1"
            />
            <Text style={styles.progressTime}>
              {formatTime(player.song.duration)}
            </Text>
          </View>

          {/* Player Controls */}
          <View style={styles.controlsContainer}>
            <View style={styles.secondaryControls}>
              <TouchableOpacity style={styles.controlButton}>
                <Ionicons name="shuffle" size={24} color={player.shuffle ? '#6366f1' : '#9ca3af'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlButton} onPress={player.previousSong}>
                <Ionicons name="play-skip-back" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={() => player.setIsPlaying(!player.isPlaying)}
            >
              <Ionicons
                name={player.isPlaying ? 'pause' : 'play'}
                size={32}
                color="#1a1a2e"
              />
            </TouchableOpacity>

            <View style={styles.secondaryControls}>
              <TouchableOpacity style={styles.controlButton} onPress={player.nextSong}>
                <Ionicons name="play-skip-forward" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => player.toggleRepeat()}
              >
                <Ionicons
                  name={player.repeat ? 'repeat' : 'repeat-off'}
                  size={24}
                  color={player.repeat ? '#6366f1' : '#9ca3af'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Lyrics Preview */}
          <TouchableOpacity style={styles.lyricsPreview} onPress={handleLyricsPress}>
            <View style={styles.lyricsPreviewContent}>
              <Ionicons name="text" size={20} color="#9ca3af" />
              <Text style={styles.lyricsPreviewText}>
                {currentLyric ? currentLyric.text : 'View Lyrics'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          {/* Additional Info */}
          <View style={styles.additionalInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Quality</Text>
              <Text style={styles.infoValue}>Lossless</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Format</Text>
              <Text style={styles.infoValue}>
                {player.song.filePath.split('.').pop()?.toUpperCase() || 'Unknown'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Duration</Text>
              <Text style={styles.infoValue}>{formatTime(player.song.duration)}</Text>
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 15,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  albumArtContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  albumArt: {
    width: screenWidth * 0.8,
    height: screenWidth * 0.8,
    borderRadius: 20,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  albumArtImage: {
    width: screenWidth * 0.8,
    height: screenWidth * 0.8,
    borderRadius: 20,
  },
  songInfoContainer: {
    alignItems: 'center',
    paddingBottom: 30,
  },
  songTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  songArtist: {
    color: '#d1d5db',
    fontSize: 18,
    marginTop: 5,
    textAlign: 'center',
  },
  songAlbum: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  progressTime: {
    color: '#9ca3af',
    fontSize: 14,
    width: 50,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    marginHorizontal: 10,
    height: 4,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  secondaryControls: {
    flexDirection: 'row',
    gap: 20,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  lyricsPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 30,
  },
  lyricsPreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lyricsPreviewText: {
    color: '#d1d5db',
    fontSize: 16,
    marginLeft: 12,
  },
  additionalInfo: {
    paddingHorizontal: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  infoValue: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 40,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 15,
  },
  emptySubtext: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
  },
});

export default NowPlayingScreen;
