import { useEffect } from "react";
import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useSettingsStore } from "@/store/settingsStore";

function ThemeApplier() {
  const theme = useSettingsStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    // Toggle Tailwind dark class
    root.classList.toggle("dark", theme === "dark-purple" || theme === "dark-blue");
    // Set data-theme for CSS var overrides (dark-blue uses plain .dark, no extra attr needed)
    if (theme === "dark-blue") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
  }, [theme]);
  return null;
}

function App() {
  return (
    <>
      <ThemeApplier />
      <AppShell />
      <Toaster richColors position="bottom-right" closeButton />
    </>
  );
}

export default App;
