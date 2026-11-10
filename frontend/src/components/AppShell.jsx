import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import Sidebar, { Logo, NAV_ITEMS } from "./Sidebar";
import ThemeToggle from "./ThemeToggle";

function TopBar() {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-border bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
      <div className="flex h-14 items-center justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]">
        <Logo />
        <ThemeToggle />
      </div>
    </header>
  );
}

function BottomTabs() {
  return (
    <nav
      aria-label="Primary mobile"
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="grid grid-cols-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className="relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span layoutId="tab-active" className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-accent" transition={{ duration: 0.25, ease: "easeOut" }} />
                  )}
                  <Icon className={`size-6 ${isActive ? "text-accent-fg" : "text-fg-muted"}`} aria-hidden="true" />
                  <span className={isActive ? "font-semibold" : "text-fg-muted"}>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function AppShell({ children }) {
  // HashRouter owns the URL hash, so the skip link focuses <main> directly instead of navigating to #main.
  const skip = (e) => {
    e.preventDefault();
    document.getElementById("main")?.focus();
  };

  return (
    <div className="min-h-dvh">
      <a href="#main" className="skip-link" onClick={skip}>
        Skip to main content
      </a>
      <Sidebar />
      <TopBar />
      <main id="main" tabIndex={-1} className="shell-main outline-none lg:pl-64">
        <div className="mx-auto w-full max-w-5xl pb-[calc(6.5rem_+_env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-6 sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))] lg:pb-16 lg:pt-10">
          {children}
        </div>
      </main>
      <BottomTabs />
    </div>
  );
}
