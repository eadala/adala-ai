import { lazy, Suspense } from "react";
import { Palette, Loader2 } from "lucide-react";

const ThemeBuilderPage = lazy(() =>
  import("@/pages/platform/theme-builder").then(m => ({ default: m.default }))
);

function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function DesignCenterTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Palette className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-bold">لوحة التصميم</h2>
          <p className="text-xs text-muted-foreground">تخصيص ألوان المنصة، الخطوط، والثيمات لكل مكتب</p>
        </div>
      </div>
      <Suspense fallback={<Loading />}>
        <ThemeBuilderPage />
      </Suspense>
    </div>
  );
}
