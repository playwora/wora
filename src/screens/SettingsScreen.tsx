import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getSettings, updateSettings } from '../database';
import { Settings } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
};

const SettingsScreen: React.FC<SettingsScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getSettings();
        setSettings(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading settings:', error);
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSaveSettings = useCallback(async (updates: Partial<Settings>) => {
    try {
      const updatedSettings = await updateSettings(updates);
      setSettings(updatedSettings);
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  }, []);

  const handleRescanLibrary = useCallback(async () => {
    Alert.alert(
      'Rescan Library',
      'This will rescan your music folder and update your library. This may take a few minutes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rescan',
          onPress: async () => {
            // In a real implementation, you would call the rescan function
            Alert.alert('Info', 'Library rescanning would start here');
          },
        },
      ]
    );
  }, []);

  const handleClearCache = useCallback(async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data including offline lyrics. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            // In a real implementation, you would clear the cache
            Alert.alert('Info', 'Cache cleared successfully');
          },
        },
      ]
    );
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading settings...</Text>
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
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              {settings?.profilePicture ? (
                <Image
                  source={{ uri: settings.profilePicture }}
                  style={styles.profileAvatarImage}
                />
              ) : (
                <Ionicons name="person" size={40} color="#9ca3af" />
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {settings?.name || 'User'}
              </Text>
              <Text style={styles.profileEmail}>
                {settings?.musicFolder ? 'Music folder configured' : 'No music folder selected'}
              </Text>
            </View>
          </View>
        </View>

        {/* Library Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Library</Text>
          <View style={styles.settingsItems}>
            <TouchableOpacity style={styles.settingsItem} onPress={handleRescanLibrary}>
              <View style={styles.settingsItemContent}>
                <Ionicons name="refresh" size={22} color="#6366f1" />
                <View style={styles.settingsItemText}>
                  <Text style={styles.settingsItemTitle}>Rescan Library</Text>
                  <Text style={styles.settingsItemSubtitle}>
                    Update your music library
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsItem} onPress={handleClearCache}>
              <View style={styles.settingsItemContent}>
                <Ionicons name="trash" size={22} color="#ef4444" />
                <View style={styles.settingsItemText}>
                  <Text style={styles.settingsItemTitle}>Clear Cache</Text>
                  <Text style={styles.settingsItemSubtitle}>
                    Free up storage space
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <View style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <Ionicons name="hard-drive" size={22} color="#10b981" />
                <View style={styles.settingsItemText}>
                  <Text style={styles.settingsItemTitle}>Storage Usage</Text>
                  <Text style={styles.settingsItemSubtitle}>
                    Cached data: 0 MB
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Playback Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Playback</Text>
          <View style={styles.settingsItems}>
            <View style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <Ionicons name="volume-high" size={22} color="#6366f1" />
                <View style={styles.settingsItemText}>
                  <Text style={styles.settingsItemTitle}>Audio Quality</Text>
                  <Text style={styles.settingsItemSubtitle}>Lossless</Text>
                </View>
              </View>
            </View>

            <View style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <Ionicons name="equalizer" size={22} color="#6366f1" />
                <View style={styles.settingsItemText}>
                  <Text style={styles.settingsItemTitle}>Equalizer</Text>
                  <Text style={styles.settingsItemSubtitle}>Customize sound</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>

            <View style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <Ionicons name="timer" size={22} color="#6366f1" />
                <View style={styles.settingsItemText}>
                  <Text style={styles.settingsItemTitle}>Sleep Timer</Text>
                  <Text style={styles.settingsItemSubtitle}>Set automatic stop time</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>
          </View>
        </View>

        {/* Last.fm Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last.fm</Text>
          <View style={styles.settingsItems}>
            <View style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <Ionicons name="logo-lastfm" size={22} color="#e21426" />
                <View style={styles.settingsItemText}>
                  <Text style={styles.settingsItemTitle}>Connect Last.fm</Text>
                  <Text style={styles.settingsItemSubtitle}>
                    {settings?.lastFmUsername
                      ? `Connected as ${settings.lastFmUsername}`
                      : 'Not connected'}
                  </Text>
                </View>
              </View>
              <Switch
                value={settings?.enableLastFm || false}
                onValueChange={(value) => {
                  handleSaveSettings({ enableLastFm: value });
                }}
                trackColor={{ false: '#4b5563', true: '#6366f1' }}
                thumbColor="#fff"
              />
            </View>

            <TouchableOpacity style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <Ionicons name="settings" size={22} color="#6366f1" />
                <View style={styles.settingsItemText}>
                  <Text style={styles.settingsItemTitle}>Scrobble Settings</Text>
                  <Text style={styles.settingsItemSubtitle}>
                    Threshold: {settings?.scrobbleThreshold || 50}%
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </View>

        {/* About Section */}
        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.settingsItems}>
            <View style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <Ionicons name="information-circle" size={22} color="#6366f1" />
                <View style={styles.settingsItemText}>
                  <Text style={styles.settingsItemTitle}>App Version</Text>
                  <Text style={styles.settingsItemSubtitle}>0.4.0-beta2</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <Ionicons name="open" size={22} color="#6366f1" />
                <View style={styles.settingsItemText}>
                  <Text style={styles.settingsItemTitle}>Open Source</Text>
                  <Text style={styles.settingsItemSubtitle}>
                    View source code on GitHub
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <Ionicons name="heart" size={22} color="#ef4444" />
                <View style={styles.settingsItemText}>
                  <Text style={styles.settingsItemTitle}>Support Project</Text>
                  <Text style={styles.settingsItemSubtitle}>
                    Help us improve Wora
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </View>

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
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#374151',
    borderRadius: 12,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4b5563',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  profileAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  profileEmail: {
    color: '#9ca3af',
    fontSize: 14,
  },
  settingsItems: {
    gap: 10,
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#374151',
    borderRadius: 12,
  },
  settingsItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingsItemText: {
    flex: 1,
  },
  settingsItemTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  settingsItemSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
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

export default SettingsScreen;
