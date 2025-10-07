import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function ArtistGridSkeleton({ count = 12, viewMode = 'grid-large' }: { count?: number; viewMode?: string }) {
  const isLarge = viewMode === 'grid-large';
  const gridClass = isLarge 
    ? "grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    : viewMode === 'grid-small'
    ? "grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
    : "space-y-1";

  if (viewMode === 'list') {
    return (
      <div className={gridClass}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className={`aspect-square ${isLarge ? 'rounded-xl' : 'rounded-lg'}`} />
          <Skeleton className={`h-4 w-3/4 ${isLarge ? 'mt-3' : 'mt-2'} mb-1`} />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function AlbumGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className="aspect-square rounded-lg" />
          <Skeleton className="h-4 w-3/4 mt-2 mb-1" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function SongListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3">
          <Skeleton className="h-12 w-12 rounded" />
          <div className="flex-1">
            <Skeleton className="h-4 w-48 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

export function ArtistDetailSkeleton() {
  return (
    <div>
      <div className="relative h-96 w-full overflow-hidden rounded-2xl">
        <Skeleton className="h-full w-full" />
        <div className="absolute bottom-6 left-6">
          <div className="flex items-end gap-6">
            <Skeleton className="h-52 w-52 rounded-xl" />
            <div>
              <Skeleton className="h-12 w-64 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 space-y-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}