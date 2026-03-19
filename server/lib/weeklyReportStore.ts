/**
 * In-memory sent history for weekly commissioner emails.
 * Optional: allows UI to show "Sent on ..." for recap and preview per league+week.
 */

export interface SentRecord {
  sentAt: string; // ISO
  commissionerEmail?: string;
}

export type WeeklyEmailType = "recap" | "preview";

const sentLog = new Map<string, SentRecord>();

function key(leagueId: string, week: number, type: WeeklyEmailType): string {
  return `${leagueId}:${week}:${type}`;
}

export function recordSent(
  leagueId: string,
  week: number,
  commissionerEmail?: string,
  type: WeeklyEmailType = "recap",
): void {
  if (week < 1) return;
  sentLog.set(key(leagueId, week, type), {
    sentAt: new Date().toISOString(),
    commissionerEmail,
  });
}

export interface SentStatus {
  recap: SentRecord | null;
  preview: SentRecord | null;
}

export function getSentRecord(leagueId: string, week: number): SentStatus {
  if (week < 1) return { recap: null, preview: null };
  return {
    recap: sentLog.get(key(leagueId, week, "recap")) ?? null,
    preview: sentLog.get(key(leagueId, week, "preview")) ?? null,
  };
}
