import React, { useEffect, useState, useCallback, useRef } from "react";
import AlbumCard from "@/components/ui/album";
import Spinner from "@/components/ui/spinner";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconSearch,
  IconX,
  IconSortAscending,
  IconSortDescending,
  IconLayoutGrid,
  IconLayoutList,
  IconGridDots,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import albumCache from "@/lib/albumCache";

export default function Albums() {
  // Initialize state from the global album cache
  const [albums, setAlbums] = useState(albumCache.getAllAlbums());
  const [filteredAlbums, setFilteredAlbums] = useState(
    albumCache.getFilteredAlbums(),
  );
  const [searchTerm, setSearchTerm] = useState(albumCache.getLastSearchQuery());
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [page, setPage] = useState(albumCache.getPage());
  const [hasMore, setHasMore] = useState(albumCache.hasMore());

  // Get sort settings from cache
  const cachedSortSettings = albumCache.getSortSettings();
  const [sortBy, setSortBy] = useState(cachedSortSettings.sortBy);
  const [sortOrder, setSortOrder] = useState(cachedSortSettings.sortOrder);

  // Initialize view mode from cache
  const [viewMode, setViewMode] = useState(albumCache.getViewMode());

  const router = useRouter();
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const gridRef = useRef(null);

  // Listen for page reset events
  useEffect(() => {
    // Listen for reset event from main process
    const resetListener = window.ipc.on("resetAlbumsState", () => {
      // Reset search term
      setSearchTerm("");

      // Reset sort options to defaults
      setSortBy("name");
      setSortOrder("asc");

      // Reset view mode to default if needed
      setViewMode("grid");

      // Reset album cache search state
      albumCache.setSearchResults([], "");

      // We'll handle the reload in a separate effect that runs when these state values change
      setPage(1);
      setHasMore(true);

      // Reset grid position if ref is available
      if (gridRef.current && gridRef.current.scrollToItem) {
        gridRef.current.scrollToItem(0);
      }
    });

    return () => {
      // Clean up event listener
      resetListener();
    };
  }, []);

  // Load albums on initial render
  useEffect(() => {
    if (!albumCache.isInitialized() || albumCache.isStale()) {
      loadAlbums();
      albumCache.setInitialized();
    } else {
      // Use the cached data
      setAlbums(albumCache.getAllAlbums());
      setFilteredAlbums(albumCache.getFilteredAlbums());

      // If we have a search query, use the cached search results
      if (searchTerm) {
        setFilteredAlbums(albumCache.getSearchResults());
      }
    }
  }, []);

  // Load albums from the database with pagination
  const loadAlbums = useCallback(
    async (isReset = false) => {
      // When resetting, ignore hasMore/loading restrictions
      if (!isReset && (loading || !hasMore) && !searchTerm) return;

      setLoading(true);

      // If this is a reset load, reset the album state
      const pageToLoad = isReset ? 1 : page;

      try {
        // Get paginated albums with durations
        const newAlbums = await window.ipc.invoke(
          "getAlbumsWithDuration",
          pageToLoad,
        );

        if (newAlbums.length === 0) {
          setHasMore(false);
          albumCache.updatePagination(pageToLoad, false);
        } else {
          // For reset operations, replace the entire album list
          if (isReset) {
            setAlbums(newAlbums);

            // Sort with default settings
            const sortedAlbums = albumCache.sortAlbums(
              newAlbums,
              sortBy,
              sortOrder,
            );
            setFilteredAlbums(sortedAlbums);
            albumCache.setFilteredAlbums(sortedAlbums);
            albumCache.setAllAlbums(newAlbums);

            // Update pagination
            setPage(2); // Set to 2 because we just loaded page 1
            albumCache.updatePagination(2, true);
          } else {
            // Regular pagination behavior follows
            // Create a Set of existing album IDs for efficient lookups
            const existingAlbumIds = new Set(albums.map((album) => album.id));

            // Filter out any duplicates from the newly loaded albums
            const uniqueNewAlbums = newAlbums.filter(
              (album) => !existingAlbumIds.has(album.id),
            );

            // Only update if we have unique albums to add
            if (uniqueNewAlbums.length > 0) {
              const updatedAlbums = [...albums, ...uniqueNewAlbums];
              setAlbums(updatedAlbums);

              // Only update filtered albums if not searching
              if (!searchTerm) {
                // Important: preserve reference to previous filtered albums to avoid scroll jumps
                const sortedAlbums = albumCache.sortAlbums(
                  updatedAlbums,
                  sortBy,
                  sortOrder,
                );

                // Use a stable state update to avoid scroll reset
                setFilteredAlbums((prev) => {
                  // If the length is significantly different, just use the new sorted albums
                  if (
                    Math.abs(prev.length - sortedAlbums.length) >
                    uniqueNewAlbums.length
                  ) {
                    return sortedAlbums;
                  }

                  // Otherwise, append the new albums to the existing array for a smoother update
                  const existingIds = new Set(prev.map((album) => album.id));
                  const newItems = sortedAlbums.filter(
                    (album) => !existingIds.has(album.id),
                  );
                  return [...prev, ...newItems];
                });

                albumCache.setFilteredAlbums(sortedAlbums);
              }

              // Update global cache with only the unique new albums
              albumCache.addAlbums(uniqueNewAlbums);
            }

            // Always increment page counter for next fetch
            setPage(page + 1);
            albumCache.updatePagination(page + 1, true);
          }
        }
      } catch (error) {
        console.error("Error loading albums:", error);
      } finally {
        setLoading(false);
      }
    },
    [page, loading, hasMore, albums, searchTerm, sortBy, sortOrder],
  );

  // Load more function with debounce to prevent too frequent calls
  const loadMoreAlbums = useCallback(() => {
    // Using a ref to track loading state locally to avoid excessive re-renders
    if (!loading && hasMore && !searchTerm) {
      console.log("Loading more albums from scroll trigger");
      loadAlbums();
    }
  }, [loadAlbums, loading, hasMore, searchTerm]);

  // When the user scrolls near the end, load more albums
  const onItemsRendered = useCallback(
    ({ visibleStopIndex }) => {
      if (
        !loading &&
        hasMore &&
        !searchTerm &&
        visibleStopIndex >= filteredAlbums.length - 10
      ) {
        loadAlbums();
      }
    },
    [loadAlbums, filteredAlbums.length, loading, hasMore, searchTerm],
  );

  // Handle search with debounce
  const handleSearch = useCallback(
    async (term) => {
      // Clear any pending search
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }

      if (!term) {
        // If search is cleared, show all sorted albums
        const sortedAlbums = albumCache.sortAlbums(albums, sortBy, sortOrder);
        setFilteredAlbums(sortedAlbums);
        albumCache.setFilteredAlbums(sortedAlbums);
        albumCache.setSearchResults([], "");
        return;
      }

      setSearchLoading(true);

      // Debounce search to avoid too many requests
      searchTimeout.current = setTimeout(async () => {
        try {
          // Call the search function to find matching albums
          const results = await window.ipc.invoke("search", term);

          if (
            results &&
            results.searchAlbums &&
            results.searchAlbums.length > 0
          ) {
            // If we got results from the server, use those
            const processedResults = results.searchAlbums;
            const sortedResults = albumCache.sortAlbums(
              processedResults,
              sortBy,
              sortOrder,
            );

            setFilteredAlbums(sortedResults);

            // Update cache with search results
            albumCache.setSearchResults(sortedResults, term);
          } else {
            // If no specific album search results from server, filter locally
            const searchTermLower = term.toLowerCase().trim();
            const localFilteredAlbums = albums.filter(
              (album) =>
                (album.name &&
                  album.name.toLowerCase().includes(searchTermLower)) ||
                (album.artist &&
                  album.artist.toLowerCase().includes(searchTermLower)),
            );

            const sortedResults = albumCache.sortAlbums(
              localFilteredAlbums,
              sortBy,
              sortOrder,
            );
            setFilteredAlbums(sortedResults);

            // Update cache with search results
            albumCache.setSearchResults(sortedResults, term);
          }
        } catch (error) {
          console.error("Error searching albums:", error);
          // Fall back to local filtering as last resort
          const searchTermLower = term.toLowerCase().trim();
          const localFilteredAlbums = albums.filter(
            (album) =>
              (album.name &&
                album.name.toLowerCase().includes(searchTermLower)) ||
              (album.artist &&
                album.artist.toLowerCase().includes(searchTermLower)),
          );

          const sortedResults = albumCache.sortAlbums(
            localFilteredAlbums,
            sortBy,
            sortOrder,
          );
          setFilteredAlbums(sortedResults);

          // Update cache with search results
          albumCache.setSearchResults(sortedResults, term);
        } finally {
          setSearchLoading(false);
        }
      }, 300);
    },
    [albums, sortBy, sortOrder],
  );

  // Handle navigation to artist page
  const navigateToArtist = useCallback(
    (artist: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (artist) {
        router.push(`/artists/${encodeURIComponent(artist)}`);
      }
    },
    [router],
  );

  // Update search when term changes
  useEffect(() => {
    handleSearch(searchTerm);
  }, [searchTerm, handleSearch]);

  // Update sorting when sort parameters change
  useEffect(() => {
    // Update the global cache with new sort settings
    albumCache.updateSortSettings(sortBy, sortOrder);

    if (searchTerm) {
      // If we're searching, sort the existing search results
      const searchResults = albumCache.getSearchResults();
      if (searchResults.length > 0) {
        const sortedResults = albumCache.sortAlbums(
          searchResults,
          sortBy,
          sortOrder,
        );
        setFilteredAlbums(sortedResults);
        albumCache.setSearchResults(sortedResults, searchTerm);
      }
    } else {
      // If not searching, fetch and sort all albums
      const fetchAndSortAllAlbums = async () => {
        setSearchLoading(true);
        try {
          // Use cached all albums if available and not stale
          let allAlbums = albumCache.getAllAlbums();

          // If the cache doesn't have all albums or is stale, fetch them
          if (allAlbums.length === 0 || albumCache.isStale()) {
            // Fetch as many pages as needed to get all albums
            let tempPage = 1;
            let hasMoreAlbums = true;
            let allFetchedAlbums = [];

            while (hasMoreAlbums) {
              const fetchedAlbums = await window.ipc.invoke(
                "getAlbums",
                tempPage,
              );
              if (fetchedAlbums.length === 0) {
                hasMoreAlbums = false;
              } else {
                allFetchedAlbums = [...allFetchedAlbums, ...fetchedAlbums];
                tempPage++;
              }
            }

            if (allFetchedAlbums.length > 0) {
              albumCache.setAllAlbums(allFetchedAlbums);
              allAlbums = allFetchedAlbums;
            }
          }

          if (allAlbums.length > 0) {
            // Sort and display all albums with the new sort parameters
            const sortedAlbums = albumCache.sortAlbums(
              allAlbums,
              sortBy,
              sortOrder,
            );
            setFilteredAlbums(sortedAlbums);
            albumCache.setFilteredAlbums(sortedAlbums);

            // Update local state
            setAlbums(allAlbums);
          } else {
            // Fall back to sorting just the loaded albums
            const sortedAlbums = albumCache.sortAlbums(
              albums,
              sortBy,
              sortOrder,
            );
            setFilteredAlbums(sortedAlbums);
            albumCache.setFilteredAlbums(sortedAlbums);
          }
        } catch (error) {
          console.error("Error fetching all albums for sorting:", error);
          // Fall back to loaded albums
          const sortedAlbums = albumCache.sortAlbums(albums, sortBy, sortOrder);
          setFilteredAlbums(sortedAlbums);
          albumCache.setFilteredAlbums(sortedAlbums);
        } finally {
          setSearchLoading(false);
        }
      };

      fetchAndSortAllAlbums();
    }

    // Reset the grid scroll position when sort changes
    if (gridRef.current && gridRef.current.scrollToItem) {
      gridRef.current.scrollToItem(0);
    }
  }, [sortBy, sortOrder]);

  // Update view mode in cache when it changes
  useEffect(() => {
    albumCache.updateViewMode(viewMode);

    // Reset the grid when view mode changes
    if (gridRef.current && gridRef.current.resetAfterIndex) {
      gridRef.current.resetAfterIndex(0, true);
    }
  }, [viewMode]);

  // Calculate total album duration from album ID - updated to use duration property first
  const calculateAlbumDuration = async (album) => {
    // Use the duration property directly if available
    if (album.duration) {
      return formatDuration(album.duration);
    }

    try {
      // Get album with songs from cache - properly await the Promise
      const cachedAlbum = await albumCache.getAlbumWithSongs(album.id);

      if (cachedAlbum && cachedAlbum.songs && cachedAlbum.songs.length > 0) {
        // Sum up all song durations
        const totalSeconds = cachedAlbum.songs.reduce(
          (total, song) => total + (song.duration || 0),
          0,
        );
        return formatDuration(totalSeconds);
      }
    } catch (error) {
      console.error("Error calculating album duration:", error);
    }

    // Default value if no songs or duration data is available
    return "--:--";
  };

  // Format seconds into MM:SS or HH:MM:SS format
  const formatDuration = (seconds) => {
    if (!seconds) return "--:--";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder((prevOrder) => (prevOrder === "asc" ? "desc" : "asc"));
  };

  // Clear search term
  const clearSearch = () => {
    setSearchTerm("");
  };

  // Show loading indicators
  const isLoadingInitial = loading && albums.length === 0;
  const isSearching = searchLoading && searchTerm;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-8">
        {/* Header with title and description */}
        <div className="flex flex-col">
          <div className="mt-4 text-lg leading-6 font-medium">Albums</div>
          <div className="opacity-50">All of your albums in one place.</div>
        </div>

        {/* Search and filter controls */}
        <div className="flex w-full flex-wrap items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Input
              placeholder="Search by album title or artist name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-8 pl-8"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <IconX size={16} stroke={2} />
              </button>
            )}
            <div className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-gray-400">
              <IconSearch size={16} stroke={2} />
            </div>
          </div>

          {/* Sort and View controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Album Title</SelectItem>
                  <SelectItem value="artist">Artist Name</SelectItem>
                  <SelectItem value="year">Release Year</SelectItem>
                  <SelectItem value="duration">Album Duration</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                onClick={toggleSortOrder}
                className="px-2"
              >
                {sortOrder === "asc" ? (
                  <IconSortAscending stroke={2} size={20} />
                ) : (
                  <IconSortDescending stroke={2} size={20} />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Loading indicators */}
        {isLoadingInitial || isSearching ? (
          <div className="flex w-full items-center justify-center py-12">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <>
            {filteredAlbums.length > 0 ? (
              <div
                ref={gridRef}
                className="grid h-full w-full grid-cols-5 gap-8"
              >
                {filteredAlbums.map((album) => (
                  <AlbumCard
                    key={album.id}
                    album={{ ...album, id: album.id.toString() }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex w-full items-center justify-center p-10 text-gray-500">
                {searchTerm
                  ? "No albums matching your search"
                  : "No albums found in your library"}
              </div>
            )}

            {loading && filteredAlbums.length > 0 && (
              <div className="flex w-full items-center justify-center py-4">
                <Spinner className="h-4 w-4" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
