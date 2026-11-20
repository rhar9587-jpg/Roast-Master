type AnalyticsValue = string | number | boolean;
type TrackProperties = Record<string, AnalyticsValue | null | undefined>;
type AnalyticsData = Record<string, AnalyticsValue>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

const PRIVATE_PROPERTY_KEYS = new Set([
  "username",
  "league_name",
  "card_name",
]);

/** League id is allowed for server funnel reconstruction; stripped from Umami. */
function toSafeUmamiData(properties?: TrackProperties): AnalyticsData | undefined {
  if (!properties) return undefined;
  return Object.entries(properties).reduce<AnalyticsData>((safe, [key, value]) => {
    if (
      !PRIVATE_PROPERTY_KEYS.has(key) &&
      key !== "league_id" &&
      (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean")
    ) {
      safe[key] = value;
    }
    return safe;
  }, {});
}

function toServerProperties(properties?: TrackProperties): Record<string, AnalyticsValue> | undefined {
  if (!properties) return undefined;
  const out: Record<string, AnalyticsValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (
      !PRIVATE_PROPERTY_KEYS.has(key) &&
      (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean")
    ) {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function postServerTrack(event: string, properties?: TrackProperties): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      event,
      properties: toServerProperties(properties) || {},
    });
    // Prefer sendBeacon so unlock → Stripe redirect still records.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/track", blob);
      return;
    }
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never break the app.
  }
}

export function trackEvent(event: string, properties?: TrackProperties): void {
  if (typeof window === "undefined") return;

  try {
    window.umami?.track(event, toSafeUmamiData(properties));
  } catch {
    // Analytics must never break the app.
  }

  postServerTrack(event, properties);
}

// Backwards-compatible alias used by existing components.
export const track = trackEvent;

// Convenience helpers for common events.
// Server funnel names match README / analytics-db counters.
export const trackFunnel = {
  exampleClicked: () => trackEvent("demo_league_opened"),
  usernameSubmitted: (season: string) =>
    trackEvent("league_search_submitted", { season }),
  leaguesReturned: (count: number, season: string) =>
    trackEvent("league_search_completed", { count, season }),
  leagueSelected: (season: string) =>
    trackEvent("league_selected", { season }),
  leagueHistoryLoaded: (isDemo: boolean, isPremium: boolean) =>
    trackEvent("league_analysis_loaded", { is_demo: isDemo, is_premium: isPremium }),
  unlockClicked: (source: string, leagueId?: string) =>
    trackEvent("unlock_clicked", {
      source,
      ...(leagueId ? { league_id: leagueId } : {}),
    }),
  shareClicked: (cardType: string, isPremium: boolean) =>
    trackEvent("share_clicked", { card_type: cardType, is_premium: isPremium }),
  purchaseSuccess: (leagueId?: string) =>
    trackEvent("purchase_success", leagueId ? { league_id: leagueId } : undefined),
  purchaseCancel: (leagueId?: string) =>
    trackEvent("purchase_cancel", leagueId ? { league_id: leagueId } : undefined),
};
