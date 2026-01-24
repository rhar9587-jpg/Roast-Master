import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RoastResponse } from "@shared/schema";
import {
  SlideBenchCrime,
  SlideCarryJob,
  SlideCover,
  SlideSackoForecast,
} from "./wrappedSlides";

type WrappedDeckProps = {
  data: RoastResponse;
  leagueName: string;
  week: number;
  initialCard?: string; // for deep links later
};

export function WrappedDeck({ data, leagueName, week, initialCard }: WrappedDeckProps) {
  const slides = useMemo(() => {
    return [
      { key: "cover", node: <SlideCover leagueName={leagueName} week={week} /> },
      { key: "carry", node: <SlideCarryJob data={data} /> },
      { key: "bench", node: <SlideBenchCrime data={data} /> },
      { key: "sacko", node: <SlideSackoForecast data={data} /> },
    ];
  }, [data, leagueName, week]);

  const initialIndex = Math.max(
    0,
    slides.findIndex((s) => s.key === initialCard)
  );

  const [idx, setIdx] = useState(initialIndex === -1 ? 0 : initialIndex);

  useEffect(() => {
    // reset index if initialCard changes
    if (initialIndex >= 0) setIdx(initialIndex);
  }, [initialIndex]);

  const prev = () => setIdx((i) => (i - 1 + slides.length) % slides.length);
  const next = () => setIdx((i) => (i + 1) % slides.length);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          Card {idx + 1} of {slides.length}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={prev} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={next} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {slides.map((s) => (
            <div key={s.key} className="w-full shrink-0">
              {s.node}
            </div>
          ))}
        </div>
      </div>

      {/* expose the current slide key for exports */}
      <input type="hidden" value={slides[idx]?.key ?? "cover"} readOnly />
    </div>
  );
}