import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type RoastRequest } from "@shared/schema";

const API_BASE =
  // If you ever need to force the API host, set VITE_API_BASE in Replit secrets/env
  // Example: https://<your-replit-host>
  (import.meta as any).env?.VITE_API_BASE?.replace(/\/$/, "") || "";

function buildUrl(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  return `${API_BASE}${path}?${qs.toString()}`;
}

async function safeReadError(res: Response) {
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j = await res.json();
      return j?.message || JSON.stringify(j);
    }
    const t = await res.text();
    // Trim noisy HTML
    return t?.slice(0, 200) || `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

export function useRoast(params: Partial<RoastRequest> | null) {
  return useQuery({
    queryKey: [api.roast.get.path, params],
    enabled: !!params?.league_id && !!params?.week,
    retry: false,
    queryFn: async () => {
      if (!params?.league_id || !params?.week) return null;

      const queryParams: Record<string, string> = {
        league_id: params.league_id,
        week: params.week.toString(),
      };

      // Only include roster_id if you’re using it in the API
      if ((params as any).roster_id) {
        queryParams.roster_id = String((params as any).roster_id);
      }

      const url = buildUrl(api.roast.get.path, queryParams);

      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });

      if (!res.ok) {
        const msg = await safeReadError(res);
        throw new Error(msg || "Failed to fetch roast");
      }

      const json = await res.json();
      return api.roast.get.responses[200].parse(json);
    },
  });
}
