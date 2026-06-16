/**
 * Financial Event Engine — محرك الأحداث المالية
 *
 * كل حدث مالي → قيود محاسبية تلقائية في office_erp_ledger
 *
 * الأحداث المدعومة:
 *   INVOICE_CREATED   → مدين: ذمم مدينة  ← دائن: إيرادات
 *   INVOICE_PAID      → مدين: صندوق/بنك  ← دائن: ذمم مدينة
 *   EXPENSE_RECORDED  → مدين: مصروفات    ← دائن: صندوق/بنك
 *   PAYROLL_PAID      → مدين: رواتب      ← دائن: بنك
 *   PAYMENT_RECEIVED  → مدين: صندوق/بنك  ← دائن: ذمم مدينة
 *   REFUND_ISSUED     → مدين: ذمم مدينة  ← دائن: صندوق
 */
import { postDoubleEntry } from "./erp-ledger";

export type FinancialEventType =
  | "INVOICE_CREATED"
  | "INVOICE_PAID"
  | "EXPENSE_RECORDED"
  | "PAYROLL_PAID"
  | "PAYMENT_RECEIVED"
  | "REFUND_ISSUED";

export interface FinancialEvent {
  officeId:      string;
  type:          FinancialEventType;
  amount:        number;
  currency?:     string;
  referenceId?:  string;
  description?:  string;
  paymentMethod?: "cash" | "bank" | "transfer";
  category?:     string;
  entryDate?:    string;
  postedBy?:     string;
}

/* ── Account definitions ─────────────────────────────────────────────────── */
const ACCOUNTS = {
  AR:       { code: "1200", name: "ذمم مدينة — عملاء", type: "Asset" },
  CASH:     { code: "1110", name: "الصندوق", type: "Asset" },
  BANK:     { code: "1120", name: "البنك الرئيسي", type: "Asset" },
  REVENUE:  { code: "4100", name: "إيرادات الأتعاب", type: "Revenue" },
  EXPENSE:  { code: "6500", name: "مصروفات تشغيلية", type: "Expense" },
  SALARIES: { code: "6100", name: "مصروفات الرواتب", type: "Expense" },
  REFUND:   { code: "4900", name: "مردودات ومسموحات", type: "Revenue" },
} as const;

function cashOrBank(method?: string) {
  return method === "bank" || method === "transfer" ? ACCOUNTS.BANK : ACCOUNTS.CASH;
}

function revenueAccount(category?: string) {
  switch (category) {
    case "أتعاب قضائية":   return { code: "4100", name: "أتعاب قضائية", type: "Revenue" };
    case "أتعاب استشارية": return { code: "4200", name: "أتعاب استشارية", type: "Revenue" };
    case "أتعاب عقود":     return { code: "4300", name: "أتعاب عقود وتوثيق", type: "Revenue" };
    default:                 return ACCOUNTS.REVENUE;
  }
}

function expenseAccount(category?: string) {
  switch (category) {
    case "رواتب":     return { code: "6100", name: "مصروفات الرواتب", type: "Expense" };
    case "إيجار":     return { code: "6200", name: "مصروفات الإيجار", type: "Expense" };
    case "اتصالات":  return { code: "6300", name: "مصروفات الاتصالات", type: "Expense" };
    case "قرطاسية":  return { code: "6400", name: "قرطاسية ومستلزمات", type: "Expense" };
    default:           return ACCOUNTS.EXPENSE;
  }
}

/* ── Main dispatcher ─────────────────────────────────────────────────────── */
export async function recordFinancialEvent(event: FinancialEvent): Promise<{ pairId: string } | null> {
  if (!event.officeId || event.officeId === "platform") return null;
  if (!event.amount || event.amount <= 0) return null;

  const base = {
    officeId:     event.officeId,
    amount:       event.amount,
    currency:     event.currency ?? "SAR",
    referenceId:  event.referenceId,
    description:  event.description,
    entryDate:    event.entryDate,
    postedBy:     event.postedBy,
  };

  try {
    switch (event.type) {
      case "INVOICE_CREATED":
        // Debit: AR ← Credit: Revenue
        return await postDoubleEntry({
          ...base, referenceType: "invoice",
          debit: ACCOUNTS.AR, credit: revenueAccount(event.category),
        });

      case "INVOICE_PAID":
      case "PAYMENT_RECEIVED":
        // Debit: Cash/Bank ← Credit: AR
        return await postDoubleEntry({
          ...base, referenceType: "payment",
          debit: cashOrBank(event.paymentMethod), credit: ACCOUNTS.AR,
        });

      case "EXPENSE_RECORDED":
        // Debit: Expense ← Credit: Cash/Bank
        return await postDoubleEntry({
          ...base, referenceType: "expense",
          debit: expenseAccount(event.category), credit: cashOrBank(event.paymentMethod),
        });

      case "PAYROLL_PAID":
        // Debit: Salaries ← Credit: Bank
        return await postDoubleEntry({
          ...base, referenceType: "payroll",
          debit: ACCOUNTS.SALARIES, credit: ACCOUNTS.BANK,
        });

      case "REFUND_ISSUED":
        // Debit: Revenue (reversal) ← Credit: Cash
        return await postDoubleEntry({
          ...base, referenceType: "refund",
          debit: ACCOUNTS.REFUND, credit: cashOrBank(event.paymentMethod),
        });

      default:
        return null;
    }
  } catch {
    return null; // Non-fatal — main data is already saved in source table
  }
}
