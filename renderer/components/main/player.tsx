import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  IconArrowsShuffle2,
  IconCheck,
  IconClock,
  IconHeart,
  IconInfoCircle,
  IconList,
  IconListTree,
  IconMessage,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconPlus,
  IconRepeat,
  IconRipple,
  IconVinyl,
  IconVolume,
  IconVolumeOff,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Howl } from "howler";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Lyrics from "@/components/main/lyrics";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { convertTime, isSyncedLyrics, parseLyrics, updateDiscordState, useAudioMetadata } from "@/lib/helpers";
import { usePlayer } from "@/context/playerContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export const Player = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [_, setSeekPosition] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const soundRef = useRef<Howl | null>(null);
  const [currentLyric, setCurrentLyric] = useState(null);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const {
    song,
    nextSong,
    previousSong,
    queue,
    history,
    currentIndex,
    repeat,
    shuffle,
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();

  const { metadata, lyrics, favourite } = useAudioMetadata(song?.filePath);

  const handlePlayPause = useCallback(() => {
    if (soundRef.current) {
      if (soundRef.current.playing()) {
        soundRef.current.pause();
      } else {
        soundRef.current.play();
      }
    }
  }, []);

  useEffect(() => {
    if (!song?.filePath) return;

    const sound = new Howl({
      src: ["wora://" + encodeURIComponent(song?.filePath)],
      format: [song?.filePath.split(".").pop()],
      html5: true,
      autoplay: true,
      preload: true,
      volume: volume,
      onload: () => {
        setSeekPosition(0);
        setIsPlaying(true);
        updateDiscordState(1, song);
      },
      onloaderror: (error) => {
        setIsPlaying(false);
        console.error("Error loading audio:", error);
      },
      onend: () => {
        setIsPlaying(false);
        if (!repeat) {
          nextSong();
        }
      },
    });

    soundRef.current = sound;

    return () => {
      sound.unload();
    };
  }, [song, nextSong]);

  useEffect(() => {
    if (!song) return;

    const updateSeek = () => {
      if (soundRef.current?.playing()) {
        setSeekPosition(soundRef.current?.seek());
      }
    };

    const interval = setInterval(updateSeek, 100);

    soundRef.current.on("play", () => {
      setIsPlaying(true);
    });

    soundRef.current.on("pause", () => {
      setIsPlaying(false);
    });

    return () => {
      clearInterval(interval);
    };
  }, [song]);

  useEffect(() => {
    if (!lyrics || !song) return;

    const parsedLyrics = isSyncedLyrics(lyrics) ? parseLyrics(lyrics) : [];

    const updateLyrics = () => {
      if (soundRef.current?.playing()) {
        const currentSeek = soundRef.current.seek();
        const currentLyricLine = parsedLyrics.find((line, index) => {
          const nextLine = parsedLyrics[index + 1];
          return (
            currentSeek >= line.time &&
            (!nextLine || currentSeek < nextLine.time)
          );
        });

        setCurrentLyric(currentLyricLine || null);
      }
    };

    const interval = setInterval(updateLyrics, 1000);

    return () => clearInterval(interval);
  }, [song, lyrics]);

  useEffect(() => {
    soundRef.current?.volume(volume);
    soundRef.current?.mute(isMuted);
  }, [volume, isMuted]);

  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.loop(repeat);
    }
  }, [repeat]);

  useEffect(() => {
    if (song) {
      setIsFavourite(favourite);
    }
  }, [song, favourite]);

  const handleVolume = useCallback((value: number[]) => {
    setVolume(value[0]);
  }, []);

  const handleSeek = useCallback((value: number[]) => {
    if (soundRef.current) {
      soundRef.current.seek(value[0]);
      setSeekPosition(value[0]);
    }
  }, []);

  const toggleFavourite = useCallback((id: number) => {
    if (!id) return;
    window.ipc.send("addToFavourites", id);
    setIsFavourite((prev) => !prev);
  }, []);

  const handleLyricClick = useCallback((time: number) => {
    if (soundRef.current) {
      soundRef.current.seek(time);
      setSeekPosition(time);
    }
  }, []);

  const toggleLyrics = useCallback(() => {
    setShowLyrics((prev) => !prev);
  }, []);

  const toggleQueue = useCallback(() => {
    setShowQueue((prev) => !prev);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  useEffect(() => {
    window?.ipc?.invoke("getAllPlaylists").then((response) => {
      setPlaylists(response);
    });
  }, []);

  const addSongToPlaylist = (playlistId: number, songId: number) => {
    window.ipc
      .invoke("addSongToPlaylist", {
        playlistId,
        songId,
      })
      .then((response) => {
        if (response === true) {
          toast(
            <div className="flex w-fit items-center gap-2 text-xs">
              <IconCheck className="text-green-400" stroke={2} size={16} />
              Song is added to playlist.
            </div>,
          );
        } else {
          toast(
            <div className="flex w-fit items-center gap-2 text-xs">
              <IconX className="text-red-500" stroke={2} size={16} />
              Song already exists in playlist.
            </div>,
          );
        }
      });
  };

  return (
    <div>
      <div className="absolute right-0 top-0 w-full">
        {showLyrics && lyrics && (
          <Lyrics
            lyrics={parseLyrics(lyrics)}
            currentLyric={currentLyric}
            onLyricClick={handleLyricClick}
            isSyncedLyrics={isSyncedLyrics(lyrics)}
          />
        )}
      </div>
      <div className="!absolute right-0 top-0 w-96">
        {showQueue && (
          <div className="wora-border relative h-full w-full rounded-2xl bg-white/70 backdrop-blur-xl dark:bg-black/70">
            <div className="h-utility w-full max-w-3xl px-6 pt-6">
              <Tabs
                defaultValue="queue"
                className="flex h-full w-full flex-col gap-4 gradient-mask-b-70"
              >
                <TabsList className="w-full">
                  <TabsTrigger value="queue" className="w-full gap-2">
                    <IconListTree stroke={2} size={15} /> Queue
                  </TabsTrigger>
                  <TabsTrigger value="history" className="w-full gap-2">
                    <IconClock stroke={2} size={15} /> History
                  </TabsTrigger>
                </TabsList>
                <TabsContent
                  value="queue"
                  className="no-scrollbar flex-grow overflow-y-auto pb-64"
                >
                  <ul className="flex flex-col gap-4">
                    {queue.slice(currentIndex + 1).map((song) => (
                      <li
                        key={song.id}
                        className="flex w-full items-center gap-4 overflow-hidden gradient-mask-r-70"
                      >
                        <div className="relative min-h-14 min-w-14 overflow-hidden rounded-lg shadow-lg">
                          <Image
                            alt="Album Cover"
                            src={`wora://${song?.album.cover}`}
                            fill
                            priority={true}
                            className="object-cover"
                          />
                        </div>
                        <div className="w-4/5 overflow-hidden">
                          <p className="text-nowrap text-sm font-medium">
                            {song.name}
                          </p>
                          <p className="text-nowrap opacity-50">
                            {song.artist}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </TabsContent>
                <TabsContent
                  value="history"
                  className="no-scrollbar flex-grow overflow-y-auto pb-64"
                >
                  <ul className="flex flex-col gap-4">
                    {[...history].reverse().map((song) => (
                      <li
                        key={song.id}
                        className="flex w-full items-center gap-4 overflow-hidden gradient-mask-r-70"
                      >
                        <div className="relative h-14 w-14 overflow-hidden rounded-lg shadow-lg">
                          <Image
                            alt="Album Cover"
                            src={`wora://${song?.album.cover}`}
                            fill
                            priority={true}
                            className="object-cover"
                          />
                        </div>
                        <div className="w-4/5 overflow-hidden">
                          <p className="text-nowrap text-sm font-medium">
                            {song.name}
                          </p>
                          <p className="text-nowrap opacity-50">
                            {song.artist}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
      <div className="w-full h-28 rounded-2xl wora-border overflow-hidden p-6">
        <div className="relative flex h-full w-full items-center">
          <TooltipProvider>
            <div className="absolute left-0 flex justify-start w-1/4 overflow-hidden gradient-mask-r-70 items-center gap-4">
              {song ? (
                <ContextMenu>
                  <ContextMenuTrigger>
                    <Link href={`/albums/${song.album.id}`}>
                      <div className="relative min-h-[4.25rem] min-w-[4.25rem] overflow-hidden rounded-lg shadow-lg transition duration-500">
                        <Image
                          alt="Album Cover"
                          src={`wora://${song?.album.cover}`}
                          fill
                          priority={true}
                          className="object-cover object-center"
                        />
                      </div>
                    </Link>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-64">
                    <Link href={`/albums/${song.album.id}`}>
                      <ContextMenuItem className="flex items-center gap-2">
                        <IconVinyl stroke={2} size={14} />
                        Go to Album
                      </ContextMenuItem>
                    </Link>
                    <ContextMenuSub>
                      <ContextMenuSubTrigger className="flex items-center gap-2">
                        <IconPlus stroke={2} size={14} />
                        Add to Playlist
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-52">
                        {playlists.map((playlist) => (
                          <ContextMenuItem
                            key={playlist.id}
                            onClick={() => {
                              addSongToPlaylist(playlist.id, song.id);
                              setIsFavourite(true);
                            }}
                          >
                            <p className="w-full text-nowrap gradient-mask-r-70">
                              {playlist.name}
                            </p>
                          </ContextMenuItem>
                        ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  </ContextMenuContent>
                </ContextMenu>
              ) : (
                <div className="relative min-h-[4.25rem] min-w-[4.25rem] overflow-hidden rounded-lg shadow-lg transition duration-500">
                  <Image
                    alt="Album Cover"
                    src={"/coverArt.png"}
                    fill
                    priority={true}
                    className="object-cover"
                  />
                </div>
              )}
              <div className="w-full gradient-mask-r-70">
                <p className="text-nowrap text-sm font-medium">
                  {song ? song.name : "Echoes of Emptiness"}
                </p>
                <p className="text-nowrap opacity-50">
                  {song ? song.artist : "The Void Ensemble"}
                </p>
              </div>
            </div>

            <div className="absolute left-0 right-0 mx-auto flex h-full w-2/4 flex-col gap-4 items-center justify-between">
              <div className="flex items-center w-full gap-8 justify-center h-full">
                <Button
                  variant="ghost"
                  asChild
                  className="relative !opacity-100"
                >
                  <Button
                    variant="ghost"
                    className="relative !opacity-100"
                    onClick={() => toggleShuffle()}
                    asChild
                  >
                    {!shuffle ? (
                      <IconArrowsShuffle2
                        stroke={2}
                        size={16}
                        className="!opacity-30 hover:!opacity-100"
                      />
                    ) : (
                      <div>
                        <IconArrowsShuffle2 stroke={2} size={16} />
                        <div className="absolute -top-2 left-0 right-0 mx-auto h-[1.5px] w-2/3 rounded-full bg-black dark:bg-white"></div>
                      </div>
                    )}
                  </Button>
                </Button>
                <Button variant="ghost" onClick={previousSong}>
                  <IconPlayerSkipBack
                    stroke={2}
                    className="fill-black dark:fill-white"
                    size={15}
                  />
                </Button>
                <Button variant="ghost" onClick={handlePlayPause}>
                  {!isPlaying ? (
                    <IconPlayerPlay
                      stroke={2}
                      className="h-6 w-6 fill-black dark:fill-white"
                    />
                  ) : (
                    <IconPlayerPause
                      stroke={2}
                      className="h-6 w-6 fill-black dark:fill-white"
                    />
                  )}
                </Button>
                <Button variant="ghost" onClick={nextSong}>
                  <IconPlayerSkipForward
                    stroke={2}
                    className="h-4 w-4 fill-black dark:fill-white"
                  />
                </Button>
                <Button
                  variant="ghost"
                  className="relative !opacity-100"
                  onClick={() => toggleRepeat()}
                  asChild
                >
                  {!repeat ? (
                    <IconRepeat
                      stroke={2}
                      size={15}
                      className="!opacity-30 hover:!opacity-100"
                    />
                  ) : (
                    <div>
                      <IconRepeat stroke={2} size={15} />
                      <div className="absolute -top-2 left-0 right-0 mx-auto h-[1.5px] w-2/3 rounded-full bg-black dark:bg-white"></div>
                    </div>
                  )}
                </Button>
                {metadata && metadata.format.lossless && (
                  <div className="absolute left-36">
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger>
                        <IconRipple stroke={2} className="w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent side="left" sideOffset={25}>
                        <p>
                          Lossless [{metadata.format.bitsPerSample}/
                          {(metadata.format.sampleRate / 1000).toFixed(1)}kHz]
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
                <div className="absolute right-36">
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger>
                      <Button
                        variant="ghost"
                        className="!opacity-100"
                        onClick={() => {
                          toggleFavourite(song?.id);
                        }}
                        asChild
                      >
                        <IconHeart
                          stroke={2}
                          className={
                            `${isFavourite ? "fill-red-500" : "fill-none"}` +
                            " w-3.5 text-red-500"
                          }
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={25}>
                      <p className="delay-500">
                        {!isFavourite
                          ? "Add to Favourites"
                          : "Remove from Favourites"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="relative h-full items-center flex w-96 px-4">
                <p className="absolute -left-8">
                  {convertTime(soundRef.current?.seek() || 0)}
                </p>
                <Slider
                  defaultValue={[0]}
                  value={[soundRef.current?.seek() || 0]}
                  onValueChange={handleSeek}
                  max={soundRef.current?.duration() || 0}
                  step={0.01}
                />
                <p className="absolute -right-8">
                  {convertTime(soundRef.current?.duration() || 0)}
                </p>
              </div>
            </div>
            <div className="absolute right-0 flex w-1/4 items-center justify-end gap-10">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  onClick={toggleMute}
                  className="!opacity-100"
                >
                  {!isMuted ? (
                    <IconVolume
                      stroke={2}
                      size={17.5}
                      className="wora-transition !opacity-30 hover:!opacity-100"
                    />
                  ) : (
                    <IconVolumeOff
                      stroke={2}
                      size={17.5}
                      className="text-red-500"
                    />
                  )}
                </Button>
                <Slider
                  onValueChange={handleVolume}
                  defaultValue={[volume]}
                  max={1}
                  step={0.01}
                  className="w-24"
                />
              </div>
              <div className="flex items-center gap-4">
                {lyrics ? (
                  <Button variant="ghost" onClick={toggleLyrics}>
                    <IconMessage stroke={2} size={15} />
                  </Button>
                ) : (
                  <IconMessage className="text-red-500 opacity-75 cursor-not-allowed" stroke={2} size={15} />
                )}
                <Dialog>
                  {song ? (
                    <DialogTrigger className="opacity-30 duration-500 hover:opacity-100">
                      <IconInfoCircle stroke={2} size={15} />
                    </DialogTrigger>
                  ) : (
                    <IconInfoCircle className="text-red-500 opacity-75 cursor-not-allowed" stroke={2} size={15} />
                  )}
                  <DialogContent>
                    <div className="flex h-full w-full items-start gap-6 overflow-hidden gradient-mask-r-70">
                      <div className="jusitfy-between flex h-full w-full flex-col gap-4">
                        <DialogHeader>
                          <DialogTitle>Track Information</DialogTitle>
                          <DialogDescription>
                            All the deets for your currently playing song.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex gap-4 overflow-hidden text-xs">
                          <div className="h-full">
                            <div className="relative h-36 w-36 overflow-hidden rounded-xl">
                              <Image
                                alt="album"
                                src={`wora://${song?.album.cover}` || "/coverArt.png"}
                                fill
                                className="object-cover"
                                quality={25}
                              />
                            </div>
                          </div>
                          <div className="flex h-full w-full flex-col gap-0.5">
                            <p className="mb-4 text-nowrap">
                              → {metadata && metadata.common.title} [
                              {metadata && metadata.format.codec}]
                            </p>
                            <p className="text-nowrap">
                              <span className="opacity-50">Artist:</span>{" "}
                              {metadata && metadata.common.artist}
                            </p>
                            <p className="text-nowrap">
                              <span className="opacity-50">Album:</span>{" "}
                              {metadata && metadata.common.album}
                            </p>
                            <p className="text-nowrap">
                              <span className="opacity-50">Codec:</span>{" "}
                              {metadata && metadata.format.codec}
                            </p>
                            {metadata && metadata.format.lossless ? (
                              <p className="text-nowrap">
                                <span className="opacity-50">Sample:</span>{" "}
                                Lossless [
                                {metadata && metadata.format.bitsPerSample}/
                                {metadata &&
                                  (metadata.format.sampleRate / 1000).toFixed(
                                    1,
                                  )}
                                kHz]
                              </p>
                            ) : (
                              <p className="text-nowrap">
                                <span className="opacity-50">Sample:</span>{" "}
                                Lossy Audio
                              </p>
                            )}
                            <p className="text-nowrap">
                              <span className="opacity-50">Duration:</span>{" "}
                              {convertTime(soundRef.current?.duration())}
                            </p>
                            <p className="text-nowrap">
                              <span className="opacity-50">Genre:</span>{" "}
                              {(metadata && metadata.common.genre) || "Unknown"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" onClick={toggleQueue}>
                  <IconList stroke={2} size={15} />
                </Button>
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

export default Player;
