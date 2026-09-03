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
import { getSongs, getAlbums, getAllArtists } from '../database';
import { Song, Album } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

type LibraryScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Library'>;
};

const LibraryScreen: React.FC<LibraryScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const player = usePlayer();
  const [activeTab, setActiveTab] = useState<'songs' | 'albums' | 'artists'>('songs');
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load songs
        const { songs: allSongs } = await getSongs(1, 50);
        setSongs(allSongs);

        // Load albums
        const allAlbums = await getAlbums(1, 50);
        setAlbums(allAlbums);

        // Load artists
        // Note: In a real implementation, you would have an artists table
        // For now, we'll extract unique artists from songs
        const artistSet = new Set<string>();
        allSongs.forEach(song => {
          if (song.artist) {
            artistSet.add(song.artist);
          }
        });
        setArtists(Array.from(artistSet).sort());

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading library data:', error);
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

  const handleArtistPress = useCallback((artist: string) => {
    navigation.navigate('ArtistDetail', { artistName: artist });
  }, [navigation]);

  const handleSearchPress = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  const renderSongItem = ({ item }: { item: Song }) => (
    <TouchableOpacity style={styles.songItem} onPress={() => handleSongPress(item)}>
      <View style={styles.songCover}>
        {item.album?.cover ? (
          <Image source={{ uri: item.album.cover }} style={styles.songCoverImage} />
        ) : (
          <Ionicons name="musical-note" size={24} color="#9ca3af" />
        )}
      </View>
      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.songArtist} numberOfLines={1}>{item.artist}</Text>
      </View>
      <Text style={styles.songDuration}>{formatDuration(item.duration)}</Text>
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

  const renderArtistItem = ({ item }: { item: string }) => (
    <TouchableOpacity style={styles.artistItem} onPress={() => handleArtistPress(item)}>
      <View style={styles.artistAvatar}>
        <Ionicons name="person" size={30} color="#9ca3af" />
      </View>
      <Text style={styles.artistName} numberOfLines={1}>{item}</Text>
    </TouchableOpacity>
  );

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '--:--';

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'songs':
        return (
          <FlatList
            data={songs}
            renderItem={renderSongItem}
            keyExtractor={item => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        );
      case 'albums':
        return (
          <FlatList
            data={albums}
            renderItem={renderAlbumItem}
            keyExtractor={item => item.id.toString()}
            numColumns={2}
            columnWrapperStyle={styles.albumGridRow}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        );
      case 'artists':
        return (
          <FlatList
            data={artists}
            renderItem={renderArtistItem}
            keyExtractor={(item, index) => `${item}-${index}`}
            numColumns={2}
            columnWrapperStyle={styles.artistGridRow}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading library...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Your Library</Text>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearchPress}>
            <Ionicons name="search" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'songs' && styles.activeTab]}
          onPress={() => setActiveTab('songs')}
        >
          <Ionicons name="musical-notes" size={20} color={activeTab === 'songs' ? '#6366f1' : '#9ca3af'} />
          <Text style={[styles.tabText, activeTab === 'songs' && styles.activeTabText]}>
            Songs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'albums' && styles.activeTab]}
          onPress={() => setActiveTab('albums')}
        >
          <Ionicons name="albums" size={20} color={activeTab === 'albums' ? '#6366f1' : '#9ca3af'} />
          <Text style={[styles.tabText, activeTab === 'albums' && styles.activeTabText]}>
            Albums
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'artists' && styles.activeTab]}
          onPress={() => setActiveTab('artists')}
        >
          <Ionicons name="people" size={20} color={activeTab === 'artists' ? '#6366f1' : '#9ca3af'} />
          <Text style={[styles.tabText, activeTab === 'artists' && styles.activeTabText]}>
            Artists
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    backgroundColor: '#374151',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
  },
  tabText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#6366f1',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingTop: 15,
    paddingBottom: 40,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#374151',
    borderRadius: 12,
    marginBottom: 10,
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
  songDuration: {
    color: '#9ca3af',
    fontSize: 14,
  },
  albumItem: {
    flex: 1,
    margin: 5,
  },
  albumGridRow: {
    justifyContent: 'space-between',
  },
  albumCover: {
    width: (screenWidth - 50) / 2,
    height: (screenWidth - 50) / 2,
    borderRadius: 12,
    backgroundColor: '#4b5563',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  albumCoverImage: {
    width: (screenWidth - 50) / 2,
    height: (screenWidth - 50) / 2,
    borderRadius: 12,
  },
  albumTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  albumArtist: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  artistItem: {
    flex: 1,
    margin: 5,
  },
  artistGridRow: {
    justifyContent: 'space-between',
  },
  artistAvatar: {
    width: (screenWidth - 50) / 2,
    height: (screenWidth - 50) / 2,
    borderRadius: (screenWidth - 50) / 4,
    backgroundColor: '#4b5563',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  artistName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
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
});

export default LibraryScreen;
