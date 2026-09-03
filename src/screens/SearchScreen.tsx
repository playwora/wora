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
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { searchSongs, getAlbums, getPlaylists } from '../database';
import { Song, Album, Playlist } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

type SearchScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Search'>;
};

const SearchScreen: React.FC<SearchScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const player = usePlayer();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({
    songs: [] as Song[],
    albums: [] as Album[],
    playlists: [] as Playlist[],
  });
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults({ songs: [], albums: [], playlists: [] });
        return;
      }

      setIsSearching(true);

      try {
        // Search songs
        const songs = await searchSongs(searchQuery);

        // Search albums
        const allAlbums = await getAlbums(1, 50);
        const filteredAlbums = allAlbums.filter(
          album =>
            album.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            album.artist.toLowerCase().includes(searchQuery.toLowerCase())
        );

        // Search playlists
        const allPlaylists = await getPlaylists();
        const filteredPlaylists = allPlaylists.filter(
          playlist =>
            playlist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            playlist.description.toLowerCase().includes(searchQuery.toLowerCase())
        );

        setSearchResults({
          songs,
          albums: filteredAlbums,
          playlists: filteredPlaylists,
        });
      } catch (error) {
        console.error('Error performing search:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleSongPress = useCallback((song: Song) => {
    player.setQueueAndPlay([song]);
  }, [player]);

  const handleAlbumPress = useCallback((album: Album) => {
    navigation.navigate('AlbumDetail', { albumId: album.id });
  }, [navigation]);

  const handlePlaylistPress = useCallback((playlist: Playlist) => {
    navigation.navigate('PlaylistDetail', { playlistId: playlist.id });
  }, [navigation]);

  const renderSongItem = ({ item }: { item: Song }) => (
    <TouchableOpacity style={styles.resultItem} onPress={() => handleSongPress(item)}>
      <Ionicons name="musical-note" size={20} color="#6366f1" />
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.resultSubtitle} numberOfLines={1}>
          Song • {item.artist}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderAlbumItem = ({ item }: { item: Album }) => (
    <TouchableOpacity style={styles.resultItem} onPress={() => handleAlbumPress(item)}>
      <Ionicons name="albums" size={20} color="#10b981" />
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.resultSubtitle} numberOfLines={1}>
          Album • {item.artist}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderPlaylistItem = ({ item }: { item: Playlist }) => (
    <TouchableOpacity style={styles.resultItem} onPress={() => handlePlaylistPress(item)}>
      <Ionicons name="list" size={20} color="#8b5cf6" />
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.resultSubtitle} numberOfLines={1}>
          Playlist • {item.songs?.length || 0} songs
        </Text>
      </View>
    </TouchableOpacity>
  );

  const hasResults = 
    searchResults.songs.length > 0 ||
    searchResults.albums.length > 0 ||
    searchResults.playlists.length > 0;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search songs, albums, playlists..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setSearchQuery('')}
              >
                <Ionicons name="close" size={20} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isSearching && searchQuery.length > 0 && (
          <View style={styles.loadingContainer}>
            <Ionicons name="sync" size={24} color="#6366f1" />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        )}

        {searchQuery.length > 0 && !isSearching && hasResults && (
          <>
            {/* Songs Results */}
            {searchResults.songs.length > 0 && (
              <View style={styles.resultsSection}>
                <Text style={styles.sectionTitle}>Songs</Text>
                <FlatList
                  data={searchResults.songs}
                  renderItem={renderSongItem}
                  keyExtractor={item => item.id.toString()}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}

            {/* Albums Results */}
            {searchResults.albums.length > 0 && (
              <View style={styles.resultsSection}>
                <Text style={styles.sectionTitle}>Albums</Text>
                <FlatList
                  data={searchResults.albums}
                  renderItem={renderAlbumItem}
                  keyExtractor={item => item.id.toString()}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}

            {/* Playlists Results */}
            {searchResults.playlists.length > 0 && (
              <View style={[styles.resultsSection, styles.lastSection]}>
                <Text style={styles.sectionTitle}>Playlists</Text>
                <FlatList
                  data={searchResults.playlists}
                  renderItem={renderPlaylistItem}
                  keyExtractor={item => item.id.toString()}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}
          </>
        )}

        {searchQuery.length > 0 && !isSearching && !hasResults && (
          <View style={styles.noResultsContainer}>
            <Ionicons name="search" size={60} color="#9ca3af" />
            <Text style={styles.noResultsText}>No results found</Text>
            <Text style={styles.noResultsSubtext}>
              Try a different search query
            </Text>
          </View>
        )}

        {searchQuery.length === 0 && !isSearching && (
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={60} color="#9ca3af" />
            <Text style={styles.emptyText}>Search your music</Text>
            <Text style={styles.emptySubtext}>
              Find songs, albums, and playlists
            </Text>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 44,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  clearButton: {
    padding: 5,
  },
  cancelButton: {
    padding: 10,
  },
  cancelButtonText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 10,
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  resultsSection: {
    marginBottom: 30,
  },
  lastSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#374151',
    borderRadius: 12,
    marginBottom: 10,
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  resultSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 2,
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  noResultsText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 15,
  },
  noResultsSubtext: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
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
  },
  bottomSpacer: {
    height: 40,
  },
});

export default SearchScreen;
