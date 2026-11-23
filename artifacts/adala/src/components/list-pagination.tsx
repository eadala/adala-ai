import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ListPaginationProps = {
  /** 1-based page index */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  dir?: "rtl" | "ltr";
  className?: string;
  /** Hide when a single page is enough (default true). */
  hideWhenSinglePage?: boolean;
};

/**
 * Minimal RTL-friendly Previous/Next control for legal-core list pages.
 * Does not change surrounding layout beyond a compact footer row.
 */
export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  dir = "rtl",
  className,
  hideWhenSinglePage = true,
}: ListPaginationProps) {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
  const pages = Math.max(1, Math.ceil(Math.max(0, total) / safeSize));
  const from = total <= 0 ? 0 : (safePage - 1) * safeSize + 1;
  const to = Math.min(safePage * safeSize, total);

  if (hideWhenSinglePage && total <= safeSize && safePage <= 1) {
    return null;
  }

  return (
    <div
      className={cn("flex items-center justify-between gap-2 pt-2", className)}
      dir={dir}
      data-testid="list-pagination"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={safePage <= 1}
        onClick={() => onPageChange(Math.max(1, safePage - 1))}
        data-testid="list-pagination-prev"
      >
        السابق
      </Button>
      <span className="text-xs text-muted-foreground tabular-nums" data-testid="list-pagination-meta">
        {from} — {to} من {total}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={safePage >= pages || total <= 0}
        onClick={() => onPageChange(Math.min(pages, safePage + 1))}
        data-testid="list-pagination-next"
      >
        التالي
      </Button>
    </div>
  );
}

/** Default page size for legal-core primary lists. */
export const LEGAL_LIST_PAGE_SIZE = 50;
