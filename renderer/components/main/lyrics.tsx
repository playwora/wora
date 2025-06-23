import { LyricLine } from "@/lib/helpers";
import React, { useEffect, useRef } from "react";
import { Badge } from "../ui/badge";
import { scrollIntoView } from "seamless-scroll-polyfill";
import { cn } from "@/lib/utils";

interface LyricsProps {
  lyrics: LyricLine[];
  currentLyric: LyricLine | null;
  onLyricClick: (time: number) => void;
  isSyncedLyrics: boolean;
}

const Lyrics: React.FC<LyricsProps> = React.memo(
  ({ lyrics, currentLyric, onLyricClick, isSyncedLyrics }) => {
    const lyricsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (currentLyric && lyricsRef.current) {
        const currentLine = document.getElementById(
          `line-${currentLyric.time}`,
        );
        if (currentLine) {
          scrollIntoView(
            currentLine,
            {
              behavior: "smooth",
              block: "center",
            },
            {
              duration: 500,
            },
          );
        }
      }
    }, [currentLyric]);

    return (
      <div className="wora-border relative h-full w-full rounded-2xl bg-white/70 backdrop-blur-xl dark:bg-black/70">
        <div className="absolute right-6 bottom-5 z-50 flex items-center gap-2">
          <Badge>{isSyncedLyrics ? "Synced" : "Unsynced"}</Badge>
        </div>

        <div className="h-utility mask flex w-full items-center overflow-y-auto mask-y-from-70% px-8 text-2xl font-medium text-balance">
          <div
            ref={lyricsRef}
            className="no-scrollbar h-full w-full py-[33vh]"
            style={{ overflowY: "auto" }}
          >
            {lyrics.map((line) => (
              <p
                key={line.time}
                id={`line-${line.time}`}
                className={cn(
                  currentLyric?.time === line.time
                    ? "scale-125 font-semibold"
                    : "opacity-40",
                  "my-2 max-w-xl origin-left transform-gpu cursor-pointer rounded-xl p-4 lowercase transition-transform duration-700 hover:bg-black/5 dark:hover:bg-white/10",
                )}
                onClick={() => onLyricClick(line.time)}
              >
                {line.text}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  },
);

export default Lyrics;
