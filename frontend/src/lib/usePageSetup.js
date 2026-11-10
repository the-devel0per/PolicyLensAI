import { useEffect, useRef } from "react";

let firstPage = true;

// Sets the document title and moves focus to the page's h1 after a route change.
export function usePageSetup(title) {
  const headingRef = useRef(null);
  useEffect(() => {
    document.title = `${title} | PolicyLens AI`;
    window.scrollTo(0, 0);
    if (firstPage) {
      firstPage = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [title]);
  return headingRef;
}
