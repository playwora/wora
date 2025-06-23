import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import {
  IconCircleFilled,
  IconPlayerPlay,
  IconArrowsShuffle2,
  IconClock,
} from "@tabler/icons-react";
import { usePlayer } from "@/context/playerContext";
import Songs from "@/components/ui/songs";
import Link from "next/link";
import { convertTime } from "@/lib/helpers";

type Album = {
  name: string;
  artist: string;
  year: number;
  cover: string;
  songs: any[];
  duration?: number;
};

export default function Album() {
  const router = useRouter();
  const [album, setAlbum] = useState<Album | null>(null);
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
    if (!router.query.slug) return;

    window.ipc
      .invoke("getAlbumWithSongs", router.query.slug)
      .then((response) => {
        setAlbum(response);
      });
  }, [router.query.slug]);

  const playAlbum = () => {
    if (album) {
      setQueueAndPlay(album.songs, 0);
    }
  };

  const playAlbumAndShuffle = () => {
    if (album) {
      setQueueAndPlay(album.songs, 0, true);
    }
  };

  // Calculate total duration from songs if not provided by the backend
  const calculateTotalDuration = () => {
    if (!album) return 0;

    if (album.duration) return album.duration;

    return (
      album.songs?.reduce((total, song) => total + (song.duration || 0), 0) || 0
    );
  };

  return (
    <>
      <div className="relative h-96 w-full overflow-hidden rounded-2xl">
        <Image
          alt={album ? album.name : "Album Cover"}
          src={album ? `wora://${album.cover}` : "/coverArt.png"}
          fill
          loading="lazy"
          className="mask-b-from-30% object-cover object-center blur-xl"
        />
        <div className="absolute bottom-6 left-6">
          <div className="flex items-end gap-4">
            <div className="relative h-52 w-52 overflow-hidden rounded-xl shadow-lg transition duration-300">
              <Image
                alt={album ? album.name : "Album Cover"}
                src={album ? `wora://${album.cover}` : "/coverArt.png"}
                fill
                loading="lazy"
                className="scale-[1.01] object-cover"
              />
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-2xl font-medium">{album && album.name}</h1>
                <p className="flex items-center gap-2 text-sm">
                  <Link
                    href={
                      album
                        ? `/artists/${encodeURIComponent(album.artist)}`
                        : "#"
                    }
                  >
                    <span className="text-primary cursor-pointer underline-offset-2 hover:underline hover:opacity-80">
                      {album && album.artist}
                    </span>
                  </Link>
                  <IconCircleFilled stroke={2} size={5} />{" "}
                  {album && album.year ? album.year : "Unknown"}
                  <IconCircleFilled stroke={2} size={5} />{" "}
                  <span className="flex items-center gap-1">
                    <IconClock size={14} stroke={2} />
                    {album ? convertTime(calculateTotalDuration()) : "--:--"}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={playAlbum} className="w-fit">
                  <IconPlayerPlay
                    className="fill-black dark:fill-white"
                    stroke={2}
                    size={16}
                  />{" "}
                  Play
                </Button>
                <Button className="w-fit" onClick={playAlbumAndShuffle}>
                  <IconArrowsShuffle2 stroke={2} size={16} /> Shuffle
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pt-2">
        <Songs library={album?.songs} disableScroll={true} />
      </div>
    </>
  );
}
