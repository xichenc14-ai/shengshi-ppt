'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function resetViewportPosition(resetTop: boolean) {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
  window.scrollTo({
    top: resetTop ? 0 : window.scrollY,
    left: 0,
    behavior: 'instant',
  });
}

function restoreRoutePosition() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (hash) {
    const target = document.getElementById(hash);
    if (target) {
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
      const navOffset = window.innerWidth >= 768 ? 80 : 68;
      const top = target.getBoundingClientRect().top + window.scrollY - navOffset;
      window.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'instant' });
      return;
    }
  }
  resetViewportPosition(true);
}

export default function ViewportStabilizer() {
  const pathname = usePathname();

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(restoreRoutePosition);
    });
    const timer = window.setTimeout(restoreRoutePosition, 120);
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(timer);
    };
  }, [pathname]);

  useEffect(() => {
    const handleHashChange = () => {
      window.requestAnimationFrame(restoreRoutePosition);
    };
    const handlePageShow = () => resetViewportPosition(false);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') resetViewportPosition(false);
    };
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('hashchange', handleHashChange);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('hashchange', handleHashChange);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return null;
}
