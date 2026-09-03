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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { getAlbumWithSongs } from '../database';
import { Album, Song } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

type AlbumDetailScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AlbumDetail'>;
  route: RouteProp<RootStackParamList, 'AlbumDetail'>;
};

const AlbumDetailScreen: React.FC<AlbumDetailScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AlbumDetail'>>();
  const { albumId } = route.params;
  const player = usePlayer();

  const [album, setAlbum] = useState<Album | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAlbum = async () => {
      try {
        const data = await getAlbumWithSongs(albumId);
        setAlbum(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading album:', error);
        setIsLoading(false);
      }
    };

    loadAlbum();
  }, [albumId]);

  const handleSongPress = useCallback((song: Song, index: number) => {
    if (album?.songs) {
      player.setQueueAndPlay(album.songs, index);
    }
  }, [player, album]);

  const handleShufflePress = useCallback(() => {
    if (album?.songs) {
      player.setQueueAndPlay(album.songs, 0, true);
    }
  }, [player, album]);

  const handlePlayAllPress = useCallback(() => {
    if (album?.songs) {
      player.setQueueAndPlay(album.songs, 0, false);
    }
  }, [player, album]);

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '--:--';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs}`;
    }
    return `${minutes}:${secs}`;
  };

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
      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>{item.name}</Text>
        <View style={styles.songMeta}>
          <Text style={styles.songArtist} numberOfLines={1}>{item.artist}</Text>
          <Text style={styles.songDuration}>{formatDuration(item.duration)}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.songOptions}>
        <Ionicons name="ellipsis-vertical" size={20} color="#9ca3af" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading album...</Text>
      </View>
    );
  }

  if (!album) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={60} color="#9ca3af" />
        <Text style={styles.errorText}>Album not found</Text>
      </View>
    );
  }

  // Calculate total duration
  const totalDuration = album.songs?.reduce((sum, song) => sum + song.duration, 0) || 0;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Album
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
        {/* Album Cover and Info */}
        <View style={styles.albumInfoContainer}>
          <View style={styles.albumCover}>
            {album.cover ? (
              <Image source={{ uri: album.cover }} style={styles.albumCoverImage} />
            ) : (
              <Ionicons name="albums" size={60} color="#9ca3af" />
            )}
          </View>
          <View style={styles.albumDetails}>
            <Text style={styles.albumName}>{album.name}</Text>
            <Text style={styles.albumArtist}>{album.artist}</Text>
            <View style={styles.albumMeta}>
              <Text style={styles.albumMetaText}>
                {album.year || 'Unknown Year'} • {album.songs?.length || 0} songs
              </Text>
              <Text style={styles.albumMetaText}>
                {formatDuration(totalDuration)}
              </Text>
            </View>
            <View style={styles.albumActions}>
              <TouchableOpacity
                style={[styles.albumAction, styles.playAllButton]}
                onPress={handlePlayAllPress}
              >
                <Ionicons name="play" size={18} color="#1a1a2e" />
                <Text style={styles.playAllButtonText}>Play All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.albumAction, styles.shuffleButton]}
                onPress={handleShufflePress}
              >
                <Ionicons name="shuffle" size={18} color="#fff" />
                <Text style={styles.shuffleButtonText}>Shuffle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Songs List */}
        <View style={styles.songsHeader}>
          <Text style={styles.songsTitle}>Tracks</Text>
          <Text style={styles.songCount}>
            {album.songs?.length || 0} tracks • {formatDuration(totalDuration)}
          </Text>
        </View>

        <FlatList
          data={album.songs || []}
          renderItem={renderSongItem}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.songsList}
        />

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
  albumInfoContainer: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  albumCover: {
    width: 140,
    height: 140,
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
  albumCoverImage: {
    width: 140,
    height: 140,
    borderRadius: 12,
  },
  albumDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  albumName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  albumArtist: {
    color: '#d1d5db',
    fontSize: 18,
    marginBottom: 10,
  },
  albumMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 15,
  },
  albumMetaText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  albumActions: {
    flexDirection: 'row',
    gap: 10,
  },
  albumAction: {
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
  shuffleButton: {
    backgroundColor: '#6366f1',
  },
  shuffleButtonText: {
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
  songInfo: {
    flex: 1,
  },
  songTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  songMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  songArtist: {
    color: '#9ca3af',
    fontSize: 14,
  },
  songDuration: {
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

export default AlbumDetailScreen;
