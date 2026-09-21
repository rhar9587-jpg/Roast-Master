/** Pure copy helpers for Season / Autopsy chrome — gated on seasonComplete. */

export function seasonModeSupportingLine(seasonComplete: boolean): string {
  return seasonComplete
    ? "Your season. Your wins. Your choke jobs. No hiding."
    : "Your season so far. Wins, choke jobs, and unfinished business.";
}

export function autopsyModeSupportingLine(seasonComplete: boolean): string {
  return seasonComplete
    ? "The final verdict on this season. Someone's getting exposed."
    : "League season so far. Snapshot the chaos while it's still live.";
}

export function autopsySectionTitle(seasonComplete: boolean): string {
  return seasonComplete ? "End-of-Season" : "Season so far";
}

export function autopsyGenerateLabel(seasonComplete: boolean): string {
  return seasonComplete ? "Generate End-of-Season" : "Generate season snapshot";
}
