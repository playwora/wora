# Wora Mobile - Android Music Player

A beautiful mobile music player for audiophiles with offline lyrics support. This is the mobile version of [Wora Desktop](https://github.com/playwora/wora), built with React Native and Expo.

## Features

- **Music Library**: Organize and browse your music collection
- **Playlists**: Create and manage custom playlists
- **Lyrics**: View synchronized and unsynced lyrics
- **Offline Lyrics**: Cache lyrics for offline viewing
- **Album Art**: Display album covers from your music files
- **Search**: Find songs, albums, and playlists quickly
- **Playback Controls**: Play, pause, skip, shuffle, repeat
- **Now Playing**: Full-screen player with progress bar
- **Dark Theme**: Beautiful dark UI optimized for mobile

## Screens

- **Home**: Overview with recent songs, albums, and playlists
- **Library**: Browse songs, albums, and artists
- **Playlists**: View and manage your playlists
- **Settings**: Configure app preferences
- **Album Detail**: View album information and tracks
- **Artist Detail**: View artist information, songs, and albums
- **Playlist Detail**: View and manage playlist songs
- **Now Playing**: Full-screen player with lyrics
- **Lyrics**: View and cache lyrics for offline use
- **Search**: Find music in your library
- **Setup**: Initial configuration

## Requirements

- Node.js 18+
- Yarn or npm
- Expo CLI
- Android Studio (for Android development)
- Java Development Kit (JDK) 11+

## Installation

1. Clone the repository:
```bash
git clone https://github.com/playwora/wora.git
cd wora-mobile
```

2. Install dependencies:
```bash
yarn install
# or
npm install
```

3. Start the development server:
```bash
yarn start
# or
npm start
```

4. Run on Android:
```bash
yarn android
# or
npm run android
```

## Building APK

To build a production APK for Android 16+ (API level 23+):

1. Install Expo CLI globally:
```bash
npm install -g expo-cli
```

2. Prebuild the project:
```bash
expo prebuild --platform android
```

3. Build the APK:
```bash
cd android
./gradlew assembleDebug
```

The APK will be generated in `android/app/build/outputs/apk/debug/`.

For a release build:
```bash
cd android
./gradlew assembleRelease
```

## Android Configuration

The app is configured to support Android 16+ (API level 23). The `app.json` and `app.json` files include the necessary permissions:

- `READ_EXTERNAL_STORAGE`: Read music files
- `WRITE_EXTERNAL_STORAGE`: Write app data
- `READ_MEDIA_AUDIO`: Access audio files
- `MANAGE_EXTERNAL_STORAGE`: Manage storage (optional)

## Project Structure

```
wora-mobile/
├── App.tsx                    # Main app component
├── src/
│   ├── context/               # React context providers
│   │   └── PlayerContext.tsx  # Player state and controls
│   ├── database/              # SQLite database operations
│   │   ├── index.ts           # Database functions
│   │   └── schema.ts          # Database schema
│   ├── lib/                   # Utility functions
│   │   ├── lyrics.ts          # Lyrics fetching and caching
│   │   └── scanner.ts         # Music library scanner
│   ├── screens/               # App screens
│   │   ├── AlbumDetailScreen.tsx
│   │   ├── ArtistDetailScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── LibraryScreen.tsx
│   │   ├── LyricsScreen.tsx
│   │   ├── NowPlayingScreen.tsx
│   │   ├── PlaylistDetailScreen.tsx
│   │   ├── PlaylistsScreen.tsx
│   │   ├── SearchScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   ├── SongDetailScreen.tsx
│   │   └── SetupScreen.tsx
│   ├── types/                 # TypeScript type definitions
│   │   └── index.ts
│   └── utils/                 # Utility components and hooks
├── assets/                    # Static assets (icons, splash screen)
├── package.json               # Project dependencies
├── app.json                   # Expo configuration
└── tsconfig.json              # TypeScript configuration
```

## Key Features Implementation

### 1. Music Folder System

The app uses the same music folder system as the desktop version. Users can select a folder during setup, and the app will scan for audio files recursively.

Supported audio formats:
- MP3, MPEG, OPUS, OGG, OGA, WAV, AAC, CAF
- M4A, M4B, MP4, WEBA, WEBM, DOLBY, FLAC

### 2. Lyrics System

- **Online Fetching**: Fetches lyrics from LRCLIB API
- **Synced Lyrics**: Supports synchronized lyrics with timestamps
- **Offline Caching**: Cache lyrics for playlists to view offline
- **Playlist Lyrics**: Cache entire playlist lyrics at once

### 3. Database

Uses SQLite via `expo-sqlite` with the following tables:
- `settings`: App configuration
- `albums`: Album information
- `songs`: Song metadata
- `playlists`: Playlist information
- `playlistSongs`: Playlist-song relationships
- `playlistLyricsCache`: Cached lyrics for offline viewing
- `favorites`: User's favorite songs

### 4. Audio Playback

Uses `expo-av` for audio playback with:
- Play/pause controls
- Seek functionality
- Progress tracking
- Playback status updates

## Offline Lyrics Feature

The app includes a feature to cache lyrics for entire playlists:

1. When viewing a playlist, tap the "Cache Lyrics" button
2. The app will fetch and cache lyrics for all songs in the playlist
3. Lyrics can then be viewed offline
4. Cached lyrics are stored in the `playlistLyricsCache` table
5. Users can clear the cache when needed

## Customization

The app uses a consistent dark theme with the following color palette:
- Background: `#1a1a2e` (dark blue)
- Cards: `#374151` (lighter blue)
- Accent: `#6366f1` (indigo)
- Text: `#fff` (white), `#d1d5db` (light gray), `#9ca3af` (gray)

## Troubleshooting

### Android Permissions

If the app can't access music files:
1. Ensure storage permissions are granted
2. On Android 11+, you may need to grant "Manage all files" permission
3. The app will prompt for permissions on first launch

### Database Issues

If the library doesn't load:
1. Clear app data and restart
2. Check that the music folder path is correct
3. Verify that audio files exist in the selected folder

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - Same as the desktop version.

## Credits

- Original desktop app: [Wora by Aaryan Kapoor](https://github.com/playwora/wora)
- Mobile port: Built with Expo and React Native
- Icons: Ionicons from Ionic Framework
