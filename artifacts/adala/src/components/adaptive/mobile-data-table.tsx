/**
 * MobileDataTable — Adaptive table→cards component
 *
 * Desktop/Tablet: renders children (pass your existing <table> or any JSX)
 * Mobile: renders each row as a card using a provided `renderCard` function
 *
 * Usage:
 *   <MobileDataTable
 *     rows={data}
 *     renderCard={(row) => <MyCard row={row} />}
 *     loading={isLoading}
 *     empty={<EmptyState ... />}
 *   >
 *     existing desktop table or grid JSX goes here
 *   </MobileDataTable>
 */
import { ReactNode } from "react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { SkeletonCardList } from "./skeleton-card";

interface MobileDataTableProps<T> {
  /** Desktop: render this content (any table/grid JSX) */
  children: ReactNode;
  /** Mobile: render each row using this function */
  renderCard: (row: T, index: number) => ReactNode;
  rows: T[];
  loading?: boolean;
  /** Shown when rows.length === 0 and not loading */
  empty?: ReactNode;
  /** Number of skeleton cards to show during loading on mobile */
  skeletonCount?: number;
  className?: string;
}

export function MobileDataTable<T>({
  children,
  renderCard,
  rows,
  loading = false,
  empty,
  skeletonCount = 4,
  className = "",
}: MobileDataTableProps<T>) {
  const { isMobile } = useBreakpoint();

  if (!isMobile) {
    return <>{children}</>;
  }

  // Mobile view
  if (loading) {
    return <SkeletonCardList count={skeletonCount} />;
  }

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className={`space-y-3 p-4 ${className}`}>
      {rows.map((row, i) => (
        <div key={i}>{renderCard(row, i)}</div>
      ))}
    </div>
  );
}
