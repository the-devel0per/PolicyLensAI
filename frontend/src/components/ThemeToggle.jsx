import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";

export default function ThemeToggle({ showLabel = false }) {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggle}
      className={`btn btn-ghost ${showLabel ? "w-full justify-start" : "icon-btn"}`}
      aria-label={`Switch to ${next} theme`}
    >
      <Icon className="size-5" aria-hidden="true" />
      {showLabel && <span>{next === "light" ? "Light theme" : "Dark theme"}</span>}
    </button>
  );
}
