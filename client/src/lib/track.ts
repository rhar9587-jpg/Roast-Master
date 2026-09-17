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
  "league_id",
  "league_name",
  "card_name",
]);

export function trackEvent(event: string, properties?: TrackProperties): void {
  if (typeof window === "undefined") return;

  try {
    const data = properties
      ? Object.entries(properties).reduce<AnalyticsData>((safe, [key, value]) => {
          if (
            !PRIVATE_PROPERTY_KEYS.has(key) &&
            (typeof value === "string" ||
              typeof value === "number" ||
              typeof value === "boolean")
          ) {
            safe[key] = value;
          }
          return safe;
        }, {})
      : undefined;

    window.umami?.track(event, data);
  } catch {
    // Analytics must never break the app.
  }
}

// Backwards-compatible alias used by existing components.
export const track = trackEvent;

// Convenience helpers for common events
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
  unlockClicked: (source: string) =>
    trackEvent("checkout_started", { source }),
  shareClicked: (cardType: string, isPremium: boolean) =>
    trackEvent("share_clicked", { card_type: cardType, is_premium: isPremium }),
  purchaseSuccess: () => trackEvent("purchase_completed"),
  purchaseCancel: () => trackEvent("purchase_canceled"),
};
