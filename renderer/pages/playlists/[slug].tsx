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
import { Input } from "components/ui/input";
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

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Playlist name must be at least 2 characters.",
  }),
  description: z.string().optional(),
});

type Playlist = {
  id: number;
  name: string;
  description: string;
  cover: string;
  songs: any;
};

export default function Playlist() {
  const router = useRouter();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const { setQueueAndPlay } = usePlayer();

  useEffect(() => {
    if (!router.query.slug) return;
    window.ipc
      .invoke("getPlaylistWithSongs", router.query.slug)
      .then((response) => {
        setPlaylist(response);
      });
  }, [router.query.slug]);

  const playPlaylist = () => {
    if (playlist) {
      setQueueAndPlay(playlist.songs, 0);
    }
  };

  const playPlaylistAndShuffle = () => {
    if (playlist) {
      setQueueAndPlay(playlist.songs, 0, true);
    }
  };

  const removeSongFromPlaylist = (songId: number) => {
    window.ipc
      .invoke("removeSongFromPlaylist", {
        playlistId: playlist.id,
        songId,
      })
      .then((response) => {
        if (response) {
          toast(
            <div className="flex w-fit items-center gap-2 text-xs">
              <IconCheck className="text-green-400" stroke={2} size={16} />
              Song removed from playlist.
            </div>,
          );

          window.ipc
            .invoke("getPlaylistWithSongs", router.query.slug)
            .then((response) => {
              setPlaylist(response);
            });
        }
      });
  };

  const toRenderAdditionalMenuItems = (song: any) => (
    <>
      <ContextMenuItem
        className="flex items-center gap-2"
        onClick={() => removeSongFromPlaylist(song.id)}
      >
        <IconX stroke={2} size={14} />
        Remove from Playlist
      </ContextMenuItem>
    </>
  );

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

  const updatePlaylist = (data: z.infer<typeof formSchema>) => {
    setLoading(true);
    window.ipc
      .invoke("updatePlaylist", { id: playlist.id, data })
      .then((response) => {
        if (response) {
          window.ipc
            .invoke("getPlaylistWithSongs", router.query.slug)
            .then((response) => {
              setPlaylist(response);
            });
          setDialogOpen(false);
          setLoading(false);
          toast(
            <div className="flex w-fit items-center gap-2 text-xs">
              <IconCheck className="text-green-400" stroke={2} size={16} />
              Your playlist is now updated.
            </div>,
          );
        }
      })
      .catch(() => setLoading(false));
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (playlist) {
      form.reset({
        name: playlist.name,
        description: playlist.description,
      });
    }
  }, [playlist]);

  return (
    <>
      <div className="relative h-96 w-full overflow-hidden rounded-2xl">
        {playlist && playlist.id === 1 ? (
          <div className="h-full w-full bg-red-500 gradient-mask-b-10"></div>
        ) : (
          <Image
            alt={playlist ? playlist.name : "Album Cover"}
            src={
              playlist && playlist.cover
                ? "wora://" + playlist.cover
                : "/coverArt.png"
            }
            fill
            loading="lazy"
            className="object-cover object-center blur-xl gradient-mask-b-10"
          />
        )}
        <div className="absolute bottom-6 left-6">
          <div className="flex items-end gap-4">
            <div className="relative h-52 w-52 overflow-hidden rounded-xl shadow-lg transition duration-300">
              <Image
                alt={playlist ? playlist.name : "Album Cover"}
                src={
                  playlist && playlist.id === 1
                    ? "/favouritesCoverArt.png"
                    : playlist && playlist.cover
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
                <h1 className="text-2xl font-medium">
                  {playlist && playlist.name}
                </h1>
                <p className="flex items-center gap-2 text-sm">
                  {playlist && playlist.description}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={playPlaylist} className="w-fit">
                  <IconPlayerPlay
                    className="fill-black dark:fill-white"
                    stroke={2}
                    size={16}
                  />{" "}
                  Play
                </Button>
                <Button className="w-fit" onClick={playPlaylistAndShuffle}>
                  <IconArrowsShuffle2 stroke={2} size={16} /> Shuffle
                </Button>
                {playlist && playlist.id !== 1 && (
                  <Button className="w-fit" onClick={() => setDialogOpen(true)}>
                    <IconStar stroke={2} size={16} /> Edit
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pt-2">
        <Songs
          library={playlist?.songs}
          renderAdditionalMenuItems={toRenderAdditionalMenuItems}
        />
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <div className="flex h-full w-full items-start gap-6">
            <div className="jusitfy-between flex h-full w-full flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Update Playlist</DialogTitle>
                <DialogDescription>
                  Update your existing playlist.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(updatePlaylist)}
                  className="flex gap-4 text-xs"
                >
                  <div className="h-full">
                    <div className="relative h-36 w-36 overflow-hidden rounded-xl">
                      <Image
                        alt="album"
                        src="/coverArt.png"
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
            </div>
          </div>
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
              onClick={() => {
                deletePlaylist();
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
