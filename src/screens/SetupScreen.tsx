import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { updateSettings, getSettings } from '../database';
import { requestStoragePermission, initializeLibrary } from '../lib/scanner';
import { Ionicons } from '@expo/vector-icons';

type SetupScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Setup'>;
};

const SetupScreen: React.FC<SetupScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [name, setName] = useState('');
  const [musicFolder, setMusicFolder] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkSettings = async () => {
      const settings = await getSettings();
      if (settings?.musicFolder) {
        navigation.replace('Home');
      }
    };
    checkSettings();
  }, []);

  const handleSelectFolder = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'Wora needs access to your storage to read music files',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          const result = await DocumentPicker.getDocumentAsync({
            type: 'application/*',
            copyToCacheDirectory: false,
          });

          if (!result.canceled && result.assets && result.assets.length > 0) {
            const folderPath = result.assets[0].uri;
            const folderName = folderPath.split('/').pop() || 'Music';
            setMusicFolder(folderName);
            setName(folderName);
          }
        }
      } catch (error) {
        console.error('Error picking folder:', error);
      }
    } else {
      // For iOS, use document directory
      setMusicFolder(FileSystem.documentDirectory);
    }
  };

  const handleContinue = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (!musicFolder.trim()) {
      Alert.alert('Error', 'Please select a music folder');
      return;
    }

    setIsLoading(true);

    try {
      // Save settings
      await updateSettings({
        name,
        musicFolder,
      });

      // Initialize library
      await initializeLibrary(musicFolder);

      // Navigate to home
      navigation.replace('Home');
    } catch (error) {
      console.error('Error setting up:', error);
      Alert.alert('Error', 'Failed to initialize library. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    try {
      await updateSettings({
        name: 'User',
        musicFolder: FileSystem.documentDirectory,
      });
      navigation.replace('Home');
    } catch (error) {
      console.error('Error skipping setup:', error);
      Alert.alert('Error', 'Failed to skip setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="musical-notes" size={60} color="#6366f1" />
        <Text style={styles.title}>Wora</Text>
        <Text style={styles.subtitle}>Mobile Music Player</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Your Name</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Music Folder</Text>
          <TouchableOpacity style={styles.inputContainer} onPress={handleSelectFolder}>
            <Ionicons name="folder" size={20} color="#9ca3af" style={styles.inputIcon} />
            <Text style={[styles.input, musicFolder ? styles.inputWithValue : styles.placeholderText]}>
              {musicFolder || 'Select music folder'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={isLoading}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.continueButton, isLoading && styles.disabledButton]}
          onPress={handleContinue}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ActivityIndicator fallback for React Native
const ActivityIndicator = ({ color }: { color: string }) => (
  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: color, borderTopColor: 'transparent', justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 20,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 15,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 5,
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 25,
  },
  label: {
    fontSize: 14,
    color: '#d1d5db',
    marginBottom: 8,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  inputWithValue: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  placeholderText: {
    flex: 1,
    color: '#9ca3af',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
  },
  skipButton: {
    padding: 12,
  },
  skipButtonText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  continueButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingHorizontal: 30,
    paddingVertical: 15,
    minWidth: 150,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SetupScreen;
