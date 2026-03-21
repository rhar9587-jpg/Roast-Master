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
        className={cn("h-8 w-8 object-contain object-left", className)}
      />
    );
  }

  return (
    <img
      src="/brand/logo-header-180x48.png"
      alt={ALT}
      width={180}
      height={48}
      decoding="async"
      className={cn(
        "h-9 w-[180px] max-w-[min(180px,70vw)] object-contain object-left md:h-10",
        className,
      )}
    />
  );
}
