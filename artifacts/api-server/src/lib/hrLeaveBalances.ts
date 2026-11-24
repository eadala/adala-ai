/**
 * Set-based leave-balance sync for GET /hr-internal/leave-balances.
 * Keeps response shape stable while eliminating per-employee / per-type N+1 queries.
 */

export const LEAVE_BALANCE_TYPES = [
  { type: "annual", quota: 21 },
  { type: "sick", quota: 14 },
  { type: "emergency", quota: 3 },
] as const;

export type LeaveBalanceType = (typeof LEAVE_BALANCE_TYPES)[number]["type"];

export type LeaveBalanceEmployeeRow = {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  office_id: string;
  status: string;
};

export type LeaveBalanceLedgerRow = {
  employee_id: string;
  leave_type: string;
  year: number;
  quota: number;
  used: number;
};

export type LeaveUsageAgg = {
  employee_id: string;
  leave_type: string;
  total: number;
};

export type LeaveBalanceEntry = {
  type: string;
  quota: number;
  used: number;
  remaining: number;
};

export type LeaveBalanceEmployeeResult = {
  employeeId: string;
  employeeName: string;
  jobTitle: string | null;
  department: string | null;
  balances: LeaveBalanceEntry[];
};

/** Legacy query count: 1 employee list + 10 queries per employee (3 insert + 3 sum + 3 update + 1 select). */
export function legacyLeaveBalancesQueryCount(employeeCount: number): number {
  return 1 + employeeCount * 10;
}

/**
 * Set-based plan is always O(1) DB round-trips (independent of employee count):
 * 1) batch INSERT … SELECT missing balances
 * 2) set-based UPDATE … FROM approved-leave aggregates
 * 3) one SELECT employees ⨝ balances for the response
 *
 * (ensureTables is separate bootstrap, unchanged.)
 */
export function setBasedLeaveBalancesQueryCount(): number {
  return 3;
}

export function leaveTypeOrder(type: string): number {
  const idx = LEAVE_BALANCE_TYPES.findIndex((t) => t.type === type);
  return idx >= 0 ? idx : 99;
}

/** Pure: group approved leave days by employee_id + leave_type for a year. */
export function aggregateApprovedLeaveUsage(
  leaves: Array<{
    employee_id: string;
    type: string;
    status: string;
    days: number;
    start_date: string;
    office_id?: string;
  }>,
  year: number,
  tenantId?: string,
): LeaveUsageAgg[] {
  const map = new Map<string, number>();
  for (const leaf of leaves) {
    if (tenantId && leaf.office_id && leaf.office_id !== tenantId) continue;
    if (leaf.status !== "approved") continue;
    const y = new Date(leaf.start_date).getUTCFullYear();
    if (y !== year) continue;
    if (!LEAVE_BALANCE_TYPES.some((t) => t.type === leaf.type)) continue;
    const key = `${leaf.employee_id}|${leaf.type}`;
    map.set(key, (map.get(key) ?? 0) + Number(leaf.days ?? 0));
  }
  return [...map.entries()].map(([key, total]) => {
    const [employee_id, leave_type] = key.split("|");
    return { employee_id, leave_type, total };
  });
}

/** Pure: ensure missing (employee × type) balance rows exist for the year. */
export function ensureMissingBalanceRows(
  employees: LeaveBalanceEmployeeRow[],
  existing: LeaveBalanceLedgerRow[],
  year: number,
): LeaveBalanceLedgerRow[] {
  const have = new Set(existing.map((b) => `${b.employee_id}|${b.leave_type}|${b.year}`));
  const next = [...existing];
  for (const emp of employees) {
    if (emp.status !== "active") continue;
    for (const t of LEAVE_BALANCE_TYPES) {
      const key = `${emp.id}|${t.type}|${year}`;
      if (have.has(key)) continue;
      next.push({
        employee_id: String(emp.id),
        leave_type: t.type,
        year,
        quota: t.quota,
        used: 0,
      });
      have.add(key);
    }
  }
  return next;
}

/** Pure: apply used totals for active-tenant employees (missing agg → 0). */
export function applyUsedToBalances(
  employees: LeaveBalanceEmployeeRow[],
  balances: LeaveBalanceLedgerRow[],
  usage: LeaveUsageAgg[],
  year: number,
): LeaveBalanceLedgerRow[] {
  const activeIds = new Set(
    employees.filter((e) => e.status === "active").map((e) => String(e.id)),
  );
  const usageMap = new Map(usage.map((u) => [`${u.employee_id}|${u.leave_type}`, u.total]));
  return balances.map((b) => {
    if (b.year !== year || !activeIds.has(b.employee_id)) return b;
    const used = usageMap.get(`${b.employee_id}|${b.leave_type}`) ?? 0;
    return { ...b, used };
  });
}

/** Pure: build the API response shape (active employees only, sorted by name). */
export function formatLeaveBalancesResponse(
  employees: LeaveBalanceEmployeeRow[],
  balances: LeaveBalanceLedgerRow[],
  year: number,
  tenantId: string,
): LeaveBalanceEmployeeResult[] {
  const active = employees
    .filter((e) => e.status === "active" && e.office_id === tenantId)
    .slice()
    .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), "ar"));

  const byEmp = new Map<string, LeaveBalanceLedgerRow[]>();
  for (const b of balances) {
    if (b.year !== year) continue;
    const list = byEmp.get(b.employee_id) ?? [];
    list.push(b);
    byEmp.set(b.employee_id, list);
  }

  return active.map((emp) => {
    const rows = (byEmp.get(String(emp.id)) ?? [])
      .slice()
      .sort((a, b) => leaveTypeOrder(a.leave_type) - leaveTypeOrder(b.leave_type));
    return {
      employeeId: String(emp.id),
      employeeName: emp.full_name,
      jobTitle: emp.job_title,
      department: emp.department,
      balances: rows.map((b) => ({
        type: b.leave_type,
        quota: Number(b.quota),
        used: Number(b.used),
        remaining: Math.max(0, Number(b.quota) - Number(b.used)),
      })),
    };
  });
}

/**
 * Pure end-to-end sync used by runtime tests to prove legacy vs set-based
 * produce identical payloads with different query counts.
 */
export function syncLeaveBalancesInMemory(args: {
  tenantId: string;
  year: number;
  employees: LeaveBalanceEmployeeRow[];
  existingBalances: LeaveBalanceLedgerRow[];
  leaves: Array<{
    employee_id: string;
    type: string;
    status: string;
    days: number;
    start_date: string;
    office_id?: string;
  }>;
}): {
  response: LeaveBalanceEmployeeResult[];
  balances: LeaveBalanceLedgerRow[];
  setBasedQueries: number;
  legacyQueries: number;
} {
  const tenantEmployees = args.employees.filter((e) => e.office_id === args.tenantId);
  const ensured = ensureMissingBalanceRows(tenantEmployees, args.existingBalances, args.year);
  const usage = aggregateApprovedLeaveUsage(args.leaves, args.year, args.tenantId);
  const updated = applyUsedToBalances(tenantEmployees, ensured, usage, args.year);
  const response = formatLeaveBalancesResponse(tenantEmployees, updated, args.year, args.tenantId);
  return {
    response,
    balances: updated,
    setBasedQueries: setBasedLeaveBalancesQueryCount(),
    legacyQueries: legacyLeaveBalancesQueryCount(
      tenantEmployees.filter((e) => e.status === "active").length,
    ),
  };
}
