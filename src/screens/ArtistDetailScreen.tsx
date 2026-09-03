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
import { getSongs, getAlbums } from '../database';
import { Song, Album } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

type ArtistDetailScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ArtistDetail'>;
  route: RouteProp<RootStackParamList, 'ArtistDetail'>;
};

const ArtistDetailScreen: React.FC<ArtistDetailScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ArtistDetail'>>();
  const { artistName } = route.params;
  const player = usePlayer();

  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadArtistData = async () => {
      try {
        // Load all songs and filter by artist
        const { songs: allSongs } = await getSongs(1, 1000);
        const artistSongs = allSongs.filter(
          song => song.artist.toLowerCase() === artistName.toLowerCase()
        );
        setSongs(artistSongs);

        // Load all albums and filter by artist
        const allAlbums = await getAlbums(1, 1000);
        const artistAlbums = allAlbums.filter(
          album => album.artist.toLowerCase() === artistName.toLowerCase()
        );
        setAlbums(artistAlbums);

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading artist data:', error);
        setIsLoading(false);
      }
    };

    loadArtistData();
  }, [artistName]);

  const handleSongPress = useCallback((song: Song, index: number) => {
    player.setQueueAndPlay(songs, index);
  }, [player, songs]);

  const handleAlbumPress = useCallback((album: Album) => {
    navigation.navigate('AlbumDetail', { albumId: album.id });
  }, [navigation]);

  const handleShufflePress = useCallback(() => {
    if (songs.length > 0) {
      player.setQueueAndPlay(songs, 0, true);
    }
  }, [player, songs]);

  const handlePlayAllPress = useCallback(() => {
    if (songs.length > 0) {
      player.setQueueAndPlay(songs, 0, false);
    }
  }, [player, songs]);

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
          <Text style={styles.songAlbum} numberOfLines={1}>
            {item.album?.name || 'Unknown Album'}
          </Text>
          <Text style={styles.songDuration}>{formatDuration(item.duration)}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.songOptions}>
        <Ionicons name="ellipsis-vertical" size={20} color="#9ca3af" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderAlbumItem = ({ item }: { item: Album }) => (
    <TouchableOpacity style={styles.albumItem} onPress={() => handleAlbumPress(item)}>
      <View style={styles.albumCover}>
        {item.cover ? (
          <Image source={{ uri: item.cover }} style={styles.albumCoverImage} />
        ) : (
          <Ionicons name="albums" size={40} color="#9ca3af" />
        )}
      </View>
      <Text style={styles.albumTitle} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.albumYear}>{item.year || 'Unknown'}</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading artist...</Text>
      </View>
    );
  }

  // Calculate total duration
  const totalDuration = songs.reduce((sum, song) => sum + song.duration, 0);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Artist
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
        {/* Artist Header */}
        <View style={styles.artistHeader}>
          <View style={styles.artistAvatar}>
            <Ionicons name="person" size={80} color="#9ca3af" />
          </View>
          <View style={styles.artistInfo}>
            <Text style={styles.artistName}>{artistName}</Text>
            <View style={styles.artistStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{songs.length}</Text>
                <Text style={styles.statLabel}>Songs</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{albums.length}</Text>
                <Text style={styles.statLabel}>Albums</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatDuration(totalDuration)}</Text>
                <Text style={styles.statLabel}>Total Time</Text>
              </View>
            </View>
            <View style={styles.artistActions}>
              <TouchableOpacity
                style={[styles.artistAction, styles.playAllButton]}
                onPress={handlePlayAllPress}
              >
                <Ionicons name="play" size={18} color="#1a1a2e" />
                <Text style={styles.playAllButtonText}>Play All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.artistAction, styles.shuffleButton]}
                onPress={handleShufflePress}
              >
                <Ionicons name="shuffle" size={18} color="#fff" />
                <Text style={styles.shuffleButtonText}>Shuffle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Popular Songs */}
        {songs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Popular Songs</Text>
            <FlatList
              data={songs.slice(0, 10)}
              renderItem={renderSongItem}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.songsList}
            />
          </View>
        )}

        {/* Albums */}
        {albums.length > 0 && (
          <View style={[styles.section, styles.lastSection]}>
            <Text style={styles.sectionTitle}>Albums</Text>
            <FlatList
              data={albums}
              renderItem={renderAlbumItem}
              keyExtractor={item => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.albumsList}
            />
          </View>
        )}

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
  artistHeader: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  artistAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
  artistInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  artistName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  artistStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statLabel: {
    color: '#9ca3af',
    fontSize: 12,
  },
  artistActions: {
    flexDirection: 'row',
    gap: 10,
  },
  artistAction: {
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
  section: {
    marginBottom: 30,
  },
  lastSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
  },
  songsList: {
    paddingBottom: 10,
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
  songAlbum: {
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
  albumsList: {
    gap: 15,
  },
  albumItem: {
    alignItems: 'center',
    marginRight: 15,
  },
  albumCover: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#4b5563',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  albumCoverImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  albumTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    width: 120,
  },
  albumYear: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    width: 120,
    marginTop: 2,
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
  bottomSpacer: {
    height: 40,
  },
});

export default ArtistDetailScreen;
