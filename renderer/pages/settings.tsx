import React, { useEffect, useState, useRef } from "react";
import {
  IconArrowRight,
  IconBrandLastfm,
  IconCheck,
  IconRefresh,
  IconLogout,
  IconX,
} from "@tabler/icons-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
  FormDescription,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  initializeLastFM,
  getSessionKey,
  logout as lastFmLogout,
  getUserInfo,
  initializeLastFMWithSession,
} from "@/lib/lastfm";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Username must be at least 2 characters long.",
  }),
  profilePicture: z.any().optional(),
});

const lastFmFormSchema = z.object({
  lastFmUsername: z.string().min(1, {
    message: "Username is required.",
  }),
  lastFmPassword: z.string().min(1, {
    message: "Password is required.",
  }),
});

const lastFmSettingsSchema = z.object({
  enableLastFm: z.boolean().default(false),
  scrobbleThreshold: z.number().min(50).max(100).default(50),
});

type Settings = {
  name: string;
  profilePicture: string;
  musicFolder: string;
  lastFmUsername?: string;
  lastFmSessionKey?: string;
  enableLastFm?: boolean;
  scrobbleThreshold?: number;
};

type LastFmSettings = {
  lastFmUsername: string | null;
  lastFmSessionKey: string | null;
  enableLastFm: boolean;
  scrobbleThreshold: number;
};

export default function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFmLoading, setLastFmLoading] = useState(false);
  const [lastFmSettings, setLastFmSettings] = useState<LastFmSettings>({
    lastFmUsername: null,
    lastFmSessionKey: null,
    enableLastFm: false,
    scrobbleThreshold: 50,
  });
  const [musicLoading, setMusicLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [stats, setStats] = useState<{
    songs: number;
    albums: number;
    playlists: number;
  } | null>(null);
  const [lastFmUserInfo, setLastFmUserInfo] = useState(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    window.ipc.invoke("getSettings").then((response) => {
      setSettings(response);
      setPreviewUrl(
        response?.profilePicture
          ? `wora://${response.profilePicture}`
          : "/userPicture.png",
      );
    });

    window.ipc.invoke("getLastFmSettings").then((response) => {
      setLastFmSettings(response);
      lastFmSettingsForm.reset({
        enableLastFm: response.enableLastFm,
        scrobbleThreshold: response.scrobbleThreshold,
      });

      // Fetch Last.fm user info if we have a session
      if (
        response.lastFmUsername &&
        response.lastFmSessionKey &&
        response.enableLastFm
      ) {
        initializeLastFMWithSession(
          response.lastFmSessionKey,
          response.lastFmUsername,
        );
        fetchUserInfo();
      }
    });

    window.ipc.invoke("getLibraryStats").then((response) => {
      setStats(response);
    });
  }, []);

  // Fetch Last.fm user info
  const fetchUserInfo = async () => {
    try {
      const userInfo = await getUserInfo();
      if (userInfo) {
        setLastFmUserInfo(userInfo);
        console.log("Last.fm user info:", userInfo);
      }
    } catch (error) {
      console.error("Failed to fetch Last.fm user info:", error);
    }
  };

  const updateSettings = async (data: z.infer<typeof formSchema>) => {
    setLoading(true);

    let profilePicturePath = settings?.profilePicture;

    if (
      data.profilePicture &&
      data.profilePicture instanceof FileList &&
      data.profilePicture.length > 0
    ) {
      const file = data.profilePicture[0];
      const fileData = await file.arrayBuffer();
      try {
        profilePicturePath = await window.ipc.invoke("uploadProfilePicture", {
          name: file.name,
          data: Array.from(new Uint8Array(fileData)),
        });
      } catch (error) {
        console.error("Error uploading profile picture:", error);
        toast(
          <div className="flex w-fit items-center gap-2 text-xs">
            <IconX className="text-red-500" stroke={2} size={16} />
            Failed to upload profile picture. Using existing picture.
          </div>,
        );
        // Fallback to the original profile picture
        profilePicturePath = settings?.profilePicture;
      }
    } else {
      // No new file selected, use the existing profile picture
      profilePicturePath = settings?.profilePicture;
    }

    const updatedData = {
      name: data.name,
      profilePicture: profilePicturePath,
    };

    await window.ipc.invoke("updateSettings", updatedData).then((response) => {
      if (response) {
        setLoading(false);
        setSettings((prevSettings) => ({ ...prevSettings, ...updatedData }));
        toast(
          <div className="flex w-fit items-center gap-2 text-xs">
            <IconCheck className="text-green-400" stroke={2} size={16} />
            Your settings are updated.
          </div>,
        );
      }
    });
  };

  const connectToLastFm = async (data: z.infer<typeof lastFmFormSchema>) => {
    setLastFmLoading(true);
    try {
      // Initialize LastFM and get a session key
      const success = await initializeLastFM(
        data.lastFmUsername,
        data.lastFmPassword,
      );
      if (success) {
        const sessionKey = getSessionKey();

        if (sessionKey) {
          // Save the Last.fm settings
          await window.ipc.invoke("updateLastFmSettings", {
            lastFmUsername: data.lastFmUsername,
            lastFmSessionKey: sessionKey,
            enableLastFm: true,
            scrobbleThreshold: lastFmSettings.scrobbleThreshold || 50,
          });

          // Update local state
          setLastFmSettings({
            lastFmUsername: data.lastFmUsername,
            lastFmSessionKey: sessionKey,
            enableLastFm: true,
            scrobbleThreshold: lastFmSettings.scrobbleThreshold || 50,
          });

          // Fetch user info
          await fetchUserInfo();

          // Reset form
          lastFmForm.reset();

          // Update settings form
          lastFmSettingsForm.reset({
            enableLastFm: true,
            scrobbleThreshold: lastFmSettings.scrobbleThreshold || 50,
          });

          toast(
            <div className="flex w-fit items-center gap-2 text-xs">
              <IconCheck className="text-green-400" stroke={2} size={16} />
              Successfully connected to Last.fm!
            </div>,
          );
        }
      } else {
        toast(
          <div className="flex w-fit items-center gap-2 text-xs">
            <IconX className="text-red-500" stroke={2} size={16} />
            Failed to connect to Last.fm. Check your credentials.
          </div>,
        );
      }
    } catch (error) {
      console.error("Error connecting to Last.fm:", error);
      toast(
        <div className="flex w-fit items-center gap-2 text-xs">
          <IconX className="text-red-500" stroke={2} size={16} />
          An error occurred while connecting to Last.fm.
        </div>,
      );
    } finally {
      setLastFmLoading(false);
    }
  };

  const disconnectFromLastFm = async () => {
    setLogoutLoading(true);
    try {
      // Clear Last.fm session
      lastFmLogout();

      // Update database
      await window.ipc.invoke("updateLastFmSettings", {
        lastFmUsername: null,
        lastFmSessionKey: null,
        enableLastFm: false,
        scrobbleThreshold: lastFmSettings.scrobbleThreshold || 50,
      });

      // Update local state
      setLastFmSettings({
        lastFmUsername: null,
        lastFmSessionKey: null,
        enableLastFm: false,
        scrobbleThreshold: lastFmSettings.scrobbleThreshold || 50,
      });

      // Clear user info
      setLastFmUserInfo(null);

      toast(
        <div className="flex w-fit items-center gap-2 text-xs">
          <IconCheck className="text-green-400" stroke={2} size={16} />
          Successfully disconnected from Last.fm
        </div>,
      );
    } catch (error) {
      console.error("Error disconnecting from Last.fm:", error);
      toast(
        <div className="flex w-fit items-center gap-2 text-xs">
          <IconX className="text-red-500" stroke={2} size={16} />
          Failed to disconnect from Last.fm
        </div>,
      );
    } finally {
      setLogoutLoading(false);
    }
  };

  const updateLastFmSettings = async (
    data: z.infer<typeof lastFmSettingsSchema>,
  ) => {
    try {
      await window.ipc.invoke("updateLastFmSettings", {
        lastFmUsername: lastFmSettings.lastFmUsername,
        lastFmSessionKey: lastFmSettings.lastFmSessionKey,
        enableLastFm: data.enableLastFm,
        scrobbleThreshold: data.scrobbleThreshold,
      });

      setLastFmSettings({
        ...lastFmSettings,
        enableLastFm: data.enableLastFm,
        scrobbleThreshold: data.scrobbleThreshold,
      });

      toast(
        <div className="flex w-fit items-center gap-2 text-xs">
          <IconCheck className="text-green-400" stroke={2} size={16} />
          Last.fm settings updated successfully.
        </div>,
      );
    } catch (error) {
      console.error("Error updating Last.fm settings:", error);
      toast(
        <div className="flex w-fit items-center gap-2 text-xs">
          <IconX className="text-red-500" stroke={2} size={16} />
          Failed to update Last.fm settings.
        </div>,
      );
    }
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const lastFmForm = useForm<z.infer<typeof lastFmFormSchema>>({
    resolver: zodResolver(lastFmFormSchema),
    defaultValues: {
      lastFmUsername: "",
      lastFmPassword: "",
    },
  });

  const lastFmSettingsForm = useForm<z.infer<typeof lastFmSettingsSchema>>({
    resolver: zodResolver(lastFmSettingsSchema),
    defaultValues: {
      enableLastFm: lastFmSettings.enableLastFm,
      scrobbleThreshold: lastFmSettings.scrobbleThreshold,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        name: settings.name,
        profilePicture: settings.profilePicture,
      });
    }
  }, [settings]);

  const rescanLibrary = () => {
    setMusicLoading(true);
    window.ipc
      .invoke("rescanLibrary")
      .then(() => {
        setMusicLoading(false);
        toast(
          <div className="flex w-fit items-center gap-2 text-xs">
            <IconCheck className="text-green-400" stroke={2} size={16} />
            Your library is rescanned.
          </div>,
        );
        window.ipc.invoke("getLibraryStats").then((response) => {
          setStats(response);
        });
      })
      .catch(() => setMusicLoading(false));
  };

  const scanLibrary = () => {
    setMusicLoading(true);
    window.ipc
      .invoke("scanLibrary", true)
      .then((response) => {
        setMusicLoading(false);
        if (response) return;
        toast(
          <div className="flex w-fit items-center gap-2 text-xs">
            <IconCheck className="text-green-400" stroke={2} size={16} />
            Your music folder is updated.
          </div>,
        );
        window.ipc.invoke("getSettings").then((response) => {
          setSettings(response);
          setPreviewUrl(
            response?.profilePicture
              ? `wora://${response.profilePicture}`
              : "/userPicture.png",
          );
        });

        window.ipc.invoke("getLibraryStats").then((response) => {
          setStats(response);
        });
      })
      .catch(() => setMusicLoading(false));
  };

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col">
          <div className="mt-4 text-lg font-medium leading-6">Settings</div>
          <div className="opacity-50">You&apos;re on your own here.</div>
        </div>
        <div className="relative flex w-full flex-col gap-8">
          <div className="flex w-full items-center gap-8">
            <div className="wora-border h-48 w-2/5 rounded-2xl p-6">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(updateSettings)}
                  className="flex h-full flex-col justify-between text-xs"
                >
                  <div className="flex w-full items-center gap-4">
                    <Label
                      className="wora-transition w-fit cursor-pointer hover:opacity-50"
                      htmlFor="profilePicture"
                    >
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={previewUrl} />
                      </Avatar>
                    </Label>
                    <FormField
                      control={form.control}
                      name="profilePicture"
                      render={({ field: { onChange, value, ...rest } }) => {
                        const fileInputRef = useRef<HTMLInputElement>(null);
                        return (
                          <FormItem hidden className="w-full">
                            <FormControl>
                              <Input
                                id="profilePicture"
                                placeholder="Picture"
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const files = e.target.files;
                                  if (files && files.length > 0) {
                                    const file = files[0];
                                    onChange(files);
                                    const objectUrl = URL.createObjectURL(file);
                                    setPreviewUrl(objectUrl);
                                  }
                                }}
                                ref={fileInputRef}
                                {...rest}
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        );
                      }}
                    />
                    <div className="flex flex-col">
                      <p className="text-sm font-medium">
                        {settings && settings.name
                          ? settings.name
                          : "Wora User"}
                      </p>
                      <p className="opacity-50">A great listner of music.</p>
                    </div>
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormControl>
                            <Input
                              placeholder="A username would be great."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <Button
                      className="w-fit justify-between text-xs"
                      type="submit"
                    >
                      Save
                      {loading ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <IconArrowRight stroke={2} className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
            <div className="wora-border h-48 w-3/5 rounded-2xl p-6">
              <div className="flex h-full flex-col justify-between text-xs">
                <div className="flex w-full items-center gap-4">
                  <div className="mt-4 flex w-full justify-around">
                    <div className="flex flex-col items-center gap-2">
                      Songs
                      <p className="text-xl font-medium">
                        {stats && stats.songs}
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      Albums
                      <p className="text-xl font-medium">
                        {stats && stats.albums}
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      Playlists
                      <p className="text-xl font-medium">
                        {stats && stats.playlists}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex w-full items-center gap-2">
                  <div className="dark:bg.white/10 flex h-9 w-full items-center rounded-xl bg-black/5 px-3 py-1 text-xs transition duration-300 focus:outline-none">
                    {settings && settings.musicFolder}
                  </div>
                  <Button
                    className="w-fit justify-between text-nowrap text-xs"
                    onClick={rescanLibrary}
                  >
                    <IconRefresh stroke={2} className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    className="w-fit justify-between text-nowrap text-xs"
                    onClick={scanLibrary}
                  >
                    Update Music Folder
                    {musicLoading ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <IconArrowRight stroke={2} className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Last.fm Integration Section */}
          <div className="flex w-full flex-col gap-4">
            <div className="flex items-center gap-2">
              <IconBrandLastfm stroke={2} size={20} className="text-red-500" />
              <h2 className="text-lg font-medium">Last.fm Integration</h2>
            </div>

            {lastFmSettings.lastFmSessionKey ? (
              // Show Last.fm settings if connected
              <div className="wora-border rounded-2xl p-6">
                <Form {...lastFmSettingsForm}>
                  <form
                    onSubmit={lastFmSettingsForm.handleSubmit(
                      updateLastFmSettings,
                    )}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              Connected as: {lastFmSettings.lastFmUsername}
                            </p>
                            {lastFmUserInfo &&
                              lastFmUserInfo.image &&
                              lastFmUserInfo.image.length > 0 && (
                                <Avatar className="h-6 w-6">
                                  <AvatarImage
                                    src={lastFmUserInfo.image[1]["#text"]}
                                  />
                                </Avatar>
                              )}
                          </div>
                          <p className="text-xs opacity-50">
                            Scrobble your played tracks to Last.fm
                          </p>
                          {lastFmUserInfo && (
                            <a
                              href={`https://www.last.fm/user/${lastFmSettings.lastFmUsername}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 text-xs text-red-500 hover:underline"
                            >
                              View profile ({lastFmUserInfo.playcount || 0}{" "}
                              scrobbles)
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={disconnectFromLastFm}
                            disabled={logoutLoading}
                            className="flex items-center gap-1"
                          >
                            {logoutLoading ? (
                              <Spinner className="h-3.5 w-3.5" />
                            ) : (
                              <>
                                <IconLogout stroke={2} size={14} />
                                Logout
                              </>
                            )}
                          </Button>
                          <FormField
                            control={lastFmSettingsForm.control}
                            name="enableLastFm"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <FormField
                        control={lastFmSettingsForm.control}
                        name="scrobbleThreshold"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <div className="flex justify-between">
                              <FormLabel className="text-xs">
                                Scrobble Threshold: {field.value}%
                              </FormLabel>
                            </div>
                            <FormControl>
                              <Slider
                                value={[field.value]}
                                min={50}
                                max={100}
                                step={1}
                                onValueChange={(vals) =>
                                  field.onChange(vals[0])
                                }
                              />
                            </FormControl>
                            <FormDescription className="text-xs opacity-50">
                              Track will scrobble after playing this percentage
                              of its length
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" className="w-fit text-xs">
                        Save Last.fm Settings
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            ) : (
              // Show connection form if not connected
              <div className="wora-border rounded-2xl p-6">
                <Form {...lastFmForm}>
                  <form
                    onSubmit={lastFmForm.handleSubmit(connectToLastFm)}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">Connect to Last.fm</p>
                      <p className="mb-2 text-xs opacity-50">
                        Connect your Last.fm account to scrobble tracks
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={lastFmForm.control}
                        name="lastFmUsername"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              Last.fm Username
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="Username" {...field} />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={lastFmForm.control}
                        name="lastFmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              Last.fm Password
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Password"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="w-fit text-xs"
                        disabled={lastFmLoading}
                      >
                        {lastFmLoading ? (
                          <>
                            Connecting <Spinner className="ml-2 h-3.5 w-3.5" />
                          </>
                        ) : (
                          <>Connect to Last.fm</>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
