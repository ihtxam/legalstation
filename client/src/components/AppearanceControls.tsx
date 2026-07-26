import { Moon, Sun, Type } from "lucide-react";
import { useTheme, type TextSize } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  /** Compact icon controls for the top bar */
  variant?: "bar" | "panel";
  className?: string;
};

export default function AppearanceControls({ variant = "bar", className }: Props) {
  const { t } = useTranslation();
  const { theme, setTheme, toggleTheme, textSize, setTextSize } = useTheme();

  if (variant === "bar") {
    return (
      <div className={cn("flex items-center gap-0.5", className)}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={toggleTheme}
          title={theme === "dark" ? t("appearance.switchToDay") : t("appearance.switchToNight")}
          aria-label={theme === "dark" ? t("appearance.switchToDay") : t("appearance.switchToNight")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
          {([
            ["sm", "A"],
            ["md", "A"],
            ["lg", "A"],
          ] as const).map(([size, label], i) => (
            <button
              key={size}
              type="button"
              onClick={() => setTextSize(size as TextSize)}
              className={cn(
                "h-7 min-w-7 px-1.5 rounded-md font-semibold transition-colors",
                i === 0 && "text-[10px]",
                i === 1 && "text-xs",
                i === 2 && "text-sm",
                textSize === size
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={t(`appearance.textSize.${size}`)}
              aria-label={t(`appearance.textSize.${size}`)}
              aria-pressed={textSize === size}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-5", className)}>
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-[var(--color-gold)]" />
          {t("appearance.theme")}
        </Label>
        <p className="text-xs text-muted-foreground">{t("appearance.themeHint")}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={theme === "light" ? "default" : "outline"}
            className={theme === "light" ? "bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-light)]" : ""}
            onClick={() => setTheme("light")}
          >
            <Sun className="h-4 w-4 me-1.5" />
            {t("appearance.day")}
          </Button>
          <Button
            type="button"
            variant={theme === "dark" ? "default" : "outline"}
            className={theme === "dark" ? "bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-light)]" : ""}
            onClick={() => setTheme("dark")}
          >
            <Moon className="h-4 w-4 me-1.5" />
            {t("appearance.night")}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Type className="h-4 w-4 text-[var(--color-gold)]" />
          {t("appearance.textSizeLabel")}
        </Label>
        <p className="text-xs text-muted-foreground">{t("appearance.textSizeHint")}</p>
        <div className="flex gap-2 flex-wrap">
          {(["sm", "md", "lg"] as const).map((size) => (
            <Button
              key={size}
              type="button"
              variant={textSize === size ? "default" : "outline"}
              className={textSize === size ? "bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-light)]" : ""}
              onClick={() => setTextSize(size)}
            >
              {t(`appearance.textSize.${size}`)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
