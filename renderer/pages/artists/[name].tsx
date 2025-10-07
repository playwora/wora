import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import {
  IconCircleFilled,
  IconPlayerPlay,
  IconArrowsShuffle2,
  IconExternalLink,
  IconUsers,
  IconUser,
  IconMusic,
  IconInfoCircle,
  IconCheck,
} from "@tabler/icons-react";
import { usePlayer } from "@/context/playerContext";
import Songs from "@/components/ui/songs";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";

type Album = {
  id: number;
  name: string;
  artist: string;
  year: number;
  cover: string;
  songs: any[];
};

type Artist = {
  name: string;
  albums: Album[];
  albumsWithSongs: Album[];
  songs: any[];
  stats?: {
    totalSongs: number;
    totalAlbums: number;
    totalDuration: number;
    genres: string[];
    formats: string[];
    yearRange: { start: number; end: number } | null;
    topSongs: Array<{
      id: number;
      name: string;
      duration: number;
      album: string;
    }>;
  };
};

type ArtistInfo = {
  name: string;
  mbid?: string;
  url?: string;
  image?: Array<{ "#text": string; size: string }>;
  bio?: {
    summary: string;
    content: string;
  };
  stats?: {
    listeners: string;
    playcount: string;
  };
  similar?: {
    artist: Array<{
      name: string;
      url: string;
      image?: Array<{ "#text": string; size: string }>;
    }>;
  };
};

type TopTrack = {
  name: string;
  playcount: string;
  listeners: string;
  artist: {
    name: string;
  };
};

export default function ArtistView() {
  const router = useRouter();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [artistInfo, setArtistInfo] = useState<ArtistInfo | null>(null);
  const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
  const [similarArtists, setSimilarArtists] = useState<any[]>([]);
  const [libraryArtists, setLibraryArtists] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [infoLoading, setInfoLoading] = useState(true);
  const { setQueueAndPlay, song } = usePlayer();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
      if (history.scrollRestoration) {
        history.scrollRestoration = "manual";
      }
    }
    return () => {
      if (history.scrollRestoration) {
        history.scrollRestoration = "auto";
      }
    };
  }, [router.asPath]);

  useEffect(() => {
    if (similarArtists && similarArtists.length > 0) {
      window.ipc.invoke("getAllArtists").then((artists) => {
        setLibraryArtists(artists || []);
      });
    }
  }, [similarArtists]);

  useEffect(() => {
    if (!router.query.name) return;

    const artistName = decodeURIComponent(router.query.name as string);
    
    setLoading(true);
    window.ipc.invoke("getArtistWithAlbums", artistName).then((response) => {
      setArtist(response);
      setLoading(false);
    });

    setInfoLoading(true);
    Promise.all([
      window.ipc.invoke("lastfm:getArtistInfo", artistName),
      window.ipc.invoke("lastfm:getArtistTopTracks", artistName),
      window.ipc.invoke("lastfm:getSimilarArtists", artistName),
    ])
      .then(([infoRes, tracksRes, similarRes]) => {
        if (infoRes.success && infoRes.artist) {
          setArtistInfo(infoRes.artist);
        }
        if (tracksRes.success && tracksRes.toptracks?.track) {
          setTopTracks(tracksRes.toptracks.track.slice(0, 10));
        }
        if (similarRes.success && similarRes.similarartists?.artist) {
          setSimilarArtists(similarRes.similarartists.artist.slice(0, 6));
        }
      })
      .finally(() => {
        setInfoLoading(false);
      });
  }, [router.query.name]);

  const playAllSongs = () => {
    if (artist && artist.songs) {
      setQueueAndPlay(artist.songs, 0);
    }
  };

  const playAllSongsAndShuffle = () => {
    if (artist && artist.songs) {
      setQueueAndPlay(artist.songs, 0, true);
    }
  };

  const playTopTrack = (trackName: string) => {
    if (artist && artist.songs) {
      const track = artist.songs.find(s => 
        s.name.toLowerCase().includes(trackName.toLowerCase())
      );
      if (track) {
        const index = artist.songs.indexOf(track);
        setQueueAndPlay(artist.songs, index);
      }
    }
  };

  const getArtistImage = () => {
    if (artistInfo?.image && Array.isArray(artistInfo.image)) {
      const sizes = ["mega", "extralarge", "large", "medium", "small"];
      for (const size of sizes) {
        const image = artistInfo.image.find(img => img.size === size);
        if (image && image["#text"] && image["#text"].length > 0 && 
            !image["#text"].includes("2a96cbd8b46e442fc41c2b86b821562f") &&
            !image["#text"].includes("c951e87f7c3c76e91f7287e326f2edeb")) {
          return image["#text"];
        }
      }
    }
    return getArtistCover();
  };

  const getArtistCover = () => {
    if (artist?.albums && artist.albums.length > 0) {
      const albumWithCover = artist.albums.find((album) => album.cover);
      return albumWithCover
        ? `wora://${albumWithCover.cover}`
        : "/coverArt.png";
    }
    return "/coverArt.png";
  };

  const formatNumber = (num: string) => {
    return parseInt(num).toLocaleString();
  };

  const cleanBio = (text: string) => {
    return text.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2');
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} minutes`;
  };

  const convertTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <>
      <div className="relative h-96 w-full overflow-hidden rounded-2xl">
        {getArtistImage().startsWith("http") ? (
          <img
            alt={artist ? artist.name : "Artist Cover"}
            src={getArtistImage()}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-center blur-xl opacity-50"
          />
        ) : (
          <Image
            alt={artist ? artist.name : "Artist Cover"}
            src={getArtistImage()}
            fill
            loading="lazy"
            className="object-cover object-center blur-xl opacity-50"
          />
        )}
        <div className="absolute bottom-6 left-6">
          <div className="flex items-end gap-6">
            <div className="relative h-52 w-52 overflow-hidden rounded-xl shadow-2xl transition duration-300">
              {getArtistImage().startsWith("http") ? (
                <img
                  alt={artist ? artist.name : "Artist Cover"}
                  src={getArtistImage()}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Image
                  alt={artist ? artist.name : "Artist Cover"}
                  src={getArtistImage()}
                  fill
                  loading="lazy"
                  className="object-cover"
                />
              )}
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-5xl font-bold drop-shadow-lg">{artist?.name}</h1>
                <div className="mt-2 flex items-center gap-3">
                  <p className="flex items-center gap-2 text-sm">
                    {artist?.albums?.length || 0} Albums
                    <IconCircleFilled stroke={2} size={5} />
                    {artist?.songs?.length || 0} Songs
                  </p>
                  {artistInfo?.stats && (
                    <>
                      <IconCircleFilled stroke={2} size={5} />
                      <p className="text-sm">
                        {formatNumber(artistInfo.stats.listeners)} listeners
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={playAllSongs}
                  className="flex items-center gap-2 rounded-full bg-white px-6 py-2 text-sm font-medium text-black hover:bg-white/90 dark:bg-white dark:text-black"
                >
                  <IconPlayerPlay
                    className="fill-black dark:fill-black"
                    stroke={2}
                    size={18}
                  />
                  Play
                </Button>
                <Button
                  onClick={playAllSongsAndShuffle}
                  variant="outline"
                  className="flex items-center gap-2 rounded-full px-6 py-2 text-sm font-medium"
                >
                  <IconArrowsShuffle2 stroke={2} size={18} />
                  Shuffle
                </Button>
                {artistInfo?.url && (
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                    onClick={() => window.open(artistInfo.url, "_blank")}
                  >
                    <IconExternalLink stroke={2} size={18} />
                    Last.fm
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button
            className={`px-6 pb-4 text-sm font-medium transition-colors ${
              activeTab === "overview"
                ? "border-b-2 border-black text-black dark:border-white dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`px-6 pb-4 text-sm font-medium transition-colors ${
              activeTab === "albums"
                ? "border-b-2 border-black text-black dark:border-white dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
            onClick={() => setActiveTab("albums")}
          >
            Albums
          </button>
          <button
            className={`px-6 pb-4 text-sm font-medium transition-colors ${
              activeTab === "songs"
                ? "border-b-2 border-black text-black dark:border-white dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
            onClick={() => setActiveTab("songs")}
          >
            Songs
          </button>
        </div>

        {activeTab === "overview" && (
          <div className="py-6">
            {artist?.stats && (
              <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="wora-border rounded-xl p-4">
                  <p className="text-2xl font-bold">{artist.stats.totalAlbums}</p>
                  <p className="text-sm opacity-60">Albums</p>
                </div>
                <div className="wora-border rounded-xl p-4">
                  <p className="text-2xl font-bold">{artist.stats.totalSongs}</p>
                  <p className="text-sm opacity-60">Songs</p>
                </div>
                <div className="wora-border rounded-xl p-4">
                  <p className="text-2xl font-bold">{formatDuration(artist.stats.totalDuration)}</p>
                  <p className="text-sm opacity-60">Total Duration</p>
                </div>
                {artist.stats.yearRange && (
                  <div className="wora-border rounded-xl p-4">
                    <p className="text-2xl font-bold">
                      {artist.stats.yearRange.start === artist.stats.yearRange.end
                        ? artist.stats.yearRange.start
                        : `${artist.stats.yearRange.start}-${artist.stats.yearRange.end}`}
                    </p>
                    <p className="text-sm opacity-60">Active Years</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Bio Section or Local Info */}
              <div className="lg:col-span-2">
                {artistInfo?.bio ? (
                  <>
                    <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                      <IconInfoCircle stroke={2} size={24} />
                      About
                    </h2>
                    <div className="wora-border rounded-xl p-6">
                      <p className="text-sm leading-relaxed opacity-90">
                        {cleanBio(artistInfo.bio.summary)}
                      </p>
                    </div>
                  </>
                ) : artist?.stats ? (
                  <>
                    <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                      <IconInfoCircle stroke={2} size={24} />
                      Library Info
                    </h2>
                    <div className="wora-border rounded-xl p-6">
                      <div className="space-y-4">
                        <div>
                          <p className="mb-2 text-sm font-medium">Audio Formats</p>
                          <div className="flex flex-wrap gap-2">
                            {artist.stats.formats.map((format) => (
                              <span
                                key={format}
                                className="rounded-full bg-black/10 px-3 py-1 text-xs dark:bg-white/10"
                              >
                                {format}
                              </span>
                            ))}
                          </div>
                        </div>
                        {artist.stats.topSongs.length > 0 && (
                          <div>
                            <p className="mb-2 text-sm font-medium">Songs in Library</p>
                            {artist.stats.topSongs.map((song, idx) => (
                              <div key={song.id} className="flex items-center justify-between py-1">
                                <div>
                                  <p className="text-sm">{song.name}</p>
                                  <p className="text-xs opacity-50">{song.album}</p>
                                </div>
                                <span className="text-xs opacity-50">{convertTime(song.duration)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Top Tracks Section */}
              {topTracks.length > 0 && (
                <div>
                  <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                    <IconMusic stroke={2} size={24} />
                    Top Tracks
                  </h2>
                  <div className="wora-border rounded-xl p-2">
                    {topTracks.slice(0, 5).map((track, index) => {
                      // Try to match Last.fm track with local song (fuzzy matching)
                      const localTrack = artist?.songs?.find(s => {
                        const localName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const lastFmName = track.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                        return localName.includes(lastFmName) || lastFmName.includes(localName);
                      });
                      const isPlaying = localTrack && song?.id === localTrack.id;
                      const isClickable = !!localTrack;
                      
                      return (
                        <div
                          key={index}
                          className={`group flex items-center justify-between rounded-lg p-3 transition-colors ${
                            isClickable ? "cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" : ""
                          } ${isPlaying ? "bg-black/5 dark:bg-white/5" : ""}`}
                          onClick={() => isClickable && playTopTrack(track.name)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold opacity-50">
                              {index + 1}
                            </span>
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${isPlaying ? "text-blue-500" : ""} ${isClickable ? "group-hover:text-blue-500" : ""}`}>
                                {track.name}
                                {localTrack && (
                                  <span className="ml-2 text-xs opacity-50">• In Library</span>
                                )}
                              </p>
                              <p className="text-xs opacity-50">
                                {formatNumber(track.playcount)} plays
                              </p>
                            </div>
                          </div>
                          {localTrack && (
                            <IconPlayerPlay 
                              size={16} 
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Empty State for Overview */}
            {!artistInfo?.bio && !artist?.stats && !topTracks.length && (
              <div className="flex flex-col items-center justify-center py-16">
                <IconMusic size={64} className="mb-4 opacity-20" />
                <h3 className="mb-2 text-xl font-medium opacity-60">No Information Available</h3>
                <p className="text-sm opacity-50">Artist data will appear here as you play their music</p>
              </div>
            )}

            {/* Similar Artists Section */}
            {similarArtists.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                  <IconUsers stroke={2} size={24} />
                  Similar Artists
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {similarArtists.map((simArtist, index) => {
                    // Check if artist exists in library
                    const libraryArtist = libraryArtists.find(a => 
                      a.name.toLowerCase() === simArtist.name.toLowerCase()
                    );
                    const isInLibrary = !!libraryArtist;
                    
                    // Get Last.fm image
                    let imageUrl = simArtist.image?.find((img: any) => img.size === "large")?.["#text"];
                    
                    // If it's the placeholder and we have the artist in library, use their album cover
                    if (imageUrl?.includes("2a96cbd8b46e442fc41c2b86b821562f") && libraryArtist?.cover) {
                      imageUrl = `wora://${libraryArtist.cover}`;
                    }
                    
                    const isLocalImage = imageUrl?.startsWith("wora://");
                    const hasRealImage = imageUrl && !imageUrl.includes("2a96cbd8b46e442fc41c2b86b821562f");
                    
                    return (
                      <div
                        key={index}
                        className="group cursor-pointer"
                        onClick={() => router.push(`/artists/${encodeURIComponent(simArtist.name)}`)}
                      >
                        <div className="relative aspect-square overflow-hidden rounded-xl shadow-lg transition duration-300 group-hover:scale-[1.02] group-hover:shadow-xl">
                          {imageUrl && !isLocalImage && hasRealImage ? (
                            <img
                              alt={simArtist.name}
                              src={imageUrl}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : isLocalImage ? (
                            <Image
                              alt={simArtist.name}
                              src={imageUrl}
                              fill
                              loading="lazy"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                              <IconUser stroke={1.5} size={48} className="opacity-50" />
                            </div>
                          )}
                          {isInLibrary && (
                            <div className="absolute bottom-2 right-2 rounded-full bg-black/70 p-1.5 backdrop-blur-sm dark:bg-white/70">
                              <IconCheck size={14} className="text-white dark:text-black" />
                            </div>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm font-medium">
                          {simArtist.name}
                          {isInLibrary && (
                            <span className="ml-1 text-xs opacity-50">• In Library</span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Albums View */}
        {activeTab === "albums" && (
          <div className="grid grid-cols-2 gap-6 py-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {artist?.albums?.map((album) => (
              <div
                key={album.id}
                className="group cursor-pointer"
                onClick={() => router.push(`/albums/${album.id}`)}
              >
                <div className="relative aspect-square overflow-hidden rounded-xl shadow-lg transition duration-300 group-hover:scale-[1.02] group-hover:shadow-xl">
                  <Image
                    alt={album.name}
                    src={
                      album.cover ? `wora://${album.cover}` : "/coverArt.png"
                    }
                    fill
                    loading="lazy"
                    className="object-cover"
                  />
                </div>
                <div className="mt-2">
                  <p className="line-clamp-1 text-sm font-medium">
                    {album.name}
                  </p>
                  <p className="text-xs opacity-50">
                    {album.year || "Unknown"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Songs View */}
        {activeTab === "songs" && (
          <div className="py-4">
            <Songs library={artist?.songs || []} disableScroll={true} />
          </div>
        )}
      </div>
    </>
  );
}