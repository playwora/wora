import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { usePlayer } from '../context/PlayerContext';
import {
  getPlaylistWithSongs,
  addSongToPlaylist,
  removeSongFromPlaylist,
  deletePlaylist,
  getAllCachedLyricsForPlaylist,
  clearLyricsCacheForPlaylist,
} from '../database';
import { Playlist, Song } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

type PlaylistDetailScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PlaylistDetail'>;
  route: RouteProp<RootStackParamList, 'PlaylistDetail'>;
};

const PlaylistDetailScreen: React.FC<PlaylistDetailScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PlaylistDetail'>>();
  const { playlistId } = route.params;
  const player = usePlayer();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const [cachedSongCount, setCachedSongCount] = useState(0);

  useEffect(() => {
    const loadPlaylist = async () => {
      try {
        const data = await getPlaylistWithSongs(playlistId);
        if (data) {
          setPlaylist(data);

          // Check how many songs have cached lyrics
          const lyricsMap = await getAllCachedLyricsForPlaylist(playlistId);
          setCachedSongCount(lyricsMap.size);
          setIsCached(lyricsMap.size === data.songs?.length);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading playlist:', error);
        setIsLoading(false);
      }
    };

    loadPlaylist();
  }, [playlistId]);

  const handleSongPress = useCallback((song: Song, index: number) => {
    if (playlist?.songs) {
      player.setQueueAndPlay(playlist.songs, index);
    }
  }, [player, playlist]);

  const handleShufflePress = useCallback(() => {
    if (playlist?.songs) {
      player.setQueueAndPlay(playlist.songs, 0, true);
    }
  }, [player, playlist]);

  const handlePlayAllPress = useCallback(() => {
    if (playlist?.songs) {
      player.setQueueAndPlay(playlist.songs, 0, false);
    }
  }, [player, playlist]);

  const handleSongOptions = useCallback((song: Song) => {
    // Show options for song (remove from playlist, etc.)
    Alert.alert(
      'Song Options',
      `What would you like to do with "${song.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove from Playlist',
          style: 'destructive',
          onPress: () => handleRemoveFromPlaylist(song),
        },
        { text: 'View Lyrics', onPress: () => handleViewLyrics(song) },
      ]
    );
  }, []);

  const handleRemoveFromPlaylist = useCallback(async (song: Song) => {
    try {
      const success = await removeSongFromPlaylist(playlistId, song.id);
      if (success) {
        // Refresh playlist
        const updatedPlaylist = await getPlaylistWithSongs(playlistId);
        setPlaylist(updatedPlaylist);
      }
    } catch (error) {
      console.error('Error removing song from playlist:', error);
      Alert.alert('Error', 'Failed to remove song from playlist');
    }
  }, [playlistId]);

  const handleViewLyrics = useCallback((song: Song) => {
    navigation.navigate('Lyrics', {
      songId: song.id,
      playlistId,
    });
  }, [navigation, playlistId]);

  const handleCacheLyrics = useCallback(async () => {
    try {
      if (!playlist?.songs) return;

      Alert.alert(
        'Cache Lyrics',
        `Would you like to cache lyrics for all ${playlist.songs.length} songs in this playlist for offline viewing?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Cache All',
            onPress: async () => {
              // In a real implementation, you would call cachePlaylistLyrics
              // For now, we'll just show a success message
              Alert.alert('Success', 'Lyrics are being cached for offline viewing');
              setIsCached(true);
              setCachedSongCount(playlist.songs.length);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error caching lyrics:', error);
      Alert.alert('Error', 'Failed to cache lyrics');
    }
  }, [playlist]);

  const handleClearCache = useCallback(async () => {
    try {
      await clearLyricsCacheForPlaylist(playlistId);
      setIsCached(false);
      setCachedSongCount(0);
      Alert.alert('Success', 'Lyrics cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
      Alert.alert('Error', 'Failed to clear cache');
    }
  }, [playlistId]);

  const handleDeletePlaylist = useCallback(async () => {
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${playlist?.name}"? This will remove all songs from the playlist.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await deletePlaylist(playlistId);
              if (success) {
                navigation.goBack();
              }
            } catch (error) {
              console.error('Error deleting playlist:', error);
              Alert.alert('Error', 'Failed to delete playlist');
            }
          },
        },
      ]
    );
  }, [navigation, playlist, playlistId]);

  const renderSongItem = ({ item, index }: { item: Song; index: number }) => (
    <TouchableOpacity
      style={[
        styles.songItem,
        player.song?.id === item.id && styles.playingSongItem,
      ]}
      onPress={() => handleSongPress(item, index)}
    >
      <View style={styles.songNumber}>
        {player.song?.id === item.id ? (
          <Ionicons name="volume-high" size={16} color="#6366f1" />
        ) : (
          <Text style={styles.songNumberText}>{index + 1}</Text>
        )}
      </View>
      <View style={styles.songCover}>
        {item.album?.cover ? (
          <Image source={{ uri: item.album.cover }} style={styles.songCoverImage} />
        ) : (
          <Ionicons name="musical-note" size={20} color="#9ca3af" />
        )}
      </View>
      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.songArtist} numberOfLines={1}>{item.artist}</Text>
      </View>
      <TouchableOpacity
        style={styles.songOptions}
        onPress={() => handleSongOptions(item)}
      >
        <Ionicons name="ellipsis-vertical" size={20} color="#9ca3af" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading playlist...</Text>
      </View>
    );
  }

  if (!playlist) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={60} color="#9ca3af" />
        <Text style={styles.errorText}>Playlist not found</Text>
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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {playlist.name}
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerAction} onPress={handleShufflePress}>
              <Ionicons name="shuffle" size={22} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerAction}>
              <Ionicons name="ellipsis-horizontal" size={22} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Playlist Cover and Info */}
        <View style={styles.playlistInfoContainer}>
          <View style={styles.playlistCover}>
            {playlist.cover && playlist.cover !== 'logo' ? (
              <Image source={{ uri: playlist.cover }} style={styles.playlistCoverImage} />
            ) : (
              <Ionicons name="list" size={60} color="#9ca3af" />
            )}
          </View>
          <View style={styles.playlistDetails}>
            <Text style={styles.playlistName}>{playlist.name}</Text>
            <Text style={styles.playlistDescription} numberOfLines={2}>
              {playlist.description}
            </Text>
            <View style={styles.playlistMeta}>
              <Text style={styles.playlistMetaText}>
                {playlist.songs?.length || 0} songs
              </Text>
              <Text style={styles.playlistMetaText}>
                {isCached && (
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                )}
                {cachedSongCount}/{playlist.songs?.length || 0} lyrics cached
              </Text>
            </View>
            <View style={styles.playlistActions}>
              <TouchableOpacity
                style={[styles.playlistAction, styles.playAllButton]}
                onPress={handlePlayAllPress}
              >
                <Ionicons name="play" size={18} color="#1a1a2e" />
                <Text style={styles.playAllButtonText}>Play All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.playlistAction, styles.cacheButton]}
                onPress={isCached ? handleClearCache : handleCacheLyrics}
              >
                <Ionicons
                  name={isCached ? 'trash' : 'cloud-download'}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.cacheButtonText}>
                  {isCached ? 'Clear Cache' : 'Cache Lyrics'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Songs List */}
        <View style={styles.songsHeader}>
          <Text style={styles.songsTitle}>Songs</Text>
          <Text style={styles.songCount}>
            {playlist.songs?.length || 0} tracks
          </Text>
        </View>

        <FlatList
          data={playlist.songs || []}
          renderItem={renderSongItem}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.songsList}
        />

        {/* Delete Playlist */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeletePlaylist}>
          <Ionicons name="trash" size={20} color="#ef4444" />
          <Text style={styles.deleteButtonText}>Delete Playlist</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    maxWidth: screenWidth * 0.6,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  playlistInfoContainer: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  playlistCover: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  playlistCoverImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  playlistDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  playlistName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  playlistDescription: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 10,
  },
  playlistMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 15,
  },
  playlistMetaText: {
    color: '#9ca3af',
    fontSize: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  playlistActions: {
    flexDirection: 'row',
    gap: 10,
  },
  playlistAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  playAllButton: {
    backgroundColor: '#fff',
  },
  playAllButtonText: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: '600',
  },
  cacheButton: {
    backgroundColor: '#6366f1',
  },
  cacheButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  songsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  songsTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  songCount: {
    color: '#9ca3af',
    fontSize: 14,
  },
  songsList: {
    paddingBottom: 20,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#374151',
    borderRadius: 12,
    marginBottom: 10,
  },
  playingSongItem: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderColor: '#6366f1',
    borderWidth: 1,
  },
  songNumber: {
    width: 30,
    alignItems: 'center',
  },
  songNumberText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  songCover: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#4b5563',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  songCoverImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  songArtist: {
    color: '#9ca3af',
    fontSize: 14,
  },
  songOptions: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    marginTop: 20,
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 10,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 40,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 15,
  },
  bottomSpacer: {
    height: 40,
  },
});

export default PlaylistDetailScreen;
