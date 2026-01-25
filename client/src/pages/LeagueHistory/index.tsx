import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toPng } from "html-to-image";
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
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { LeagueSelector } from "./LeagueSelector";
import { InsightsDashboard } from "./InsightsDashboard";
import { DominanceGrid } from "./DominanceGrid";
import { StorylinesMiniCards } from "./StorylinesMiniCards";
import { MatchupDetailModal } from "./MatchupDetailModal";
import { GridTable } from "./DominanceGrid/GridTable";
import { fmtRecord, getViewerByLeague, setViewerByLeague, saveRecentLeague, getRecentLeagues } from "./utils";
import { computeLeagueStorylines, computeYourRoast } from "./storylines";
import type {
  Badge,
  DominanceApiResponse,
  DominanceCellDTO,
  VictimRow,
  LandlordSummary,
} from "./types";

function isCountable(c: DominanceCellDTO) {
  return (c?.games ?? 0) >= 3;
}

export default function LeagueHistoryPage() {
  const [leagueId, setLeagueId] = useState("");
  const [startWeek, setStartWeek] = useState(1);
  const [endWeek, setEndWeek] = useState(17);
  const [selected, setSelected] = useState<DominanceCellDTO | null>(null);
  const [activeBadge, setActiveBadge] = useState<Badge | null>(null);
  const [isSelectorCollapsed, setIsSelectorCollapsed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isExportingStorylines, setIsExportingStorylines] = useState(false);
  const [isExportingYourRoast, setIsExportingYourRoast] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);
  const [viewerKey, setViewerKey] = useState<string>("");
  const { toast } = useToast();

  const gridVisibleRef = useRef<HTMLDivElement | null>(null);
  const gridExportRef = useRef<HTMLDivElement | null>(null);
  const storylinesExportRef = useRef<HTMLDivElement | null>(null);
  const yourRoastExportRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedFromUrl = useRef(false);
  const shouldAutoTrigger = useRef(false);

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["league-history-dominance", leagueId, startWeek, endWeek],
    enabled: false,
    queryFn: async (): Promise<DominanceApiResponse> => {
      try {
        const qs = new URLSearchParams({
          league_id: leagueId.trim(),
          start_week: String(startWeek),
          end_week: String(endWeek),
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
        setLastAnalyzedAt(new Date());
        return res.json();
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

  // Read URL params on mount
  useEffect(() => {
    if (hasInitializedFromUrl.current) return;
    hasInitializedFromUrl.current = true;

    const params = new URLSearchParams(window.location.search);
    const urlLeagueId = params.get("league_id");
    const urlStartWeek = params.get("start_week");
    const urlEndWeek = params.get("end_week");

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

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, [leagueId, startWeek, endWeek]);

  useEffect(() => {
    const justFetched = prevFetching.current && !isFetching && hasData;
    prevFetching.current = isFetching;
    if (justFetched && !isSelectorCollapsed) setIsSelectorCollapsed(true);
  }, [isFetching, hasData, isSelectorCollapsed]);

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
        grandTotals.games
      ),
    [allCells, managers, rowTotals, totalsByManager, grandTotals.games]
  );

  const yourRoastCards = useMemo(
    () =>
      viewerKey
        ? computeYourRoast(viewerKey, allCells, managers)
        : [],
    [viewerKey, allCells, managers]
  );

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
    const saved = getViewerByLeague(leagueId.trim());
    const keys = new Set(managers.map((m) => m.key));
    if (saved && keys.has(saved)) {
      setViewerKey(saved);
    } else if (saved) {
      setViewerByLeague(leagueId.trim(), "");
    }
  }, [hasData, managers, leagueId, data?.league]);

  function openCell(cellKey: string | null) {
    if (!cellKey) return;
    const c = cellMap.get(cellKey);
    if (c) setSelected(c);
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
    const exampleLeagueId = "1204010682635255808";
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

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-4">
      {/* Hero Section */}
      {!hasData && (
        <div className="rounded-lg border bg-gradient-to-br from-background to-muted/20 p-6 md:p-8 space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Who Owns Your League?
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
              Shareable roasts for your league chat.
            </p>
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
        </div>
      )}

      {/* Standard Header (when data exists) */}
      {hasData && (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">
              League History
            </h1>
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
          {managers.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm text-muted-foreground">View as:</span>
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
                <SelectTrigger className="w-[180px]">
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
            </div>
          )}
        </div>
      )}

      <LeagueSelector
        leagueId={leagueId}
        startWeek={startWeek}
        endWeek={endWeek}
        onLeagueIdChange={setLeagueId}
        onStartWeekChange={setStartWeek}
        onEndWeekChange={setEndWeek}
        onAnalyze={() => refetch()}
        isFetching={isFetching}
        error={error as Error | null}
        isCollapsed={isSelectorCollapsed}
        onCollapsedChange={setIsSelectorCollapsed}
        leagueName={data?.league?.name}
        season={data?.league?.season}
      />

      {hasData && hasEnoughData && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            The Headlines
          </h2>
          <InsightsDashboard
            landlord={landlord}
            mostOwned={mostOwned}
            biggestRivalry={biggestRivalry}
            avatarByKey={avatarByKey}
            onOpenCell={openCell}
          />
          {hasData && hasEnoughData && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Found your nemesis? Send this roast.
            </p>
          )}
        </section>
      )}

      {hasData && !hasEnoughData && (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">
            Not enough roasts yet.
          </p>
          <p className="text-xs text-muted-foreground">
            Add more weeks to see who owns who.
          </p>
        </div>
      )}

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">
          The Scoreboard
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

      {hasData &&
        hasEnoughData &&
        (leagueStorylines.length > 0 || !!viewerKey) && (
          <section>
            <div className="flex flex-wrap gap-2 mb-3">
              {leagueStorylines.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveStorylinesPng}
                  disabled={isExportingStorylines}
                >
                  {isExportingStorylines ? "Saving…" : "Save Storylines"}
                </Button>
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
              leagueCards={leagueStorylines}
              yourRoastCards={yourRoastCards}
              viewerChosen={!!viewerKey}
              onOpenCell={(key) => openCell(key)}
              storylinesExportRef={storylinesExportRef}
              yourRoastExportRef={yourRoastExportRef}
              exportTimestamp={
                lastAnalyzedAt?.toLocaleString() ??
                new Date().toLocaleString()
              }
            />
          </section>
        )}

      {hasData && (
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

      <MatchupDetailModal
        selected={selected}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
