"use client";

import type { ReactNode } from "react";
import { Columns2, Contrast, Flame, Minus, Moon, Plus, Rows3, Sparkles, Sun } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSettingsStore } from "@/store/useSettingsStore";
import {
  PAGE_TURN_ANIMATION_LABELS,
  type FontFamilyOption,
  type PageTurnAnimationLevel,
  type ReaderTheme,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const THEMES: { id: ReaderTheme; label: string; bg: string }[] = [
  { id: "light", label: "Açık", bg: "#ffffff" },
  { id: "cream", label: "Krem", bg: "#f7f3e9" },
  { id: "sepia", label: "Sepya", bg: "#f4ecd8" },
  { id: "dark", label: "Koyu", bg: "#1e1e1e" },
  { id: "coffee", label: "Kahve", bg: "#2b2420" },
  { id: "oled-black", label: "Siyah", bg: "#000000" },
];

const FONTS: { id: FontFamilyOption; label: string; className: string }[] = [
  { id: "literata", label: "Literata", className: "font-reader-literata" },
  { id: "lora", label: "Lora", className: "font-reader-lora" },
  { id: "garamond", label: "Garamond", className: "font-reader-garamond" },
  { id: "sans", label: "Sans", className: "font-reader-sans" },
  { id: "dyslexic", label: "Dyslexic", className: "font-reader-dyslexic" },
];

export function ReaderSettingsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const settings = useSettingsStore();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto max-h-[85dvh] w-full gap-0 rounded-t-3xl border-none bg-popover/95 px-5 pb-8 pt-3 shadow-2xl backdrop-blur-xl sm:max-w-md"
      >
        <div className="mx-auto mb-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/25" />
        <SheetHeader className="p-0 pb-4">
          <SheetTitle className="text-[15px]">Okuma Ayarları</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-7 overflow-y-auto pb-1 pr-1">
          <section>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Tema
            </p>
            <div className="grid grid-cols-4 gap-2.5">
              {THEMES.map((t) => {
                const active = settings.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => settings.update({ theme: t.id })}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all",
                      active
                        ? "border-primary bg-primary/5 ring-2 ring-primary/15"
                        : "border-border hover:border-muted-foreground/40"
                    )}
                  >
                    <span
                      className="size-7 rounded-full border border-black/10 shadow-sm"
                      style={{ backgroundColor: t.bg }}
                    />
                    <span className="text-[11px] text-muted-foreground">{t.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => settings.update({ theme: "custom" })}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all",
                  settings.theme === "custom"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/15"
                    : "border-border hover:border-muted-foreground/40"
                )}
              >
                <span
                  className="size-7 rounded-full border border-black/10 shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${settings.customBg} 50%, ${settings.customFg} 50%)`,
                  }}
                />
                <span className="text-[11px] text-muted-foreground">Özel</span>
              </button>
            </div>

            {settings.theme === "custom" && (
              <div className="mt-3 flex items-center gap-4 rounded-xl border border-border p-3">
                <ColorField
                  label="Arka Plan"
                  value={settings.customBg}
                  onChange={(v) => settings.update({ customBg: v })}
                />
                <ColorField
                  label="Yazı"
                  value={settings.customFg}
                  onChange={(v) => settings.update({ customFg: v })}
                />
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-foreground">
                <Moon className="size-4 text-muted-foreground" />
                Otomatik Gece Modu
              </span>
              <Switch
                checked={settings.autoNightMode}
                onCheckedChange={(checked) => settings.update({ autoNightMode: checked })}
              />
            </div>
          </section>

          <section className="flex flex-col gap-5">
            <SliderRow
              icon={<Sun className="size-4" />}
              label="Parlaklık"
              value={settings.brightness}
              min={50}
              max={150}
              suffix="%"
              onChange={(v) => settings.update({ brightness: v })}
            />
            <SliderRow
              icon={<Contrast className="size-4" />}
              label="Kontrast"
              value={settings.contrast}
              min={50}
              max={150}
              suffix="%"
              onChange={(v) => settings.update({ contrast: v })}
            />
            <SliderRow
              icon={<Flame className="size-4" />}
              label="Sıcaklık"
              value={settings.warmth}
              min={0}
              max={100}
              onChange={(v) => settings.update({ warmth: v })}
            />
          </section>

          <section className="flex flex-col gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Yazı Tipi
            </p>
            <ToggleGroup
              value={[settings.fontFamily]}
              onValueChange={(v) => {
                const next = v[0] as FontFamilyOption | undefined;
                if (next) settings.update({ fontFamily: next });
              }}
              variant="outline"
              className="w-full flex-wrap"
            >
              {FONTS.map((f) => (
                <ToggleGroupItem
                  key={f.id}
                  value={f.id}
                  className={cn("min-w-[31%] flex-1", f.className)}
                >
                  {f.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="flex items-center justify-between rounded-xl border border-border p-1">
              <button
                type="button"
                onClick={() => settings.update({ fontSize: Math.max(12, settings.fontSize - 1) })}
                className="flex size-9 items-center justify-center rounded-lg text-foreground hover:bg-muted"
              >
                <Minus className="size-4" />
              </button>
              <span className="text-sm tabular-nums text-muted-foreground">
                {settings.fontSize}px
              </span>
              <button
                type="button"
                onClick={() => settings.update({ fontSize: Math.min(32, settings.fontSize + 1) })}
                className="flex size-9 items-center justify-center rounded-lg text-foreground hover:bg-muted"
              >
                <Plus className="size-4" />
              </button>
            </div>

            <SliderRow
              icon={<Rows3 className="size-4" />}
              label="Satır Aralığı"
              value={Math.round(settings.lineHeight * 10)}
              min={12}
              max={22}
              onChange={(v) => settings.update({ lineHeight: v / 10 })}
            />
          </section>

          <section className="flex flex-col gap-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Düzen
            </p>
            <SliderRow
              label="Kenar Boşluğu"
              value={settings.margin}
              min={8}
              max={64}
              suffix="px"
              onChange={(v) => settings.update({ margin: v })}
            />

            {/* Two-column layout only makes sense with room to spare — hidden below sm. */}
            <div className="hidden items-center justify-between sm:flex">
              <span className="flex items-center gap-2 text-sm text-foreground">
                <Columns2 className="size-4 text-muted-foreground" />
                Sütun
              </span>
              <ToggleGroup
                value={[String(settings.columns)]}
                onValueChange={(v) => {
                  const next = v[0];
                  if (next) settings.update({ columns: Number(next) as 1 | 2 });
                }}
                variant="outline"
              >
                <ToggleGroupItem value="1">1</ToggleGroupItem>
                <ToggleGroupItem value="2">2</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-foreground">
                  <Sparkles className="size-4 text-muted-foreground" />
                  Sayfa Geçiş Animasyonu
                </span>
                <span className="text-muted-foreground">
                  {PAGE_TURN_ANIMATION_LABELS[settings.pageTurnAnimation]}
                </span>
              </div>
              <Slider
                value={[settings.pageTurnAnimation]}
                min={0}
                max={2}
                step={1}
                onValueChange={(v) => {
                  const next = Array.isArray(v) ? v[0] : v;
                  if (Number.isFinite(next)) {
                    settings.update({
                      pageTurnAnimation: Math.round(next) as PageTurnAnimationLevel,
                    });
                  }
                }}
              />
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-1 items-center gap-2.5 text-sm text-foreground">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-8 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
      />
      {label}
    </label>
  );
}

function SliderRow({
  icon,
  label,
  value,
  min,
  max,
  suffix = "",
  onChange,
}: {
  icon?: ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  // Guard against transient/corrupted non-finite values (e.g. stale
  // localStorage) — Base UI's Slider renders a native range input under the
  // hood, and a NaN `value` there throws a React DOM warning.
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-foreground">
          {icon}
          {label}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {Math.round(safeValue)}
          {suffix}
        </span>
      </div>
      <Slider
        value={[safeValue]}
        min={min}
        max={max}
        onValueChange={(v) => {
          // A single-thumb Base UI slider reports a plain number from
          // pointer/drag interactions but an array from keyboard/native
          // input changes — normalize both.
          const next = Array.isArray(v) ? v[0] : v;
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </div>
  );
}
