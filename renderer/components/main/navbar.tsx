import {
  IconDeviceDesktop,
  IconFocusCentered,
  IconInbox,
  IconList,
  IconMoon,
  IconSearch,
  IconSun,
  IconVinyl,
  IconUser,
  IconArrowLeft,
} from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { usePlayer } from "@/context/playerContext";
import Spinner from "@/components/ui/spinner";
import { useTheme } from "next-themes";

type Settings = {
  name: string;
  profilePicture: string;
};

type NavLink = {
  href: string;
  icon: React.ReactNode;
  label: string;
};

const Navbar = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const { setQueueAndPlay } = usePlayer();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isBackButtonVisible, setIsBackButtonVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkBackButton = () => {
      const path = router.pathname;
      const isDetailPage = path.includes('/artists/[') || path.includes('/albums/[') || path.includes('/playlists/[');
      const shouldShow = isDetailPage && window.history.length > 1;
      
      if (shouldShow !== canGoBack) {
        setCanGoBack(shouldShow);
        if (shouldShow) {
          setTimeout(() => setIsBackButtonVisible(true), 50);
        } else {
          setIsBackButtonVisible(false);
        }
      }
    };
    checkBackButton();
    router.events.on('routeChangeComplete', checkBackButton);
    return () => {
      router.events.off('routeChangeComplete', checkBackButton);
    };
  }, [router, canGoBack]);

  const navLinks: NavLink[] = [
    {
      href: "/home",
      icon: <IconInbox stroke={2} className="w-5" />,
      label: "Home",
    },
    {
      href: "/playlists",
      icon: <IconVinyl stroke={2} size={20} />,
      label: "Playlists",
    },
    {
      href: "/songs",
      icon: <IconList stroke={2} size={20} />,
      label: "Songs",
    },
    {
      href: "/albums",
      icon: <IconFocusCentered stroke={2} size={20} />,
      label: "Albums",
    },
    {
      href: "/artists",
      icon: <IconUser stroke={2} size={20} />,
      label: "Artists",
    },
  ];

  const handleThemeToggle = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const renderIcon = () => {
    if (!mounted) {
      return <IconDeviceDesktop stroke={2} className="w-5" />;
    }
    if (theme === "light") {
      return <IconSun stroke={2} className="w-5" />;
    } else if (theme === "dark") {
      return <IconMoon stroke={2} className="w-5" />;
    } else {
      return <IconDeviceDesktop stroke={2} className="w-5" />;
    }
  };

  const isActive = (href: string): boolean => {
    if (href === "/home" && router.pathname === "/") {
      return true;
    }

    return (
      router.pathname === href ||
      (href !== "/home" && router.pathname.startsWith(href))
    );
  };

  const handleNavigation = useCallback(
    (href: string, e: React.MouseEvent) => {
      if (isActive(href)) {
        e.preventDefault();

        if (router.pathname === href) {
          const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
          if (viewport) {
            (viewport as HTMLElement).scrollTop = 0;
          }
          
          if (href === "/albums") {
            window.ipc.send("resetAlbumsPageState", null);
          } else if (href === "/songs") {
            window.ipc.send("resetSongsPageState", null);
          } else if (href === "/playlists") {
            window.ipc.send("resetPlaylistsPageState", null);
          } else if (href === "/home") {
            window.ipc.send("resetHomePageState", null);
          } else if (href === "/artists") {
            window.ipc.send("resetArtistsPageState", null);
          }
        } else {
          // If navigating to a different page, just push the route
          router.push(href);
        }
      }
    },
    [router],
  );

  useEffect(() => {
    const down = (e) => {
      if (e.key === "f" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    setLoading(true);

    if (!search) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      window.ipc.invoke("search", search).then((response) => {
        const albums = response.searchAlbums;
        const playlists = response.searchPlaylists;
        const songs = response.searchSongs;
        const artists = response.searchArtists || [];

        setSearchResults([
          ...artists.map((artist: any) => ({ ...artist, type: "Artist" })),
          ...playlists.map((playlist: any) => ({
            ...playlist,
            type: "Playlist",
          })),
          ...albums.map((album: any) => ({ ...album, type: "Album" })),
          ...songs.map((song: any) => ({ ...song, type: "Song" })),
        ]);

        setLoading(false);
      });
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const openSearch = () => setOpen(true);

  const handleItemClick = (item: any) => {
    if (item.type === "Album") {
      router.push(`/albums/${item.id}`);
    } else if (item.type === "Song") {
      setQueueAndPlay([item], 0);
    } else if (item.type === "Playlist") {
      router.push(`/playlists/${item.id}`);
    } else if (item.type === "Artist") {
      router.push(`/artists/${encodeURIComponent(item.name)}`);
    }
    setOpen(false);
  };

  useEffect(() => {
    window.ipc.invoke("getSettings").then((response) => {
      setSettings(response);
    });

    window.ipc.on("confirmSettingsUpdate", () => {
      window.ipc.invoke("getSettings").then((response) => {
        setSettings(response);
      });
    });
  }, []);

  return (
    <>
      <div className="flex h-full flex-col items-center justify-center gap-10">
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger>
              <Link href="/settings">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={`${settings && settings.profilePicture ? "wora://" + settings.profilePicture : "/userPicture.png"}`}
                  />
                </Avatar>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={25}>
              <p>{settings && settings.name ? settings.name : "Wora User"}</p>
            </TooltipContent>
          </Tooltip>
          <div className="wora-border flex w-18 flex-col items-center gap-10 rounded-2xl p-8 transition-all duration-300 ease-in-out">
            <div
              className={`transition-all duration-300 ease-in-out ${
                canGoBack ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0 -mt-10 overflow-hidden'
              }`}
            >
              {(canGoBack || isBackButtonVisible) && (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      onClick={() => router.back()}
                      className={`transition-all duration-300 ${
                        isBackButtonVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
                      }`}
                    >
                      <IconArrowLeft stroke={2} className="w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={50}>
                    <p>Back</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            
            {navLinks.map((link) => (
              <Tooltip key={link.href} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className={isActive(link.href) && "opacity-100"}
                  >
                    <Link
                      href={link.href}
                      onClick={(e) => handleNavigation(link.href, e)}
                      className="flex h-full w-full items-center justify-center"
                    >
                      {link.icon}
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={50}>
                  <p>{link.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button variant="ghost" onClick={openSearch}>
                  <IconSearch stroke={2} className="w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={50}>
                <p>Search</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" onClick={handleThemeToggle}>
                {renderIcon()}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={25}>
              <p className="capitalize">Theme: {mounted ? theme : 'system'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput
            placeholder="Search for a song, album or playlist..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading && (
              <div className="flex h-[325px] w-full items-center justify-center">
                <Spinner className="h-6 w-6" />
              </div>
            )}
            {search && !loading ? (
              <CommandGroup heading="Search Results" className="pb-2">
                {searchResults.map((item) => (
                  <CommandItem
                    key={`${item.type}-${item.id || item.name}`}
                    value={`${item.name}-${item.type}-${item.id || ""}`}
                    onSelect={() => handleItemClick(item)}
                    className="text-black dark:text-white"
                  >
                    <div className="flex h-full w-full items-center gap-2.5 mask-r-from-70%">
                      {(item.type === "Playlist" || item.type === "Album") && (
                        <div className="relative h-12 w-12 overflow-hidden rounded-lg shadow-xl transition duration-300">
                          <Image
                            className="object-cover"
                            src={`wora://${item.cover}`}
                            alt={item.name}
                            fill
                          />
                        </div>
                      )}
                      {item.type === "Artist" && (
                        <div className="dark:bg.white/10 flex h-12 w-12 items-center justify-center rounded-lg bg-black/10">
                          <IconUser stroke={1.5} size={24} />
                        </div>
                      )}
                      <div>
                        <p className="w-full overflow-hidden text-xs text-nowrap">
                          {item.name}
                          <span className="ml-1 opacity-50">({item.type})</span>
                        </p>
                        <p className="w-full text-xs opacity-50">
                          {item.type === "Playlist"
                            ? item.description
                            : item.type === "Artist"
                              ? "Artist"
                              : item.artist}
                        </p>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <div className="flex h-[325px] w-full items-center justify-center text-xs">
                <div className="dark:bg.white/10 ml-2 rounded-lg bg-black/5 px-1.5 py-1 shadow-xs">
                  ⌘ / Ctrl + F
                </div>
              </div>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
};

export default Navbar;
