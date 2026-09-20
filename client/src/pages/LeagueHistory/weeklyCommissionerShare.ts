/**
 * Commissioner email preview vs public league share URLs.
 * Preview stays on the API email HTML route; sharing uses the public /share page.
 */

import { weeklyPublicShareUrl } from "@shared/weeklyShareUrl";
import type { WeeklyEmailMode } from "./weeklyContext";

export type CommissionerEmailPreviewParams = {
  leagueId: string;
  week: number;
  mode: WeeklyEmailMode;
  /** Optional — only for commissioner email preview, never for public share. */
  note?: string;
  /** Optional — only for commissioner email preview, never for public share. */
  signoff?: string;
};

/**
 * Internal commissioner email HTML preview path.
 * May include note/signoff query params for the email generator only.
 */
export function buildCommissionerEmailPreviewPath(
  params: CommissionerEmailPreviewParams,
): string {
  const leagueId = String(params.leagueId || "").trim();
  const search = new URLSearchParams({
    week: String(Math.floor(Number(params.week)) || 1),
    mode: params.mode === "preview" ? "preview" : "recap",
  });
  const note = params.note?.trim();
  const signoff = params.signoff?.trim();
  if (note) search.set("note", note);
  if (signoff) search.set("signoff", signoff);
  return `/api/leagues/${encodeURIComponent(leagueId)}/weekly-email/preview?${search.toString()}`;
}

/**
 * Public recap URL for league-member sharing (canonical Fantasy Roast share page).
 * Never includes commissioner note, signoff, or email.
 */
export function buildCommissionerPublicRecapUrl(leagueId: string, week: number): string {
  return weeklyPublicShareUrl(String(leagueId || "").trim(), week);
}

/** True when a URL is the internal email preview API (not for member sharing). */
export function isCommissionerEmailPreviewApiUrl(url: string): boolean {
  return String(url || "").includes("/weekly-email/preview");
}
