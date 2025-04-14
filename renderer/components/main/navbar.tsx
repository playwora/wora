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

  // Only show mounted components to prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  // Define navigation links
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
    if (theme === "light") {
      return <IconSun stroke={2} className="w-5" />;
    } else if (theme === "dark") {
      return <IconMoon stroke={2} className="w-5" />;
    } else {
      return <IconDeviceDesktop stroke={2} className="w-5" />;
    }
  };

  // Check if current path matches the href (including base path match)
  const isActive = (href: string): boolean => {
    if (href === "/home" && router.pathname === "/") {
      return true;
    }

    // Check for exact match or if it's a subpath
    return (
      router.pathname === href ||
      (href !== "/home" && router.pathname.startsWith(href))
    );
  };

  // Handle navigation with page state reset when clicking active page
  const handleNavigation = useCallback(
    (href: string, e: React.MouseEvent) => {
      // If we're on this exact page or a subpage of it
      if (isActive(href)) {
        e.preventDefault();

        // Scroll to top
        window.scrollTo(0, 0);

        // If we're on a subpath (e.g., /albums/[slug]), navigate to the main path
        if (router.pathname !== href) {
          router.push(href);
          return;
        }

        // If we're already on the exact page, just reset state
        if (href === "/albums") {
          // Reset albums page state
          window.ipc.send("resetAlbumsPageState", null);
        } else if (href === "/songs") {
          // Reset songs page state
          window.ipc.send("resetSongsPageState", null);
        } else if (href === "/playlists") {
          // Reset playlists page state
          window.ipc.send("resetPlaylistsPageState", null);
        } else if (href === "/home") {
          // Reset home page state
          window.ipc.send("resetHomePageState", null);
        }

        // Removed router.replace(router.asPath) to allow smooth transitions
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

  // If not mounted yet, render a placeholder to avoid hydration issues
  if (!mounted) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-10">
        <div className="h-8 w-8 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div className="wora-border flex w-[4.5rem] flex-col items-center gap-10 rounded-2xl p-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-10 w-10 rounded-md bg-neutral-200 dark:bg-neutral-800"
            />
          ))}
        </div>
      </div>
    );
  }

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
          <div className="wora-border flex w-[4.5rem] flex-col items-center gap-10 rounded-2xl p-8">
            {/* Navigation Links */}
            {navLinks.map((link) => (
              <Tooltip key={link.href} delayDuration={0}>
                <TooltipTrigger>
                  <Button
                    variant={isActive(link.href) ? "default" : "ghost"}
                    className={
                      isActive(link.href) ? "dark:bg.white/10 bg-black/10" : ""
                    }
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

            {/* Search Button */}
            <Tooltip delayDuration={0}>
              <TooltipTrigger>
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
            <TooltipTrigger>
              <Button variant="ghost" onClick={handleThemeToggle}>
                {renderIcon()}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={25}>
              <p className="capitalize">Theme: {theme}</p>
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
                    <div className="flex h-full w-full items-center gap-2.5 gradient-mask-r-70">
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
                        <p className="w-full overflow-hidden text-nowrap text-xs">
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
                <div className="dark:bg.white/10 ml-2 rounded-lg bg-black/5 px-1.5 py-1 shadow-sm">
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
