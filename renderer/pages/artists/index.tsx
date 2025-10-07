import React, { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useRouter } from "next/router";
import { useScrollAreaRestoration } from "@/hooks/useScrollAreaRestoration";
import { useDebounce } from "@/hooks/useDebounce";
import Image from "next/image";
import { 
  IconUser, 
  IconSearch, 
  IconLayoutGrid, 
  IconLayoutList,
  IconGridDots,
  IconSortAscending,
  IconSortDescending
} from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import Spinner from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArtistGridSkeleton } from "@/components/LoadingSkeletons";
import ErrorBoundary from "@/components/ErrorBoundary";

type ArtistItem = {
  name: string;
  albumCount: number;
  songCount: number;
  cover?: string;
};

type ViewMode = "grid-large" | "grid-small" | "list";
type SortBy = "name" | "albums" | "songs";
type SortOrder = "asc" | "desc";


export default function ArtistsPage() {
  const router = useRouter();
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useScrollAreaRestoration('artists');
  
  
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("artistsViewMode") as ViewMode) || "grid-large";
    }
    return "grid-large";
  });
  
  const [sortBy, setSortBy] = useState<SortBy>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("artistsSortBy") as SortBy) || "name";
    }
    return "name";
  });
  
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("artistsSortOrder") as SortOrder) || "asc";
    }
    return "asc";
  });
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("artistsViewMode", viewMode);
    }
  }, [viewMode]);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("artistsSortBy", sortBy);
    }
  }, [sortBy]);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("artistsSortOrder", sortOrder);
    }
  }, [sortOrder]);

  useEffect(() => {
    const loadArtists = async () => {
      setLoading(true);
      setError(null);
      try {
        const allArtists = await window.ipc.invoke("getAllArtists");
        if (Array.isArray(allArtists)) {
          setArtists(allArtists);
        } else {
          throw new Error("Invalid data format received");
        }
      } catch (err) {
        console.error("Error loading artists:", err);
        setError("Failed to load artists. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadArtists();
  }, []);

  useEffect(() => {
    if (searchQuery !== debouncedSearchQuery) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [searchQuery, debouncedSearchQuery]);

  const filteredArtists = useMemo(() => {
    let filtered = artists;
    
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = artists.filter((artist) =>
        artist.name.toLowerCase().includes(query)
      );
    }
    
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "albums":
          comparison = a.albumCount - b.albumCount;
          break;
        case "songs":
          comparison = a.songCount - b.songCount;
          break;
        case "name":
        default:
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });
    
    return sorted;
  }, [debouncedSearchQuery, artists, sortBy, sortOrder]);

  const handleArtistClick = useCallback((artistName: string) => {
    router.push(`/artists/${encodeURIComponent(artistName)}`);
  }, [router]);

  return (
    <TooltipProvider>
      <div className="relative">
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm dark:bg-black/95 pb-4">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col">
              <div className="mt-4 text-lg leading-6 font-medium">Artists</div>
              <div className="opacity-50">
                Browse and discover artists in your music library.
              </div>
            </div>
            
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" size={20} />
              <Input
                type="text"
                placeholder="Search artists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Spinner className="h-4 w-4" />
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border p-1 dark:border-gray-800">
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSortBy("name")}
                      className={`rounded px-2 py-1 text-xs transition ${sortBy === "name" ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      Name
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sort by name</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSortBy("albums")}
                      className={`rounded px-2 py-1 text-xs transition ${sortBy === "albums" ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      Albums
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sort by album count</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSortBy("songs")}
                      className={`rounded px-2 py-1 text-xs transition ${sortBy === "songs" ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      Songs
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sort by song count</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    className="rounded-lg border p-2 transition hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800"
                  >
                    {sortOrder === "asc" ? <IconSortAscending size={16} /> : <IconSortDescending size={16} />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{sortOrder === "asc" ? "Ascending" : "Descending"}</p>
                </TooltipContent>
              </Tooltip>
              
              <div className="flex items-center gap-1 rounded-lg border p-1 dark:border-gray-800">
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setViewMode("grid-large")}
                      className={`rounded p-1 transition ${viewMode === "grid-large" ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      <IconLayoutGrid size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Large Grid</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setViewMode("grid-small")}
                      className={`rounded p-1 transition ${viewMode === "grid-small" ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      <IconGridDots size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Small Grid</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`rounded p-1 transition ${viewMode === "list" ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                    >
                      <IconLayoutList size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>List View</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            </div>
            
            <div className="text-sm opacity-60">
              {filteredArtists.length} {filteredArtists.length === 1 ? "artist" : "artists"}
              {searchQuery && ` matching "${searchQuery}"`}
            </div>
          </div>
        </div>

        <div className="mt-4">
          {error ? (
            <div className="flex h-64 w-full flex-col items-center justify-center">
              <p className="text-lg text-red-500">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition"
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <ArtistGridSkeleton viewMode={viewMode} />
          ) : filteredArtists.length === 0 ? (
            <div className="flex h-64 w-full flex-col items-center justify-center">
              <IconSearch size={48} className="mb-4 opacity-50" />
              <p className="text-lg opacity-50">No artists found</p>
            </div>
          ) : (
            <ErrorBoundary>
              {viewMode === "grid-large" && (
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
                  {filteredArtists.map((artist) => (
                    <div
                      key={artist.name}
                      className="group cursor-pointer"
                      onClick={() => handleArtistClick(artist.name)}
                    >
                      <div className="relative aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 shadow-lg transition duration-300 group-hover:scale-[1.02] group-hover:shadow-xl dark:from-gray-800 dark:to-gray-900">
                        {artist.cover ? (
                          <Image
                            alt={artist.name}
                            src={`wora://${artist.cover}`}
                            fill
                            loading="lazy"
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <IconUser stroke={1.5} size={48} className="opacity-50" />
                          </div>
                        )}
                      </div>
                      <div className="mt-3">
                        <p className="truncate font-medium">{artist.name}</p>
                        <p className="text-xs opacity-60">
                          {artist.albumCount} {artist.albumCount === 1 ? "album" : "albums"} · {artist.songCount} {artist.songCount === 1 ? "song" : "songs"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {viewMode === "grid-small" && (
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12">
                  {filteredArtists.map((artist) => (
                    <div
                      key={artist.name}
                      className="group cursor-pointer"
                      onClick={() => handleArtistClick(artist.name)}
                    >
                      <div className="relative aspect-square overflow-hidden rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 shadow transition duration-300 group-hover:scale-[1.05] group-hover:shadow-lg dark:from-gray-800 dark:to-gray-900">
                        {artist.cover ? (
                          <Image
                            alt={artist.name}
                            src={`wora://${artist.cover}`}
                            fill
                            loading="lazy"
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <IconUser stroke={1.5} size={32} className="opacity-50" />
                          </div>
                        )}
                      </div>
                      <div className="mt-2">
                        <p className="truncate text-xs font-medium">{artist.name}</p>
                        <p className="truncate text-xs opacity-50">
                          {artist.songCount} songs
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {viewMode === "list" && (
                <div className="space-y-1">
                  {filteredArtists.map((artist) => (
                    <div
                      key={artist.name}
                      className="group flex cursor-pointer items-center gap-4 rounded-lg p-3 transition hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => handleArtistClick(artist.name)}
                    >
                      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                        {artist.cover ? (
                          <Image
                            alt={artist.name}
                            src={`wora://${artist.cover}`}
                            fill
                            loading="lazy"
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <IconUser stroke={1.5} size={20} className="opacity-50" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{artist.name}</p>
                        <p className="text-sm opacity-60">
                          {artist.albumCount} {artist.albumCount === 1 ? "album" : "albums"} · {artist.songCount} {artist.songCount === 1 ? "song" : "songs"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ErrorBoundary>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}