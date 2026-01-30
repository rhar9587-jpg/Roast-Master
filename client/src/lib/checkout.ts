type CheckoutResponse = {
  url?: string;
  error?: string;
  message?: string;
};

export async function createCheckoutSession(leagueId: string): Promise<string> {
  if (!leagueId.trim()) {
    throw new Error("league_id is required");
  }

  const res = await fetch("/api/checkout/create-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ league_id: leagueId.trim() }),
  });

  let data: CheckoutResponse = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok || !data?.url) {
    throw new Error(data?.error || data?.message || "Failed to start checkout");
  }

  return data.url;
}
