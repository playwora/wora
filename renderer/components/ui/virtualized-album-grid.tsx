import React, { useEffect, useRef, useState, useCallback } from "react";
import { FixedSizeGrid as Grid } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import Image from "next/image";
import Link from "next/link";

// Updated Album type to match what's used in albums.tsx
type Album = {
  id: string;
  name: string;
  artist: string;
  cover?: string;
  artworkUrl?: string; // Keep for backwards compatibility
  songs?: any[];
  duration?: number;
  year?: number;
};

interface VirtualizedAlbumGridProps {
  albums: Album[];
  navigateToArtist: (artist: string, e: React.MouseEvent) => void;
  calculateAlbumDuration: (album: Album) => Promise<string> | string;
  viewMode: string;
  onLoadMore?: () => void; // Add callback for infinite scrolling
}

// Custom styles to hide scrollbars
const scrollbarHiddenStyles = {
  // Hide scrollbar for Chrome, Safari and Opera
  "&::-webkit-scrollbar": {
    display: "none",
  },
  // Hide scrollbar for IE, Edge and Firefox
  msOverflowStyle: "none", // IE and Edge
  scrollbarWidth: "none", // Firefox
  overflow: "scroll", // Keep scroll functionality
};

// Skeleton loader for album covers
const AlbumSkeleton = () => (
  <div className="absolute inset-0 h-full w-full animate-pulse bg-neutral-200 dark:bg-neutral-800" />
);

const VirtualizedAlbumGrid: React.FC<VirtualizedAlbumGridProps> = ({
  albums,
  navigateToArtist,
  calculateAlbumDuration,
  viewMode,
  onLoadMore,
}) => {
  const gridRef = useRef<any>(null);
  // Track album durations that have been calculated - keep reference stable
  const [albumDurations, setAlbumDurations] = useState<{
    [key: string]: string;
  }>({});
  // Add a key that changes when albums or viewMode changes to force grid re-render
  const [gridKey, setGridKey] = useState(0);

  // Track the current scroll position
  const scrollPositionRef = useRef(0);
  // Debounce flag to prevent multiple onLoadMore calls
  const isLoadingMoreRef = useRef(false);
  // Timer for debouncing onLoadMore calls
  const loadMoreTimerRef = useRef<any>(null);

  // Restore scroll position and grid when needed
  const resetGrid = useCallback(() => {
    if (gridRef.current) {
      // Reset scroll position
      if (gridRef.current._outerRef) {
        gridRef.current._outerRef.scrollTop = 0;
        scrollPositionRef.current = 0;
      }

      // Force grid re-render
      setGridKey((prevKey) => prevKey + 1);

      // Reset loading more state
      isLoadingMoreRef.current = false;
      if (loadMoreTimerRef.current) {
        clearTimeout(loadMoreTimerRef.current);
        loadMoreTimerRef.current = null;
      }
    }
  }, []);

  // Expose methods via ref
  React.useImperativeHandle(
    gridRef,
    () => ({
      scrollToItem: (rowIndex, columnIndex = 0) => {
        if (gridRef.current) {
          gridRef.current.scrollToItem({ rowIndex, columnIndex });
          // Update the scroll position ref after scrolling
          setTimeout(() => {
            if (gridRef.current && gridRef.current._outerRef) {
              scrollPositionRef.current = gridRef.current._outerRef.scrollTop;
            }
          }, 50);
        }
      },
      resetAfterIndex: (index, shouldForceUpdate) => {
        if (gridRef.current) {
          // Store current scroll position
          if (gridRef.current._outerRef) {
            scrollPositionRef.current = gridRef.current._outerRef.scrollTop;
          }

          gridRef.current.resetAfterRowIndex(index, shouldForceUpdate);

          // Restore scroll position after reset
          setTimeout(() => {
            if (gridRef.current && gridRef.current._outerRef) {
              gridRef.current._outerRef.scrollTop = scrollPositionRef.current;
            }
          }, 0);
        }
      },
      resetGrid,
    }),
    [resetGrid],
  );

  // Recalculate grid when view mode changes (but not on every album change)
  useEffect(() => {
    // Force grid to re-render only on view mode change
    setGridKey((prevKey) => prevKey + 1);
  }, [viewMode]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (loadMoreTimerRef.current) {
        clearTimeout(loadMoreTimerRef.current);
      }
    };
  }, []);

  // Preload album durations immediately on mount and when albums change
  useEffect(() => {
    const loadDurations = async () => {
      // Create a new map to avoid mutation issues
      const newDurationsMap: { [key: string]: string } = { ...albumDurations };
      let hasNewDurations = false;

      // Only process albums that don't already have a duration
      const albumsToProcess = albums.filter(
        (album) => !newDurationsMap[album.id],
      );

      for (const album of albumsToProcess) {
        try {
          const duration = await calculateAlbumDuration(album);
          newDurationsMap[album.id] = duration;
          hasNewDurations = true;
        } catch (error) {
          newDurationsMap[album.id] = "--:--";
          hasNewDurations = true;
        }
      }

      // Only update state if we have new durations
      if (hasNewDurations) {
        setAlbumDurations(newDurationsMap);
      }
    };

    loadDurations();
  }, [albums, calculateAlbumDuration]);

  // Determine column count based on view mode
  const getColumnCount = (width: number) => {
    if (viewMode === "list") return 1;
    if (viewMode === "compact-grid")
      return Math.max(1, Math.floor(width / 180));
    return Math.max(1, Math.floor(width / 240)); // Default grid view
  };

  // Get item height based on view mode and column width
  const getItemHeight = (width: number, columnCount: number) => {
    if (viewMode === "list") return 100;

    // For grid views, calculate based on aspect ratio + text space
    const columnWidth = width / columnCount;
    const imageHeight = columnWidth; // 1:1 aspect ratio for album covers
    const textHeight = viewMode === "compact-grid" ? 30 : 60; // Space for text

    return imageHeight + textHeight;
  };

  // Handle scroll events for infinite scrolling
  const handleScroll = useCallback(
    ({ scrollTop, scrollHeight, clientHeight }) => {
      // Store the current scroll position for potential recovery
      scrollPositionRef.current = scrollTop;

      // If we're close to the bottom and onLoadMore callback exists, trigger it
      if (onLoadMore && scrollTop + clientHeight >= scrollHeight - 500) {
        // Use debouncing to prevent multiple calls
        if (!isLoadingMoreRef.current) {
          isLoadingMoreRef.current = true;

          if (loadMoreTimerRef.current) {
            clearTimeout(loadMoreTimerRef.current);
          }

          loadMoreTimerRef.current = setTimeout(() => {
            onLoadMore();
            // Reset the loading flag after some time
            setTimeout(() => {
              isLoadingMoreRef.current = false;
            }, 1000); // Prevent another load more call for 1 second
          }, 100);
        }
      }
    },
    [onLoadMore],
  );

  // Handle newly rendered items - can be used for lazy loading images etc.
  const handleItemsRendered = useCallback(
    ({ visibleRowStopIndex, overscanRowStopIndex }) => {
      // We'll rely primarily on handleScroll for infinite scrolling
    },
    [],
  );

  // After a re-render (like when new data is loaded), try to maintain scroll position
  useEffect(() => {
    if (
      gridRef.current &&
      gridRef.current._outerRef &&
      scrollPositionRef.current > 0
    ) {
      // Try to restore scroll position after data changes
      const timer = setTimeout(() => {
        if (gridRef.current && gridRef.current._outerRef) {
          gridRef.current._outerRef.scrollTop = scrollPositionRef.current;
        }
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [albums.length]); // Only run when the number of albums changes

  const Cell = ({ columnIndex, rowIndex, style, data }) => {
    const { items, columnCount, onArtistClick, calculateDuration, viewMode } =
      data;
    const index = rowIndex * columnCount + columnIndex;

    if (index >= items.length) {
      return <div style={style} />;
    }

    const album = items[index];
    const imageSrc = album.cover
      ? `wora://${album.cover}`
      : album.artworkUrl || "/coverArt.png";
    const duration = albumDurations[album.id] || "--:--";

    const [imgLoaded, setImgLoaded] = useState(false);

    // Render different views based on viewMode
    if (viewMode === "list") {
      return (
        <div style={style}>
          <Link
            href={`/albums/${album.id}`}
            className="group/album flex w-full items-center justify-between rounded-xl border border-gray-200 p-4 transition-all duration-200 hover:bg-black/5 hover:shadow-md dark:border-gray-800 dark:hover:bg-white/10"
          >
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-lg shadow-lg">
                {!imgLoaded && <AlbumSkeleton />}
                <Image
                  alt={album.name}
                  src={imageSrc}
                  fill
                  loading="lazy"
                  className={`object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                  quality={10}
                  onLoad={() => setImgLoaded(true)}
                />
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-medium">{album.name}</p>
                <button
                  onClick={(e) => onArtistClick(album.artist, e)}
                  className="text-start opacity-60 hover:underline hover:opacity-100"
                >
                  {album.artist}
                </button>
                <div className="flex items-center gap-2">
                  {album.year && (
                    <p className="text-xs opacity-50">Year: {album.year}</p>
                  )}
                  <div className="text-xs opacity-50">•</div>
                  <p
                    className="text-xs opacity-50"
                    title="Total album duration"
                  >
                    Duration: {duration}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        </div>
      );
    }

    // Grid view (default or compact)
    if (viewMode === "compact-grid") {
      return (
        <div style={style} className="p-1">
          <Link
            href={`/albums/${album.id}`}
            className="group/album flex flex-col items-center"
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-lg shadow-md transition-all duration-200 hover:shadow-xl">
              {!imgLoaded && <AlbumSkeleton />}
              <Image
                alt={album.name}
                src={imageSrc}
                fill
                loading="lazy"
                className={`object-cover transition-opacity duration-1000 group-hover/album:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 16vw"
                quality={20}
                onLoad={() => setImgLoaded(true)}
              />
            </div>
            <p
              className="mt-2 w-full truncate text-center text-xs font-medium"
              title={album.name}
            >
              {album.name}
            </p>
          </Link>
        </div>
      );
    }

    // Default grid view
    return (
      <div style={style} className="p-2">
        <Link
          href={`/albums/${album.id}`}
          className="group/album flex flex-col"
        >
          <div className="relative aspect-square w-full overflow-hidden rounded-lg shadow-md transition-all duration-200 hover:shadow-xl">
            {!imgLoaded && <AlbumSkeleton />}
            <Image
              alt={album.name}
              src={imageSrc}
              fill
              loading="lazy"
              className={`object-cover transition-opacity duration-1000 group-hover/album:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
              quality={50}
              onLoad={() => setImgLoaded(true)}
            />
          </div>
          <div className="mt-3 flex flex-col">
            <p className="truncate font-medium" title={album.name}>
              {album.name}
            </p>
            <div className="flex items-center justify-between">
              <button
                onClick={(e) => onArtistClick(album.artist, e)}
                className="truncate text-start text-sm opacity-60 hover:underline hover:opacity-100"
                title={album.artist}
              >
                {album.artist}
              </button>
              <span className="shrink-0 text-xs opacity-50">{duration}</span>
            </div>
          </div>
        </Link>
      </div>
    );
  };

  return (
    <div className="h-full w-full">
      <AutoSizer>
        {({ height, width }) => {
          const columnCount = getColumnCount(width);
          const rowCount = Math.ceil(albums.length / columnCount);
          const itemHeight = getItemHeight(width, columnCount);

          return (
            <Grid
              key={gridKey}
              ref={gridRef}
              columnCount={columnCount}
              columnWidth={width / columnCount}
              height={height}
              rowCount={rowCount}
              rowHeight={itemHeight}
              width={width}
              itemData={{
                items: albums,
                columnCount,
                onArtistClick: navigateToArtist,
                calculateDuration: calculateAlbumDuration,
                viewMode,
              }}
              style={scrollbarHiddenStyles}
              overscanRowCount={5} // Increase overscan to improve scrolling experience
              initialScrollOffset={0} // Always start at the top
              onScroll={handleScroll}
              onItemsRendered={handleItemsRendered}
              useIsScrolling={false} // Disable isScrolling to improve performance
            >
              {Cell}
            </Grid>
          );
        }}
      </AutoSizer>
    </div>
  );
};

export default React.memo(VirtualizedAlbumGrid); // Use memo to prevent unnecessary re-renders
