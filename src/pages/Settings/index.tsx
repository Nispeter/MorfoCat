import { PanelLayout } from "@/components/layout/PanelLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettingsStore, type Theme } from "@/store/settingsStore";
import { useT, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface ThemeOption {
  value: Theme;
  labelKey: "settings.darkPurple" | "settings.lightCyan" | "settings.darkBlue";
  descKey: "settings.darkPurpleDesc" | "settings.lightCyanDesc" | "settings.darkBlueDesc";
  preview: { bg: string; card: string; primary: string; text: string };
}

const THEMES: ThemeOption[] = [
  {
    value: "dark-purple",
    labelKey: "settings.darkPurple",
    descKey: "settings.darkPurpleDesc",
    preview: { bg: "#0e0a18", card: "#130f1e", primary: "#a855f7", text: "#e9e3f5" },
  },
  {
    value: "light-cyan",
    labelKey: "settings.lightCyan",
    descKey: "settings.lightCyanDesc",
    preview: { bg: "#f0fbfc", card: "#ffffff", primary: "#0891b2", text: "#0c2a30" },
  },
  {
    value: "dark-blue",
    labelKey: "settings.darkBlue",
    descKey: "settings.darkBlueDesc",
    preview: { bg: "#0d1117", card: "#0d1117", primary: "#3b82f6", text: "#e2e8f0" },
  },
];

const LANGS: Array<{ value: Lang; labelKey: "settings.langEn" | "settings.langEs"; flag: string }> = [
  { value: "en", labelKey: "settings.langEn", flag: "🇬🇧" },
  { value: "es", labelKey: "settings.langEs", flag: "🇪🇸" },
];

function ThemePreview({ preview }: { preview: ThemeOption["preview"] }) {
  return (
    <div
      className="h-20 w-full rounded-md overflow-hidden border border-white/10"
      style={{ background: preview.bg }}
    >
      {/* Mini sidebar */}
      <div className="flex h-full">
        <div className="w-10 h-full flex flex-col gap-1 p-1.5" style={{ background: preview.card }}>
          {[40, 55, 40, 55, 40].map((w, i) => (
            <div key={i} className="rounded-sm h-2" style={{ width: `${w}%`, background: i === 1 ? preview.primary : `${preview.text}22` }} />
          ))}
        </div>
        {/* Mini content */}
        <div className="flex-1 p-2 space-y-1.5">
          <div className="h-2 w-2/3 rounded-sm" style={{ background: `${preview.text}66` }} />
          <div className="h-8 w-full rounded-md" style={{ background: preview.card }} />
          <div className="flex gap-1">
            <div className="h-5 w-16 rounded-sm" style={{ background: preview.primary }} />
            <div className="h-5 w-12 rounded-sm" style={{ background: `${preview.text}22` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const t = useT();
  const { theme, lang, setTheme, setLang } = useSettingsStore();

  return (
    <PanelLayout title={t("page.settings.title")} description={t("page.settings.desc")}>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Theme */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("settings.theme")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("settings.themeDesc")}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {THEMES.map((opt) => {
                const active = theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={cn(
                      "relative flex flex-col gap-2 rounded-lg border-2 p-3 text-left transition-all hover:border-primary/60",
                      active ? "border-primary shadow-md" : "border-border"
                    )}
                  >
                    {active && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check size={11} className="text-primary-foreground" />
                      </span>
                    )}
                    <ThemePreview preview={opt.preview} />
                    <div>
                      <p className="text-sm font-semibold">{t(opt.labelKey)}</p>
                      <p className="text-xs text-muted-foreground">{t(opt.descKey)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("settings.language")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("settings.langDesc")}</p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {LANGS.map((opt) => {
                const active = lang === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setLang(opt.value)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border-2 px-5 py-3 text-sm font-medium transition-all hover:border-primary/60",
                      active ? "border-primary bg-primary/5 shadow-sm" : "border-border"
                    )}
                  >
                    <span className="text-xl">{opt.flag}</span>
                    <span>{t(opt.labelKey)}</span>
                    {active && <Check size={14} className="ml-1 text-primary" />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </PanelLayout>
  );
}
