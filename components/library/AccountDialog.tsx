"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "@/store/useToastStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Mode = "signIn" | "signUp";

function authErrorMessage(err: unknown, t: ReturnType<typeof useTranslation>["t"]): string {
  const code = err instanceof Error && "code" in err ? String((err as { code: unknown }).code) : "";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) {
    return t("account.errorWrongPassword");
  }
  if (code.includes("email-already-in-use")) return t("account.errorEmailInUse");
  if (code.includes("weak-password")) return t("account.errorWeakPassword");
  if (code.includes("invalid-email")) return t("account.errorInvalidEmail");
  if (code.includes("user-not-found")) return t("account.errorUserNotFound");
  return t("account.errorGeneric");
}

export function AccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const createAccountWithEmail = useAuthStore((s) => s.createAccountWithEmail);
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const signOut = useAuthStore((s) => s.signOut);

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setMode("signIn");
    setEmail("");
    setPassword("");
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) resetForm();
    onOpenChange(value);
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
      handleOpenChange(false);
    } catch (err) {
      toast.error(authErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async () => {
    setBusy(true);
    try {
      if (mode === "signIn") await signInWithEmail(email, password);
      else await createAccountWithEmail(email, password);
      handleOpenChange(false);
    } catch (err) {
      toast.error(authErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error(t("account.errorInvalidEmail"));
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
      toast.success(t("account.resetEmailSent"));
    } catch (err) {
      toast.error(authErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
      handleOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton>
        {user ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("account.signedInTitle")}</DialogTitle>
              <DialogDescription>{user.email ?? user.displayName ?? ""}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="destructive" onClick={() => void handleSignOut()} disabled={busy}>
                {t("account.signOut")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {mode === "signIn" ? t("account.signInTitle") : t("account.signUpTitle")}
              </DialogTitle>
              <DialogDescription>{t("account.description")}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <Button variant="outline" onClick={() => void handleGoogle()} disabled={busy}>
                {t("account.continueWithGoogle")}
              </Button>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                {t("account.orDivider")}
                <div className="h-px flex-1 bg-border" />
              </div>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("account.emailLabel")}
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("account.passwordLabel")}
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>

              {mode === "signIn" && (
                <button
                  type="button"
                  className="self-start text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() => void handleForgotPassword()}
                >
                  {t("account.forgotPassword")}
                </button>
              )}
            </div>

            <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col">
              <Button
                onClick={() => void handleEmailSubmit()}
                disabled={busy || !email.trim() || !password.trim()}
              >
                {mode === "signIn" ? t("account.signIn") : t("account.signUp")}
              </Button>
              <button
                type="button"
                className="text-center text-xs text-muted-foreground underline underline-offset-2"
                onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
              >
                {mode === "signIn" ? t("account.switchToSignUp") : t("account.switchToSignIn")}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
