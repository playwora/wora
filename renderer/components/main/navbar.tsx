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
  IconLanguage,
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
import { useTranslation } from "react-i18next";

type Settings = {
  name: string;
  profilePicture: string;
  language?: string;
};

type NavLink = {
  href: string;
  icon: React.ReactNode;
  label: string;
};

const supportedLanguages = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

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
  const { t, i18n } = useTranslation();

  // --- Language states ---
  const [language, setLanguage] = useState<string>("en");
  const [openLanguageDialog, setOpenLanguageDialog] = useState(false);
  const [langSearch, setLangSearch] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const navLinks: NavLink[] = [
    {
      href: "/home",
      icon: <IconInbox stroke={2} className="w-5" />,
      label: t("navbar.links.home"),
    },
    {
      href: "/playlists",
      icon: <IconVinyl stroke={2} size={20} />,
      label: t("navbar.links.playlists"),
    },
    {
      href: "/songs",
      icon: <IconList stroke={2} size={20} />,
      label: t("navbar.links.songs"),
    },
    {
      href: "/albums",
      icon: <IconFocusCentered stroke={2} size={20} />,
      label: t("navbar.links.albums"),
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

        window.scrollTo(0, 0);

        if (router.pathname !== href) {
          router.push(href);
          return;
        }

        if (href === "/albums") {
          window.ipc.send("resetAlbumsPageState", null);
        } else if (href === "/songs") {
          window.ipc.send("resetSongsPageState", null);
        } else if (href === "/playlists") {
          window.ipc.send("resetPlaylistsPageState", null);
        } else if (href === "/home") {
          window.ipc.send("resetHomePageState", null);
        }
      }
    },
    [router],
  );

  // ---- Language Setting Load ----
  useEffect(() => {
    window.ipc.invoke("getSettings").then((response) => {
      setSettings(response);
      if (response?.language && supportedLanguages.find(l => l.code === response.language)) {
        setLanguage(response.language);
        i18n.changeLanguage(response.language);
      }
    });
    window.ipc.on("confirmSettingsUpdate", () => {
      window.ipc.invoke("getSettings").then((response) => {
        setSettings(response);
      });
    });
    // Sync on manual change (rarely needed, for IPC listeners)
    window.ipc.on("languageChanged", (_event, lang) => {
      setLanguage(lang as string);
      i18n.changeLanguage(lang as string);
    });
  }, [i18n]);

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

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    window.ipc.invoke("updateSettings", { language: lang });
    window.ipc.send("languageChanged", lang);
  };

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
              <p>{settings && settings.name ? settings.name : t("settings.default_name")}</p>
            </TooltipContent>
          </Tooltip>
          <div className="wora-border flex w-18 flex-col items-center gap-10 rounded-2xl p-8">
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
                <p>{t("navbar.search.open")}</p>
              </TooltipContent>
            </Tooltip>

            {/* --- Idioma: Botón y Dialog --- */}
            <Tooltip delayDuration={0}>
              <TooltipTrigger>
                <Button variant="ghost" onClick={() => setOpenLanguageDialog(true)}>
                  <IconLanguage stroke={2} className="w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={25}>
                <p>{t("navbar.language")}</p>
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
              <p className="capitalize">{t("navbar.theme")}: {theme}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* --- Language CommandDialog --- */}
      <CommandDialog open={openLanguageDialog} onOpenChange={setOpenLanguageDialog}>
        <Command>
          <CommandInput
            placeholder={t("navbar.language_search") || "Search language..."}
            value={langSearch}
            onValueChange={setLangSearch}
          />
          <CommandList>
            <CommandGroup heading={t("navbar.available_languages") || "Available Languages"}>
              {supportedLanguages
                .filter(lang =>
                  lang.label.toLowerCase().includes(langSearch.toLowerCase())
                )
                .map((lang) => (
                  <CommandItem
                    key={lang.code}
                    value={lang.label.toLowerCase()}
                    onSelect={() => {
                      handleLanguageChange(lang.code);
                      setOpenLanguageDialog(false);
                      setLangSearch("");
                    }}
                    className={language === lang.code ? "font-bold" : ""}
                  >
                    <span className="mr-2 text-lg">{lang.flag}</span>
                    {lang.label}
                    {language === lang.code && (
                      <span className="ml-auto text-xs px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 opacity-70">
                        {t("navbar.selected") || "Selected"}
                      </span>
                    )}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput
            placeholder={t("navbar.search.placeholder")}
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
              <CommandGroup heading={t("navbar.search.results")} className="pb-2">
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
                          <span className="ml-1 opacity-50">({t(`navbar.search.types.${item.type.toLowerCase()}`)})</span>
                        </p>
                        <p className="w-full text-xs opacity-50">
                          {item.type === "Playlist"
                            ? item.description
                            : item.type === "Artist"
                              ? t("navbar.search.types.artist")
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
