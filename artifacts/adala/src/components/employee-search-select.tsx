/**
 * Bounded server-search employee picker.
 * Uses GET /api/hr/employees?page=&limit=&search= so employees beyond the
 * array-mode soft-cap remain selectable without dumping the full roster.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { authFetch } from "@/lib/authFetch";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const PICKER_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 250;

export type EmployeeSearchSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  /** Persist id (default) or full display name (tasks assignee). */
  valueMode?: "id" | "fullName";
  /** Optional status filter forwarded to the API (e.g. "active"). */
  status?: string;
  placeholder?: string;
  /** Show job title beside the name. */
  showJobTitle?: boolean;
  /** Allow clearing selection (empty string). */
  allowClear?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
  /** Called with the selected employee row when valueMode is id. */
  onEmployeeSelect?: (emp: NormalizedEmployee | null) => void;
};

export type NormalizedEmployee = {
  id: string;
  fullName: string;
  jobTitle: string;
  status: string;
};

type EmployeeApiRow = {
  id?: string | number;
  fullName?: string | null;
  full_name?: string | null;
  jobTitle?: string | null;
  job_title?: string | null;
  status?: string | null;
};

function normalizeEmployee(raw: EmployeeApiRow): NormalizedEmployee {
  return {
    id: String(raw?.id ?? ""),
    fullName: String(raw?.fullName ?? raw?.full_name ?? "").trim(),
    jobTitle: String(raw?.jobTitle ?? raw?.job_title ?? "").trim(),
    status: String(raw?.status ?? ""),
  };
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function EmployeeSearchSelect({
  value,
  onValueChange,
  valueMode = "id",
  status,
  placeholder = "ابحث عن موظف...",
  showJobTitle = false,
  allowClear = false,
  clearLabel = "بدون تعيين",
  disabled = false,
  className,
  onEmployeeSelect,
}: EmployeeSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [selectedLabel, setSelectedLabel] = useState("");

  const { data: pageRes, isFetching } = useQuery({
    queryKey: ["employee-search-select", debouncedSearch, status, PICKER_LIMIT],
    queryFn: async () => {
      const p = new URLSearchParams({
        page: "1",
        limit: String(PICKER_LIMIT),
      });
      if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
      if (status && status !== "all") p.set("status", status);
      const r = await authFetch(`${BASE}/api/hr/employees?${p}`);
      if (!r.ok) throw new Error("خطأ في الخادم");
      const json: unknown = await r.json();
      if (Array.isArray(json)) {
        return {
          data: (json as EmployeeApiRow[]).map(normalizeEmployee),
          total: json.length,
        };
      }
      const envelope = json as { data?: EmployeeApiRow[]; total?: number };
      return {
        data: (envelope?.data ?? []).map(normalizeEmployee),
        total: Number(envelope?.total ?? 0),
      };
    },
    enabled: open,
    staleTime: 30_000,
  });

  const employees = useMemo(() => pageRes?.data ?? [], [pageRes?.data]);
  const total = Number(pageRes?.total ?? 0);

  useEffect(() => {
    if (!value) {
      setSelectedLabel("");
      return;
    }
    const match = employees.find((e) =>
      valueMode === "fullName" ? e.fullName === value : e.id === value,
    );
    if (match) setSelectedLabel(match.fullName);
  }, [value, employees, valueMode]);

  const displayLabel = useMemo(() => {
    if (!value) return "";
    if (valueMode === "fullName") return value;
    return selectedLabel || value;
  }, [value, valueMode, selectedLabel]);

  const selectEmployee = (emp: NormalizedEmployee) => {
    const next = valueMode === "fullName" ? emp.fullName : emp.id;
    setSelectedLabel(emp.fullName);
    onValueChange(next);
    onEmployeeSelect?.(emp);
    setOpen(false);
    setSearch("");
  };

  const clearSelection = () => {
    setSelectedLabel("");
    onValueChange("");
    onEmployeeSelect?.(null);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between font-normal",
            !displayLabel && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {displayLabel || placeholder}
          </span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" dir="rtl">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isFetching ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                جارٍ البحث...
              </div>
            ) : (
              <>
                <CommandEmpty>لا يوجد موظف مطابق</CommandEmpty>
                <CommandGroup>
                  {allowClear && value ? (
                    <CommandItem value="__clear__" onSelect={clearSelection}>
                      <X className="me-2 h-4 w-4 opacity-60" />
                      {clearLabel}
                    </CommandItem>
                  ) : null}
                  {employees.map((emp) => {
                    const itemValue = valueMode === "fullName" ? emp.fullName : emp.id;
                    const selected = value === itemValue;
                    return (
                      <CommandItem
                        key={emp.id}
                        value={`${emp.id}-${emp.fullName}`}
                        onSelect={() => selectEmployee(emp)}
                      >
                        <Check
                          className={cn(
                            "me-2 h-4 w-4",
                            selected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="truncate">
                          {emp.fullName}
                          {showJobTitle && emp.jobTitle ? ` — ${emp.jobTitle}` : ""}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                {total > employees.length ? (
                  <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                    يُعرض {employees.length} من {total} — ضيّق البحث للوصول إلى الباقي
                  </p>
                ) : null}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
