import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import AppShell from "./components/AppShell";
import ErrorBoundary from "./components/ErrorBoundary";
import Skeleton from "./components/Skeleton";
import { ToastProvider } from "./components/Toast";
import { ThemeProvider } from "./lib/theme";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const NewAnalysis = lazy(() => import("./pages/NewAnalysis"));
const Report = lazy(() => import("./pages/Report"));

function PageFallback() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">Loading page</span>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.15, ease: "easeOut" } }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        <Suspense fallback={<PageFallback />}>
          <Routes location={location}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<NewAnalysis />} />
            <Route path="/report/:id" element={<Report />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      {/* "user" turns off transform and layout animations when the OS asks for reduced motion */}
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <HashRouter>
            <AppShell>
              <ErrorBoundary>
                <AnimatedRoutes />
              </ErrorBoundary>
            </AppShell>
          </HashRouter>
        </ToastProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
