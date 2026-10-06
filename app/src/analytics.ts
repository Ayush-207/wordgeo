// Privacy-friendly analytics via GoatCounter: no cookies, no personal data.
//
// Page views are counted automatically when the script loads. Gameplay events
// (solves, give-ups, hints) are counted as GoatCounter "events". Everything is
// a no-op until GOATCOUNTER_CODE is set, and GoatCounter's script ignores
// localhost, so dev and e2e runs are never counted.

/** The site code from goatcounter.com, i.e. CODE in https://CODE.goatcounter.com */
const GOATCOUNTER_CODE = "wordgeo";

declare global {
  interface Window {
    goatcounter?: {
      count?: (vars: { path: string; title?: string; event?: boolean }) => void;
    };
  }
}

export function initAnalytics(): void {
  if (!GOATCOUNTER_CODE) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://gc.zgo.at/count.js";
  script.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
  document.head.appendChild(script);
}

export type GameEvent =
  | "start-daily"
  | "start-practice"
  | "solve-daily"
  | "solve-practice"
  | "give-up-daily"
  | "give-up-practice"
  | "hint"
  | "copy-result";

export function trackEvent(name: GameEvent): void {
  // the script loads async; events fired before it arrives are dropped
  window.goatcounter?.count?.({ path: name, title: name, event: true });
}
