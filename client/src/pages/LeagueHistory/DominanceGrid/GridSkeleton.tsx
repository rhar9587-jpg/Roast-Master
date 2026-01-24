import { Fragment } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 6;
const COLS = 6;

export function GridSkeleton() {
  return (
    <div
      className="grid gap-px rounded-lg border bg-muted/30 p-px"
      style={{
        gridTemplateColumns: `220px repeat(${COLS}, minmax(110px, 1fr)) 160px`,
      }}
    >
      <Skeleton className="h-10 rounded-none" />
      {Array.from({ length: COLS }).map((_, i) => (
        <Skeleton key={i} className="h-10 rounded-none" />
      ))}
      <Skeleton className="h-10 rounded-none" />

      {Array.from({ length: ROWS }).map((_, row) => (
        <Fragment key={row}>
          <Skeleton className="h-16 rounded-none" />
          {Array.from({ length: COLS }).map((_, col) => (
            <Skeleton key={col} className="h-16 rounded-none" />
          ))}
          <Skeleton className="h-16 rounded-none" />
        </Fragment>
      ))}
    </div>
  );
}
