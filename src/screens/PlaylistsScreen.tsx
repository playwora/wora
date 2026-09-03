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
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { getPlaylists, createPlaylist } from '../database';
import { Playlist } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

type PlaylistsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Playlists'>;
};

const PlaylistsScreen: React.FC<PlaylistsScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const player = usePlayer();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('');

  useEffect(() => {
    const loadPlaylists = async () => {
      try {
        const data = await getPlaylists();
        setPlaylists(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading playlists:', error);
        setIsLoading(false);
      }
    };

    loadPlaylists();
  }, []);

  const handlePlaylistPress = useCallback((playlist: Playlist) => {
    navigation.navigate('PlaylistDetail', { playlistId: playlist.id });
  }, [navigation]);

  const handleCreatePlaylist = useCallback(async () => {
    if (!newPlaylistName.trim()) {
      Alert.alert('Error', 'Please enter a playlist name');
      return;
    }

    try {
      const playlist = await createPlaylist({
        name: newPlaylistName.trim(),
        description: newPlaylistDescription.trim() || 'Created with Wora',
        cover: 'logo',
      });

      setPlaylists(prev => [...prev, playlist]);
      setShowCreateModal(false);
      setNewPlaylistName('');
      setNewPlaylistDescription('');

      // Navigate to the new playlist
      navigation.navigate('PlaylistDetail', { playlistId: playlist.id });
    } catch (error) {
      console.error('Error creating playlist:', error);
      Alert.alert('Error', 'Failed to create playlist');
    }
  }, [navigation, newPlaylistName, newPlaylistDescription]);

  const handlePlayPlaylist = useCallback((playlist: Playlist) => {
    // Play the first song in the playlist
    if (playlist.songs && playlist.songs.length > 0) {
      player.setQueueAndPlay(playlist.songs, 0);
    }
  }, [player]);

  const renderPlaylistItem = ({ item }: { item: Playlist }) => (
    <TouchableOpacity
      style={styles.playlistItem}
      onPress={() => handlePlaylistPress(item)}
    >
      <View style={styles.playlistCover}>
        {item.cover && item.cover !== 'logo' ? (
          <Image source={{ uri: item.cover }} style={styles.playlistCoverImage} />
        ) : (
          <Ionicons name="list" size={30} color="#9ca3af" />
        )}
      </View>
      <View style={styles.playlistInfo}>
        <Text style={styles.playlistName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.playlistDescription} numberOfLines={1}>
          {item.description}
        </Text>
        <View style={styles.playlistMeta}>
          <Text style={styles.playlistMetaText}>
            {item.songs?.length || 0} songs
          </Text>
          <TouchableOpacity
            style={styles.playButton}
            onPress={(e) => {
              e.stopPropagation();
              handlePlayPlaylist(item);
            }}
          >
            <Ionicons name="play" size={16} color="#1a1a2e" />
            <Text style={styles.playButtonText}>Play</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading playlists...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Your Playlists</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color="#1a1a2e" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {playlists.length > 0 ? (
          <FlatList
            data={playlists}
            renderItem={renderPlaylistItem}
            keyExtractor={item => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="list" size={60} color="#9ca3af" />
            <Text style={styles.emptyText}>No playlists yet</Text>
            <Text style={styles.emptySubtext}>
              Create your first playlist to get started
            </Text>
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createFirstButtonText}>Create Playlist</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Playlist</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Playlist Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="musical-notes" size={20} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter playlist name"
                  placeholderTextColor="#9ca3af"
                  value={newPlaylistName}
                  onChangeText={setNewPlaylistName}
                  autoCapitalize="sentences"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="text" size={20} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter playlist description"
                  placeholderTextColor="#9ca3af"
                  value={newPlaylistDescription}
                  onChangeText={setNewPlaylistDescription}
                  autoCapitalize="sentences"
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton]}
                onPress={handleCreatePlaylist}
              >
                <Text style={styles.createButtonText}>Create</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingTop: 15,
    paddingBottom: 40,
  },
  playlistItem: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#374151',
    borderRadius: 12,
    marginBottom: 15,
  },
  playlistCover: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#4b5563',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  playlistCoverImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  playlistInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  playlistName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  playlistDescription: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 5,
  },
  playlistMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playlistMetaText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    gap: 5,
  },
  playButtonText: {
    color: '#1a1a2e',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
    gap: 10,
  },
  createFirstButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    color: '#d1d5db',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4b5563',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
    marginTop: 20,
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
  createButton: {
    backgroundColor: '#10b981',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PlaylistsScreen;
