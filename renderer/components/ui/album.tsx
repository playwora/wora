import Image from "next/image";
import Link from "next/link";
import React from "react";

type Album = {
  id: string;
  name: string;
  artist: string;
  cover: string;
};

type AlbumCardProps = {
  album: Album;
};

const AlbumCard: React.FC<AlbumCardProps> = ({ album }) => {
  return (
    <Link href={`/albums/${album.id}`}>
      <div className="group/album wora-border wora-transition rounded-2xl p-5 hover:bg-black/5 dark:hover:bg-white/10">
        <div className="relative flex flex-col justify-between">
          <div className="relative w-full overflow-hidden rounded-xl pb-[100%] shadow-lg">
            <Image
              alt={album ? album.name : "Album Cover"}
              src={`wora://${album.cover}`}
              fill
              loading="lazy"
              className="z-10 cursor-pointer object-cover"
            />
          </div>
          <div className="mt-8 flex w-full flex-col overflow-clip">
            <p className="cursor-pointer mask-r-from-70% text-sm font-medium text-nowrap">
              {album.name}
            </p>
            <p className="mr-2 truncate opacity-50">{album.artist}</p>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default AlbumCard;
