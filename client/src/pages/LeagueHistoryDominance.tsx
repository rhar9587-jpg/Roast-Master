import { Fragment, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { RoastDeckCarousel } from "@/components/roast/RoastDeckCarousel";

// shadcn/ui (adjust paths if yours differ)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { BaseballCard } from "@/components/roast/BaseballCard";

type Badge = "OWNED" | "NEMESIS" | "RIVAL" | "EDGE" | "SMALL SAMPLE";

type DominanceCellDTO = {
  a: string;
  b: string;
  aName: string;
  bName: string;
  games: number;
  score: number;
  badge: Badge;
  record: string;
  pf: number;
  pa: number;
};

// --- helper: map dominance cell -> V2 card props ---
function dominanceToCard(cell: DominanceCellDTO, avatarUrl?: string | null) {
  const [wins] = cell.record.split("-"); // e.g. "4-0" -> "4"
  const winsNum = Number(wins);

  const title =
    cell.badge === "OWNED"
      ? "LEAGUE LANDLORD"
      : cell.badge === "NEMESIS"
      ? "NEMESIS"
      : cell.badge === "RIVAL"
      ? "RIVALRY"
      : cell.badge === "EDGE"
      ? "EDGE"
      : "SMALL SAMPLE";

  const punchline =
    cell.badge === "OWNED"
      ? `${cell.bName} is your favourite tenant`
      : cell.badge === "NEMESIS"
      ? `${cell.bName} lives rent-free`
      : cell.badge === "RIVAL"
      ? "This one’s personal"
      : cell.badge === "EDGE"
      ? "Too close for comfort"
      : "Not enough games to be sure";

  // optional rarity (tune thresholds however you like)
  const rarity =
    cell.games >= 10 && winsNum >= 8
      ? "LEGENDARY"
      : cell.games >= 8 && winsNum >= 6
      ? "EPIC"
      : cell.games >= 6 && winsNum >= 4
      ? "RARE"
      : "COMMON";

  return {
    badge: cell.badge,
    title,
    name: cell.aName,
    avatarUrl,
    primaryStat: { value: String(winsNum), label: "WINS" },
    punchline,
    lines: [
      { label: "Victim", value: `${cell.bName} (${cell.record})` },
      { label: "Games", value: String(cell.games) },
      { label: "PF / PA", value: `${cell.pf.toFixed(1)} / ${cell.pa.toFixed(1)}` },
      { label: "Score", value: cell.score.toFixed(2) },
    ],
    season: "2024–25",
    rarity,
    watermark: "Fantasy Roast",
  } as const;
}


type DominanceApiResponse = {
  league: { league_id: string; name: string; season: string };
  grid: Array<{
    key: string;
    name: string;
    opponents: Array<{
      opponent_key: string;
      opponent_name: string;
      record: {
        wins: number;
        losses: number;
        ties: number;
        pointsFor: number;
        pointsAgainst: number;
        games: number;
        score: number;
        badge: Badge;
      };
      display?: { record: string; score: string };
    }>;
    totalWins: number;
    totalLosses: number;
    totalTies: number;
  }>;
  totalsByManager?: Array<{
    key: string;
    name: string;
    avatarUrl?: string | null; // ✅
    totalWins: number;
    totalLosses: number;
    totalTies: number;
    totalGames: number;
    totalPF: number;
    totalPA: number;
    totalScore: number;
  }>;
  cells?: DominanceCellDTO[];
};


function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function scoreToBg(score: number, games: number) {
  if (games < 3) return "bg-slate-200/60 dark:bg-slate-700/40";

  const s = clamp(score, -1, 1);
  const abs = Math.abs(s);
  const tier = abs >= 0.75 ? 5 : abs >= 0.55 ? 4 : abs >= 0.35 ? 3 : abs >= 0.15 ? 2 : 1;

  if (s > 0) {
    return ["bg-emerald-50", "bg-emerald-100", "bg-emerald-200", "bg-emerald-300", "bg-emerald-400"][tier - 1];
  }
  if (s < 0) {
    return ["bg-rose-50", "bg-rose-100", "bg-rose-200", "bg-rose-300", "bg-rose-400"][tier - 1];
  }
  return "bg-muted";
}

function badgePill(badge: Badge) {
  switch (badge) {
    case "OWNED":
      return "bg-emerald-600 text-white";
    case "NEMESIS":
      return "bg-rose-600 text-white";
    case "RIVAL":
      return "bg-amber-500 text-white";
    case "SMALL SAMPLE":
      return "bg-slate-600 text-white";
    default:
      return "bg-muted-foreground/15 text-foreground";
  }
}

function abbrev(name: string) {
  if (!name) return "???";
  const first = name.split(" ")[0] ?? name;
  return first.length > 10 ? first.slice(0, 10) + "…" : first;
}

function fmtRecord(w: number, l: number, t: number) {
  return t > 0 ? `${w}–${l}–${t}` : `${w}–${l}`;
}

function fmtScore(s: number) {
  return `${s >= 0 ? "+" : ""}${s.toFixed(2)}`;
}

export default function LeagueHistoryDominance() {
  const [leagueId, setLeagueId] = useState("1204010682635255808");
  const [startWeek, setStartWeek] = useState(1);
  const [endWeek, setEndWeek] = useState(17);

  const [selected, setSelected] = useState<DominanceCellDTO | null>(null);

  // Visible grid container (what the user scrolls)
  const gridVisibleRef = useRef<HTMLDivElement | null>(null);

  // Export grid container (a dedicated, non-scroll-clipped version)
  const gridExportRef = useRef<HTMLDivElement | null>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const queryKey = ["league-history-dominance", leagueId, startWeek, endWeek];

  const { data, isFetching, error, refetch } = useQuery({
    queryKey,
    enabled: false,
    queryFn: async (): Promise<DominanceApiResponse> => {
      const qs = new URLSearchParams({
        league_id: leagueId.trim(),
        start_week: String(startWeek),
        end_week: String(endWeek),
      });
      const res = await fetch(`/api/league-history/dominance?${qs.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to load dominance grid");
      }
      return res.json();
    },
  });

  const filename = useMemo(() => {
    const leagueName = data?.league?.name ? data.league.name.replace(/[^\w\s-]/g, "").trim() : "league";
    const season = data?.league?.season ? String(data.league.season).replace(/[^\w-]/g, "") : "history";
    return `fantasy-roast-dominance-${leagueName}-${season}.png`.replace(/\s+/g, "-").toLowerCase();
  }, [data?.league]);

  const avatarByKey = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const t of data?.totalsByManager ?? []) {
      m[t.key] = t.avatarUrl ?? null;
    }
    return m;
  }, [data?.totalsByManager]);

  
  // ✅ SORT: strongest teams first (dominance proxy)
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
      m.set(r.key, { w: r.totalWins, l: r.totalLosses, t: r.totalTies, games, score });
    }
    return m;
  }, [data]);

  // ✅ Bottom row totals: "league vs this team" (aggregate of everyone’s record against that team)
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

    for (const [id, v] of m.entries()) {
      v.games = v.w + v.l + v.t;
      v.score = v.games ? (v.w - v.l) / v.games : 0;
      m.set(id, v);
    }

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
    // Note: this is double-counted across the league because every matchup appears twice (A vs B and B vs A)
    const games = w + l + t;
    const score = games ? (w - l) / games : 0;
    return { w, l, t, games, score };
  }, [data]);

  // =========================
  // CELL MAP
  // =========================

  const cellMap = useMemo(() => {
    const m = new Map<string, DominanceCellDTO>();

    // Prefer server-provided cells if present
    if (data?.cells?.length) {
      for (const c of data.cells) m.set(`${c.a}-${c.b}`, c);
      return m;
    }

    // Fallback: derive cells from grid.opponents
    for (const row of data?.grid ?? []) {
      for (const o of row.opponents ?? []) {
        const w = o.record?.wins ?? 0;
        const l = o.record?.losses ?? 0;
        const t = o.record?.ties ?? 0;

        const games = typeof o.record?.games === "number" ? o.record.games : w + l + t;
        const score = typeof o.record?.score === "number" ? o.record.score : games ? (w - l) / games : 0;

        const badge = (o.record?.badge ??
          (games < 3 ? "SMALL SAMPLE" : score > 0.25 ? "OWNED" : score < -0.25 ? "NEMESIS" : "EDGE")) as Badge;

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

  function openCell(cellKey?: string | null) {
    if (!cellKey) return;
    const c = cellMap.get(cellKey);
    if (c) setSelected(c);
  }

  // =========================
  // HERO CARDS (V1)
  // =========================

  const isCountable = (c: DominanceCellDTO) => (c?.games ?? 0) >= 3;

  // Landlord = manager who OWNS the most distinct victims
  type VictimRow = {
    cellKey: string; // `${a}-${b}`
    victimKey: string;
    victimName: string;
    record: string;
    games: number;
    score: number;
  };

  type LandlordSummary = {
    landlordKey: string;
    landlordName: string;
    victimCount: number;
    victims: VictimRow[];
    totalOwnedGames: number;
    bestVictim?: VictimRow | null;
  };

  const landlord = useMemo<LandlordSummary | null>(() => {
    const groups = new Map<string, { landlordName: string; victims: VictimRow[] }>();

    for (const c of allCells) {
      if (!c) continue;
      if (c.badge !== "OWNED") continue;
      if (!isCountable(c)) continue;
      if (!c.a || !c.b) continue;

      const landlordKey = c.a;
      const landlordName = c.aName || landlordKey;

      const g = groups.get(landlordKey) ?? { landlordName, victims: [] };

      g.victims.push({
        cellKey: `${c.a}-${c.b}`,
        victimKey: c.b,
        victimName: c.bName || c.b,
        record: c.record,
        games: c.games,
        score: c.score,
      });

      groups.set(landlordKey, g);
    }

    if (!groups.size) return null;

    const avg = (arr: VictimRow[], f: (x: VictimRow) => number) =>
      arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : 0;

    let bestKey: string | null = null;
    let best: { landlordName: string; victims: VictimRow[] } | null = null;

    for (const [k, v] of groups.entries()) {
      if (!best) {
        bestKey = k;
        best = v;
        continue;
      }

      const aCount = v.victims.length;
      const bCount = best.victims.length;
      if (aCount !== bCount) {
        if (aCount > bCount) {
          bestKey = k;
          best = v;
        }
        continue;
      }

      const aAvgScore = avg(v.victims, (x) => x.score);
      const bAvgScore = avg(best.victims, (x) => x.score);
      if (aAvgScore !== bAvgScore) {
        if (aAvgScore > bAvgScore) {
          bestKey = k;
          best = v;
        }
        continue;
      }

      const aAvgGames = avg(v.victims, (x) => x.games);
      const bAvgGames = avg(best.victims, (x) => x.games);
      if (aAvgGames > bAvgGames) {
        bestKey = k;
        best = v;
      }
    }

    if (!bestKey || !best) return null;

    const victimsSorted = [...best.victims].sort((x, y) => {
      if (y.games !== x.games) return y.games - x.games;
      if (y.score !== x.score) return y.score - x.score;
      return x.victimName.localeCompare(y.victimName);
    });

    const totalOwnedGames = victimsSorted.reduce((s, x) => s + x.games, 0);
    const bestVictim = victimsSorted[0] ?? null;

    return {
      landlordKey: bestKey,
      landlordName: best.landlordName,
      victimCount: victimsSorted.length,
      victims: victimsSorted,
      totalOwnedGames,
      bestVictim,
    };
  }, [allCells]);

  // Most Owned = biggest victim (owned by the most different managers)
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
      if (!c) continue;
      if (c.badge !== "OWNED") continue;
      if (!isCountable(c)) continue;
      if (!c.a || !c.b) continue;

      // c.a owns c.b
      const victimKey = c.b;
      const victimName = c.bName || victimKey;

      const cur =
        victimMap.get(victimKey) ?? {
          victimKey,
          victimName,
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

      victimMap.set(victimKey, cur);
    }

    if (!victimMap.size) return null;

    const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + f(x), 0);

    let best: (typeof victimMap extends Map<any, infer V> ? V : never) | null = null;

    for (const v of victimMap.values()) {
      if (!best) {
        best = v;
        continue;
      }

      const aOwners = v.ownedBy.length;
      const bOwners = best.ownedBy.length;
      if (aOwners !== bOwners) {
        if (aOwners > bOwners) best = v;
        continue;
      }

      const aGames = sum(v.ownedBy, (x) => x.games);
      const bGames = sum(best.ownedBy, (x) => x.games);
      if (aGames !== bGames) {
        if (aGames > bGames) best = v;
        continue;
      }

      // weighted avg dominance score (higher = more dominated)
      const aAvgScore = aGames ? sum(v.ownedBy, (x) => x.score * x.games) / aGames : 0;
      const bAvgScore = bGames ? sum(best.ownedBy, (x) => x.score * x.games) / bGames : 0;
      if (aAvgScore !== bAvgScore) {
        if (aAvgScore > bAvgScore) best = v;
      }
    }

    if (!best) return null;

    const worst = [...best.ownedBy].sort((x, y) => {
      if (y.score !== x.score) return y.score - x.score;
      return y.games - x.games;
    })[0];

    const totalOwners = best.ownedBy.length;
    const totalOwnedGames = best.ownedBy.reduce((s, x) => s + x.games, 0);

    return {
      victimName: best.victimName,
      victimKey: best.victimKey,
      timesOwned: totalOwners,
      totalGames: totalOwnedGames,
      worstNemesisName: worst?.landlordName ?? "—",
      worstNemesisRecord: worst?.record ?? "—",
      worstNemesisCellKey: worst?.cellKey ?? null,
      cellKey: worst?.cellKey ?? null,
      ownedBy: best.ownedBy,
    };
  }, [allCells]);

  // Biggest Rivalry = closest to 0 score with decent sample size (tie-break: most games)
  const biggestRivalry = useMemo(() => {
    if (!allCells.length) return null;

    const eligible = allCells
      .filter((c) => c && isCountable(c) && c.a && c.b)
      .map((c) => ({
        ...c,
        absScore: Math.abs(c.score ?? 0),
      }));

    if (!eligible.length) return null;

    eligible.sort((x, y) => {
      // closest to 0 first
      if (x.absScore !== y.absScore) return x.absScore - y.absScore;
      // then most games
      if ((y.games ?? 0) !== (x.games ?? 0)) return (y.games ?? 0) - (x.games ?? 0);

      // prefer RIVAL over EDGE over others
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

  // =========================
  // EXPORT (html-to-image)
  // =========================

  async function waitForPaint() {
    // @ts-ignore
    if (document.fonts?.ready) {
      // @ts-ignore
      await document.fonts.ready;
    }
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  }

  async function exportPngDataUrl() {
    if (!gridExportRef.current) throw new Error("Export grid not ready");

    const el = gridExportRef.current;
    const originalStyle = el.style.cssText;

    el.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      z-index: 9999;
      pointer-events: none;
      visibility: visible;
      opacity: 1;
      clip-path: none;
      transform: none;
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
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
        width,
        height,
      });
      return dataUrl;
    } finally {
      el.style.cssText = originalStyle;
    }
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

      const shareText = "Fantasy Roast — Dominance Grid";

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Dominance Grid",
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

  // --- Render helpers ---

  function GridInner({ forExport }: { forExport: boolean }) {
    return (
      <div
        className="grid"
        style={{
          gridTemplateColumns: `220px repeat(${managers.length}, minmax(110px, 1fr)) 160px`,
        }}
      >
        <div className="sticky top-0 z-10 bg-background border-b border-r p-2 text-xs font-medium">Team</div>

        {managers.map((m) => (
          <div
            key={`col-${m.key}-${forExport ? "x" : "v"}`}
            className="sticky top-0 z-10 bg-background border-b p-2 text-xs font-medium text-center"
            title={m.name}
          >
            {abbrev(m.name)}
          </div>
        ))}

        <div className="sticky top-0 z-10 bg-background border-b border-l p-2 text-xs font-medium text-center">Total</div>

        {managers.map((row) => {
          const rt = rowTotals.get(row.key);

          return (
            <Fragment key={`r-${row.key}-${forExport ? "x" : "v"}`}>
              <div className="sticky left-0 z-10 bg-background border-r p-2" title={row.name}>
                <div className="text-xs font-medium">{row.name}</div>
                {rt ? (
                  <div className="text-[11px] text-muted-foreground">
                    {fmtRecord(rt.w, rt.l, rt.t)} • {fmtScore(rt.score)}
                  </div>
                ) : null}
              </div>

              {managers.map((col) => {
                if (row.key === col.key) {
                  return (
                    <div
                      key={`cell-${row.key}-${col.key}-${forExport ? "x" : "v"}`}
                      className="border p-2 bg-muted/30"
                    />
                  );
                }

                const c = cellMap.get(`${row.key}-${col.key}`);
                if (!c) {
                  return (
                    <div
                      key={`cell-${row.key}-${col.key}-${forExport ? "x" : "v"}`}
                      className="border p-2 text-xs text-muted-foreground"
                    >
                      —
                    </div>
                  );
                }

                const bg = scoreToBg(c.score, c.games);

                if (forExport) {
                  return (
                    <div key={`cell-${c.a}-${c.b}-x`} className={`border p-2 text-left ${bg}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] rounded px-1.5 py-0.5 ${badgePill(c.badge)}`}>{c.badge}</span>
                        <span className="text-[10px] text-muted-foreground">{c.games}g</span>
                      </div>

                      <div className="mt-1 text-sm font-semibold">
                        {c.score >= 0 ? "+" : ""}
                        {c.score.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">{c.record}</div>
                    </div>
                  );
                }

                return (
                  <button
                    key={`cell-${c.a}-${c.b}-v`}
                    className={`border p-2 text-left hover:opacity-90 transition ${bg}`}
                    onClick={() => setSelected(c)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] rounded px-1.5 py-0.5 ${badgePill(c.badge)}`}>{c.badge}</span>
                      <span className="text-[10px] text-muted-foreground">{c.games}g</span>
                    </div>

                    <div className="mt-1 text-sm font-semibold">
                      {c.score >= 0 ? "+" : ""}
                      {c.score.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">{c.record}</div>
                  </button>
                );
              })}

              <div className="border-l border p-2 bg-muted/20">
                {rt ? (
                  <div className="space-y-1">
                    <div className="text-xs font-medium">Overall</div>
                    <div className="text-xs text-muted-foreground">{fmtRecord(rt.w, rt.l, rt.t)}</div>
                    <div className="text-sm font-semibold">{fmtScore(rt.score)}</div>
                    <div className="text-[10px] text-muted-foreground">{rt.games} games</div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">—</div>
                )}
              </div>
            </Fragment>
          );
        })}

        <div className="sticky left-0 z-10 bg-background border-t border-r p-2">
          <div className="text-xs font-medium">League vs Team</div>
          <div className="text-[11px] text-muted-foreground">(how everyone does vs them)</div>
        </div>

        {managers.map((m) => {
          const ct = colTotals.get(m.key);
          return (
            <div key={`coltotal-${m.key}-${forExport ? "x" : "v"}`} className="border-t p-2 text-center bg-muted/10">
              {ct ? (
                <>
                  <div className="text-xs text-muted-foreground">{fmtRecord(ct.w, ct.l, ct.t)}</div>
                  <div className="text-sm font-semibold">{fmtScore(ct.score)}</div>
                  <div className="text-[10px] text-muted-foreground">{ct.games} games</div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">—</div>
              )}
            </div>
          );
        })}

        <div className="border-t border-l p-2 text-center bg-muted/20">
          <div className="text-xs font-medium">Grand</div>
          <div className="text-xs text-muted-foreground">{fmtRecord(grandTotals.w, grandTotals.l, grandTotals.t)}</div>
          <div className="text-sm font-semibold">{fmtScore(grandTotals.score)}</div>
          <div className="text-[10px] text-muted-foreground">(double-counted)</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">League History – Dominance Grid</h1>
        {data?.league ? (
          <p className="text-sm text-muted-foreground">
            {data.league.name} • Season {data.league.season}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Build a dominance grid for any Sleeper league.</p>
        )}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label>League ID</Label>
            <Input value={leagueId} onChange={(e) => setLeagueId(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Start week</Label>
            <Input
              inputMode="numeric"
              value={String(startWeek)}
              onChange={(e) => setStartWeek(Number(e.target.value || 1))}
            />
          </div>

          <div className="space-y-1">
            <Label>End week</Label>
            <Input
              inputMode="numeric"
              value={String(endWeek)}
              onChange={(e) => setEndWeek(Number(e.target.value || 17))}
            />
          </div>

          <div className="flex items-end">
            <Button className="w-full" onClick={() => refetch()} disabled={isFetching || !leagueId.trim()}>
              {isFetching ? "Building…" : "Build Dominance Grid"}
            </Button>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-600">{(error as Error).message}</p> : null}
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(["OWNED", "NEMESIS", "RIVAL", "EDGE", "SMALL SAMPLE"] as Badge[]).map((b) => (
          <span key={b} className={`rounded px-2 py-1 ${badgePill(b)}`}>
            {b}
          </span>
        ))}
      </div>

      {/* Hero cards */}
      {managers.length > 0 ? (
        <RoastDeckCarousel>
          <BaseballCard
            badge="OWNED"
            title="LEAGUE LANDLORD"
            name={landlord?.landlordName ?? "—"}
            avatarUrl={landlord ? (avatarByKey[landlord.landlordKey] ?? null) : null}
            primaryStat={{ value: landlord ? String(landlord.totalOwnedGames) : "—", label: "OWNED GAMES" }}
            punchline={landlord ? `Owns ${landlord.victimCount} managers overall` : "No landlord yet"}
            lines={[
              { label: "Victims", value: landlord ? String(landlord.victimCount) : "—" },
              {
                label: "Top victim",
                value: landlord?.bestVictim
                  ? `${landlord.bestVictim.victimName} (${landlord.bestVictim.record})`
                  : "—",
              },
            ]}
            season="2024–25"
            onClick={() => openCell(landlord?.bestVictim?.cellKey ?? null)}
          />

          <BaseballCard
            badge="NEMESIS"
            title="MOST OWNED"
            name={mostOwned?.victimName ?? "—"}
            avatarUrl={mostOwned ? (avatarByKey[mostOwned.victimKey] ?? null) : null}
            primaryStat={{ value: mostOwned ? String(mostOwned.timesOwned) : "—", label: "TIMES OWNED" }}
            punchline={mostOwned ? `Owned by ${mostOwned.timesOwned} different managers` : "No victims yet"}
            lines={[
              { label: "Worst nemesis", value: mostOwned?.worstNemesisName ?? "—" },
              { label: "Games", value: mostOwned ? String(mostOwned.totalGames) : "—" },
            ]}
            season="2024–25"
            onClick={() => openCell(mostOwned?.cellKey)}
          />

          <BaseballCard
            badge="RIVAL"
            title="BIGGEST RIVALRY"
            name={biggestRivalry ? `${biggestRivalry.aName} vs ${biggestRivalry.bName}` : "—"}
            avatarUrl={biggestRivalry ? (avatarByKey[biggestRivalry.aKey] ?? null) : null}
            primaryStat={{ value: biggestRivalry?.record ?? "—", label: "RECORD" }}
            punchline={biggestRivalry ? "Closest matchup with actual heat" : "No rivalry yet"}
            lines={[
              { label: "Games", value: biggestRivalry ? String(biggestRivalry.games) : "—" },
              { label: "Score", value: biggestRivalry ? fmtScore(biggestRivalry.score) : "—" },
            ]}
            season="2024–25"
            onClick={() => openCell(biggestRivalry?.cellKey ?? null)}
          />
        </RoastDeckCarousel>
      ) : null}


      {/* Export buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={downloadPng} disabled={!managers.length || isDownloading || isSharing}>
          {isDownloading ? "Exporting…" : "Download PNG"}
        </Button>

        <Button variant="secondary" onClick={sharePng} disabled={!managers.length || isDownloading || isSharing}>
          {isSharing ? "Exporting…" : "Share"}
        </Button>
      </div>

      {/* Visible grid */}
      {managers.length > 0 ? (
        <div ref={gridVisibleRef} className="rounded-lg border bg-background">
          <div className="overflow-auto">
            <GridInner forExport={false} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Build the grid to see the 12×12 matrix here.</p>
      )}

      {/* Export grid (hidden but rendered for capture) */}
      {managers.length > 0 ? (
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
            <GridInner forExport={true} />
          </div>
        </div>
      ) : null}

      {/* Rivalry preview panel */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selected.aName} vs {selected.bName}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex gap-2 items-center">
                  <span className={`text-xs rounded px-2 py-1 ${badgePill(selected.badge)}`}>{selected.badge}</span>
                  <span className="text-muted-foreground">{selected.games} games</span>
                </div>

                <div className="rounded border p-3 space-y-1">
                  <div>
                    <span className="text-muted-foreground">Record:</span> {selected.record}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Score:</span> {selected.score >= 0 ? "+" : ""}
                    {selected.score.toFixed(2)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Points For:</span> {selected.pf.toFixed(2)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Points Against:</span> {selected.pa.toFixed(2)}
                  </div>
                </div>

                <Button className="w-full" variant="secondary" disabled>
                  Coming soon: Rivalry Pack
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}