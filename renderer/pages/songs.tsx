import React, { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import Songs from "@/components/ui/songs";
import { usePlayer } from "@/context/playerContext";
import Spinner from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconArrowsShuffle2,
  IconSortAscending,
  IconSortDescending,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import songCache from "@/lib/songCache";

export default function AllSongs() {
  // Initialize state from the global song cache
  const [songs, setSongs] = useState(songCache.getAllSongs());
  const [filteredSongs, setFilteredSongs] = useState(
    songCache.getFilteredSongs(),
  );
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [page, setPage] = useState(songCache.getPage());
  const [hasMore, setHasMore] = useState(songCache.hasMore());

  // Get sort settings from cache
  const cachedSortSettings = songCache.getSortSettings();
  const [sortBy, setSortBy] = useState(cachedSortSettings.sortBy);
  const [sortOrder, setSortOrder] = useState(cachedSortSettings.sortOrder);

  // Get last search query from cache
  const [searchTerm, setSearchTerm] = useState(songCache.getLastSearchQuery());

  const { setQueueAndPlay } = usePlayer();
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Add ref to Songs component
  const songsListRef = useRef<{ scrollToTop: () => void }>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Listen for page reset events
  useEffect(() => {
    // Listen for reset event from main process
    const resetListener = window.ipc.on("resetSongsState", () => {
      // First, clear the search and cache state
      setSearchTerm("");
      songCache.setSearchResults([], "");

      // Reset sort options to defaults
      setSortBy("name");
      setSortOrder("asc");

      // Clear existing song data to prevent duplicates
      setSongs([]);
      setFilteredSongs([]);

      // Force reset pagination state
      setPage(1);
      setHasMore(true);

      // Reset scroll position if songs list ref is available
      if (songsListRef.current && songsListRef.current.scrollToTop) {
        songsListRef.current.scrollToTop();
      }

      // Force immediate reload of fresh data
      setTimeout(() => {
        loadSongs(true);
      }, 0);
    });

    return () => {
      // Clean up event listener
      resetListener();
    };
  }, []);

  // Load songs on initial render
  useEffect(() => {
    if (!songCache.isInitialized() || songCache.isStale()) {
      loadSongs();
      songCache.setInitialized();
    } else {
      // Use the cached data
      setSongs(songCache.getAllSongs());
      setFilteredSongs(songCache.getFilteredSongs());

      // If we have a search query, use the cached search results
      if (searchTerm) {
        setFilteredSongs(songCache.getSearchResults());
      }
    }
  }, []);

  // Load songs from the database with pagination
  const loadSongs = useCallback(
    async (isReset = false) => {
      // When resetting, ignore hasMore/loading restrictions
      if (!isReset && (loading || !hasMore) && !searchTerm) return;

      console.log("Loading songs: page", isReset ? 1 : page);
      setLoading(true);

      // If this is a reset load, reset the song state
      const pageToLoad = isReset ? 1 : page;

      try {
        // Get paginated songs
        const newSongs = await window.ipc.invoke("getSongs", pageToLoad);

        if (newSongs.length === 0) {
          console.log("No more songs to load");
          setHasMore(false);
          songCache.updatePagination(pageToLoad, false);
        } else {
          console.log(`Loaded ${newSongs.length} songs`);
          // Process songs to ensure complete data
          const processedSongs = newSongs.map((song) => ({
            ...song,
            album: {
              id: song.album?.id || null,
              name: song.album?.name || "Unknown Album",
              artist: song.album?.artist || "Unknown Artist",
              cover: song.album?.cover || null,
              year: song.album?.year || null,
            },
          }));

          // For reset operations, replace the entire song list
          if (isReset) {
            setSongs(processedSongs);

            // Sort with default settings
            const sortedSongs = songCache.sortSongs(
              processedSongs,
              sortBy,
              sortOrder,
            );
            setFilteredSongs(sortedSongs);
            songCache.setFilteredSongs(sortedSongs);
            songCache.setAllSongs(processedSongs);

            // Update pagination
            setPage(2); // Set to 2 because we just loaded page 1
            songCache.updatePagination(2, true);
          } else {
            // Regular pagination behavior follows
            const updatedSongs = [...songs, ...processedSongs];
            setSongs(updatedSongs);
            setPage(page + 1);

            // Only update filtered songs if not searching
            if (!searchTerm) {
              const sortedSongs = songCache.sortSongs(
                updatedSongs,
                sortBy,
                sortOrder,
              );
              setFilteredSongs(sortedSongs);
              songCache.setFilteredSongs(sortedSongs);
            }

            // Update global cache
            songCache.addSongs(processedSongs);
            songCache.updatePagination(page + 1, true);
          }
        }
      } catch (error) {
        console.error("Error loading songs:", error);
      } finally {
        setLoading(false);
      }
    },
    [page, loading, hasMore, songs, searchTerm, sortBy, sortOrder],
  );

  // Handle search with debounce
  const handleSearch = useCallback(
    async (term) => {
      // Clear any pending search
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }

      if (!term) {
        // If search is cleared, show all sorted songs
        const sortedSongs = songCache.sortSongs(songs, sortBy, sortOrder);
        setFilteredSongs(sortedSongs);
        songCache.setFilteredSongs(sortedSongs);
        songCache.setSearchResults([], "");
        return;
      }

      setSearchLoading(true);

      // Debounce search to avoid too many requests
      searchTimeout.current = setTimeout(async () => {
        try {
          // Always use the dedicated searchSongs endpoint to search the entire database
          // This ensures we search all songs regardless of how many have been loaded
          const results = await window.ipc.invoke("searchSongs", term);

          if (results && results.length >= 0) {
            // Process results to ensure complete data
            const processedResults = results.map((song) => ({
              ...song,
              album: {
                id: song.album?.id || null,
                name: song.album?.name || "Unknown Album",
                artist: song.album?.artist || "Unknown Artist",
                cover: song.album?.cover || null,
                year: song.album?.year || null,
              },
            }));

            const sortedResults = songCache.sortSongs(
              processedResults,
              sortBy,
              sortOrder,
            );
            setFilteredSongs(sortedResults);

            // Update cache with search results
            songCache.setSearchResults(sortedResults, term);

            // Also update the entire songs collection if appropriate
            if (processedResults.length > songs.length) {
              songCache.setAllSongs(processedResults);
              setSongs(processedResults);
            }
          } else {
            // If no results, show empty list
            setFilteredSongs([]);
            songCache.setSearchResults([], term);
          }
        } catch (error) {
          console.error("Error searching songs:", error);
          // Fall back to empty results
          setFilteredSongs([]);
          songCache.setSearchResults([], term);
        } finally {
          setSearchLoading(false);
        }
      }, 300);
    },
    [songs, sortBy, sortOrder],
  );

  // Handle shuffle all songs
  const handleShuffleAllSongs = async () => {
    // If we're searching or filtering, shuffle only the filtered songs
    if (searchTerm || filteredSongs.length !== songs.length) {
      if (filteredSongs.length > 0) {
        setQueueAndPlay(filteredSongs, 0, true);
      }
      return;
    }

    // Handle shuffling all songs
    setSearchLoading(true);
    try {
      // Use cached all songs if available and not stale
      let allSongs = songCache.getAllSongs();

      // If the cache doesn't have all songs or is stale, fetch them
      if (allSongs.length === 0 || songCache.isStale()) {
        allSongs = await window.ipc.invoke("getAllSongs");

        if (allSongs && allSongs.length > 0) {
          // Process and cache all songs
          const processedSongs = allSongs.map((song) => ({
            ...song,
            album: {
              id: song.album?.id || null,
              name: song.album?.name || "Unknown Album",
              artist: song.album?.artist || "Unknown Artist",
              cover: song.album?.cover || null,
            },
          }));

          songCache.setAllSongs(processedSongs);
          allSongs = processedSongs;
        }
      }

      if (allSongs.length > 0) {
        // Shuffle and play all songs
        setQueueAndPlay(allSongs, 0, true);
      }
    } catch (error) {
      console.error("Error fetching all songs:", error);
      if (filteredSongs.length > 0) {
        setQueueAndPlay(filteredSongs, 0, true);
      }
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle play all songs in current order
  const handlePlayAllSongs = async () => {
    // If we're searching or filtering, play only the filtered songs
    if (searchTerm || filteredSongs.length !== songs.length) {
      if (filteredSongs.length > 0) {
        setQueueAndPlay(filteredSongs, 0, false);
      }
      return;
    }

    // Handle playing all songs
    setSearchLoading(true);
    try {
      // Use cached all songs if available and not stale
      let allSongs = songCache.getAllSongs();

      // If the cache doesn't have all songs or is stale, fetch them
      if (allSongs.length === 0 || songCache.isStale()) {
        allSongs = await window.ipc.invoke("getAllSongs");

        if (allSongs && allSongs.length > 0) {
          // Process and cache all songs
          const processedSongs = allSongs.map((song) => ({
            ...song,
            album: {
              id: song.album?.id || null,
              name: song.album?.name || "Unknown Album",
              artist: song.album?.artist || "Unknown Artist",
              cover: song.album?.cover || null,
            },
          }));

          songCache.setAllSongs(processedSongs);
          allSongs = processedSongs;
        }
      }

      if (allSongs.length > 0) {
        // Sort and play all songs
        const sortedSongs = songCache.sortSongs(allSongs, sortBy, sortOrder);
        setQueueAndPlay(sortedSongs, 0, false);
      }
    } catch (error) {
      console.error("Error fetching all songs:", error);
      if (filteredSongs.length > 0) {
        setQueueAndPlay(filteredSongs, 0, false);
      }
    } finally {
      setSearchLoading(false);
    }
  };

  // Update search when term changes
  useEffect(() => {
    handleSearch(searchTerm);
  }, [searchTerm, handleSearch]);

  // Update sorting when sort parameters change
  useEffect(() => {
    // Update the global cache with new sort settings
    songCache.updateSortSettings(sortBy, sortOrder);

    if (searchTerm) {
      // If we're searching, sort the existing search results
      const searchResults = songCache.getSearchResults();
      if (searchResults.length > 0) {
        const sortedResults = songCache.sortSongs(
          searchResults,
          sortBy,
          sortOrder,
        );
        setFilteredSongs(sortedResults);
        songCache.setSearchResults(sortedResults, searchTerm);
      }
    } else {
      // If not searching, fetch and sort all songs
      const fetchAndSortAllSongs = async () => {
        setSearchLoading(true);
        try {
          // Always query all songs from the database to ensure comprehensive sorting
          const allSongs = await window.ipc.invoke("getAllSongs");

          if (allSongs && allSongs.length > 0) {
            // Process and cache all songs
            const processedSongs = allSongs.map((song) => ({
              ...song,
              album: {
                id: song.album?.id || null,
                name: song.album?.name || "Unknown Album",
                artist: song.album?.artist || "Unknown Artist",
                cover: song.album?.cover || null,
              },
            }));

            // Update the complete song collection in cache
            songCache.setAllSongs(processedSongs);

            // Sort and display all songs with the new sort parameters
            const sortedSongs = songCache.sortSongs(
              processedSongs,
              sortBy,
              sortOrder,
            );
            setFilteredSongs(sortedSongs);
            songCache.setFilteredSongs(sortedSongs);

            // Update local state
            setSongs(processedSongs);
          } else {
            // Fall back to sorting just the loaded songs if the query failed
            const sortedSongs = songCache.sortSongs(songs, sortBy, sortOrder);
            setFilteredSongs(sortedSongs);
            songCache.setFilteredSongs(sortedSongs);
          }
        } catch (error) {
          console.error("Error fetching all songs for sorting:", error);
          // Fall back to sorting just the loaded songs
          const sortedSongs = songCache.sortSongs(songs, sortBy, sortOrder);
          setFilteredSongs(sortedSongs);
          songCache.setFilteredSongs(sortedSongs);
        } finally {
          setSearchLoading(false);
        }
      };

      fetchAndSortAllSongs();
    }
  }, [sortBy, sortOrder]);

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder((prevOrder) => (prevOrder === "asc" ? "desc" : "asc"));
  };

  // Clear search term
  const clearSearch = () => {
    setSearchTerm("");
  };

  // Handle loading more songs when user scrolls near the bottom
  const handleLoadMore = useCallback(() => {
    if (!searchTerm && !loading && hasMore) {
      console.log("Loading more songs from scroll trigger");
      loadSongs();
    }
  }, [loadSongs, hasMore, loading, searchTerm]);

  // Show loading indicators
  const isLoadingInitial = loading && songs.length === 0;
  const isSearching = searchLoading && searchTerm;

  return (
    <div className="flex flex-col gap-8" ref={contentRef}>
      <div className="flex flex-col gap-8">
        <div className="flex w-full items-center justify-between">
          <div className="flex flex-col">
            <div className="mt-4 text-lg font-medium leading-6">Songs</div>
            <div className="opacity-50">
              All your songs in one place, ready to be sorted and filtered.
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={handlePlayAllSongs}
              className="flex items-center gap-2"
              disabled={isLoadingInitial || filteredSongs.length === 0}
            >
              Play All
            </Button>
            <Button
              onClick={handleShuffleAllSongs}
              className="flex items-center gap-2"
              disabled={isLoadingInitial || filteredSongs.length === 0}
            >
              <IconArrowsShuffle2 stroke={2} size={16} />
              Shuffle
            </Button>
          </div>
        </div>

        {/* Search and filter section */}
        <div className="flex w-full items-center gap-4">
          <div className="relative w-full max-w-md">
            <Input
              placeholder="Search by song, artist or album..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-8"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <IconX size={16} stroke={2} />
              </button>
            )}
            <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
              <IconSearch size={16} stroke={2} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Song Title</SelectItem>
                <SelectItem value="artist">Artist</SelectItem>
                <SelectItem value="album">Album</SelectItem>
                <SelectItem value="duration">Duration</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={toggleSortOrder} className="px-2">
              {sortOrder === "asc" ? (
                <IconSortAscending stroke={2} size={20} />
              ) : (
                <IconSortDescending stroke={2} size={20} />
              )}
            </Button>
          </div>
        </div>

        {isLoadingInitial || isSearching ? (
          <div className="flex w-full items-center justify-center py-12">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <>
            {filteredSongs.length > 0 ? (
              <Songs
                library={filteredSongs}
                ref={songsListRef}
                onLoadMore={handleLoadMore}
                hasMore={hasMore && !searchTerm}
                loadingMore={loading}
              />
            ) : (
              <div className="flex w-full items-center justify-center p-10 text-gray-500">
                {searchTerm
                  ? "No songs matching your search"
                  : "No songs found in your library"}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
