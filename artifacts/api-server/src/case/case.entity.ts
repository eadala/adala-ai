/**
 * Case Entity — النواة
 * نظام إدارة القضايا الجديد
 */

export type CaseStatus   = "open" | "in_progress" | "closed";
export type CaseType     = "criminal" | "civil" | "commercial" | "labor" | "real_estate";
export type CaseSource   = "manual" | "store" | "marketplace" | "portal";

export interface CaseEntity {
  id:          string;
  officeId:    string;
  title:       string;
  description?: string;
  caseType:    CaseType;
  status:      CaseStatus;
  clientName?: string;
  assignedTo?: string;
  source:      CaseSource;
  storeOrderId?: string;
  createdBy?:  string;
  createdAt:   Date;
  updatedAt:   Date;
  version:     number;
  deletedAt?:  Date | null;
}

export interface CreateCaseInput {
  title:        string;
  description?: string;
  caseType:     CaseType;
  status?:      CaseStatus;
  clientName?:  string;
  assignedTo?:  string;
  source?:      CaseSource;
  createdBy?:   string;
}

export interface UpdateCaseInput {
  title?:       string;
  description?: string;
  caseType?:    CaseType;
  status?:      CaseStatus;
  clientName?:  string;
  assignedTo?:  string;
  version?:     number;
}

export interface CaseFilters {
  status?:         CaseStatus;
  caseType?:       CaseType;
  search?:         string;
  limit?:          number;
  offset?:         number;
  assignedUserId?: string;
}

/* ── Labels for Arabic UI ── */
export const STATUS_LABELS: Record<CaseStatus, string> = {
  open:        "مفتوحة",
  in_progress: "قيد التنفيذ",
  closed:      "مغلقة",
};

export const TYPE_LABELS: Record<CaseType, string> = {
  criminal:    "جنائية",
  civil:       "مدنية",
  commercial:  "تجارية",
  labor:       "عمالية",
  real_estate: "عقارية",
};
