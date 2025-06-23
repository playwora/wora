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

// Form validation schema
const formSchema = z.object({
  name: z.string().min(2, {
    message: "Playlist name must be at least 2 characters.",
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
          Failed to load playlist
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
            Song removed from playlist
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
            Playlist updated successfully
          </div>,
        );
      }
    } catch (error) {
      console.error("Error updating playlist:", error);
      toast(
        <div className="flex w-fit items-center gap-2 text-xs">
          <IconX className="text-red-500" stroke={2} size={16} />
          Failed to update playlist
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
          Playlist deleted successfully.
        </div>,
      );
      await router.push("/playlists");
    } catch (err) {
      toast.error(`Failed to delete playlist: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Additional menu items for the song context menu
  const renderContextMenuItems = (song: any) => (
    <ContextMenuItem
      className="flex items-center gap-2"
      onClick={() => removeSongFromPlaylist(song.id)}
    >
      <IconX stroke={2} size={14} />
      Remove from Playlist
    </ContextMenuItem>
  );

  // Show loading or empty state if no playlist
  if (!playlist) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <>
      {/* Playlist header */}
      <div className="relative h-96 w-full overflow-hidden rounded-2xl">
        {playlist.id === 1 ? (
          <div className="h-full w-full bg-red-500 gradient-mask-b-10"></div>
        ) : (
          <Image
            alt={playlist.name}
            src={playlist.cover ? "wora://" + playlist.cover : "/coverArt.png"}
            fill
            loading="lazy"
            className="object-cover object-center blur-xl gradient-mask-b-10"
          />
        )}
        <div className="absolute bottom-6 left-6">
          <div className="flex items-end gap-4">
            {/* Album cover */}
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
            {/* Playlist info and actions */}
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
                  Play
                </Button>
                <Button className="w-fit" onClick={() => playPlaylist(true)}>
                  <IconArrowsShuffle2 stroke={2} size={16} /> Shuffle
                </Button>
                {playlist.id !== 1 && (
                  <Button className="w-fit" onClick={() => setDialogOpen(true)}>
                    <IconStar stroke={2} size={16} /> Edit
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Song list */}
      <div className="pt-2">
        <Songs
          library={playlist.songs}
          renderAdditionalMenuItems={renderContextMenuItems}
          disableScroll={true}
        />
      </div>
      {/* Edit playlist dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Playlist</DialogTitle>
            <DialogDescription>Update your existing playlist</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(updatePlaylist)}
              className="flex gap-4 text-xs"
            >
              {/* Album cover */}
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
              {/* Form inputs */}
              <div className="flex h-full w-full flex-col items-end gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormControl>
                        <Input placeholder="Name" {...field} />
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
                        <Input placeholder="Description" {...field} />
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
                    Delete Playlist
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
                    Update Playlist
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
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this playlist? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              className="w-fit justify-between text-xs"
              variant="outline"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={loading}
            >
              Cancel
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
              {loading ? <Spinner className="h-3.5 w-3.5" /> : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
