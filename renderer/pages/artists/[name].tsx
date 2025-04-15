import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import {
  IconCircleFilled,
  IconPlayerPlay,
  IconArrowsShuffle2,
} from "@tabler/icons-react";
import { usePlayer } from "@/context/playerContext";
import Songs from "@/components/ui/songs";

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
};

export default function ArtistView() {
  const router = useRouter();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [activeTab, setActiveTab] = useState("albums");
  const { setQueueAndPlay } = usePlayer();
  const containerRef = useRef<HTMLDivElement>(null);

  // Disable scroll restoration on mount and route change
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Force scroll to top
      window.scrollTo(0, 0);

      // Disable scroll restoration for this page
      if (history.scrollRestoration) {
        history.scrollRestoration = "manual";
      }
    }

    // Cleanup - reset when leaving the page
    return () => {
      if (history.scrollRestoration) {
        history.scrollRestoration = "auto";
      }
    };
  }, [router.asPath]);

  useEffect(() => {
    if (!router.query.name) return;

    // Decode the artist name from the URL
    const artistName = decodeURIComponent(router.query.name as string);

    window.ipc.invoke("getArtistWithAlbums", artistName).then((response) => {
      setArtist(response);
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

  // Get a representative album cover for the artist
  const getArtistCover = () => {
    if (artist?.albums && artist.albums.length > 0) {
      const albumWithCover = artist.albums.find((album) => album.cover);
      return albumWithCover
        ? `wora://${albumWithCover.cover}`
        : "/coverArt.png";
    }
    return "/coverArt.png";
  };

  return (
    <>
      <div className="relative h-96 w-full overflow-hidden rounded-2xl">
        <Image
          alt={artist ? artist.name : "Artist Cover"}
          src={getArtistCover()}
          fill
          loading="lazy"
          className="object-cover object-center blur-xl gradient-mask-b-10"
        />
        <div className="absolute bottom-6 left-6">
          <div className="flex items-end gap-4">
            <div className="relative h-52 w-52 overflow-hidden rounded-xl shadow-lg transition duration-300">
              <Image
                alt={artist ? artist.name : "Artist Cover"}
                src={getArtistCover()}
                fill
                loading="lazy"
                className="scale-[1.01] object-cover"
              />
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-4xl font-bold">{artist?.name}</h1>
                <p className="flex items-center gap-2 text-sm">
                  {artist?.albums?.length || 0} Albums
                  <IconCircleFilled stroke={2} size={5} />
                  {artist?.songs?.length || 0} Songs
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={playAllSongs}
                  className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-opacity-90 dark:bg-white dark:text-black"
                >
                  <IconPlayerPlay
                    className="fill-black dark:fill-black"
                    stroke={2}
                    size={16}
                  />
                  Play
                </button>
                <button
                  onClick={playAllSongsAndShuffle}
                  className="flex items-center gap-2 rounded-full bg-black/10 px-4 py-2 text-sm font-medium hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20"
                >
                  <IconArrowsShuffle2 stroke={2} size={16} />
                  Shuffle
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs for Albums and Songs */}
      <div className="mt-8">
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button
            className={`px-4 pb-4 text-sm font-medium ${
              activeTab === "albums"
                ? "border-b-2 border-black text-black dark:border-white dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
            onClick={() => setActiveTab("albums")}
          >
            Albums
          </button>
          <button
            className={`px-4 pb-4 text-sm font-medium ${
              activeTab === "songs"
                ? "border-b-2 border-black text-black dark:border-white dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
            onClick={() => setActiveTab("songs")}
          >
            Songs
          </button>
        </div>

        {/* Albums View */}
        {activeTab === "albums" && (
          <div className="grid grid-cols-2 gap-6 py-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {artist?.albums?.map((album) => (
              <div
                key={album.id}
                className="flex cursor-pointer flex-col gap-2"
                onClick={() => router.push(`/albums/${album.id}`)}
              >
                <div className="relative aspect-square overflow-hidden rounded-xl shadow-lg transition duration-300 hover:scale-[1.02] hover:shadow-xl">
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
                <div>
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
