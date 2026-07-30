"use client";

import { useState } from "react";
import { UserRound, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { AccountDialog } from "./AccountDialog";

export function AccountButton() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("account.ariaLabel")}
        onClick={() => setOpen(true)}
      >
        {user ? <UserRoundCheck className="size-4" /> : <UserRound className="size-4" />}
      </Button>
      <AccountDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
