import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  IconPlayerPlay,
  IconArrowsShuffle2,
} from "@tabler/icons-react";
import { Song, usePlayer } from "@/context/playerContext";
import InfiniteLoadingSongs from "@/components/ui/infinite-loading-songs";

export default function AllSongs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { setQueueAndPlay } = usePlayer();

  const loadSongs = useCallback(async () => {
      if (loading || !hasMore) return;
      setLoading(true);
  
      if (page > 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
  
      try {
        const newSongs = await window.ipc.invoke("getSongs", page);
        if (newSongs.length === 0) {
          setHasMore(false);
        } else {
          setSongs((prevSongs) => [...prevSongs, ...newSongs]);
          setPage((prevPage) => prevPage + 1);
        }
      } catch (error) {
        console.error("Error loading songs:", error);
      } finally {
        setLoading(false);
      }
    }, [page, loading, hasMore]);
  
    useEffect(() => {
      loadSongs();
    }, []);
  
   

  const playSongs = () => {
    setQueueAndPlay(songs, 0);
  };

  const playSongsAndShuffle = () => {
    setQueueAndPlay(songs, 0, true);
  };

  return (
    <>
      <div className="relative h-96 w-full overflow-hidden rounded-2xl">
        <div className="absolute bottom-6 left-6">
          <div className="flex items-end gap-4">
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-2xl font-medium">
                  All Songs
                </h1>
              </div>
              <div className="flex gap-2">
                <Button onClick={playSongs} className="w-fit">
                  <IconPlayerPlay
                    className="fill-black dark:fill-white"
                    stroke={2}
                    size={16}
                  />{" "}
                  Play
                </Button>
                <Button className="w-fit" onClick={playSongsAndShuffle}>
                  <IconArrowsShuffle2 stroke={2} size={16} /> Shuffle
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pt-2">
        <InfiniteLoadingSongs
          library={songs}
          hasMore={hasMore}
          loading={loading}
          loadMore={loadSongs}
        />
      </div>
    </>
  );
}
