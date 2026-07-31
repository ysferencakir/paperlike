// Thin wrappers around native-only UI (status bar color/style, and our own
// small ImmersivePlugin for the system nav bar). All no-ops on the web —
// callers don't need to check Capacitor.isNativePlatform() themselves.

import type { Translate } from "./i18n/useTranslation";
import { sanitizeCrashPayload } from "./error-redaction";

interface ImmersivePlugin {
  hide(): Promise<void>;
  show(): Promise<void>;
  keepAwake(options: { awake: boolean }): Promise<void>;
}

// Capacitor's plugin proxies answer to *any* property access, including
// `.then` — so the moment one becomes the resolved value of a Promise
// (returned from an async function, or awaited directly), JS's Promise
// machinery mistakes it for a thenable and calls a native "then()" method
// that doesn't exist, throwing at runtime. immersivePlugin below is only
// ever *assigned*, never `return`ed or `await`ed, to avoid that entirely —
// only its own methods' (real) promises get awaited.
let immersivePlugin: ImmersivePlugin | null = null;
let readyPromise: Promise<void> | null = null;

async function initImmersivePlugin(): Promise<void> {
  const { Capacitor, registerPlugin } = await import("@capacitor/core");
  immersivePlugin = Capacitor.isNativePlatform() ? registerPlugin<ImmersivePlugin>("Immersive") : null;
}

/** Hides (true) or restores (false) the Android system navigation bar. */
export async function setImmersive(hidden: boolean): Promise<void> {
  if (!readyPromise) readyPromise = initImmersivePlugin();
  await readyPromise;
  if (!immersivePlugin) return;
  await (hidden ? immersivePlugin.hide() : immersivePlugin.show());
}

/** Keeps the screen from dimming/locking while reading. */
export async function setKeepAwake(awake: boolean): Promise<void> {
  if (!readyPromise) readyPromise = initImmersivePlugin();
  await readyPromise;
  if (!immersivePlugin) return;
  await immersivePlugin.keepAwake({ awake });
}

interface VolumeKeyPlugin {
  setEnabled(options: { enabled: boolean }): Promise<void>;
  addListener(
    eventName: "volumeKey",
    cb: (event: { direction: "up" | "down" }) => void
  ): Promise<{ remove: () => void }>;
}

// Registered once and cached — calling registerPlugin() again on every
// invocation (this used to happen on every reader mount/settings toggle)
// still works, but Capacitor logs a noisy "already registered" warning each
// time.
let volumeKeyPlugin: VolumeKeyPlugin | null = null;

/**
 * Opts the hardware volume buttons into turning pages instead of changing
 * media volume, for as long as the caller wants (e.g. while the reader is
 * mounted). Returns a cleanup function that turns it back off — always call
 * it (e.g. on unmount), since leaving this on would swallow volume presses
 * everywhere else in the app too.
 */
export async function enableVolumeKeyPageTurn(
  onKey: (direction: "up" | "down") => void
): Promise<() => void> {
  const { Capacitor, registerPlugin } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return () => {};
  if (!volumeKeyPlugin) volumeKeyPlugin = registerPlugin<VolumeKeyPlugin>("VolumeKey");
  const plugin = volumeKeyPlugin;
  await plugin.setEnabled({ enabled: true });
  const listener = await plugin.addListener("volumeKey", (event) => onKey(event.direction));
  return () => {
    void plugin.setEnabled({ enabled: false });
    listener.remove();
  };
}

/**
 * Reads text aloud — native TTS engine on Android (steadier voice/queueing
 * than Android WebView's own patchy `speechSynthesis` support), falling
 * back to the Web Speech API when running in a plain browser (dev testing).
 * `onEnd` fires once speech finishes or errors, either way.
 */
export async function speak(text: string, lang: string, onEnd: () => void): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
    await TextToSpeech.stop();
    try {
      await TextToSpeech.speak({ text, lang, category: "playback" });
    } finally {
      onEnd();
    }
    return;
  }
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
}

/** Stops whichever TTS engine (native or Web Speech API) is currently speaking. */
export async function stopSpeaking(): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
    await TextToSpeech.stop();
    return;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

const BREAK_REMINDER_ID = 1001;

/**
 * Requests the Android 13+ POST_NOTIFICATIONS runtime permission, only at
 * the moment a notification-dependent feature is actually being turned on
 * (not upfront at app launch). No-op (always granted) on the web, where
 * break reminders don't need OS permission at all.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return true;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const { display } = await LocalNotifications.checkPermissions();
  if (display === "granted") return true;
  const result = await LocalNotifications.requestPermissions();
  return result.display === "granted";
}

/**
 * Schedules a native "time for a break?" notification via the OS's own
 * alarm scheduler — unlike a plain JS `setTimeout`, this survives the app
 * being backgrounded or the WebView process getting killed, so it still
 * fires even if the reader isn't open (or the app isn't running) when the
 * interval elapses. Re-scheduling (same fixed id) replaces any pending one.
 */
export async function scheduleBreakReminder(minutesFromNow: number, t: Translate): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;
  if (!(await requestNotificationPermission())) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.schedule({
    notifications: [
      {
        id: BREAK_REMINDER_ID,
        title: t("native.breakReminderTitle"),
        body: t("native.breakReminderBody"),
        schedule: { at: new Date(Date.now() + minutesFromNow * 60000) },
      },
    ],
  });
}

export async function cancelBreakReminder(): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.cancel({ notifications: [{ id: BREAK_REMINDER_ID }] });
}

interface ShortcutsPlugin {
  setContinueReading(options: { bookId: string; title: string }): Promise<void>;
}
let shortcutsPlugin: ShortcutsPlugin | null = null;

/** Updates the app icon's "Continue reading <title>" long-press shortcut. */
export async function setContinueReadingShortcut(
  bookId: string,
  title: string,
  t: Translate
): Promise<void> {
  const { Capacitor, registerPlugin } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;
  if (!shortcutsPlugin) shortcutsPlugin = registerPlugin<ShortcutsPlugin>("Shortcuts");
  await shortcutsPlugin.setContinueReading({
    bookId,
    title: t("native.continueReadingShortcut", { title }),
  });
}

interface WidgetPlugin {
  updateProgress(options: { bookId: string; title: string; percentage: number }): Promise<void>;
}
let widgetPlugin: WidgetPlugin | null = null;

/** Pushes the currently-open book/progress to the "continue reading" home-screen widget. */
export async function updateContinueReadingWidget(
  bookId: string,
  title: string,
  percentage: number
): Promise<void> {
  const { Capacitor, registerPlugin } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;
  if (!widgetPlugin) widgetPlugin = registerPlugin<WidgetPlugin>("Widget");
  await widgetPlugin.updateProgress({ bookId, title, percentage: Math.round(percentage) });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Hands a file off to be saved/shared. On the web this is a plain browser
 * download; on native it writes to the cache dir and opens the OS share
 * sheet, so the user can drop it into Drive, WhatsApp, another device, etc.
 * — there's no single "save to disk" primitive that makes sense on Android.
 */
export async function shareFile(blob: Blob, filename: string, title: string): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const base64 = await blobToBase64(blob);
  await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
  await Share.share({ title, files: [uri] });
}

interface CrashReportingPlugin {
  recordException(options: { message: string; stack: string }): Promise<void>;
  log(options: { message: string }): Promise<void>;
  setCollectionEnabled(options: { enabled: boolean }): Promise<void>;
}

let crashReportingPlugin: CrashReportingPlugin | null = null;
let crashReportingInit: Promise<void> | null = null;
// Privacy-safe process default. The persisted user preference is applied by
// CrashReportingHandler during client startup.
let crashReportingCollectionEnabled = false;

async function initCrashReporting(): Promise<void> {
  const { Capacitor, registerPlugin } = await import("@capacitor/core");
  crashReportingPlugin = Capacitor.isNativePlatform()
    ? registerPlugin<CrashReportingPlugin>("CrashReporting")
    : null;
}

/**
 * Applies the explicit local opt-in to native Crashlytics. Disabling also
 * asks the native SDK to discard unsent reports; Firebase applies the
 * automatic-collection override fully on the next app launch.
 */
export async function setCrashReportingCollectionEnabled(enabled: boolean): Promise<void> {
  crashReportingCollectionEnabled = enabled;
  if (!crashReportingInit) crashReportingInit = initCrashReporting();
  await crashReportingInit;
  if (!crashReportingPlugin) return;
  await crashReportingPlugin.setCollectionEnabled({ enabled });
}

/** Sends a JS-side error to Crashlytics. No-op on the web. */
export async function recordException(error: unknown): Promise<void> {
  if (!crashReportingCollectionEnabled) return;
  if (!crashReportingInit) crashReportingInit = initCrashReporting();
  await crashReportingInit;
  if (!crashReportingPlugin) return;
  const { message, stack } = sanitizeCrashPayload(error);
  await crashReportingPlugin.recordException({ message, stack });
}

function isDarkHex(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

/** Light tap feedback for a page turn. */
export async function hapticPageTurn(): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;
  const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
  await Haptics.impact({ style: ImpactStyle.Light });
}

/** Slightly stronger feedback for a deliberate action (highlight, bookmark). */
export async function hapticAction(): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;
  const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
  await Haptics.impact({ style: ImpactStyle.Medium });
}

/** Tints the status bar to match a screen's own background color. */
export async function syncStatusBar(bgHex: string): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;
  const { StatusBar, Style } = await import("@capacitor/status-bar");
  const dark = isDarkHex(bgHex);
  await StatusBar.setBackgroundColor({ color: bgHex });
  await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
}
