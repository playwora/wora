import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PlayerProvider } from './src/context/PlayerContext';
import { initDatabase } from './src/database';
import { RootStackParamList, BottomTabParamList } from './src/types';
import HomeScreen from './src/screens/HomeScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import PlaylistsScreen from './src/screens/PlaylistsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AlbumDetailScreen from './src/screens/AlbumDetailScreen';
import ArtistDetailScreen from './src/screens/ArtistDetailScreen';
import PlaylistDetailScreen from './src/screens/PlaylistDetailScreen';
import SongDetailScreen from './src/screens/SongDetailScreen';
import SetupScreen from './src/screens/SetupScreen';
import SearchScreen from './src/screens/SearchScreen';
import NowPlayingScreen from './src/screens/NowPlayingScreen';
import LyricsScreen from './src/screens/LyricsScreen';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';

// Initialize database on app start
initDatabase().catch(error => {
  console.error('Failed to initialize database:', error);
});

const Tab = createBottomTabNavigator<BottomTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Tab bar icon component
const TabBarIcon = ({ routeName, focused, color, size }: {
  routeName: string;
  focused: boolean;
  color: string;
  size: number;
}) => {
  let iconName;

  switch (routeName) {
    case 'Home':
      iconName = focused ? 'home' : 'home-outline';
      break;
    case 'Library':
      iconName = focused ? 'library' : 'library-outline';
      break;
    case 'Playlists':
      iconName = focused ? 'list' : 'list-outline';
      break;
    case 'Settings':
      iconName = focused ? 'settings' : 'settings-outline';
      break;
    default:
      iconName = 'help';
  }

  return <Ionicons name={iconName as any} size={size} color={color} />;
};

// Main tab navigator
const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => (
        <TabBarIcon routeName={route.name} focused={focused} color={color} size={size} />
      ),
      tabBarActiveTintColor: '#6366f1',
      tabBarInactiveTintColor: '#9ca3af',
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.tabBarLabel,
      headerShown: false,
      lazy: true,
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Library" component={LibraryScreen} />
    <Tab.Screen name="Playlists" component={PlaylistsScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);

// Root stack navigator
const RootStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: Platform.OS === 'android' ? 'fade' : 'default',
      contentStyle: { backgroundColor: '#1a1a2e' },
    }}
  >
    <Stack.Screen name="Setup" component={SetupScreen} />
    <Stack.Screen name="Home" component={MainTabs} />
    <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} />
    <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} />
    <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
    <Stack.Screen name="SongDetail" component={SongDetailScreen} />
    <Stack.Screen name="Search" component={SearchScreen} />
    <Stack.Screen name="NowPlaying" component={NowPlayingScreen} />
    <Stack.Screen name="Lyrics" component={LyricsScreen} />
  </Stack.Navigator>
);

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <PlayerProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <View style={styles.appContainer}>
              <RootStack />
            </View>
          </NavigationContainer>
        </PlayerProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  tabBar: {
    backgroundColor: '#1a1a2e',
    borderTopWidth: 0,
    paddingBottom: Platform.OS === 'android' ? 5 : 0,
    height: Platform.OS === 'android' ? 60 : 80,
  },
  tabBarLabel: {
    fontSize: 12,
    paddingBottom: 5,
  },
});
