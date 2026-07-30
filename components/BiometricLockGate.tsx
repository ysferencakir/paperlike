"use client";

import { useEffect, useRef, useState } from "react";
import { Fingerprint } from "lucide-react";
import { useSecurityStore } from "@/store/useSecurityStore";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/useTranslation";

/**
 * Full-screen lock overlay for the "protect the library with biometrics"
 * setting (BackupMenu). Locks on cold start and again every time the app
 * comes back from the background — mirroring how banking/notes apps
 * typically implement this, not a one-time-per-process unlock.
 */
// After this many failed/impossible unlock attempts, an escape hatch to
// disable the lock outright appears — otherwise a phone that loses its
// enrolled biometry (or never had one) locks the user out permanently, since
// the only other way to flip this setting off lives inside the very library
// it's locking.
const ESCAPE_HATCH_THRESHOLD = 2;

export function BiometricLockGate() {
  const { t } = useTranslation();
  const enabled = useSecurityStore((s) => s.biometricLockEnabled);
  const setBiometricLockEnabled = useSecurityStore((s) => s.setBiometricLockEnabled);
  const [locked, setLocked] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const isNativeRef = useRef(false);

  // Adjusted during render (React's documented pattern for "reset state
  // when a prop changes") rather than in an effect — locks/unlocks in the
  // same commit the moment `enabled` flips, instead of one render later.
  const [prevEnabled, setPrevEnabled] = useState(enabled);
  if (enabled !== prevEnabled) {
    setPrevEnabled(enabled);
    setLocked(enabled);
  }

  useEffect(() => {
    if (!enabled) return;

    let appStateSub: { remove: () => void } | undefined;
    let cancelled = false;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      isNativeRef.current = Capacitor.isNativePlatform();
      if (!isNativeRef.current || cancelled) return;
      const { App } = await import("@capacitor/app");
      const listener = await App.addListener("appStateChange", (state) => {
        if (state.isActive) setLocked(true);
      });
      if (cancelled) listener.remove();
      else appStateSub = listener;
    })();

    return () => {
      cancelled = true;
      appStateSub?.remove();
    };
  }, [enabled]);

  const unlock = async () => {
    setError(null);
    if (!isNativeRef.current) {
      // No biometry to check on the web (dev testing) — just unlock.
      setLocked(false);
      return;
    }
    try {
      const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
      const status = await BiometricAuth.checkBiometry();
      // isAvailable only reflects enrolled *biometrics* — deviceIsSecure
      // covers PIN/pattern/password, which authenticate() below can also
      // fall back to via allowDeviceCredential. Only truly impossible when
      // neither is set up.
      if (!status.isAvailable && !status.deviceIsSecure) {
        setError(t("biometric.notAvailable"));
        setFailedAttempts((n) => n + 1);
        return;
      }
      await BiometricAuth.authenticate({
        reason: t("biometric.reason"),
        allowDeviceCredential: true,
      });
      setLocked(false);
      setFailedAttempts(0);
    } catch {
      setError(t("biometric.failed"));
      setFailedAttempts((n) => n + 1);
    }
  };

  const disableLock = () => {
    setBiometricLockEnabled(false);
    setLocked(false);
  };

  if (!locked) return null;

  const showEscapeHatch = failedAttempts >= ESCAPE_HATCH_THRESHOLD;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-[#0a0a0a] px-8 text-center">
      <Fingerprint className="size-10 text-white/80" />
      <p className="text-sm text-white/70">{t("biometric.locked")}</p>
      <Button size="sm" onClick={() => void unlock()}>
        {t("biometric.unlock")}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {showEscapeHatch && !confirmingDisable && (
        <button
          type="button"
          className="mt-4 text-xs text-white/40 underline underline-offset-2"
          onClick={() => setConfirmingDisable(true)}
        >
          {t("biometric.disableLock")}
        </button>
      )}
      {confirmingDisable && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-xs text-white/50">{t("biometric.disableLockConfirm")}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={disableLock}>
              {t("biometric.disableLockConfirmYes")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingDisable(false)}>
              {t("biometric.disableLockConfirmNo")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
