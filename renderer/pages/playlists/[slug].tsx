import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import {
  IconPlayerPlay,
  IconArrowsShuffle2,
  IconX,
  IconCheck,
  IconStar,
  IconTrash,
  IconArrowRight,
} from "@tabler/icons-react";
import { usePlayer } from "@/context/playerContext";
import { toast } from "sonner";
import Spinner from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Songs from "@/components/ui/songs";
import { ContextMenuItem } from "@/components/ui/context-menu";
import { useTranslation } from "react-i18next";

// Form validation schema
const formSchema = z.object({
  name: z.string().min(2, {
    message: "playlists.errors.name_too_short",
  }),
  description: z.string().optional(),
});

// Playlist type definition
type Playlist = {
  id: number;
  name: string;
  description: string;
  cover: string;
  songs: any[];
};

export default function Playlist() {
  const { t } = useTranslation();
  const router = useRouter();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const { setQueueAndPlay } = usePlayer();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  // Reset scroll position when the component mounts or route changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, [router.asPath]);

  // Load playlist data when the slug changes
  useEffect(() => {
    if (!router.query.slug) return;
    fetchPlaylistData();
  }, [router.query.slug]);

  // Update form values when playlist data changes
  useEffect(() => {
    if (playlist) {
      form.reset({
        name: playlist.name,
        description: playlist.description,
      });
    }
  }, [playlist, form]);

  const fetchPlaylistData = async () => {
    try {
      const response = await window.ipc.invoke(
        "getPlaylistWithSongs",
        router.query.slug,
      );
      setPlaylist(response);
    } catch (error) {
      console.error("Error fetching playlist:", error);
      toast(
        <div className="flex w-fit items-center gap-2 text-xs">
          <IconX className="text-red-500" stroke={2} size={16} />
          {t("playlist.errors.load_failed")}
        </div>,
      );
    }
  };

  const playPlaylist = (shuffle = false) => {
    if (!playlist?.songs?.length) return;
    setQueueAndPlay(playlist.songs, 0, shuffle);
  };

  const removeSongFromPlaylist = async (songId: number) => {
    if (!playlist) return;
    try {
      const response = await window.ipc.invoke("removeSongFromPlaylist", {
        playlistId: playlist.id,
        songId,
      });
      if (response) {
        toast(
          <div className="flex w-fit items-center gap-2 text-xs">
            <IconCheck className="text-green-400" stroke={2} size={16} />
            {t("playlist.songs.removed")}
          </div>,
        );
        fetchPlaylistData();
      }
    } catch (error) {
      console.error("Error removing song:", error);
    }
  };

  const updatePlaylist = async (data: z.infer<typeof formSchema>) => {
    if (!playlist) return;
    setLoading(true);
    try {
      const response = await window.ipc.invoke("updatePlaylist", {
        id: playlist.id,
        data,
      });
      if (response) {
        await fetchPlaylistData();
        setDialogOpen(false);
        toast(
          <div className="flex w-fit items-center gap-2 text-xs">
            <IconCheck className="text-green-400" stroke={2} size={16} />
            {t("playlist.success.updated")}
          </div>,
        );
      }
    } catch (error) {
      console.error("Error updating playlist:", error);
      toast(
        <div className="flex w-fit items-center gap-2 text-xs">
          <IconX className="text-red-500" stroke={2} size={16} />
          {t("playlist.errors.update_failed")}
        </div>,
      );
    } finally {
      setLoading(false);
    }
  };

  const deletePlaylist = async () => {
    if (!playlist) return;
    setLoading(true);
    try {
      await window.ipc.invoke("deletePlaylist", { id: playlist.id });
      toast(
        <div className="flex w-fit items-center gap-2 text-xs">
          <IconCheck className="text-green-400" stroke={2} size={16} />
          {t("playlist.success.deleted")}
        </div>,
      );
      await router.push("/playlists");
    } catch (err) {
      toast.error(t("playlist.errors.delete_failed", { error: err.message }));
    } finally {
      setLoading(false);
    }
  };

  const renderContextMenuItems = (song: any) => (
    <ContextMenuItem
      className="flex items-center gap-2"
      onClick={() => removeSongFromPlaylist(song.id)}
    >
      <IconX stroke={2} size={14} />
      {t("playlist.songs.remove")}
    </ContextMenuItem>
  );

  if (!playlist) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <>
      <div className="relative h-96 w-full overflow-hidden rounded-2xl">
        {playlist.id === 1 ? (
          <div className="h-full w-full bg-red-500 mask-b-from-30%"></div>
        ) : (
          <Image
            alt={playlist.name}
            src={playlist.cover ? "wora://" + playlist.cover : "/coverArt.png"}
            fill
            loading="lazy"
            className="mask-b-from-30% object-cover object-center blur-xl"
          />
        )}
        <div className="absolute bottom-6 left-6">
          <div className="flex items-end gap-4">
            <div className="relative h-52 w-52 overflow-hidden rounded-xl shadow-lg">
              <Image
                alt={playlist.name}
                src={
                  playlist.id === 1
                    ? "/favouritesCoverArt.png"
                    : playlist.cover
                      ? "wora://" + playlist.cover
                      : "/coverArt.png"
                }
                fill
                loading="lazy"
                className="scale-[1.01] object-cover"
              />
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-2xl font-medium">{playlist.name}</h1>
                <p className="flex items-center gap-2 text-sm">
                  {playlist.description}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => playPlaylist(false)} className="w-fit">
                  <IconPlayerPlay
                    className="fill-black dark:fill-white"
                    stroke={2}
                    size={16}
                  />{" "}
                  {t("playlist.actions.play")}
                </Button>
                <Button className="w-fit" onClick={() => playPlaylist(true)}>
                  <IconArrowsShuffle2 stroke={2} size={16} /> {t("playlist.actions.shuffle")}
                </Button>
                {playlist.id !== 1 && (
                  <Button className="w-fit" onClick={() => setDialogOpen(true)}>
                    <IconStar stroke={2} size={16} /> {t("playlist.actions.edit")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pt-2">
        <Songs
          library={playlist.songs}
          renderAdditionalMenuItems={renderContextMenuItems}
          disableScroll={true}
        />
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("playlist.edit.title")}</DialogTitle>
            <DialogDescription>{t("playlist.edit.subtitle")}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(updatePlaylist)}
              className="flex gap-4 text-xs"
            >
              <div>
                <div className="relative h-36 w-36 overflow-hidden rounded-xl">
                  <Image
                    alt="album"
                    src={
                      playlist.cover
                        ? "wora://" + playlist.cover
                        : "/coverArt.png"
                    }
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="flex h-full w-full flex-col items-end gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormControl>
                        <Input placeholder={t("playlist.edit.name_placeholder")} {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormControl>
                        <Input placeholder={t("playlist.edit.description_placeholder")} {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button
                    className="w-fit justify-between text-xs"
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={loading}
                  >
                    {t("playlist.edit.delete")}
                    {loading ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <IconTrash stroke={2} className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    className="w-fit justify-between text-xs"
                    type="submit"
                    disabled={loading}
                  >
                    {t("playlist.edit.update")}
                    {loading ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <IconArrowRight stroke={2} className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("playlist.delete.title")}</DialogTitle>
            <DialogDescription>
              {t("playlist.delete.subtitle")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              className="w-fit justify-between text-xs"
              variant="outline"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={loading}
            >
              {t("playlist.delete.cancel")}
            </Button>
            <Button
              className="w-fit justify-between text-xs"
              variant="destructive"
              onClick={async () => {
                await deletePlaylist();
                setConfirmDeleteOpen(false);
                setDialogOpen(false);
              }}
              disabled={loading}
            >
              {loading ? <Spinner className="h-3.5 w-3.5" /> : t("playlist.delete.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
