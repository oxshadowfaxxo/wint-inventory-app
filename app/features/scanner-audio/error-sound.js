export const STORAGE_KEY = "winterthur-inventory:barcode-error-audio:v1";
export const DEFAULT_PREFERENCES = { enabled: true, volume: 70 };
let preferences = DEFAULT_PREFERENCES;
let context;
let activeGain;
let busyUntil = 0;

function normalize(value) {
  return {
    enabled: typeof value?.enabled === "boolean" ? value.enabled : true,
    volume:
      typeof value?.volume === "number" && Number.isFinite(value.volume)
        ? Math.max(0, Math.min(100, value.volume))
        : 70,
  };
}

export function readPreferences() {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) preferences = normalize(JSON.parse(stored));
  } catch {
    /* Keep session preferences when storage is blocked. */
  }
  return preferences;
}

export function savePreferences(value) {
  preferences = normalize(value);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    /* Settings still apply for this session. */
  }
  try {
    if (activeGain && context)
      activeGain.gain.setValueAtTime(
        preferences.enabled ? (preferences.volume / 100) * 0.2 : 0,
        context.currentTime,
      );
  } catch {
    /* Audio failures do not prevent saving. */
  }
  return preferences;
}

// Called during a user gesture, before awaiting the barcode response.
export function unlockAudio() {
  try {
    if (typeof window === "undefined") return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!context || context.state === "closed") context = new AudioContext();
    if (context.state === "suspended") void context.resume().catch(() => {});
  } catch {
    /* Audio must never interrupt counting. */
  }
}

export function playErrorSound() {
  try {
    const { enabled, volume } = readPreferences();
    if (!enabled || volume === 0 || !context || context.state !== "running")
      return false;
    const now = context.currentTime;
    // Drop alerts during the previous pair; never build an audio backlog.
    if (now < busyUntil) return false;
    busyUntil = now + 0.38;
    const master = context.createGain();
    activeGain = master;
    master.gain.setValueAtTime((volume / 100) * 0.2, now);
    master.connect(context.destination);
    for (const offset of [0, 0.23]) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const start = now + offset;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(220, start);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(1, start + 0.01);
      envelope.gain.setValueAtTime(1, start + 0.13);
      envelope.gain.linearRampToValueAtTime(0, start + 0.15);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
        if (offset > 0) {
          master.disconnect();
          if (activeGain === master) activeGain = undefined;
        }
      };
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    }
    return true;
  } catch {
    return false;
  }
}

const BARCODE_ERRORS = new Set([
  "BARCODE_NOT_FOUND",
  "SHOPIFY_BARCODE_NOT_FOUND",
  "DUPLICATE_SHOPIFY_BARCODE",
  "INACTIVE_PRODUCT",
  "INVENTORY_NOT_TRACKED",
  "NOT_STOCKED_AT_LOCATION",
  "MISSING_ON_HAND",
]);

export function isBarcodeFailure(data) {
  return (
    !data?.scan?.line &&
    (Boolean(data?.scan?.duplicate) ||
      (data?.scanError === true && BARCODE_ERRORS.has(data.barcodeErrorCode)))
  );
}
