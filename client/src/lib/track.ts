// Simple client-side analytics tracker
// Non-blocking, never throws

type TrackProperties = Record<string, string | number | boolean | null | undefined>;

export function track(event: string, properties?: TrackProperties): void {
  // Fire and forget - never block UI
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, properties: properties || {} }),
    }).catch(() => {
      // Silently fail - analytics should never break the app
    });
  } catch {
    // Silently fail
  }
}

// Convenience helpers for common events
export const trackFunnel = {
  homeVisit: () => track("home_visit"),
  exampleClicked: () => track("example_clicked"),
  usernameSubmitted: (username: string) => track("username_submitted", { username }),
  leaguesReturned: (count: number, username: string) => track("leagues_returned", { count, username }),
  leagueSelected: (leagueId: string, leagueName: string) => track("league_selected", { league_id: leagueId, league_name: leagueName }),
  leagueHistoryLoaded: (leagueId: string) => track("league_history_loaded", { league_id: leagueId }),
  unlockClicked: (leagueId: string, source: string) => track("unlock_clicked", { league_id: leagueId, source }),
  shareClicked: (cardType: string, leagueId: string, isPremium: boolean) => track("share_clicked", { card_type: cardType, league_id: leagueId, is_premium: isPremium }),
  purchaseSuccess: (leagueId: string) => track("purchase_success", { league_id: leagueId }),
  purchaseCancel: (leagueId: string) => track("purchase_cancel", { league_id: leagueId }),
};
