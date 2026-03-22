import * as React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export function RoastDeckCarousel({
  children,
}: {
  children: React.ReactNode;
}) {
  /** Skip null / false so we don't render empty slides (blank gaps in the track). */
  const slides = React.Children.toArray(children).filter(React.isValidElement);

  return (
    <div className="relative w-full">
      <Carousel
        opts={{
          align: "start",
          loop: false,
        }}
        className="w-full"
      >
        {/*
          Mobile: basis-full = one card per view (no ~15% empty gutter from basis-[85%]).
          sm+: show 2–3 cards so the row feels full without a huge dead zone beside slide 1.
        */}
        <CarouselContent className="-ml-2 items-stretch md:-ml-4">
          {slides.map((child, idx) => (
            <CarouselItem
              key={idx}
              className="pl-2 md:pl-4 basis-full min-w-0 sm:basis-1/2 lg:basis-1/3"
            >
              {child}
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Hide arrows on mobile, show on md+ */}
        <div className="hidden md:block">
          <CarouselPrevious />
          <CarouselNext />
        </div>
      </Carousel>
    </div>
  );
}