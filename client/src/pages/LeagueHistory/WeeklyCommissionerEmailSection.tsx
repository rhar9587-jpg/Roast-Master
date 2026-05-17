import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";
import { markFreeSendUsed } from "./premium";
import { setCommissionerEmail } from "./utils";

function WeeklyEmailSentStatus({ leagueId, week }: { leagueId: string; week: number }) {
  const { data } = useQuery({
    queryKey: ["weekly-email-sent", leagueId, week],
    queryFn: async () => {
      const res = await fetch(`/api/leagues/${encodeURIComponent(leagueId)}/weekly-email/sent?week=${week}`);
      if (!res.ok) return { recap: { sent: false }, preview: { sent: false } };
      const json = await res.json();
      return json as {
        recap: { sent: boolean; sentAt?: string };
        preview: { sent: boolean; sentAt?: string };
      };
    },
    enabled: !!leagueId && week >= 1,
  });
  if (!data?.recap?.sent && !data?.preview?.sent) return null;
  const lines: string[] = [];
  if (data.recap?.sent && data.recap.sentAt) {
    const label = new Date(data.recap.sentAt).toLocaleDateString(undefined, { dateStyle: "medium" });
    lines.push(`Recap sent on ${label}`);
  }
  if (data.preview?.sent && data.preview.sentAt) {
    const label = new Date(data.preview.sentAt).toLocaleDateString(undefined, { dateStyle: "medium" });
    lines.push(`Preview sent on ${label}`);
  }
  if (lines.length === 0) return null;
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {lines.join(" · ")}
    </p>
  );
}

export type WeeklyCommissionerEmailSectionProps = {
  leagueId: string;
  leagueWeek: number;
  weeklyCommissionerEmailMode: "recap" | "preview";
  setWeeklyCommissionerEmailMode: (m: "recap" | "preview") => void;
  weeklyCommissionerNote: string;
  setWeeklyCommissionerNote: (v: string) => void;
  weeklyCommissionerSignoff: string;
  setWeeklyCommissionerSignoff: (v: string) => void;
  commissionerEmail: string;
  setCommissionerEmailState: (v: string) => void;
  showPremiumContent: boolean;
  isDemo: boolean;
  freeSendAlreadyUsed: boolean;
  canGenerateAndPreviewWeeklyEmail: boolean;
  canSendWeeklyEmail: boolean;
  weeklyEmailGenerateLoading: boolean;
  setWeeklyEmailGenerateLoading: (v: boolean) => void;
  weeklyEmailSendLoading: boolean;
  setWeeklyEmailSendLoading: (v: boolean) => void;
  onCheckout: () => void;
  setServerFreeSendUsed: (v: boolean) => void;
};

export function WeeklyCommissionerEmailSection({
  leagueId,
  leagueWeek,
  weeklyCommissionerEmailMode,
  setWeeklyCommissionerEmailMode,
  weeklyCommissionerNote,
  setWeeklyCommissionerNote,
  weeklyCommissionerSignoff,
  setWeeklyCommissionerSignoff,
  commissionerEmail,
  setCommissionerEmailState,
  showPremiumContent,
  isDemo,
  freeSendAlreadyUsed,
  canGenerateAndPreviewWeeklyEmail,
  canSendWeeklyEmail,
  weeklyEmailGenerateLoading,
  setWeeklyEmailGenerateLoading,
  weeklyEmailSendLoading,
  setWeeklyEmailSendLoading,
  onCheckout,
  setServerFreeSendUsed,
}: WeeklyCommissionerEmailSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const trimmedId = leagueId.trim();

  return (
    <section
      id="weekly-commissioner-email"
      className="rounded-lg border bg-muted/20 p-4 space-y-4 scroll-mt-24"
    >
      <h3 className="text-sm font-semibold text-foreground">Weekly Commissioner Email</h3>
      <p className="text-xs text-muted-foreground">
        This email matches the same week as your roast. Preview it first, then send rankings and matchup notes to your commissioner.
      </p>
      {!showPremiumContent && !isDemo && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-3 text-sm text-amber-800 dark:text-amber-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <p className="min-w-0 flex-1">
              {freeSendAlreadyUsed
                ? "You've used your free send. Unlock to keep sending."
                : "Unlock to send weekly commissioner emails (preview + recap) for this league."}
            </p>
            <Button size="sm" className="w-full shrink-0 sm:w-auto" onClick={onCheckout}>
              {freeSendAlreadyUsed ? "Unlock to send again" : "Unlock weekly emails for this league"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {freeSendAlreadyUsed ? "Commissioners send this every week." : "Your first send is free. Commissioners send this every week."}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs font-medium text-foreground">Build email</p>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Email type</label>
          <select
            value={weeklyCommissionerEmailMode}
            onChange={(e) => setWeeklyCommissionerEmailMode(e.target.value as "recap" | "preview")}
            className="mt-1 w-full max-w-md rounded-lg border px-2 py-1.5 text-sm"
            disabled={!canGenerateAndPreviewWeeklyEmail}
            title="Recap = after scores are in; Preview = before the week."
          >
            <option value="recap">Recap (post-week)</option>
            <option value="preview">Preview (pre-week)</option>
          </select>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Recap = after scores are in; Preview = before the week kicks off.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!canGenerateAndPreviewWeeklyEmail || weeklyEmailGenerateLoading}
            onClick={async () => {
              setWeeklyEmailGenerateLoading(true);
              try {
                const res = await fetch(
                  `/api/weekly-email?league_id=${encodeURIComponent(trimmedId)}&week=${leagueWeek}`,
                );
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data?.error || "Failed to generate email.");
                }
                toast({ title: "Email ready", description: "Use Preview or Send to Commissioner." });
                track("weekly_email_generated", { league_id: trimmedId, week: leagueWeek });
              } catch (err: unknown) {
                toast({
                  title: "Could not generate email",
                  description: err instanceof Error ? err.message : "Unknown error",
                  variant: "destructive",
                });
              } finally {
                setWeeklyEmailGenerateLoading(false);
              }
            }}
          >
            {weeklyEmailGenerateLoading ? "Generating…" : "Generate Email"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canGenerateAndPreviewWeeklyEmail}
            onClick={() => {
              track("weekly_email_preview", {
                league_id: trimmedId,
                week: leagueWeek,
                mode: weeklyCommissionerEmailMode,
              });
              const params = new URLSearchParams({
                week: String(leagueWeek),
                mode: weeklyCommissionerEmailMode,
              });
              if (weeklyCommissionerNote.trim()) params.set("note", weeklyCommissionerNote.trim());
              if (weeklyCommissionerSignoff.trim()) params.set("signoff", weeklyCommissionerSignoff.trim());
              const url = `/api/leagues/${encodeURIComponent(trimmedId)}/weekly-email/preview?${params.toString()}`;
              window.open(url, "_blank", "noopener,noreferrer");
            }}
          >
            Preview Email
          </Button>
        </div>
      </div>

      {canGenerateAndPreviewWeeklyEmail && (
        <Collapsible open={optionalOpen} onOpenChange={setOptionalOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-dashed bg-background/50 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/50"
            >
              <span>Optional note &amp; sign-off</span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 transition-transform", optionalOpen && "rotate-180")}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Add a note at the top (optional)</label>
              <input
                type="text"
                placeholder="e.g. Big week — trade deadline Tuesday!"
                value={weeklyCommissionerNote}
                onChange={(e) => setWeeklyCommissionerNote(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                maxLength={500}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Sign-off line (optional)</label>
              <input
                type="text"
                placeholder="e.g. Good luck this week!"
                value={weeklyCommissionerSignoff}
                onChange={(e) => setWeeklyCommissionerSignoff(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                maxLength={180}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Collapsible open={sendOpen} onOpenChange={setSendOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-dashed bg-background/50 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/50"
          >
            <span>Send to commissioner</span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", sendOpen && "rotate-180")}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <Separator className="mb-3 bg-border/80" />
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="block text-xs font-medium text-muted-foreground">Commissioner email</label>
                <input
                  type="email"
                  placeholder="commissioner@example.com"
                  value={commissionerEmail}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCommissionerEmailState(v);
                    if (trimmedId) setCommissionerEmail(trimmedId, v);
                  }}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  disabled={!canSendWeeklyEmail}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  We&apos;ll send the report here. You can forward it to your league or BCC everyone.
                </p>
                {showPremiumContent && (
                  <WeeklyEmailSentStatus leagueId={trimmedId} week={leagueWeek} />
                )}
              </div>
              <Button
                size="sm"
                className="w-full shrink-0 sm:w-auto"
                disabled={!canSendWeeklyEmail || !commissionerEmail.trim() || weeklyEmailSendLoading}
                onClick={async () => {
                  if (!commissionerEmail.trim()) {
                    toast({ title: "Enter commissioner email", variant: "destructive" });
                    return;
                  }
                  setWeeklyEmailSendLoading(true);
                  try {
                    const res = await fetch(`/api/leagues/${encodeURIComponent(trimmedId)}/weekly-email/send`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        week: leagueWeek,
                        commissioner_email: commissionerEmail.trim(),
                        note: weeklyCommissionerNote.trim() || undefined,
                        signoff: weeklyCommissionerSignoff.trim() || undefined,
                        mode: weeklyCommissionerEmailMode,
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      if (res.status === 402 || data?.code === "FREE_SEND_USED") {
                        setServerFreeSendUsed(true);
                        throw new Error("You've used your free send. Unlock to send again.");
                      }
                      throw new Error(data?.error || "Failed to send email.");
                    }
                    if (!showPremiumContent && !isDemo) {
                      markFreeSendUsed(trimmedId);
                      setServerFreeSendUsed(true);
                    }
                    track("weekly_email_sent", {
                      league_id: trimmedId,
                      week: leagueWeek,
                      mode: weeklyCommissionerEmailMode,
                    });
                    toast({
                      title: "Sent",
                      description:
                        weeklyCommissionerEmailMode === "preview"
                          ? "Matchup preview sent to commissioner."
                          : "Weekly email sent to commissioner.",
                    });
                    queryClient.invalidateQueries({ queryKey: ["weekly-email-sent", trimmedId, leagueWeek] });
                  } catch (err: unknown) {
                    toast({
                      title: "Send failed",
                      description: err instanceof Error ? err.message : "Unknown error",
                      variant: "destructive",
                    });
                  } finally {
                    setWeeklyEmailSendLoading(false);
                  }
                }}
              >
                {weeklyEmailSendLoading ? "Sending…" : "Send to Commissioner"}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
