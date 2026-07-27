/**
 * Set-based payroll generation helpers (POST /hr/payroll/generate).
 * Preserves legacy salary math while eliminating per-employee INSERT loops.
 */

export const PAYROLL_ALLOWANCE_RATE = 0.15;
export const PAYROLL_GOSI_RATE = 0.1;

export type PayrollGenerateEmployee = {
  id: string;
  salary: string | number | null;
  office_id: string;
  status: string;
};

export type PayrollAmounts = {
  baseSalary: number;
  allowances: number;
  deductions: number;
  gosi: number;
  netSalary: number;
};

export type ExistingPayrollKey = {
  employee_id: string;
  month: string;
  year: number;
};

/** Legacy: 1 employee SELECT + N INSERTs. */
export function legacyPayrollGenerateQueryCount(employeeCount: number): number {
  return 1 + employeeCount;
}

/** Set-based: one INSERT…SELECT…RETURNING (duplicate-safe via NOT EXISTS). */
export function setBasedPayrollGenerateQueryCount(): number {
  return 1;
}

export function computePayrollAmounts(salary: string | number | null | undefined): PayrollAmounts {
  const baseSalary = parseFloat(String(salary ?? "0")) || 0;
  const allowances = baseSalary * PAYROLL_ALLOWANCE_RATE;
  const deductions = 0;
  const gosi = baseSalary * PAYROLL_GOSI_RATE;
  const netSalary = baseSalary + allowances - deductions - gosi;
  return { baseSalary, allowances, deductions, gosi, netSalary };
}

export function payrollDuplicateKey(employeeId: string, month: string, year: number): string {
  return `${employeeId}|${month}|${year}`;
}

/** Active tenant employees without an existing payroll row for month/year. */
export function selectEmployeesForPayrollGenerate(args: {
  employees: PayrollGenerateEmployee[];
  existing: ExistingPayrollKey[];
  tenantId: string;
  month: string;
  year: number;
}): PayrollGenerateEmployee[] {
  const existingKeys = new Set(
    args.existing
      .filter((p) => p.month === args.month && Number(p.year) === args.year)
      .map((p) => payrollDuplicateKey(String(p.employee_id), p.month, Number(p.year))),
  );

  return args.employees.filter((e) => {
    if (e.status !== "active" || e.office_id !== args.tenantId) return false;
    return !existingKeys.has(payrollDuplicateKey(String(e.id), args.month, args.year));
  });
}

export function buildPayrollGenerateEntries(
  employees: PayrollGenerateEmployee[],
): Array<PayrollAmounts & { employee_id: string; status: "draft" }> {
  return employees.map((e) => ({
    employee_id: String(e.id),
    status: "draft" as const,
    ...computePayrollAmounts(e.salary),
  }));
}

export function buildPayrollGenerateResponse<T>(entries: T[]): {
  generated: number;
  entries: T[];
} {
  return { generated: entries.length, entries };
}

/**
 * Pure simulation of set-based generate for runtime tests:
 * same eligibility + amounts; query counts contrast legacy vs set-based.
 */
export function syncPayrollGenerateInMemory(args: {
  tenantId: string;
  month: string;
  year: number;
  employees: PayrollGenerateEmployee[];
  existing: ExistingPayrollKey[];
}): {
  response: {
    generated: number;
    entries: Array<PayrollAmounts & { employee_id: string; month: string; year: number; status: "draft" }>;
  };
  setBasedQueries: number;
  legacyQueries: number;
} {
  const eligible = selectEmployeesForPayrollGenerate(args);
  const entries = buildPayrollGenerateEntries(eligible).map((row) => ({
    ...row,
    month: args.month,
    year: args.year,
  }));
  const activeCount = args.employees.filter(
    (e) => e.status === "active" && e.office_id === args.tenantId,
  ).length;
  return {
    response: buildPayrollGenerateResponse(entries),
    setBasedQueries: setBasedPayrollGenerateQueryCount(),
    legacyQueries: legacyPayrollGenerateQueryCount(activeCount),
  };
}
