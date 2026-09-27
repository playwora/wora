// Per-track / per-album equalizer engine (Web Audio).
//
// Wora plays audio through howler with `html5: true` (an <audio> element).
// We tap that element with a MediaElementSource and route it through a chain
// of BiquadFilterNodes (10-band graphic EQ) + a preamp gain, then to the
// destination. Processing is 32-bit float end to end (no bit-depth loss), and
// gain changes use setTargetAtTime for click-free ramping.

export interface EqCurve {
  enabled: boolean;
  preamp: number; // dB
  bands: number[]; // gain in dB per band (same length/order as EQ_FREQS)
}

export const EQ_FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export function flatCurve(): EqCurve {
  return { enabled: true, preamp: 0, bands: EQ_FREQS.map(() => 0) };
}

export function isFlat(c: EqCurve | null | undefined): boolean {
  if (!c) return true;
  if (Math.abs(c.preamp || 0) > 0.01) return false;
  return (c.bands || []).every((g) => Math.abs(g) < 0.01);
}

let ctx: AudioContext | null = null;
let mediaSource: MediaElementAudioSourceNode | null = null;
let filters: BiquadFilterNode[] = [];
let preampNode: GainNode | null = null;
let attachedEl: HTMLMediaElement | null = null;
let lastCurve: EqCurve | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// Build (or rebuild) the EQ graph around a specific media element.
export function attachElement(el: HTMLMediaElement | null | undefined): void {
  if (!el) return;
  const c = ensureContext();
  if (!c) return;
  if (attachedEl === el && mediaSource) {
    applyCurve(lastCurve); // same element, just re-apply
    return;
  }

  // Tear down previous graph (previous element is being discarded by howler).
  try {
    if (mediaSource) mediaSource.disconnect();
  } catch {}
  filters.forEach((f) => {
    try {
      f.disconnect();
    } catch {}
  });
  try {
    if (preampNode) preampNode.disconnect();
  } catch {}

  try {
    // Help avoid Web Audio tainting on the custom wora:// protocol.
    if (!el.crossOrigin) el.crossOrigin = "anonymous";
  } catch {}

  try {
    mediaSource = c.createMediaElementSource(el);
  } catch (e) {
    // An element can only be wired to one MediaElementSource per context.
    console.warn("[eq] createMediaElementSource failed:", e);
    return;
  }

  filters = EQ_FREQS.map((freq) => {
    const b = c.createBiquadFilter();
    b.type = "peaking";
    b.frequency.value = freq;
    b.Q.value = 1.0;
    b.gain.value = 0;
    return b;
  });
  preampNode = c.createGain();
  preampNode.gain.value = 1;

  let prev: AudioNode = mediaSource;
  for (const f of filters) {
    prev.connect(f);
    prev = f;
  }
  prev.connect(preampNode);
  preampNode.connect(c.destination);

  attachedEl = el;
  void c.resume?.();
  applyCurve(lastCurve);
}

// Reach the underlying <audio> element from a howler Howl instance.
export function attachHowl(sound: any): void {
  const el: HTMLMediaElement | undefined = sound?._sounds?.[0]?._node;
  if (el) attachElement(el);
}

// Apply a curve live (click-free ramp). Pass null to bypass (flat).
export function applyCurve(curve: EqCurve | null | undefined): void {
  lastCurve = curve || null;
  if (!ctx || filters.length === 0) return;
  const on = !!(curve && curve.enabled);
  const now = ctx.currentTime;
  const tau = 0.02; // ~20ms smoothing
  filters.forEach((f, i) => {
    const g = on && curve.bands ? curve.bands[i] || 0 : 0;
    f.gain.setTargetAtTime(g, now, tau);
  });
  if (preampNode) {
    const preLin = on ? Math.pow(10, (curve.preamp || 0) / 20) : 1;
    preampNode.gain.setTargetAtTime(preLin, now, tau);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function isReady(): boolean {
  return filters.length > 0;
}
