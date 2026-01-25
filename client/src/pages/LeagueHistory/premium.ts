const STORAGE_KEY = "fantasy-roast-premium";

export function isPremium(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function setPremium(value: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
}
