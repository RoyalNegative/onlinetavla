// Optional, lightweight analytics (Google Analytics 4). Mirrors the Firebase
// pattern: activates only when VITE_GA_MEASUREMENT_ID (e.g. "G-XXXXXXX") is set;
// otherwise every call here is a safe no-op and no third-party script loads.
//
// This is also the hook point for Google Ads conversions: mark a GA4 event below
// (e.g. `room_created`) as a conversion and import it into Google Ads — no extra
// code needed. To use a dedicated Ads tag instead, set VITE_ADS_CONVERSION_ID.

const env = import.meta.env as Record<string, string | undefined>;
const GA_ID = env.VITE_GA_MEASUREMENT_ID;
const ADS_ID = env.VITE_ADS_CONVERSION_ID; // e.g. "AW-123456789"

export const analyticsEnabled = Boolean(GA_ID || ADS_ID);

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

let ready = false;

/** Injects gtag.js once. No-op when no measurement/conversion id is configured. */
export function initAnalytics(): void {
  if (ready || !analyticsEnabled || typeof window === 'undefined') return;
  ready = true;

  const tagId = GA_ID ?? ADS_ID!;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${tagId}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  const gtag: GtagFn = (...args) => {
    window.dataLayer!.push(args);
  };
  window.gtag = gtag;
  gtag('js', new Date());
  // Manual page_view: SPAs navigate without full reloads (see trackPageView).
  if (GA_ID) gtag('config', GA_ID, { send_page_view: false });
  if (ADS_ID) gtag('config', ADS_ID);
}

/** Report a client-side route change as a page view. */
export function trackPageView(path: string, title: string): void {
  window.gtag?.('event', 'page_view', { page_path: path, page_title: title });
}

/** Report a custom event (e.g. a conversion signal). No-op when disabled. */
export function track(event: string, params?: Record<string, unknown>): void {
  window.gtag?.('event', event, params ?? {});
}
