import {
  IconDeviceDesktop,
  IconFocusCentered,
  IconInbox,
  IconList,
  IconMoon,
  IconSearch,
  IconSun,
  IconVinyl,
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
import { useEffect, useState } from "react";
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

const Navbar = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const { setQueueAndPlay } = usePlayer();
  const { theme, setTheme } = useTheme();

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

        setSearchResults([
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
          <div className="wora-border flex w-[4.5rem] flex-col items-center gap-10 rounded-2xl p-8">
            <Tooltip delayDuration={0}>
              <TooltipTrigger>
                <Button variant="ghost" asChild>
                  <Link href="/home">
                    <IconInbox stroke={2} className="w-5" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={50}>
                <p>Home</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger>
                <Button variant="ghost" asChild onClick={openSearch}>
                  <IconSearch stroke={2} className="w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={50}>
                <p>Search</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger>
                <Button variant="ghost" asChild>
                  <Link href="/playlists">
                    <IconVinyl stroke={2} size={20} />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={50}>
                <p>Playlists</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger>
                <Button variant="ghost" asChild>
                  <Link href="/songs">
                    <IconList stroke={2} size={20} />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={50}>
                <p>Songs</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger>
                <Button variant="ghost" asChild>
                  <Link href="/albums">
                    <IconFocusCentered stroke={2} size={20} />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={50}>
                <p>Albums</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Tooltip delayDuration={0}>
            <TooltipTrigger>
              <Button variant="ghost" onClick={handleThemeToggle} asChild>
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
                    key={`${item.type}-${item.id}`}
                    value={`${item.name}-${item.type}-${item.id}`}
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
                      <div>
                        <p className="w-full overflow-hidden text-nowrap text-xs">
                          {item.name}
                          <span className="ml-1 opacity-50">({item.type})</span>
                        </p>
                        <p className="w-full text-xs opacity-50">
                          {item.type === "Playlist"
                            ? item.description
                            : item.artist}
                        </p>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <div className="flex h-[325px] w-full items-center justify-center text-xs">
                <div className="ml-2 rounded-lg bg-black/5 px-1.5 py-1 shadow-sm dark:bg-white/10">
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
