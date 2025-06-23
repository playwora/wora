import React, { useEffect, useState, useRef } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import AlbumCard from "@/components/ui/album";
import Songs from "@/components/ui/songs";
import { Button } from "@/components/ui/button";
import { IconArrowsShuffle2 } from "@tabler/icons-react";
import { usePlayer } from "@/context/playerContext";
import Link from "next/link";

export default function Home() {
  const [library, setLibrary] = useState<any | null>([]);
  const [allSongs, setAllSongs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { setQueueAndPlay } = usePlayer();
  const songsRef = useRef(null);

  useEffect(() => {
    window.ipc.invoke("getRandomLibraryItems").then((response) => {
      setLibrary(response);
    });

    // Listen for reset event from main process
    const resetListener = window.ipc.on("resetHomeState", () => {
      // Refresh random library items
      window.ipc.invoke("getRandomLibraryItems").then((response) => {
        setLibrary(response);
      });
    });

    return () => {
      // Clean up event listener
      resetListener();
    };
  }, []);

  const handleShuffleAllSongs = async () => {
    setIsLoading(true);
    try {
      // Always fetch fresh songs to ensure proper album data
      const songs = await window.ipc.invoke("getAllSongs");

      // Process songs to ensure album data is complete
      const processedSongs = songs.map((song) => {
        // Ensure the song has a proper album structure
        if (!song.album) {
          song.album = {
            id: null,
            name: "Unknown Album",
            artist: "Unknown Artist",
            cover: null,
          };
        }

        // Make sure the album object is complete
        return {
          ...song,
          album: {
            id: song.album.id || null,
            name: song.album.name || "Unknown Album",
            artist: song.album.artist || "Unknown Artist",
            cover: song.album.cover || null,
            year: song.album.year || null,
          },
        };
      });

      setAllSongs(processedSongs);

      // Play all songs in shuffle mode
      setQueueAndPlay(processedSongs, 0, true);
    } catch (error) {
      console.error("Error shuffling all songs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col">
          <div className="mt-4 text-lg leading-6 font-medium">Home</div>
          <div className="opacity-50">
            The coolest music library in the world.
          </div>
        </div>
        <Button
          onClick={handleShuffleAllSongs}
          className="flex items-center gap-2"
          disabled={isLoading}
        >
          <IconArrowsShuffle2 stroke={2} size={16} />
          Shuffle All Songs
        </Button>
      </div>
      {library?.albums && library.albums.length > 5 && (
        <Carousel
          className="relative w-[89vw]"
          opts={{
            loop: true,
          }}
        >
          <CarouselPrevious className="absolute left-0 z-50 my-0" />
          <div className="w-full mask-x-from-70%">
            <CarouselContent className="-ml-8">
              {library.albums.map((album: any, index: number) => (
                <CarouselItem key={index} className="basis-1/5 pl-8">
                  <AlbumCard album={album} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </div>
          <CarouselNext className="absolute right-0 z-50 my-0" />
        </Carousel>
      )}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">Recently Added</h3>
          <Button variant="ghost" className="text-xs" asChild>
            <Link href="/songs">View All</Link>
          </Button>
        </div>
        <Songs
          library={library?.songs}
          ref={songsRef}
          limit={5}
          disableScroll={true}
        />
      </div>
    </div>
  );
}
