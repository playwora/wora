import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { getSongById } from '../database';
import { Song } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

type SongDetailScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SongDetail'>;
  route: RouteProp<RootStackParamList, 'SongDetail'>;
};

const SongDetailScreen: React.FC<SongDetailScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SongDetail'>>();
  const { songId } = route.params;
  const player = usePlayer();

  const [song, setSong] = useState<Song | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSong = async () => {
      try {
        const data = await getSongById(songId);
        setSong(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading song:', error);
        setIsLoading(false);
      }
    };

    loadSong();
  }, [songId]);

  const handlePlayPress = useCallback(() => {
    if (song) {
      player.setQueueAndPlay([song]);
    }
  }, [player, song]);

  const handleAddToQueue = useCallback(() => {
    if (song) {
      player.addToQueue(song);
      navigation.goBack();
    }
  }, [navigation, player, song]);

  const handleViewLyrics = useCallback(() => {
    if (song) {
      navigation.navigate('Lyrics', {
        songId: song.id,
        playlistId: undefined,
      });
    }
  }, [navigation, song]);

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

  const getFileExtension = (filePath: string): string => {
    return filePath.split('.').pop()?.toUpperCase() || 'Unknown';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading song...</Text>
      </View>
    );
  }

  if (!song) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={60} color="#9ca3af" />
        <Text style={styles.errorText}>Song not found</Text>
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
            Song Details
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Song Cover */}
        <View style={styles.songCoverContainer}>
          <View style={styles.songCover}>
            {song.album?.cover ? (
              <Image source={{ uri: song.album.cover }} style={styles.songCoverImage} />
            ) : (
              <Ionicons name="musical-note" size={screenWidth * 0.6} color="#9ca3af" />
            )}
          </View>
        </View>

        {/* Song Info */}
        <View style={styles.songInfoContainer}>
          <Text style={styles.songTitle}>{song.name}</Text>
          <Text style={styles.songArtist}>{song.artist}</Text>
          <Text style={styles.songAlbum}>
            {song.album?.name || 'Unknown Album'} • {song.album?.artist || 'Unknown Artist'}
          </Text>
        </View>

        {/* Player Controls */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[styles.controlButton, styles.playButton]}
            onPress={handlePlayPress}
          >
            <Ionicons name="play" size={24} color="#1a1a2e" />
            <Text style={styles.playButtonText}>Play</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, styles.queueButton]}
            onPress={handleAddToQueue}
          >
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.queueButtonText}>Add to Queue</Text>
          </TouchableOpacity>
        </View>

        {/* Song Details */}
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>Details</Text>
          <View style={styles.detailsItems}>
            <View style={styles.detailItem}>
              <Ionicons name="time" size={20} color="#6366f1" />
              <View style={styles.detailItemText}>
                <Text style={styles.detailItemLabel}>Duration</Text>
                <Text style={styles.detailItemValue}>
                  {formatDuration(song.duration)}
                </Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="file-tray" size={20} color="#10b981" />
              <View style={styles.detailItemText}>
                <Text style={styles.detailItemLabel}>Format</Text>
                <Text style={styles.detailItemValue}>
                  {getFileExtension(song.filePath)}
                </Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="hard-drive" size={20} color="#8b5cf6" />
              <View style={styles.detailItemText}>
                <Text style={styles.detailItemLabel}>File Size</Text>
                <Text style={styles.detailItemValue}>Unknown</Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="folder" size={20} color="#f59e0b" />
              <View style={styles.detailItemText}>
                <Text style={styles.detailItemLabel}>File Path</Text>
                <Text style={[styles.detailItemValue, styles.pathValue]} numberOfLines={1}>
                  {song.filePath}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Lyrics */}
        <TouchableOpacity style={styles.lyricsButton} onPress={handleViewLyrics}>
          <Ionicons name="text" size={20} color="#6366f1" />
          <View style={styles.lyricsButtonText}>
            <Text style={styles.lyricsButtonTitle}>View Lyrics</Text>
            <Text style={styles.lyricsButtonSubtitle}>
              See synchronized lyrics for this song
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
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
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  songCoverContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  songCover: {
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
  songCoverImage: {
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
    marginBottom: 5,
  },
  songArtist: {
    color: '#d1d5db',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 5,
  },
  songAlbum: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 40,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  playButton: {
    backgroundColor: '#fff',
  },
  playButtonText: {
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: '600',
  },
  queueButton: {
    backgroundColor: '#6366f1',
  },
  queueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  detailsContainer: {
    marginBottom: 30,
  },
  detailsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  detailsItems: {
    gap: 15,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#374151',
    borderRadius: 12,
    gap: 12,
  },
  detailItemText: {
    flex: 1,
  },
  detailItemLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  detailItemValue: {
    color: '#d1d5db',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  pathValue: {
    fontSize: 12,
  },
  lyricsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    borderColor: '#6366f1',
    borderWidth: 1,
    gap: 12,
  },
  lyricsButtonText: {
    flex: 1,
  },
  lyricsButtonTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  lyricsButtonSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
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

export default SongDetailScreen;
