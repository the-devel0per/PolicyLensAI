import { NavLink, Link } from "react-router-dom";
import { motion } from "motion/react";
import { FilePlus2, LayoutDashboard, ShieldCheck } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

export const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/new", label: "New analysis", icon: FilePlus2, end: false },
];

export function Logo() {
  return (
    <Link to="/" className="flex min-h-11 items-center gap-3 rounded-md font-semibold" aria-label="PolicyLens AI, go to dashboard">
      <span className="grid size-9 place-items-center rounded-md bg-accent-solid text-white shadow-e2">
        <ShieldCheck className="size-5" aria-hidden="true" />
      </span>
      <span className="text-lg">PolicyLens AI</span>
    </Link>
  );
}

export default function Sidebar() {
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface-solid/60 p-4 backdrop-blur-xl lg:flex">
      <div className="px-2 pb-6 pt-2">
        <Logo />
      </div>
      <nav aria-label="Primary" className="flex-1">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} className="relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-surface-hover">
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span layoutId="sidebar-active" className="absolute inset-0 -z-10 rounded-md border border-accent bg-accent-soft" transition={{ duration: 0.25, ease: "easeOut" }} />
                    )}
                    <Icon className={`size-5 ${isActive ? "text-accent-fg" : "text-fg-muted"}`} aria-hidden="true" />
                    <span className={isActive ? "font-semibold" : ""}>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="space-y-3 border-t border-border pt-4">
        <ThemeToggle showLabel />
        <p className="px-3 text-xs text-fg-muted">AI-assisted analysis. Not legal advice.</p>
      </div>
    </aside>
  );
}
