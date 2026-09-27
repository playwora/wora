import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  IconAdjustmentsHorizontal,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/context/playerContext";
import { EQ_FREQS, EqCurve, applyCurve, flatCurve } from "@/lib/eq";

type Scope = "track" | "album";

const NotificationToast = ({
  success,
  message,
}: {
  success: boolean;
  message: string;
}) => (
  <div className="flex w-fit items-center gap-2 text-xs">
    {success ? (
      <IconCheck className="text-green-400" stroke={2} size={16} />
    ) : (
      <IconX className="text-red-500" stroke={2} size={16} />
    )}
    {message}
  </div>
);

function normalizeCurve(raw: any): EqCurve {
  const base = flatCurve();
  if (!raw || typeof raw !== "object") return base;
  const bands = Array.isArray(raw.bands) ? raw.bands : base.bands;
  return {
    enabled: raw.enabled !== false,
    preamp: typeof raw.preamp === "number" ? raw.preamp : 0,
    bands: EQ_FREQS.map((_, i) =>
      typeof bands[i] === "number" ? bands[i] : 0,
    ),
  };
}

function freqLabel(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}k` : `${hz}`;
}

export default function EqualizerPage() {
  const { song } = usePlayer();
  const [scope, setScope] = useState<Scope>("track");
  const [curve, setCurve] = useState<EqCurve>(flatCurve());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Device layer: each named device keeps its own set of track/album curves.
  const [devices, setDevices] = useState<string[]>(["Default"]);
  const [device, setDevice] = useState<string>("Default");
  const [newDeviceName, setNewDeviceName] = useState("");

  const albumKey = String(song?.album?.id ?? song?.album?.name ?? "");
  const storageKey = scope === "track" ? String(song?.id ?? "") : albumKey;

  // Load device list + the active device once.
  useEffect(() => {
    Promise.all([
      window.ipc.invoke("getEqDevices"),
      window.ipc.invoke("getActiveEqDevice"),
    ])
      .then(([devs, active]: [string[], string]) => {
        setDevices(Array.isArray(devs) && devs.length ? devs : ["Default"]);
        setDevice(active || "Default");
      })
      .catch(() => {});
  }, []);

  // Load the stored curve for the current song + scope.
  useEffect(() => {
    let cancelled = false;
    if (!song) {
      setCurve(flatCurve());
      return;
    }
    window.ipc
      .invoke("getEqSetting", { device, scope, key: storageKey })
      .then((stored: any) => {
        if (cancelled) return;
        const c = stored ? normalizeCurve(stored) : flatCurve();
        setCurve(c);
        applyCurve(c); // preview what we're editing
      })
      .catch(() => {
        if (!cancelled) setCurve(flatCurve());
      });
    return () => {
      cancelled = true;
    };
  }, [song, scope, storageKey, device]);

  // Restore the truly effective curve when leaving the page.
  useEffect(() => {
    return () => {
      if (!song) {
        applyCurve(null);
        return;
      }
      window.ipc
        .invoke("resolveEq", { device, trackId: song.id, albumKey })
        .then((res: any) => applyCurve(res?.curve || null))
        .catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, albumKey, device]);

  // Debounced auto-save: persists the curve for the current target without a Save button.
  const persist = useCallback(
    (next: EqCurve) => {
      if (!song || !storageKey) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        window.ipc
          .invoke("setEqSetting", {
            device,
            scope,
            key: storageKey,
            curve: next,
          })
          .then(() => {
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 1200);
          })
          .catch(() => {});
      }, 350);
    },
    [song, storageKey, scope, device],
  );

  // Apply live AND auto-save (used for every user edit).
  const commitLive = useCallback(
    (next: EqCurve) => {
      setCurve(next);
      applyCurve(next);
      persist(next);
    },
    [persist],
  );

  const setBand = (i: number, value: number) => {
    commitLive({
      ...curve,
      bands: curve.bands.map((b, idx) => (idx === i ? value : b)),
    });
  };

  const setPreamp = (value: number) => commitLive({ ...curve, preamp: value });
  const setEnabled = (value: boolean) =>
    commitLive({ ...curve, enabled: value });

  const handleReset = () => commitLive(flatCurve());

  const handleRemove = () => {
    if (!song || !storageKey) return;
    if (saveTimer.current) clearTimeout(saveTimer.current); // don't re-create the row
    window.ipc
      .invoke("deleteEqSetting", { device, scope, key: storageKey })
      .then((ok: boolean) => {
        const f = flatCurve();
        setCurve(f);
        applyCurve(f);
        toast(
          <NotificationToast
            success={ok}
            message={ok ? "EQ removed" : "Failed to remove EQ"}
          />,
        );
      });
  };

  // ---- Device management ----
  const changeDevice = (name: string) => {
    setDevice(name);
    window.ipc.invoke("setActiveEqDevice", { name }).catch(() => {});
  };

  const addDevice = () => {
    const n = newDeviceName.trim();
    if (!n) return;
    window.ipc
      .invoke("addEqDevice", { name: n })
      .then(() => {
        setDevices((d) => (d.includes(n) ? d : [...d, n]));
        setNewDeviceName("");
        changeDevice(n);
        toast(
          <NotificationToast success={true} message={`Device "${n}" added`} />,
        );
      })
      .catch(() => {});
  };

  const removeDevice = () => {
    if (device === "Default") return;
    const target = device;
    window.ipc
      .invoke("deleteEqDevice", { name: target })
      .then((ok: boolean) => {
        if (ok) {
          setDevices((d) => d.filter((x) => x !== target));
          changeDevice("Default");
          toast(
            <NotificationToast
              success={true}
              message={`Device "${target}" removed`}
            />,
          );
        }
      })
      .catch(() => {});
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <IconAdjustmentsHorizontal stroke={2} size={26} />
        <div>
          <h1 className="text-lg font-medium">Equalizer</h1>
          <p className="opacity-50">
            Per-device EQ — each device has its own curves; a track overrides
            its album default.
          </p>
        </div>
      </div>

      {!song ? (
        <div className="wora-border flex h-40 items-center justify-center rounded-2xl bg-white/70 text-sm opacity-50 dark:bg-black/70">
          Play a track to edit its equalizer.
        </div>
      ) : (
        <div className="wora-border flex flex-col gap-6 rounded-2xl bg-white/70 p-6 dark:bg-black/70">
          {/* Device selector */}
          <div className="flex flex-wrap items-center gap-2 border-b border-black/5 pb-4 dark:border-white/5">
            <span className="opacity-50">Device:</span>
            <select
              value={device}
              onChange={(e) => changeDevice(e.target.value)}
              className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
            >
              {devices.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {device !== "Default" && (
              <Button variant="ghost" onClick={removeDevice}>
                Delete device
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <input
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addDevice()}
                placeholder="new device (e.g. Headphones)"
                className="w-48 rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
              />
              <Button variant="ghost" onClick={addDevice}>
                Add device
              </Button>
            </div>
          </div>

          {/* Now playing + target */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{song.name}</p>
              <p className="truncate opacity-50">
                {song.artist} — {song.album?.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="opacity-50">Apply to:</span>
              <div className="flex overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
                {(["track", "album"] as Scope[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={`px-3 py-1.5 text-xs capitalize transition ${
                      scope === s
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Enable */}
          <label className="flex w-fit cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={curve.enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enabled
          </label>

          {/* Bands */}
          <div className="flex items-end gap-4 overflow-x-auto pb-2">
            {/* Preamp */}
            <BandSlider label="Pre" value={curve.preamp} onChange={setPreamp} />
            <div className="mx-1 h-40 w-px self-center bg-black/10 dark:bg-white/10" />
            {EQ_FREQS.map((f, i) => (
              <BandSlider
                key={f}
                label={freqLabel(f)}
                value={curve.bands[i]}
                onChange={(v) => setBand(i, v)}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={handleReset}>
              Reset
            </Button>
            <Button variant="ghost" onClick={handleRemove}>
              Remove {scope} EQ
            </Button>
            <p className="ml-auto flex items-center gap-1.5 text-xs opacity-50">
              {savedFlash ? (
                <>
                  <IconCheck className="text-green-400" stroke={2} size={14} />
                  Saved
                </>
              ) : (
                "Applies and saves automatically"
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function BandSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex w-10 flex-col items-center gap-2">
      <span className="text-[10px] tabular-nums opacity-70">
        {value > 0 ? "+" : ""}
        {value.toFixed(1)}
      </span>
      <input
        type="range"
        min={-12}
        max={12}
        step={0.5}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        // Vertical range slider (Chromium / Electron)
        style={
          {
            WebkitAppearance: "slider-vertical",
            writingMode: "vertical-lr",
            direction: "rtl",
            width: "24px",
            height: "150px",
          } as React.CSSProperties
        }
        className="cursor-pointer"
      />
      <span className="text-[10px] opacity-50">{label}</span>
    </div>
  );
}
