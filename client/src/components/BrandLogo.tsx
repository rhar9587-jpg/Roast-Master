import { cn } from "@/lib/utils";

const ALT =
  "Fantasy Roast — rooster logo for fantasy football roasts, dominance receipts, and league storylines";

type BrandLogoProps = {
  variant: "horizontal" | "icon";
  className?: string;
};

/**
 * Brand marks for nav (not for hero). Desktop: header lockup; mobile: rooster icon only.
 */
export function BrandLogo({ variant, className }: BrandLogoProps) {
  if (variant === "icon") {
    return (
      <img
        src="/brand/logo-icon-light.png"
        alt={ALT}
        width={32}
        height={32}
        decoding="async"
        className={cn(
          "block h-8 w-8 max-h-8 max-w-8 object-contain object-left shrink-0",
          className,
        )}
      />
    );
  }

  /** Height-driven sizing keeps 180×48 aspect ratio (avoid fixed width + short height = “thin” look). */
  return (
    <img
      src="/brand/logo-header-180x48.png"
      alt={ALT}
      width={180}
      height={48}
      decoding="async"
      className={cn(
        "block h-11 w-auto max-w-[min(240px,85vw)] object-contain object-left shrink-0 md:h-14",
        className,
      )}
    />
  );
}
