import React, {
  useEffect,
  useState,
  useCallback,
  memo,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import {
  IconCheck,
  IconClock,
  IconHeart,
  IconPlayerPlay,
  IconPlus,
  IconSquare,
  IconX,
  IconUser,
} from "@tabler/icons-react";
import { convertTime } from "@/lib/helpers";
import { Song, usePlayer } from "@/context/playerContext";
import { toast } from "sonner";

type Playlist = {
  id: number;
  name: string;
};

type SongsProps = {
  library: Song[];
  renderAdditionalMenuItems?: (song: Song, index: number) => React.ReactNode;
  limit?: number;
  disableScroll?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
};

// Skeleton loader for song covers
const SongSkeleton = () => (
  <div className="absolute inset-0 h-full w-full animate-pulse bg-neutral-200 dark:bg-neutral-800" />
);

// Memoized song item component to prevent unnecessary re-renders
const SongItem = memo(
  ({
    song,
    index,
    handleMusicClick,
    playNext,
    addToQueue,
    playlists,
    addSongToPlaylist,
    renderAdditionalMenuItems,
  }: {
    song: Song;
    index: number;
    handleMusicClick: (index: number) => void;
    playNext: (song: Song) => void;
    addToQueue: (song: Song) => void;
    playlists: Playlist[];
    addSongToPlaylist: (playlistId: number, songId: number) => void;
    renderAdditionalMenuItems?: (song: Song, index: number) => React.ReactNode;
  }) => {
    const [imgLoaded, setImgLoaded] = useState(false);
    return (
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className="wora-transition flex w-full cursor-pointer items-center justify-between rounded-xl p-3 hover:bg-black/5 dark:hover:bg-white/10"
            onClick={() => handleMusicClick(index)}
          >
            <div className="flex items-center gap-4">
              <div className="relative h-12 w-12 overflow-hidden rounded-lg shadow-lg transition duration-300">
                {!imgLoaded && <SongSkeleton />}
                <Image
                  alt={song.album.name}
                  src={`wora://${song.album.cover}`}
                  fill
                  loading="lazy"
                  className={`object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                  quality={10}
                  sizes="48px"
                  priority={false}
                  onLoad={() => setImgLoaded(true)}
                />
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-medium">{song.name}</p>
                <Link
                  href={`/artists/${encodeURIComponent(song.artist)}`}
                  passHref
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Use router to navigate without stopping song playback
                    const router = require("next/router").default;
                    router.push(`/artists/${encodeURIComponent(song.artist)}`);
                  }}
                >
                  <p className="cursor-pointer opacity-50 hover:underline hover:opacity-80">
                    {song.artist}
                  </p>
                </Link>
              </div>
            </div>
            <div>
              <p className="flex items-center gap-1 opacity-50">
                <IconClock stroke={2} size={15} />
                {convertTime(song.duration)}
              </p>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          <ContextMenuItem
            className="flex items-center gap-2"
            onClick={() => handleMusicClick(index)}
          >
            <IconPlayerPlay className="fill-white" stroke={2} size={14} />
            Play Song
          </ContextMenuItem>
          <ContextMenuItem
            className="flex items-center gap-2"
            onClick={() => playNext(song)}
          >
            <IconSquare stroke={2} size={14} />
            Play Next
          </ContextMenuItem>
          <ContextMenuItem
            className="flex items-center gap-2"
            onClick={() => addToQueue(song)}
          >
            <IconPlus className="fill-white" stroke={2} size={14} />
            Add to Queue
          </ContextMenuItem>
          <Link href={`/artists/${encodeURIComponent(song.artist)}`}>
            <ContextMenuItem className="flex items-center gap-2">
              <IconUser stroke={2} size={14} />
              Go to Artist
            </ContextMenuItem>
          </Link>
          <ContextMenuSub>
            <ContextMenuSubTrigger className="flex items-center gap-2">
              <IconHeart stroke={2} size={14} />
              Add to Playlist
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-52">
              {playlists.map((playlist) => (
                <ContextMenuItem
                  key={playlist.id}
                  onClick={() => addSongToPlaylist(playlist.id, song.id)}
                >
                  <p className="w-full text-nowrap gradient-mask-r-70">
                    {playlist.name}
                  </p>
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          {renderAdditionalMenuItems && renderAdditionalMenuItems(song, index)}
        </ContextMenuContent>
      </ContextMenu>
    );
  },
);

SongItem.displayName = "SongItem";

// Row renderer for virtualized list
const Row = memo(
  ({
    data,
    index,
    style,
  }: {
    data: any;
    index: number;
    style: React.CSSProperties;
  }) => {
    const {
      library,
      handleMusicClick,
      playNext,
      addToQueue,
      playlists,
      addSongToPlaylist,
      renderAdditionalMenuItems,
    } = data;
    const song = library[index];

    return (
      <div style={style}>
        <SongItem
          song={song}
          index={index}
          handleMusicClick={handleMusicClick}
          playNext={playNext}
          addToQueue={addToQueue}
          playlists={playlists}
          addSongToPlaylist={addSongToPlaylist}
          renderAdditionalMenuItems={renderAdditionalMenuItems}
        />
      </div>
    );
  },
);

Row.displayName = "Row";

// Loading indicator row that appears at the bottom of the list
const LoadingRow = memo(({ style }: { style: React.CSSProperties }) => {
  return (
    <div style={style} className="flex items-center justify-center py-4">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/10 border-t-black dark:border-white/10 dark:border-t-white"></div>
    </div>
  );
});

LoadingRow.displayName = "LoadingRow";

// Adding imperative handle to expose methods for scrolling
const Songs = forwardRef<
  { scrollToTop: () => void }, // Methods exposed via ref
  SongsProps
>(
  (
    {
      library,
      renderAdditionalMenuItems,
      limit,
      disableScroll,
      onLoadMore,
      hasMore = false,
      loadingMore = false,
    },
    ref,
  ) => {
    const { setQueueAndPlay, playNext, addToQueue } = usePlayer();
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<any>(null);
    const isNearBottomRef = useRef(false);

    // Expose methods to parent component via ref
    useImperativeHandle(ref, () => ({
      scrollToTop: () => {
        if (listRef.current) {
          listRef.current.scrollTo(0);
        }
      },
    }));

    // Load playlists data only once
    useEffect(() => {
      window.ipc.invoke("getAllPlaylists").then((response) => {
        setPlaylists(response);
      });
    }, []);

    const handleMusicClick = useCallback(
      (index: number) => {
        setQueueAndPlay(library, index);
      },
      [library, setQueueAndPlay],
    );

    const addSongToPlaylist = useCallback(
      (playlistId: number, songId: number) => {
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
      },
      [],
    );

    // Function to handle scrolling events and trigger loading more content
    const handleScroll = useCallback(
      ({ scrollOffset, scrollUpdateWasRequested }) => {
        if (!onLoadMore || !hasMore || loadingMore || disableScroll) return;

        // Only calculate when this is a user scroll, not a programmatic one
        if (!scrollUpdateWasRequested && listRef.current) {
          const list = listRef.current;
          const clientHeight = list._outerRef.clientHeight;
          const scrollHeight = list._outerRef.scrollHeight;

          // Trigger loading when we're 200px from the bottom
          const threshold = 200;
          const isNearBottom =
            scrollHeight - scrollOffset - clientHeight < threshold;

          if (isNearBottom && !isNearBottomRef.current) {
            isNearBottomRef.current = true;
            onLoadMore();
          } else if (!isNearBottom && isNearBottomRef.current) {
            isNearBottomRef.current = false;
          }
        }
      },
      [onLoadMore, hasMore, loadingMore, disableScroll],
    );

    // Memoized data for the virtualized list
    const itemData = useMemo(
      () => ({
        library,
        handleMusicClick,
        playNext,
        addToQueue,
        playlists,
        addSongToPlaylist,
        renderAdditionalMenuItems,
      }),
      [
        library,
        handleMusicClick,
        playNext,
        addToQueue,
        playlists,
        addSongToPlaylist,
        renderAdditionalMenuItems,
      ],
    );

    // Limit the number of songs if a limit is specified
    const limitedLibrary = useMemo(() => {
      if (!library) return [];
      return limit ? library.slice(0, limit) : library;
    }, [library, limit]);

    // Calculate the total number of items including the loading indicator
    const itemCount = useMemo(() => {
      if (!library) return 0;
      // Add an extra row for the loading indicator if we have more to load
      return hasMore && !disableScroll ? library.length + 1 : library.length;
    }, [library, hasMore, disableScroll]);

    // Row renderer that handles both song items and the loading indicator
    const rowRenderer = useCallback(
      (props) => {
        const { index, style } = props;

        // If this is the last item and we have more to load, show loading indicator
        if (index === library.length && hasMore) {
          return <LoadingRow style={style} />;
        }

        // Otherwise, render a regular song row
        return <Row {...props} />;
      },
      [library, hasMore],
    );

    // If disableScroll is true, render static song items instead of virtualized list
    if (disableScroll) {
      return (
        <div className="relative flex w-full flex-col" ref={containerRef}>
          {limitedLibrary && limitedLibrary.length > 0 ? (
            <div className="space-y-1">
              {limitedLibrary.map((song, index) => (
                <SongItem
                  key={song.id}
                  song={song}
                  index={index}
                  handleMusicClick={handleMusicClick}
                  playNext={playNext}
                  addToQueue={addToQueue}
                  playlists={playlists}
                  addSongToPlaylist={addSongToPlaylist}
                  renderAdditionalMenuItems={renderAdditionalMenuItems}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center p-10 text-gray-500">
              No songs found
            </div>
          )}
        </div>
      );
    }

    // Default behavior: render virtualized list with scrolling
    return (
      <div
        className="relative flex h-[calc(100vh-350px)] w-full flex-col"
        ref={containerRef}
      >
        {library && library.length > 0 ? (
          <AutoSizer>
            {({ height, width }) => (
              <List
                height={height || 600}
                width={width || "100%"}
                itemCount={itemCount}
                itemSize={72} // Approximate height of each song item
                itemData={itemData}
                className="no-scrollbar"
                ref={listRef}
                overscanCount={5} // Render more items above and below the visible area
                onScroll={handleScroll}
              >
                {rowRenderer}
              </List>
            )}
          </AutoSizer>
        ) : (
          <div className="flex items-center justify-center p-10 text-gray-500">
            No songs found
          </div>
        )}
      </div>
    );
  },
);

Songs.displayName = "Songs";

export default memo(Songs);
