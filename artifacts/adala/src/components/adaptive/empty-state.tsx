/**
 * EmptyState — Professional empty/zero-data display
 * Used across all list pages when there's no data to show
 */
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  size?: "sm" | "md" | "lg";
}

export function EmptyState({
  icon, title, description, action, secondaryAction, size = "md",
}: EmptyStateProps) {
  const sizeClasses = {
    sm: { wrapper: "py-8", iconBox: "h-12 w-12", iconSize: "h-6 w-6", title: "text-sm font-semibold", desc: "text-xs" },
    md: { wrapper: "py-12", iconBox: "h-16 w-16", iconSize: "h-8 w-8", title: "text-base font-semibold", desc: "text-sm" },
    lg: { wrapper: "py-16", iconBox: "h-20 w-20", iconSize: "h-10 w-10", title: "text-lg font-bold", desc: "text-sm" },
  }[size];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${sizeClasses.wrapper} px-6`}>
      {icon && (
        <div className={`${sizeClasses.iconBox} rounded-2xl bg-muted/50 flex items-center justify-center mb-4 text-muted-foreground/50`}>
          <span className={sizeClasses.iconSize}>{icon}</span>
        </div>
      )}
      <p className={`${sizeClasses.title} text-foreground/70 mb-1`}>{title}</p>
      {description && (
        <p className={`${sizeClasses.desc} text-muted-foreground max-w-xs leading-relaxed mb-4`}>{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-[200px]">
          {action && (
            <Button onClick={action.onClick} className="w-full">{action.label}</Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick} className="w-full">{secondaryAction.label}</Button>
          )}
        </div>
      )}
    </div>
  );
}
