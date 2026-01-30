import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, HelpCircle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { LeagueSelector } from "./LeagueSelector";
import { InsightsDashboard } from "./InsightsDashboard";
import { HeroReceipts } from "./HeroReceipts";
import { DominanceGrid } from "./DominanceGrid";
import { StorylinesMiniCards } from "./StorylinesMiniCards";
import { MatchupDetailModal } from "./MatchupDetailModal";
import { GridTable } from "./DominanceGrid/GridTable";
import { ConversionBanner } from "./ConversionBanner";
import { PostAnalysisToast } from "./PostAnalysisToast";
import { StickyUpgradeBar } from "./StickyUpgradeBar";
import { UnlockReceiptsModal } from "./UnlockReceiptsModal";
import { RoastCard } from "@/components/RoastCard";
import { SeasonWrappedCard } from "@/components/SeasonWrappedCard";
import { LeagueAutopsyCard } from "@/components/LeagueAutopsyCard";
import { LockedModePreview } from "./LockedModePreview";
import { isLeagueUnlocked, unlockLeague, lockLeague } from "./premium";
import { createCheckoutSession } from "@/lib/checkout";
import { fmtRecord, getViewerByLeague, setViewerByLeague, saveRecentLeague, getRecentLeagues, getStoredUsername, setStoredUsername } from "./utils";
import { computeLeagueStorylines, computeYourRoast, computeAdditionalMiniCards, type MiniCard } from "./storylines";
import { computeHeroReceipts } from "./computeHeroReceipts";
import { trackFunnel } from "@/lib/track";
import type {
  Badge,
  DominanceApiResponse,
  DominanceCellDTO,
  VictimRow,
  LandlordSummary,
  ManagerRow,
} from "./types";
import type { RoastResponse, WrappedResponse, LeagueAutopsyResponse } from "@shared/schema";

const EXAMPLE_LEAGUE_ID = "demo-group-chat-dynasty";
const WEEKLY_ENABLED = false; // Disabled for Super Bowl V1 - re-enable post-Super Bowl
type Mode = "history" | "weekly" | "season" | "end";
type TeamOption = { roster_id: number; name: string };

function isCountable(c: DominanceCellDTO) {
  return (c?.games ?? 0) >= 3;
}

export default function LeagueHistoryPage() {
  const [leagueId, setLeagueId] = useState("");
  const [startWeek, setStartWeek] = useState(1);
  const [endWeek, setEndWeek] = useState(17);
  const [includePlayoffs, setIncludePlayoffs] = useState(false);
  const [defaultRegularSeasonEnd, setDefaultRegularSeasonEnd] = useState<number | null>(null);
  const [selected, setSelected] = useState<DominanceCellDTO | null>(null);
  const [selectedMiniCard, setSelectedMiniCard] = useState<MiniCard | null>(null);
  const [activeBadge, setActiveBadge] = useState<Badge | null>(null);
  const [isSelectorCollapsed, setIsSelectorCollapsed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isExportingStorylines, setIsExportingStorylines] = useState(false);
  const [isExportingYourRoast, setIsExportingYourRoast] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);
  const [viewerKey, setViewerKey] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [highlightedManagerKey, setHighlightedManagerKey] = useState<string | null>(null);
  const [showPostAnalysisToast, setShowPostAnalysisToast] = useState(false);
  const [isPremiumState, setIsPremiumState] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [activeMode, setActiveMode] = useState<Mode>("history");
  const [weeklyWeek, setWeeklyWeek] = useState<number>(17);
  const [weeklyRoastData, setWeeklyRoastData] = useState<RoastResponse | null>(null);
  const [weeklyRoastLoading, setWeeklyRoastLoading] = useState(false);
  const [weeklyRoastError, setWeeklyRoastError] = useState<string | null>(null);
  const [seasonWrappedData, setSeasonWrappedData] = useState<WrappedResponse | null>(null);
  const [seasonWrappedLoading, setSeasonWrappedLoading] = useState(false);
  const [seasonWrappedError, setSeasonWrappedError] = useState<string | null>(null);
  const [seasonTeams, setSeasonTeams] = useState<TeamOption[]>([]);
  const [seasonTeamsLoading, setSeasonTeamsLoading] = useState(false);
  const [seasonRosterId, setSeasonRosterId] = useState<number | "">("");
  const [autopsyData, setAutopsyData] = useState<LeagueAutopsyResponse | null>(null);
  const [autopsyLoading, setAutopsyLoading] = useState(false);
  const [autopsyError, setAutopsyError] = useState<string | null>(null);
  const { toast } = useToast();

  // Demo league always shows full content (bypasses premium gating)
  const isDemo = leagueId === EXAMPLE_LEAGUE_ID;
  const showPremiumContent = isPremiumState || isDemo;

  const gridVisibleRef = useRef<HTMLDivElement | null>(null);
  const gridExportRef = useRef<HTMLDivElement | null>(null);
  const storylinesExportRef = useRef<HTMLDivElement | null>(null);
  const yourRoastExportRef = useRef<HTMLDivElement | null>(null);
  const viewAsPickerRef = useRef<HTMLDivElement | null>(null);
  const selectorRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedFromUrl = useRef(false);
  const shouldAutoTrigger = useRef(false);
  const hasScrolledToPicker = useRef(false);

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["league-history-dominance", leagueId, startWeek, endWeek, includePlayoffs],
    enabled: false,
    queryFn: async (): Promise<DominanceApiResponse> => {
      try {
        const qs = new URLSearchParams({
          league_id: leagueId.trim(),
          start_week: String(startWeek),
          end_week: String(endWeek),
          include_playoffs: includePlayoffs ? "true" : "false",
        });
        const res = await fetch(`/api/league-history/dominance?${qs.toString()}`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          const errorMsg = j?.error || "Failed to load roasts";

          // Map errors to helpful messages
          if (res.status === 404 || errorMsg.toLowerCase().includes("not found")) {
            throw new Error("LEAGUE_NOT_FOUND");
          }
          if (errorMsg.toLowerCase().includes("timeout")) {
            throw new Error("TIMEOUT");
          }
          if (errorMsg.toLowerCase().includes("network") || errorMsg.toLowerCase().includes("fetch")) {
            throw new Error("NETWORK_ERROR");
          }
          throw new Error(errorMsg);
        }
        const json = await res.json();
        if (
          import.meta.env?.DEV &&
          typeof window !== "undefined" &&
          window.localStorage.getItem("debugLeagueHistory") === "1"
        ) {
          console.log("[LeagueHistory] seasonStats:", json?.seasonStats?.length ?? 0);
          console.log("[LeagueHistory] weeklyMatchups:", json?.weeklyMatchups?.length ?? 0);
          console.log("[LeagueHistory] defaultRegularSeasonEnd:", json?.defaultRegularSeasonEnd);
        }
        setLastAnalyzedAt(new Date());
        // Update default regular season end from response
        if (json?.defaultRegularSeasonEnd !== undefined) {
          setDefaultRegularSeasonEnd(json.defaultRegularSeasonEnd);
        }
        return json;
      } catch (e) {
        // fetch() threw (e.g. "Failed to fetch") — server down, network unreachable, CORS
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("network") || msg.toLowerCase().includes("failed")) {
          throw new Error("NETWORK_ERROR");
        }
        throw e;
      }
    },
  });

  const hasData = Boolean(data?.grid?.length);
  const prevFetching = useRef(false);
  const prevHasData = useRef(false);

  // Load stored username on mount
  useEffect(() => {
    const stored = getStoredUsername();
    if (stored) setUsername(stored);
  }, []);

  // Manager matching function
  function findManagerKeyByUsername(
    username: string,
    managers: ManagerRow[]
  ): string | null {
    if (!username.trim() || managers.length === 0) return null;
    
    const needle = username.trim().toLowerCase();
    
    // Try exact match first
    for (const m of managers) {
      const nameLower = m.name.toLowerCase();
      if (nameLower === needle) return m.key;
    }
    
    // Try partial match
    for (const m of managers) {
      const nameLower = m.name.toLowerCase();
      if (nameLower.includes(needle) || needle.includes(nameLower)) {
        return m.key;
      }
    }
    
    return null;
  }

  // Handler for toggling "Include playoffs" checkbox
  function handleIncludePlayoffsChange(newValue: boolean) {
    setIncludePlayoffs(newValue);
    
    // When toggling OFF playoffs and we have a default regular season end,
    // clamp endWeek if it's currently above the regular season
    if (!newValue && defaultRegularSeasonEnd !== null && endWeek > defaultRegularSeasonEnd) {
      setEndWeek(defaultRegularSeasonEnd);
    }
  }

  // Read URL params on mount
  useEffect(() => {
    if (hasInitializedFromUrl.current) return;
    hasInitializedFromUrl.current = true;

    const params = new URLSearchParams(window.location.search);
    const urlLeagueId = params.get("league_id");
    const urlStartWeek = params.get("start_week");
    const urlEndWeek = params.get("end_week");
    const urlViewer = params.get("view");

    // Priority 1: URL params (shareable links, Home navigation)
    if (urlLeagueId && urlLeagueId.trim()) {
      setLeagueId(urlLeagueId.trim());
      shouldAutoTrigger.current = true;
      if (urlStartWeek) {
        const week = Number(urlStartWeek);
        if (!isNaN(week) && week >= 1) {
          setStartWeek(week);
        }
      }
      if (urlEndWeek) {
        const week = Number(urlEndWeek);
        if (!isNaN(week) && week >= 1) {
          setEndWeek(week);
        }
      }
      // Set viewer if provided in URL
      if (urlViewer && urlViewer.trim()) {
        setViewerKey(urlViewer.trim());
      }
      return; // URL params take precedence, exit early
    }

    // Priority 2: Recent leagues (most recent entry)
    const recent = getRecentLeagues();
    if (recent.length > 0) {
      const mostRecent = recent[0];
      setLeagueId(mostRecent.leagueId);
      setStartWeek(mostRecent.startWeek);
      setEndWeek(mostRecent.endWeek);
      // Don't auto-trigger for recent leagues (user should click Analyze)
      return;
    }

    // Priority 3: Empty state (user must enter league)
    // leagueId already defaults to "" from useState
  }, []);

  // Post-checkout handling (success/canceled) + clean URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const canceled = params.get("canceled");
    if (!success && !canceled) return;

    const urlLeagueId = params.get("league_id")?.trim();

    if (success === "true") {
      if (urlLeagueId) {
        unlockLeague(urlLeagueId);
        setIsPremiumState(isLeagueUnlocked(urlLeagueId));
        trackFunnel.purchaseSuccess(urlLeagueId);
      }
      toast({
        title: "🔥 League unlocked. Drop the receipts.",
      });
    } else if (canceled === "true") {
      if (urlLeagueId) {
        trackFunnel.purchaseCancel(urlLeagueId);
      }
      toast({
        title: "Payment canceled.",
      });
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("success");
    url.searchParams.delete("canceled");
    const nextSearch = url.searchParams.toString();
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`
    );
  }, [toast]);

  // Auto-trigger after URL params are loaded
  useEffect(() => {
    if (shouldAutoTrigger.current && leagueId.trim()) {
      shouldAutoTrigger.current = false;
      refetch();
    }
  }, [leagueId, startWeek, endWeek, refetch]);

  // Sync state changes to URL
  useEffect(() => {
    if (!hasInitializedFromUrl.current) return;

    const params = new URLSearchParams();
    if (leagueId.trim()) {
      params.set("league_id", leagueId.trim());
    }
    params.set("start_week", String(startWeek));
    params.set("end_week", String(endWeek));
    // Include viewer if selected
    if (viewerKey && viewerKey.trim()) {
      params.set("view", viewerKey.trim());
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, [leagueId, startWeek, endWeek, viewerKey]);

  // Track when league history loads
  const hasTrackedLoad = useRef(false);
  useEffect(() => {
    const justFetched = prevFetching.current && !isFetching && hasData;
    prevFetching.current = isFetching;
    // Always collapse form after successful data fetch to focus on content
    if (justFetched) {
      setIsSelectorCollapsed(true);
      
      // Track league history loaded (once per session per league)
      if (!hasTrackedLoad.current && leagueId) {
        hasTrackedLoad.current = true;
        trackFunnel.leagueHistoryLoaded(leagueId);
      }
      
      // Auto-scroll to "View as" picker after a short delay to let UI render
      // Check data?.grid?.length inside effect (managers is defined later via useMemo)
      if (!hasScrolledToPicker.current && viewAsPickerRef.current) {
        // Use data?.grid?.length as proxy for managers.length since managers depends on it
        const hasManagers = data?.grid?.length > 0;
        if (hasManagers) {
          setTimeout(() => {
            viewAsPickerRef.current?.scrollIntoView({ 
              behavior: "smooth", 
              block: "center" 
            });
            hasScrolledToPicker.current = true;
          }, 500);
        }
      }
    }
  }, [isFetching, hasData, data?.grid?.length, leagueId]);

  // Save to recent leagues after successful fetch
  useEffect(() => {
    if (hasData && data?.league && leagueId.trim()) {
      saveRecentLeague(
        leagueId.trim(),
        data.league.name ?? undefined,
        data.league.season ? String(data.league.season) : undefined,
        startWeek,
        endWeek
      );
    }
  }, [hasData, data?.league, leagueId, startWeek, endWeek]);

  const filenameBase = useMemo(() => {
    const leagueName = data?.league?.name
      ? data.league.name.replace(/[^\w\s-]/g, "").trim()
      : "league";
    const season = data?.league?.season
      ? String(data.league.season).replace(/[^\w-]/g, "")
      : "history";
    return `fantasy-roast-${leagueName}-${season}`.replace(/\s+/g, "-").toLowerCase();
  }, [data?.league]);

  const filename = useMemo(
    () => `${filenameBase}-dominance.png`,
    [filenameBase]
  );
  const filenameStorylines = useMemo(
    () => `${filenameBase}-storylines.png`,
    [filenameBase]
  );
  const filenameYourRoast = useMemo(
    () => `${filenameBase}-your-roast.png`,
    [filenameBase]
  );

  const avatarByKey = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const t of data?.totalsByManager ?? []) {
      m[t.key] = t.avatarUrl ?? null;
    }
    return m;
  }, [data?.totalsByManager]);

  const emojiByKey = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const t of data?.totalsByManager ?? []) {
      m[t.key] = (t as any).emoji ?? null;
    }
    return m;
  }, [data?.totalsByManager]);

  const managers = useMemo(() => {
    if (!data?.grid?.length) return [];
    const sorted = [...data.grid].sort((a, b) => {
      const aNet = a.totalWins - a.totalLosses;
      const bNet = b.totalWins - b.totalLosses;
      if (bNet !== aNet) return bNet - aNet;
      if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
    return sorted.map((r) => ({ key: r.key, name: r.name }));
  }, [data]);

  const rowTotals = useMemo(() => {
    const m = new Map<string, { w: number; l: number; t: number; games: number; score: number }>();
    for (const r of data?.grid ?? []) {
      const games = r.totalWins + r.totalLosses + r.totalTies;
      const score = games ? (r.totalWins - r.totalLosses) / games : 0;
      m.set(r.key, {
        w: r.totalWins,
        l: r.totalLosses,
        t: r.totalTies,
        games,
        score,
      });
    }
    return m;
  }, [data]);

  const colTotals = useMemo(() => {
    const m = new Map<string, { w: number; l: number; t: number; games: number; score: number }>();
    for (const row of data?.grid ?? []) {
      for (const o of row.opponents ?? []) {
        const id = o.opponent_key;
        const cur = m.get(id) || { w: 0, l: 0, t: 0, games: 0, score: 0 };
        cur.w += o.record?.wins ?? 0;
        cur.l += o.record?.losses ?? 0;
        cur.t += o.record?.ties ?? 0;
        m.set(id, cur);
      }
    }
    Array.from(m.values()).forEach((v) => {
      v.games = v.w + v.l + v.t;
      v.score = v.games ? (v.w - v.l) / v.games : 0;
    });
    return m;
  }, [data]);

  const grandTotals = useMemo(() => {
    let w = 0,
      l = 0,
      t = 0;
    for (const r of data?.grid ?? []) {
      w += r.totalWins;
      l += r.totalLosses;
      t += r.totalTies;
    }
    const games = w + l + t;
    const score = games ? (w - l) / games : 0;
    return { w, l, t, games, score };
  }, [data]);

  const cellMap = useMemo(() => {
    const m = new Map<string, DominanceCellDTO>();
    if (data?.cells?.length) {
      for (const c of data.cells) m.set(`${c.a}-${c.b}`, c);
      return m;
    }
    for (const row of data?.grid ?? []) {
      for (const o of row.opponents ?? []) {
        const w = o.record?.wins ?? 0;
        const l = o.record?.losses ?? 0;
        const t = o.record?.ties ?? 0;
        const games =
          typeof o.record?.games === "number" ? o.record.games : w + l + t;
        const score =
          typeof o.record?.score === "number"
            ? o.record.score
            : games
              ? (w - l) / games
              : 0;
        const badge = (o.record?.badge ?? "EDGE") as Badge;
        m.set(`${row.key}-${o.opponent_key}`, {
          a: row.key,
          b: o.opponent_key,
          aName: row.name,
          bName: o.opponent_name,
          games,
          score,
          badge,
          record: fmtRecord(w, l, t),
          pf: o.record?.pointsFor ?? 0,
          pa: o.record?.pointsAgainst ?? 0,
        });
      }
    }
    return m;
  }, [data]);

  const allCells = useMemo(() => {
    if (data?.cells?.length) return data.cells;
    return Array.from(cellMap.values());
  }, [data?.cells, cellMap]);

  const landlord = useMemo<LandlordSummary | null>(() => {
    const groups = new Map<string, { landlordName: string; victims: VictimRow[] }>();
    for (const c of allCells) {
      if (!c || c.badge !== "OWNED" || !isCountable(c) || !c.a || !c.b) continue;
      const g = groups.get(c.a) ?? { landlordName: c.aName || c.a, victims: [] };
      g.victims.push({
        cellKey: `${c.a}-${c.b}`,
        victimKey: c.b,
        victimName: c.bName || c.b,
        record: c.record,
        games: c.games,
        score: c.score,
      });
      groups.set(c.a, g);
    }
    if (!groups.size) return null;
    const avg = (arr: VictimRow[], f: (x: VictimRow) => number) =>
      arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : 0;
    let bestKey: string | null = null;
    let best: { landlordName: string; victims: VictimRow[] } | null = null;
    const entries = Array.from(groups.entries());
    for (let i = 0; i < entries.length; i++) {
      const [k, v] = entries[i];
      if (!best) {
        bestKey = k;
        best = v;
        continue;
      }
      if (v.victims.length > best.victims.length) {
        bestKey = k;
        best = v;
        continue;
      }
      if (v.victims.length < best.victims.length) continue;
      const aAvg = avg(v.victims, (x) => x.score);
      const bAvg = avg(best.victims, (x) => x.score);
      if (aAvg > bAvg) {
        bestKey = k;
        best = v;
        continue;
      }
      if (aAvg < bAvg) continue;
      const aAvgG = avg(v.victims, (x) => x.games);
      const bAvgG = avg(best.victims, (x) => x.games);
      if (aAvgG > bAvgG) {
        bestKey = k;
        best = v;
      }
    }
    if (!bestKey || !best) return null;
    const sorted = [...best.victims].sort((x, y) => {
      if (y.games !== x.games) return y.games - x.games;
      if (y.score !== x.score) return y.score - x.score;
      return x.victimName.localeCompare(y.victimName);
    });
    return {
      landlordKey: bestKey,
      landlordName: best.landlordName,
      victimCount: sorted.length,
      victims: sorted,
      totalOwnedGames: sorted.reduce((s, x) => s + x.games, 0),
      bestVictim: sorted[0] ?? null,
    };
  }, [allCells]);

  const mostOwned = useMemo(() => {
    if (!allCells.length) return null;
    const victimMap = new Map<
      string,
      {
        victimKey: string;
        victimName: string;
        ownedBy: Array<{
          landlordKey: string;
          landlordName: string;
          cellKey: string;
          record: string;
          games: number;
          score: number;
        }>;
      }
    >();
    for (const c of allCells) {
      if (!c || c.badge !== "OWNED" || !isCountable(c) || !c.a || !c.b) continue;
      const cur = victimMap.get(c.b) ?? {
        victimKey: c.b,
        victimName: c.bName || c.b,
        ownedBy: [],
      };
      cur.ownedBy.push({
        landlordKey: c.a,
        landlordName: c.aName || c.a,
        cellKey: `${c.a}-${c.b}`,
        record: c.record,
        games: c.games,
        score: c.score,
      });
      victimMap.set(c.b, cur);
    }
    if (!victimMap.size) return null;
    type OwnedByItem = {
      landlordKey: string;
      landlordName: string;
      cellKey: string;
      record: string;
      games: number;
      score: number;
    };
    type VictimEntry = {
      victimKey: string;
      victimName: string;
      ownedBy: OwnedByItem[];
    };
    const sum = (arr: OwnedByItem[], f: (x: OwnedByItem) => number) =>
      arr.reduce((s: number, x: OwnedByItem) => s + f(x), 0);
    let best: VictimEntry | null = null;
    const vals = Array.from(victimMap.values());
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (!best) {
        best = v;
        continue;
      }
      if (v.ownedBy.length > best.ownedBy.length) {
        best = v;
        continue;
      }
      if (v.ownedBy.length < best.ownedBy.length) continue;
      const aG = sum(v.ownedBy, (x) => x.games);
      const bG = sum(best.ownedBy, (x) => x.games);
      if (aG > bG) {
        best = v;
        continue;
      }
      if (aG < bG) continue;
      const aS = aG ? sum(v.ownedBy, (x) => x.score * x.games) / aG : 0;
      const bS = bG ? sum(best.ownedBy, (x) => x.score * x.games) / bG : 0;
      if (aS > bS) best = v;
    }
    if (!best) return null;
    const worst = [...best.ownedBy].sort(
      (x, y) => (y.score !== x.score ? y.score - x.score : y.games - x.games)
    )[0];
    return {
      victimName: best.victimName,
      victimKey: best.victimKey,
      timesOwned: best.ownedBy.length,
      totalGames: best.ownedBy.reduce((s: number, x: OwnedByItem) => s + x.games, 0),
      worstNemesisName: worst?.landlordName ?? "—",
      worstNemesisRecord: worst?.record ?? "—",
      worstNemesisCellKey: worst?.cellKey ?? null,
      cellKey: worst?.cellKey ?? null,
      ownedBy: best.ownedBy,
    };
  }, [allCells]);

  const biggestRivalry = useMemo(() => {
    if (!allCells.length) return null;
    const eligible = allCells
      .filter((c) => c && isCountable(c) && c.a && c.b)
      .map((c) => ({ ...c, absScore: Math.abs(c.score ?? 0) }));
    if (!eligible.length) return null;
    eligible.sort((x, y) => {
      if (x.absScore !== y.absScore) return x.absScore - y.absScore;
      if ((y.games ?? 0) !== (x.games ?? 0)) return (y.games ?? 0) - (x.games ?? 0);
      const rank = (b: Badge) => (b === "RIVAL" ? 2 : b === "EDGE" ? 1 : 0);
      return rank(y.badge) - rank(x.badge);
    });
    const top = eligible[0];
    return {
      aKey: top.a,
      bKey: top.b,
      aName: top.aName,
      bName: top.bName,
      record: top.record,
      games: top.games,
      score: top.score,
      badge: top.badge,
      cellKey: `${top.a}-${top.b}`,
    };
  }, [allCells]);

  const totalsByManager = useMemo(() => {
    return data?.totalsByManager ?? null;
  }, [data?.totalsByManager]);

  const leagueStorylines = useMemo(
    () =>
      computeLeagueStorylines(
        allCells,
        managers,
        rowTotals,
        totalsByManager,
        grandTotals.games,
        data?.weeklyMatchups ?? []
      ),
    [allCells, managers, rowTotals, totalsByManager, grandTotals.games, data?.weeklyMatchups]
  );

  const yourRoastCards = useMemo(
    () =>
      viewerKey
        ? computeYourRoast(viewerKey, allCells, managers, data?.weeklyMatchups ?? [])
        : [],
    [viewerKey, allCells, managers, data?.weeklyMatchups]
  );

  // Compute hero receipts from seasonStats and weeklyMatchups
  const heroReceipts = useMemo(
    () =>
      data?.seasonStats && data?.weeklyMatchups
        ? computeHeroReceipts(data.seasonStats, data.weeklyMatchups, managers, avatarByKey, leagueId, emojiByKey)
        : [],
    [data?.seasonStats, data?.weeklyMatchups, managers, avatarByKey, leagueId, emojiByKey]
  );

  // Compute additional mini cards from seasonStats and weeklyMatchups
  const additionalMiniCards = useMemo(
    () =>
      data?.seasonStats && data?.weeklyMatchups
        ? computeAdditionalMiniCards(data.weeklyMatchups, data.seasonStats, managers)
        : [],
    [data?.seasonStats, data?.weeklyMatchups, managers]
  );

  const lockedReceiptsCount = useMemo(() => {
    return Math.max(heroReceipts.length - 1, 0);
  }, [heroReceipts.length]);

  const lockedStorylinesCount = useMemo(() => {
    const totalStorylines = leagueStorylines.length + additionalMiniCards.length;
    return Math.max(totalStorylines - 1, 0);
  }, [leagueStorylines.length, additionalMiniCards.length]);

  const lockedYourRoastCount = useMemo(() => {
    if (!viewerKey) return 0;
    return Math.max(yourRoastCards.length - 1, 0);
  }, [viewerKey, yourRoastCards.length]);

  const lockedTotalCount = useMemo(() => {
    return lockedReceiptsCount + lockedStorylinesCount + lockedYourRoastCount;
  }, [lockedReceiptsCount, lockedStorylinesCount, lockedYourRoastCount]);

  // Compute ownedCount for contextual copy
  const ownedCount = useMemo(() => {
    if (!viewerKey || !allCells.length) return 0;
    return allCells.filter(
      c => c.badge === "OWNED" && c.a === viewerKey && isCountable(c)
    ).length;
  }, [viewerKey, allCells]);

  // Compute rivalryExists for contextual copy
  const rivalryExists = useMemo(() => {
    return biggestRivalry?.badge === "RIVAL";
  }, [biggestRivalry]);

  useEffect(() => {
    setViewerKey("");
  }, [leagueId]);

  useEffect(() => {
    if (
      !hasData ||
      !managers.length ||
      !leagueId.trim() ||
      !data?.league ||
      data.league.league_id !== leagueId.trim()
    )
      return;
    
    // Check if viewer was set from URL params (highest priority)
    const params = new URLSearchParams(window.location.search);
    const urlViewer = params.get("view");
    const keys = new Set(managers.map((m) => m.key));
    
    // Priority: URL param > persisted > username match > empty
    if (urlViewer && urlViewer.trim() && keys.has(urlViewer.trim())) {
      setViewerKey(urlViewer.trim());
      setViewerByLeague(leagueId.trim(), urlViewer.trim());
      return;
    }
    
    const saved = getViewerByLeague(leagueId.trim());
    
    if (saved && keys.has(saved)) {
      setViewerKey(saved);
    } else if (saved) {
      setViewerByLeague(leagueId.trim(), "");
      // After clearing invalid persisted, try username match
      if (username.trim()) {
        const matchedKey = findManagerKeyByUsername(username, managers);
        if (matchedKey) {
          setViewerKey(matchedKey);
          setViewerByLeague(leagueId.trim(), matchedKey);
        }
      }
    } else {
      // No persisted selection, try username match
      if (username.trim()) {
        const matchedKey = findManagerKeyByUsername(username, managers);
        if (matchedKey) {
          setViewerKey(matchedKey);
          setViewerByLeague(leagueId.trim(), matchedKey);
        }
      }
    }
  }, [hasData, managers, leagueId, data?.league, username]);

  function openCell(cellKey: string | null) {
    if (!cellKey) return;
    const c = cellMap.get(cellKey);
    if (c) setSelected(c);
  }

  function onHighlightManager(managerKey: string) {
    setHighlightedManagerKey(managerKey);
    setTimeout(() => {
      setHighlightedManagerKey(null);
    }, 3000);
  }

  async function waitForPaint() {
    if (typeof document !== "undefined" && (document as any).fonts?.ready) {
      await (document as any).fonts.ready;
    }
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r()))
    );
  }

  async function exportElementToPng(el: HTMLDivElement | null): Promise<string> {
    if (!el) throw new Error("Export element not ready");
    const originalStyle = el.style.cssText;
    el.style.cssText = `
      position: fixed; left: 0; top: 0; z-index: 9999;
      pointer-events: none; visibility: visible; opacity: 1;
      clip-path: none; transform: none;
    `;
    await waitForPaint();
    let width = el.scrollWidth || el.offsetWidth;
    let height = el.scrollHeight || el.offsetHeight;
    if (!width || !height) {
      const rect = el.getBoundingClientRect();
      width = Math.ceil(rect.width) || width;
      height = Math.ceil(rect.height) || height;
    }
    if (!width || !height) {
      await waitForPaint();
      width = el.scrollWidth || el.offsetWidth || 100;
      height = el.scrollHeight || el.offsetHeight || 100;
    }
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    await waitForPaint();
    try {
      return await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
        width,
        height,
      });
    } finally {
      el.style.cssText = originalStyle;
    }
  }

  async function exportPngDataUrl() {
    return exportElementToPng(gridExportRef.current);
  }

  async function downloadPng() {
    if (!managers.length) return;
    setIsDownloading(true);
    try {
      const dataUrl = await exportPngDataUrl();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
      toast({
        title: "Roast saved",
        description: "Roast saved. Share it.",
      });
    } finally {
      setIsDownloading(false);
    }
  }

  async function sharePng() {
    if (!managers.length) return;
    setIsSharing(true);
    try {
      const dataUrl = await exportPngDataUrl();
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });
      const shareText = "Fantasy Roast — Roasts";
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Roasts",
          text: shareText,
          files: [file],
        });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      window.open(dataUrl, "_blank");
    } finally {
      setIsSharing(false);
    }
  }

  async function saveStorylinesPng() {
    if (!storylinesExportRef.current) return;
    setIsExportingStorylines(true);
    try {
      const dataUrl = await exportElementToPng(storylinesExportRef.current);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filenameStorylines;
      a.click();
      toast({
        title: "Storylines saved",
        description: "Share it.",
      });
    } finally {
      setIsExportingStorylines(false);
    }
  }

  async function saveYourRoastPng() {
    if (!yourRoastExportRef.current) return;
    setIsExportingYourRoast(true);
    try {
      const dataUrl = await exportElementToPng(yourRoastExportRef.current);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filenameYourRoast;
      a.click();
      toast({
        title: "Your Roast saved",
        description: "Share it.",
      });
    } finally {
      setIsExportingYourRoast(false);
    }
  }

  function handleTryExampleLeague() {
    const exampleLeagueId = "demo-group-chat-dynasty";
    setLeagueId(exampleLeagueId);
    setStartWeek(1);
    setEndWeek(17);
    shouldAutoTrigger.current = true;
    // Ensure URL sync happens
    hasInitializedFromUrl.current = true;
    // Trigger will happen via useEffect, but we can also trigger immediately
    setTimeout(() => {
      refetch();
    }, 100);
  }

  const hasEnoughData = useMemo(() => {
    if (!data?.grid?.length) return false;
    const totalGames = allCells.reduce((sum, c) => sum + (c?.games ?? 0), 0);
    return totalGames > 0;
  }, [data, allCells]);

  // Show post-analysis toast when analysis completes
  useEffect(() => {
    if (hasData && !prevHasData.current && !isFetching) {
      setShowPostAnalysisToast(true);
    }
    prevHasData.current = hasData;
  }, [hasData, isFetching]);

  // Compute stats for toast
  const matchupCount = allCells.length;
  const managerCount = managers.length;

  // Sync premium state on mount
  useEffect(() => {
    setIsPremiumState(isLeagueUnlocked(leagueId.trim()));
  }, [leagueId]);

  // Reset mode-specific data when league changes
  useEffect(() => {
    if (!leagueId) return;
    setActiveMode("history");
    setWeeklyWeek(endWeek || 17);
    setWeeklyRoastData(null);
    setWeeklyRoastError(null);
    setSeasonWrappedData(null);
    setSeasonWrappedError(null);
    setSeasonRosterId("");
    setAutopsyData(null);
    setAutopsyError(null);
  }, [leagueId, endWeek]);

  // Load roster list when "Your Season" is selected
  useEffect(() => {
    if (activeMode !== "season" || !leagueId.trim()) return;
    setSeasonTeamsLoading(true);
    fetch(`/api/league-teams?league_id=${leagueId.trim()}`)
      .then((res) => res.json())
      .then((data) => {
        setSeasonTeams(data?.teams || []);
      })
      .catch(() => {
        setSeasonTeams([]);
        toast({
          title: "Failed to load rosters",
          description: "Please try again.",
          variant: "destructive",
        });
      })
      .finally(() => {
        setSeasonTeamsLoading(false);
      });
  }, [activeMode, leagueId]);

  async function handleCheckout() {
    if (!leagueId.trim()) {
      toast({
        title: "Enter a league first",
        description: "Add your league ID or username to continue.",
      });
      return;
    }
    trackFunnel.unlockClicked(leagueId, "page");
    try {
      const url = await createCheckoutSession(leagueId.trim());
      window.location.href = url;
    } catch (err: any) {
      toast({
        title: "Checkout failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    }
  }

  function handleUpgrade() {
    setShowUnlockModal(true);
  }

  function handleLoadYourLeagueFromExample() {
    setIsSelectorCollapsed(false);
    setTimeout(() => {
      selectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  async function fetchWeeklyRoast() {
    if (!leagueId.trim()) return;
    setWeeklyRoastLoading(true);
    setWeeklyRoastError(null);
    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          league_id: leagueId.trim(),
          week: weeklyWeek,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch weekly roast.");
      setWeeklyRoastData(data);
    } catch (err: any) {
      setWeeklyRoastError(err.message || "Failed to fetch weekly roast.");
      setWeeklyRoastData(null);
    } finally {
      setWeeklyRoastLoading(false);
    }
  }

  async function fetchSeasonWrapped() {
    if (!leagueId.trim()) return;
    setSeasonWrappedLoading(true);
    setSeasonWrappedError(null);
    try {
      const res = await fetch("/api/wrapped", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          league_id: leagueId.trim(),
          week: endWeek || 17,
          roster_id: typeof seasonRosterId === "number" ? seasonRosterId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch Your Season.");
      setSeasonWrappedData(data);
    } catch (err: any) {
      setSeasonWrappedError(err.message || "Failed to fetch Your Season.");
      setSeasonWrappedData(null);
    } finally {
      setSeasonWrappedLoading(false);
    }
  }

  async function fetchLeagueAutopsy() {
    if (!leagueId.trim()) return;
    setAutopsyLoading(true);
    setAutopsyError(null);
    try {
      const res = await fetch("/api/league-autopsy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          league_id: leagueId.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch End-of-Season.");
      setAutopsyData(data);
    } catch (err: any) {
      setAutopsyError(err.message || "Failed to fetch End-of-Season.");
      setAutopsyData(null);
    } finally {
      setAutopsyLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-4">
      {/* Hero Section */}
      {!hasData && (
        <div className="rounded-lg border bg-gradient-to-br from-background to-muted/20 p-6 md:p-8 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Who Owns Your League?
              </h1>
              <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
                Turn your Sleeper league into shareable roasts. Find the moments. Tag your nemesis. Own the group chat.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Built for group chats and league banter.
              </p>
            </div>
            <Link href="/">
              <Button variant="ghost" size="sm" className="shrink-0">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleTryExampleLeague} size="lg" className="font-semibold">
              Try Example League
            </Button>
            <Collapsible open={showHowItWorks} onOpenChange={setShowHowItWorks}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="lg">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  How it works
                  {showHowItWorks ? (
                    <ChevronUp className="h-4 w-4 ml-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-2" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="rounded-lg border bg-background p-4 space-y-4 text-sm">
                  <div>
                    <h3 className="font-semibold mb-1">What is dominance?</h3>
                    <p className="text-muted-foreground">
                      How much you own another manager (or get owned). A positive score means you've won more head-to-head; negative means they've got the roasts on you.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">What do the badges mean?</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                      <li><strong className="text-foreground">OWNED</strong> — You own them.</li>
                      <li><strong className="text-foreground">NEMESIS</strong> — They own you.</li>
                      <li><strong className="text-foreground">RIVAL</strong> — This one's personal.</li>
                      <li><strong className="text-foreground">EDGE</strong> — Slight edge.</li>
                      <li><strong className="text-foreground">TOO CLOSE TO CALL</strong> — Too close to roast.</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">What does the score represent?</h3>
                    <p className="text-muted-foreground">
                      Ownership score from -1 to +1. Plus means you're winning the matchup; minus means they are. +0.50 is roughly "you've won 75% of your games against them."
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          
          {/* Preview Placeholders */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center">
              <h3 className="text-sm font-semibold mb-1">The Scoreboard</h3>
              <p className="text-xs text-muted-foreground">
                See every matchup, find your nemesis
              </p>
            </div>
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center">
              <h3 className="text-sm font-semibold mb-1">The Headlines</h3>
              <p className="text-xs text-muted-foreground">
                Who owns the league (Premium)
              </p>
            </div>
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center">
              <h3 className="text-sm font-semibold mb-1">Your Roast</h3>
          <p className="text-xs text-muted-foreground">
            Your personal roasts
          </p>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2">
            Powered by Sleeper API • Built for sharing
          </p>
        </div>
      )}

      {/* Standard Header (when data exists) */}
      {hasData && (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">
                League History
              </h1>
              <Link href="/">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  Home
                </Button>
              </Link>
            </div>
            {data?.league ? (
              <p className="text-sm text-muted-foreground">
                {data.league.name} • Season {data.league.season}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Analyze head-to-head dominance for any Sleeper league.
              </p>
            )}
          </div>
          {process.env.NODE_ENV === "development" && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (isPremiumState) {
                    lockLeague(leagueId.trim());
                  } else {
                    unlockLeague(leagueId.trim());
                  }
                  setIsPremiumState(!isPremiumState);
                }}
              >
                {isPremiumState ? "Premium: ON" : "Premium: OFF"}
              </Button>
            </div>
          )}
        </div>
      )}

      {hasData && (
        <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/20 p-1">
          {[
            { id: "history", label: "History" },
            ...(WEEKLY_ENABLED ? [{ id: "weekly", label: "Weekly" }] : []),
            { id: "season", label: "Your Season" },
            { id: "end", label: "Recap" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveMode(tab.id as Mode)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeMode === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {hasData && (
        <p className="text-sm text-muted-foreground">
          {activeMode === "history" && "Every argument your league has ever had — with receipts."}
          {WEEKLY_ENABLED && activeMode === "weekly" && "Pick a week. Get the chaos from that matchup slate."}
          {activeMode === "season" && "Your season. Your wins. Your choke jobs. No hiding."}
          {activeMode === "end" && "The final verdict on this season. Someone's getting exposed."}
        </p>
      )}

      {activeMode === "history" && !showPremiumContent && hasData && (
        <p className="text-xs text-muted-foreground">
          Unlock once for this league to share everything.
        </p>
      )}

      {leagueId === EXAMPLE_LEAGUE_ID && (
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3 text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <span className="text-foreground">
            📺 <strong>This is demo data.</strong> Who really owns YOUR league? Find out →
          </span>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              className="interact-cta font-semibold"
              onClick={handleLoadYourLeagueFromExample}
            >
              Get My League's Roasts
            </Button>
          </div>
        </div>
      )}

      <div ref={selectorRef}>
        <LeagueSelector
          leagueId={leagueId}
          startWeek={startWeek}
          endWeek={endWeek}
          includePlayoffs={includePlayoffs}
          onLeagueIdChange={setLeagueId}
          onStartWeekChange={setStartWeek}
          onEndWeekChange={setEndWeek}
          onIncludePlayoffsChange={handleIncludePlayoffsChange}
          onAnalyze={() => refetch()}
          isFetching={isFetching}
          error={error as Error | null}
          isCollapsed={isSelectorCollapsed}
          onCollapsedChange={setIsSelectorCollapsed}
          leagueName={data?.league?.name}
          season={data?.league?.season}
        />
      </div>

      {WEEKLY_ENABLED && hasData && activeMode === "weekly" && !showPremiumContent && (
        <section className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-foreground">Week</label>
              <input
                type="number"
                min={1}
                max={18}
                value={weeklyWeek}
                onChange={(e) => setWeeklyWeek(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                disabled
              />
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium">Locked.</span> Unlock to generate weekly roasts.
              </p>
            </div>
            <Button disabled>Generate Weekly Roast</Button>
          </div>
        </section>
      )}

      {WEEKLY_ENABLED && hasData && activeMode === "weekly" && !showPremiumContent && (
        <LockedModePreview
          title="Weekly Roast"
          description="Pick any week and generate the chaos from that slate."
          previewItems={[
            "Top dog and fraud of the week",
            "Matchup chaos and blowouts",
            "Shareable roast cards for the group chat",
          ]}
          onUnlock={handleCheckout}
          lockedTotalCount={lockedTotalCount}
        />
      )}

      {WEEKLY_ENABLED && hasData && activeMode === "weekly" && showPremiumContent && (
        <section className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-foreground">Week</label>
              <input
                type="number"
                min={1}
                max={18}
                value={weeklyWeek}
                onChange={(e) => setWeeklyWeek(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </div>
            <Button onClick={fetchWeeklyRoast} disabled={weeklyRoastLoading}>
              {weeklyRoastLoading ? "Generating…" : "Generate Weekly Roast"}
            </Button>
          </div>
          {weeklyRoastError && (
            <p className="text-xs text-red-600">{weeklyRoastError}</p>
          )}
        </section>
      )}

      {WEEKLY_ENABLED && hasData && activeMode === "weekly" && showPremiumContent && weeklyRoastData && (
        <RoastCard data={weeklyRoastData} isPremium={showPremiumContent} />
      )}

      {WEEKLY_ENABLED && hasData && activeMode === "weekly" && showPremiumContent && !weeklyRoastData && !weeklyRoastLoading && (
        <div className="rounded-lg border border-dashed bg-muted/10 p-6 text-center">
          <p className="text-sm text-muted-foreground">Choose a week to generate the roast.</p>
          <p className="text-xs text-muted-foreground mt-1">History is always available.</p>
        </div>
      )}

      {hasData && activeMode === "season" && !showPremiumContent && (
        <section className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <label className="block text-sm font-semibold text-foreground">Pick your team</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <select
                value={seasonRosterId}
                onChange={(e) =>
                  setSeasonRosterId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full rounded-lg border px-3 py-2"
                disabled
              >
                <option value="">Choose your roster...</option>
                {seasonTeams.map((t) => (
                  <option key={t.roster_id} value={t.roster_id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <Button disabled className="sm:w-auto">Generate Your Season</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Locked.</span> Unlock to generate Your Season.
          </p>
        </section>
      )}

      {hasData && activeMode === "season" && !showPremiumContent && (
        <LockedModePreview
          title="Your Season"
          description="Pick a manager and reveal their season wrapped."
          previewItems={[
            "Personal highlights and lowlights",
            "Your season story in shareable cards",
            "A roast-worthy recap for the group chat",
          ]}
          onUnlock={handleCheckout}
          lockedTotalCount={lockedTotalCount}
        />
      )}

      {hasData && activeMode === "season" && showPremiumContent && (
        <section className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <label className="block text-sm font-semibold text-foreground">Pick your team</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <select
                value={seasonRosterId}
                onChange={(e) =>
                  setSeasonRosterId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full rounded-lg border px-3 py-2"
                disabled={seasonTeamsLoading}
              >
                <option value="">Choose your roster...</option>
                {seasonTeams.map((t) => (
                  <option key={t.roster_id} value={t.roster_id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={fetchSeasonWrapped} disabled={seasonWrappedLoading} className="sm:w-auto">
              {seasonWrappedLoading ? "Generating…" : "Generate Your Season"}
            </Button>
          </div>
          {seasonTeamsLoading && (
            <p className="text-xs text-muted-foreground">Loading rosters…</p>
          )}
          {seasonWrappedError && (
            <p className="text-xs text-red-600">{seasonWrappedError}</p>
          )}
        </section>
      )}

      {hasData && activeMode === "season" && showPremiumContent && seasonWrappedData && (
        <SeasonWrappedCard data={seasonWrappedData} isPremium={showPremiumContent} />
      )}

      {hasData && activeMode === "season" && showPremiumContent && !seasonWrappedData && !seasonWrappedLoading && (
        <div className="rounded-lg border border-dashed bg-muted/10 p-6 text-center">
          <p className="text-sm text-muted-foreground">Choose a manager to generate Your Season.</p>
          <p className="text-xs text-muted-foreground mt-1">History is always available.</p>
        </div>
      )}

      {hasData && activeMode === "end" && !showPremiumContent && (
        <section className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">End-of-Season</h2>
              <p className="text-sm text-muted-foreground">League-wide moments and chaos.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium">Locked.</span> Unlock to generate the recap.
              </p>
            </div>
            <Button disabled>Generate End-of-Season</Button>
          </div>
        </section>
      )}

      {hasData && activeMode === "end" && !showPremiumContent && (
        <LockedModePreview
          title="Recap"
          description="End-of-season moments that your league won't forget."
          previewItems={[
            "Biggest blowouts and upsets",
            "Season highs and lows",
            "Shareable recap cards for the league",
          ]}
          onUnlock={handleCheckout}
          lockedTotalCount={lockedTotalCount}
        />
      )}

      {hasData && activeMode === "end" && showPremiumContent && (
        <section className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">End-of-Season</h2>
              <p className="text-sm text-muted-foreground">League-wide moments and chaos.</p>
            </div>
            <Button onClick={fetchLeagueAutopsy} disabled={autopsyLoading}>
              {autopsyLoading ? "Generating…" : "Generate End-of-Season"}
            </Button>
          </div>
          {autopsyError && (
            <p className="text-xs text-red-600">{autopsyError}</p>
          )}
        </section>
      )}

      {hasData && activeMode === "end" && showPremiumContent && autopsyData && (
        <LeagueAutopsyCard data={autopsyData} isPremium={showPremiumContent} />
      )}

      {hasData && activeMode === "end" && showPremiumContent && !autopsyData && !autopsyLoading && (
        <div className="rounded-lg border border-dashed bg-muted/10 p-6 text-center">
          <p className="text-sm text-muted-foreground">Click Generate to see the league recap.</p>
          <p className="text-xs text-muted-foreground mt-1">History is always available.</p>
        </div>
      )}

      {activeMode === "history" && hasData && hasEnoughData && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Your league's biggest moments
          </h2>
          <InsightsDashboard
            landlord={landlord}
            mostOwned={mostOwned}
            biggestRivalry={biggestRivalry}
            avatarByKey={avatarByKey}
            emojiByKey={emojiByKey}
            onOpenCell={openCell}
            isPremium={showPremiumContent}
            onUnlock={handleCheckout}
            lockedTotalCount={lockedTotalCount}
          />
          {hasData && hasEnoughData && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Found your nemesis? Send this roast.
            </p>
          )}
        </section>
      )}

      {/* View as picker - moved here for better visibility */}
      {activeMode === "history" && hasData && hasEnoughData && managers.length > 0 && (
        <section ref={viewAsPickerRef} className="flex items-center justify-center gap-3 py-2">
          <span className="text-sm font-medium text-foreground">View as:</span>
          <Select
            value={viewerKey || "__none__"}
            onValueChange={(v) => {
              if (v === "__none__") {
                setViewerKey("");
                if (leagueId.trim()) setViewerByLeague(leagueId.trim(), "");
              } else {
                setViewerKey(v);
                if (leagueId.trim()) setViewerByLeague(leagueId.trim(), v);
              }
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Pick your manager" />
            </SelectTrigger>
            <SelectContent className="!bg-background">
              <SelectItem value="__none__">
                Pick your manager
              </SelectItem>
              {managers.map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            See your personal roasts
          </p>
        </section>
      )}

      {activeMode === "history" && hasData && hasEnoughData && heroReceipts.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          You’ve seen who owns the league. Now here’s how it broke.
        </p>
      )}

      {import.meta.env.DEV && hasData && (
        <p className="text-xs text-muted-foreground mb-2">
          seasonStats: {data?.seasonStats?.length ?? 0}, weeklyMatchups: {data?.weeklyMatchups?.length ?? 0}, heroReceipts: {heroReceipts.length}
        </p>
      )}

      {activeMode === "history" && hasData && hasEnoughData && heroReceipts.length > 0 && (
        <section className="mt-8">
          <HeroReceipts
            heroReceipts={heroReceipts}
            isPremium={showPremiumContent}
            onUnlock={handleCheckout}
            lockedTotalCount={lockedTotalCount}
          />
        </section>
      )}

      {activeMode === "history" && hasData && !hasEnoughData && (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">
            Not enough roasts yet.
          </p>
          <p className="text-xs text-muted-foreground">
            Add more weeks to see who owns who.
          </p>
        </div>
      )}

      {activeMode === "history" && (
        <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">
          Every matchup, every roast
        </h2>
        <DominanceGrid
          managers={managers}
          rowTotals={rowTotals}
          colTotals={colTotals}
          grandTotals={grandTotals}
          cellMap={cellMap}
          allCells={allCells}
          activeBadge={activeBadge}
          onActiveBadgeChange={setActiveBadge}
          onSelectCell={setSelected}
          onDownloadPng={downloadPng}
          onSharePng={sharePng}
          isDownloading={isDownloading}
          isSharing={isSharing}
          isFetching={isFetching}
          gridVisibleRef={gridVisibleRef}
          highlightedManagerKey={highlightedManagerKey}
          isPremium={showPremiumContent}
          onUnlock={handleCheckout}
        />
        
        {/* Trust Signals */}
        {hasData && (
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>Powered by Sleeper API</span>
            {lastAnalyzedAt && (
              <span>
                Last updated: {lastAnalyzedAt.toLocaleString()}
              </span>
            )}
          </div>
        )}
      </section>
      )}

      {activeMode === "history" &&
        hasData &&
        hasEnoughData &&
        (leagueStorylines.length > 0 || !!viewerKey) && (
          <section>
            <div className="flex flex-wrap gap-2 mb-3">
              {leagueStorylines.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (showPremiumContent) {
                            saveStorylinesPng();
                          } else {
                            handleUpgrade();
                          }
                        }}
                        disabled={isExportingStorylines}
                      >
                        {isExportingStorylines ? "Saving…" : "Save Storylines"}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!showPremiumContent && (
                    <TooltipContent>
                      <p>Unlock to export League Storylines</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              )}
              {!!viewerKey && yourRoastCards.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveYourRoastPng}
                  disabled={isExportingYourRoast}
                >
                  {isExportingYourRoast ? "Saving…" : "Save Your Roast"}
                </Button>
              )}
            </div>
            <StorylinesMiniCards
              leagueCards={[...leagueStorylines, ...additionalMiniCards]}
              yourRoastCards={yourRoastCards}
              viewerChosen={!!viewerKey}
              onOpenCell={(key) => openCell(key)}
              onOpenMiniCard={(card) => setSelectedMiniCard(card)}
              onHighlightManager={onHighlightManager}
              storylinesExportRef={storylinesExportRef}
              yourRoastExportRef={yourRoastExportRef}
              exportTimestamp={
                lastAnalyzedAt?.toLocaleString() ??
                new Date().toLocaleString()
              }
              isPremium={showPremiumContent}
              onUnlock={handleCheckout}
              lockedTotalCount={lockedTotalCount}
            />
          </section>
        )}

      {/* Conversion Banner - appears after Storylines */}
      {activeMode === "history" && hasData && hasEnoughData && (
        <section>
          <ConversionBanner 
            onUpgrade={handleCheckout}
            onScrollToTop={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            ownedCount={ownedCount}
            rivalryExists={rivalryExists}
            leagueName={data?.league?.name}
            leagueId={leagueId}
            lockedReceiptsCount={lockedReceiptsCount}
            lockedStorylinesCount={lockedStorylinesCount}
            lockedTotalCount={lockedTotalCount}
            isDemo={isDemo}
          />
        </section>
      )}

      {/* Post-Analysis Toast */}
      {activeMode === "history" && showPostAnalysisToast && hasData && (
        <PostAnalysisToast
          matchupCount={matchupCount}
          managerCount={managerCount}
          minWeek={startWeek}
          maxWeek={endWeek}
          onDismiss={() => setShowPostAnalysisToast(false)}
          isPremium={showPremiumContent}
        />
      )}

      {/* Sticky Upgrade Bar */}
      {activeMode === "history" && hasData && hasEnoughData && (
        <StickyUpgradeBar
          onUpgrade={handleCheckout}
          onScrollToTop={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          leagueName={data?.league?.name}
          lockedReceiptsCount={lockedReceiptsCount}
          lockedStorylinesCount={lockedStorylinesCount}
          lockedTotalCount={lockedTotalCount}
          isDemo={isDemo}
        />
      )}

      {/* Unlock Modal (hidden in demo mode) */}
      {activeMode === "history" && !isDemo && (
        <UnlockReceiptsModal
          open={showUnlockModal}
          onOpenChange={setShowUnlockModal}
          onUnlock={handleCheckout}
          ownedCount={ownedCount}
          rivalryExists={rivalryExists}
          leagueName={data?.league?.name}
          lockedReceiptsCount={lockedReceiptsCount}
          lockedStorylinesCount={lockedStorylinesCount}
          lockedTotalCount={lockedTotalCount}
          leagueId={leagueId}
          onCompUnlock={() => {
            unlockLeague(leagueId);
            setIsPremiumState(true);
          }}
        />
      )}

      {activeMode === "history" && hasData && (
        <div
          ref={gridExportRef}
          className="fixed pointer-events-none"
          style={{
            left: 0,
            top: 0,
            clipPath: "inset(100%)",
            zIndex: 1,
          }}
        >
          <div className="rounded-lg border bg-white">
            <GridTable
              managers={managers}
              rowTotals={rowTotals}
              colTotals={colTotals}
              grandTotals={grandTotals}
              cellMap={cellMap}
              forExport
              activeBadge={null}
              onSelectCell={() => {}}
            />
          </div>
        </div>
      )}

      {activeMode === "history" && (
        <MatchupDetailModal
          selected={selected}
          miniCardDetail={selectedMiniCard}
          open={!!selected || !!selectedMiniCard}
          onOpenChange={(open) => {
            if (!open) {
              setSelected(null);
              setSelectedMiniCard(null);
            }
          }}
        />
      )}
    </div>
  );
}
