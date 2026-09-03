import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { getSongById, getPlaylistWithSongs } from '../database';
import { getLyrics, getCurrentLyric, cachePlaylistLyrics, areLyricsCached } from '../lib/lyrics';
import { LyricLine, Song } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { height: screenHeight } = Dimensions.get('window');

type LyricsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Lyrics'>;
  route: RouteProp<RootStackParamList, 'Lyrics'>;
};

const LyricsScreen: React.FC<LyricsScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Lyrics'>>();
  const { songId, playlistId } = route.params;
  const player = usePlayer();

  const [song, setSong] = useState<Song | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isSynced, setIsSynced] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLyric, setCurrentLyric] = useState<LyricLine | null>(null);
  const [showOfflineOption, setShowOfflineOption] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get song details
        const songData = await getSongById(songId);
        if (!songData) {
          Alert.alert('Error', 'Song not found');
          navigation.goBack();
          return;
        }
        setSong(songData);

        // Check if lyrics are cached for this playlist
        if (playlistId) {
          const cached = await areLyricsCached(playlistId, songId);
          setIsCached(cached);
        }

        // Fetch lyrics
        const { lyrics: fetchedLyrics, isSynced: synced, isCached: cached } = await getLyrics(
          songData.name,
          songData.artist,
          songData.duration,
          songData.id,
          playlistId
        );

        setLyrics(fetchedLyrics);
        setIsSynced(synced);
        setIsCached(cached);
        setIsLoading(false);

        // Set initial current lyric based on player position
        if (player.song?.id === songId) {
          const current = getCurrentLyric(fetchedLyrics, player.seek);
          setCurrentLyric(current);
        }
      } catch (error) {
        console.error('Error loading lyrics:', error);
        setIsLoading(false);
      }
    };

    loadData();
  }, [songId, playlistId, player.song?.id, player.seek]);

  // Update current lyric when player position changes
  useEffect(() => {
    if (!song || song.id !== player.song?.id) return;

    const interval = setInterval(() => {
      const current = getCurrentLyric(lyrics, player.seek);
      setCurrentLyric(current);
    }, 200);

    return () => clearInterval(interval);
  }, [player.seek, lyrics, song, player.song?.id]);

  const handleLyricPress = useCallback((line: LyricLine) => {
    // Seek to this lyric's time
    player.seekTo(line.time);
  }, [player]);

  const handleSaveOffline = useCallback(async () => {
    if (!playlistId || !song) return;

    try {
      setShowOfflineOption(false);

      // Get all songs in the playlist
      const playlist = await getPlaylistWithSongs(playlistId);
      if (!playlist?.songs) return;

      // Cache lyrics for all songs in the playlist
      const result = await cachePlaylistLyrics(playlistId, playlist.songs);

      Alert.alert(
        'Success',
        `Cached lyrics for ${result.success} songs. ${result.failed} songs failed.`
      );

      setIsCached(true);
    } catch (error) {
      console.error('Error caching playlist lyrics:', error);
      Alert.alert('Error', 'Failed to cache lyrics for offline viewing');
    }
  }, [playlistId, song]);

  const handleToggleOfflineOption = useCallback(() => {
    setShowOfflineOption(!showOfflineOption);
  }, [showOfflineOption]);

  const renderLyricLine = (line: LyricLine, index: number) => {
    const isCurrent = currentLyric?.time === line.time;

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.lyricLine,
          isCurrent && styles.currentLyricLine,
        ]}
        onPress={() => handleLyricPress(line)}
      >
        <Text
          style={[
            styles.lyricText,
            isCurrent && styles.currentLyricText,
          ]}
        >
          {line.text}
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading lyrics...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {song?.name || 'Lyrics'}
            </Text>
            <Text style={styles.headerArtist} numberOfLines={1}>
              {song?.artist || 'Unknown Artist'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.offlineButton}
              onPress={handleToggleOfflineOption}
            >
              <Ionicons
                name={isCached ? 'cloud-done' : 'cloud-download'}
                size={24}
                color={isCached ? '#10b981' : '#9ca3af'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.lyricsContainer}>
        <ScrollView
          style={styles.lyricsScroll}
          contentContainerStyle={styles.lyricsContent}
          showsVerticalScrollIndicator={false}
          // Auto-scroll to current lyric
          onContentSizeChange={() => {
            if (currentLyric) {
              // Scroll to current lyric
              // Note: In a real implementation, you'd use scrollTo with ref
            }
          }}
        >
          <View style={styles.lyricsHeader}>
            <Text style={styles.lyricsType}>
              {isSynced ? 'Synced Lyrics' : 'Unsynced Lyrics'}
            </Text>
            {isCached && (
              <View style={styles.cachedBadge}>
                <Ionicons name="checkmark" size={12} color="#10b981" />
                <Text style={styles.cachedBadgeText}>Cached for offline</Text>
              </View>
            )}
          </View>

          <View style={styles.lyricsLines}>
            {lyrics.length > 0 ? (
              lyrics.map(renderLyricLine)
            ) : (
              <View style={styles.noLyricsContainer}>
                <Ionicons name="text" size={48} color="#9ca3af" />
                <Text style={styles.noLyricsText}>No lyrics found</Text>
                <Text style={styles.noLyricsSubtext}>
                  Try searching online or add lyrics manually
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Offline save option modal */}
      {showOfflineOption && !isCached && playlistId && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Lyrics Offline</Text>
            <Text style={styles.modalText}>
              Would you like to cache lyrics for all songs in this playlist for offline viewing?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleToggleOfflineOption}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveOffline}
              >
                <Text style={styles.saveButtonText}>Save Offline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 15,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerArtist: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  offlineButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  lyricsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  lyricsScroll: {
    flex: 1,
  },
  lyricsContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  lyricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  lyricsType: {
    color: '#9ca3af',
    fontSize: 14,
  },
  cachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  cachedBadgeText: {
    color: '#10b981',
    fontSize: 12,
    marginLeft: 5,
  },
  lyricsLines: {
    alignItems: 'center',
  },
  lyricLine: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginVertical: 4,
    borderRadius: 8,
  },
  currentLyricLine: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    transform: [{ scale: 1.05 }],
  },
  lyricText: {
    color: '#9ca3af',
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 28,
  },
  currentLyricText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  noLyricsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    minHeight: screenHeight * 0.5,
  },
  noLyricsText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 15,
  },
  noLyricsSubtext: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#374151',
    borderRadius: 20,
    padding: 25,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalText: {
    color: '#d1d5db',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#4b5563',
  },
  cancelButtonText: {
    color: '#d1d5db',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#10b981',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default LyricsScreen;
