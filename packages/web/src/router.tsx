// Minimal history-based router (no dependency needed for two screens).

import { useEffect, useState } from 'react';

export function useRoute(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

export function navigate(to: string): void {
  if (to === window.location.pathname) return;
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Returns the room id if the path is /r/:id, else null. */
export function roomIdFromPath(path: string): string | null {
  const match = path.match(/^\/r\/([a-z0-9]+)$/i);
  return match ? match[1] : null;
}
