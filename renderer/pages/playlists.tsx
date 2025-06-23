"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Label } from "@/components/ui/label";
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
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { IconArrowRight, IconPlus, IconX } from "@tabler/icons-react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Playlist name must be at least 2 characters.",
  }),
  description: z.string().optional(),
  playlistCover: z.any().optional(),
});

export default function Playlists() {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", playlistCover: undefined },
  });

  useEffect(() => {
    const load = () =>
      window.ipc.invoke("getAllPlaylists").then((resp) => setPlaylists(resp));
    load();
    const resetListener = window.ipc.on("resetPlaylistsState", load);
    return () => {
      resetListener();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const createPlaylist = async (data: z.infer<typeof formSchema>) => {
    setLoading(true);
    let playlistCoverPath = null;
    try {
      const files = data.playlistCover as FileList | undefined;
      if (files && files.length > 0) {
        const file = files[0];
        const buffer = await file.arrayBuffer();
        playlistCoverPath = await window.ipc.invoke("uploadPlaylistCover", {
          name: file.name,
          data: Array.from(new Uint8Array(buffer)),
        });
      }
      const resp = await window.ipc.invoke("createPlaylist", {
        name: data.name,
        description: data.description,
        cover: playlistCoverPath,
      });
      setDialogOpen(false);
      setPreviewUrl("");
      form.reset();
      router.push(`/playlists/${resp.lastInsertRowid}`);
    } catch {
      toast(
        <div className="flex w-fit items-center gap-2 text-xs">
          <IconX className="text-red-500" stroke={2} size={16} />
          Failed to create playlist. Please try again.
        </div>
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex w-full items-center justify-between">
        <div className="flex flex-col">
          <div className="mt-4 text-lg font-medium leading-6">Playlists</div>
          <div className="opacity-50">
            Most awesome, epic playlists created by you.
          </div>
        </div>
        <Button variant="default" onClick={() => setDialogOpen(true)}>
          Create Playlist <IconPlus size={14} />
        </Button>
      </div>
      <div className="grid w-full grid-cols-5 gap-8">
        {playlists.map((pl) => (
          <Link key={pl.id} href={`/playlists/${pl.id}`} passHref>
            <div className="group/album wora-border wora-transition rounded-2xl p-5 hover:bg-black/5 dark:hover:bg-white/10">
              <div className="relative flex flex-col justify-between">
                <div className="relative w-full overflow-hidden rounded-xl pb-[100%] shadow-lg">
                  <Image
                    alt={pl.name || "Playlist Cover"}
                    src={
                      pl.id === 1
                        ? "/favouritesCoverArt.png"
                        : pl.cover
                          ? "wora://" + pl.cover
                          : "/coverArt.png"
                    }
                    fill
                    loading="lazy"
                    className="z-10 object-cover"
                  />
                </div>
                <div className="mt-8 flex w-full flex-col overflow-hidden">
                  <p className="truncate text-sm font-medium">{pl.name}</p>
                  <p className="truncate opacity-50">{pl.description}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Playlist</DialogTitle>
            <DialogDescription>
              Add a new playlist to your library.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(createPlaylist)}
              className="flex gap-4 text-xs"
            >
              <FormField
                control={form.control}
                name="playlistCover"
                render={({ field: { onChange, value, ...rest } }) => (
                  <FormItem>
                    <Label
                      htmlFor="playlistCover"
                      className="wora-transition block cursor-pointer hover:opacity-50"
                    >
                      <div className="relative h-36 w-36 overflow-hidden rounded-lg shadow-lg">
                        <Image
                          alt="Cover Preview"
                          src={previewUrl || "/coverArt.png"}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </Label>
                    <FormControl>
                      <Input
                        id="playlistCover"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files?.length) {
                            onChange(files);
                            const url = URL.createObjectURL(files[0]);
                            setPreviewUrl(url);
                          }
                        }}
                        {...rest}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex h-full w-full flex-col items-end justify-between gap-4">
                <div className="flex w-full flex-col gap-2">
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
                </div>
                <Button
                  className="w-fit justify-between text-xs"
                  type="submit"
                  disabled={loading}
                >
                  Create Playlist
                  {loading ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <IconArrowRight stroke={2} className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
