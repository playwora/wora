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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { getLibraryStats, getSongs, getAlbums, getPlaylists, getFavorites } from '../database';
import { Song, Album, Playlist, LibraryStats } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

const HomeScreen: React.FC<HomeScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const player = usePlayer();
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);
  const [recentAlbums, setRecentAlbums] = useState<Album[]>([]);
  const [favoriteSongs, setFavoriteSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load library statistics
        const libraryStats = await getLibraryStats();
        setStats(libraryStats);

        // Load recent songs
        const { songs } = await getSongs(1, 10);
        setRecentSongs(songs.slice(0, 5));

        // Load recent albums
        const albums = await getAlbums(1, 10);
        setRecentAlbums(albums.slice(0, 5));

        // Load favorite songs
        const favorites = await getFavorites();
        setFavoriteSongs(favorites.slice(0, 5));

        // Load playlists
        const allPlaylists = await getPlaylists();
        setPlaylists(allPlaylists.slice(0, 5));

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading home data:', error);
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSongPress = useCallback((song: Song) => {
    player.setQueueAndPlay([song]);
  }, [player]);

  const handleAlbumPress = useCallback((album: Album) => {
    navigation.navigate('AlbumDetail', { albumId: album.id });
  }, [navigation]);

  const handlePlaylistPress = useCallback((playlist: Playlist) => {
    navigation.navigate('PlaylistDetail', { playlistId: playlist.id });
  }, [navigation]);

  const handleSearchPress = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  const handleNowPlayingPress = useCallback(() => {
    navigation.navigate('NowPlaying');
  }, [navigation]);

  const renderStatCard = (label: string, value: string | number, icon: string) => (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={24} color="#6366f1" />
      <View style={styles.statCardContent}>
        <Text style={styles.statCardValue}>{value}</Text>
        <Text style={styles.statCardLabel}>{label}</Text>
      </View>
    </View>
  );

  const renderSongItem = ({ item }: { item: Song }) => (
    <TouchableOpacity style={styles.songItem} onPress={() => handleSongPress(item)}>
      <View style={styles.songCover}>
        {item.album?.cover ? (
          <Image source={{ uri: item.album.cover }} style={styles.songCoverImage} />
        ) : (
          <Ionicons name="musical-note" size={30} color="#9ca3af" />
        )}
      </View>
      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.songArtist} numberOfLines={1}>{item.artist}</Text>
      </View>
      <Ionicons name="play" size={20} color="#9ca3af" />
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
      <Text style={styles.albumArtist} numberOfLines={1}>{item.artist}</Text>
    </TouchableOpacity>
  );

  const renderPlaylistItem = ({ item }: { item: Playlist }) => (
    <TouchableOpacity style={styles.playlistItem} onPress={() => handlePlaylistPress(item)}>
      <View style={styles.playlistCover}>
        {item.cover && item.cover !== 'logo' ? (
          <Image source={{ uri: item.cover }} style={styles.playlistCoverImage} />
        ) : (
          <Ionicons name="list" size={30} color="#9ca3af" />
        )}
      </View>
      <Text style={styles.playlistTitle} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.playlistCount}>{item.songs?.length || 0} songs</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.headerTitle}>Discover your music</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.searchButton} onPress={handleSearchPress}>
              <Ionicons name="search" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        {stats && (
          <View style={styles.statsContainer}>
            {renderStatCard('Songs', stats.totalSongs, 'musical-note')}
            {renderStatCard('Albums', stats.totalAlbums, 'albums')}
            {renderStatCard('Artists', stats.totalArtists, 'people')}
            {renderStatCard('Playlists', stats.totalPlaylists, 'list')}
          </View>
        )}

        {/* Now Playing */}
        {player.song && (
          <TouchableOpacity style={styles.nowPlayingCard} onPress={handleNowPlayingPress}>
            <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.nowPlayingGradient}>
              <View style={styles.nowPlayingContent}>
                <Ionicons name="play" size={24} color="#fff" />
                <View style={styles.nowPlayingInfo}>
                  <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                    {player.song.name}
                  </Text>
                  <Text style={styles.nowPlayingArtist} numberOfLines={1}>
                    {player.song.artist}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Recent Songs */}
        {recentSongs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Songs</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Library')}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={recentSongs}
              renderItem={renderSongItem}
              keyExtractor={item => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sectionContent}
            />
          </View>
        )}

        {/* Recent Albums */}
        {recentAlbums.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Albums</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Library')}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={recentAlbums}
              renderItem={renderAlbumItem}
              keyExtractor={item => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sectionContent}
            />
          </View>
        )}

        {/* Favorite Songs */}
        {favoriteSongs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Favorites</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Library')}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={favoriteSongs}
              renderItem={renderSongItem}
              keyExtractor={item => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sectionContent}
            />
          </View>
        )}

        {/* Playlists */}
        {playlists.length > 0 && (
          <View style={[styles.section, styles.lastSection]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Playlists</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Playlists')}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={playlists}
              renderItem={renderPlaylistItem}
              keyExtractor={item => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sectionContent}
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
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    color: '#9ca3af',
    fontSize: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 15,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 5,
    padding: 15,
    backgroundColor: '#374151',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCardContent: {
    marginLeft: 10,
  },
  statCardValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statCardLabel: {
    color: '#9ca3af',
    fontSize: 12,
  },
  nowPlayingCard: {
    marginBottom: 30,
  },
  nowPlayingGradient: {
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nowPlayingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  nowPlayingInfo: {
    marginLeft: 15,
  },
  nowPlayingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  nowPlayingArtist: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  section: {
    marginBottom: 30,
  },
  lastSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  seeAllText: {
    color: '#6366f1',
    fontSize: 14,
  },
  sectionContent: {
    gap: 15,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 12,
    minWidth: screenWidth - 100,
  },
  songCover: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#4b5563',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  songCoverImage: {
    width: 44,
    height: 44,
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
  albumArtist: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    width: 120,
  },
  playlistItem: {
    alignItems: 'center',
    marginRight: 15,
  },
  playlistCover: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#4b5563',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  playlistCoverImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  playlistTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    width: 120,
  },
  playlistCount: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    width: 120,
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

export default HomeScreen;
