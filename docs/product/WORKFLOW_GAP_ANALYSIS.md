# Workflow Gap Analysis — Customer Zero

---

## Day 0 — Company Onboarding

| Step | Expected | Actual | Gap | Priority |
|------|----------|--------|-----|----------|
| Register / sign in | Clerk SSO | ✅ Works | — | — |
| Create tenant | Auto trial office | ✅ `trialOnboarding` | Enterprise uses `office_registry` — not obvious | P2 |
| Configure office | Name, specialty, size | ✅ Wizard step 1 | AI suggest needs Gemini key | P3 |
| First case | Optional seed case | ✅ Step 2 | Skip path works | — |
| Invite team | Email invitation | ✅ Step 3 + `/api/rbac/invitations` | Resend now requires `users:create` | — |
| Assign roles | Role picker | ✅ `/team` | Existing DB roles not auto-updated (sync inserts only) | P2 |
| Understand permissions | Clear role matrix | ⚠️ Partial | No in-app SoD view | P2 |

**Administrator clarity:** 7/10 — wizard is intuitive; enterprise billing path unclear.

---

## Day 1 — Partner

| Workflow | Status | Gap |
|----------|--------|-----|
| Dashboard overview | ✅ | JLWM widgets heavy for SMB |
| Manage users | ✅ | Fixed enumeration leak |
| Review cases | ✅ | — |
| Approve payroll | ✅ | `payroll:manage` |
| HR admin | ✅ | Fixed `hr:manage` for office_manager |
| Audit logs | ⚠️ | Needs `audit:view` (owner only) |

---

## Day 1 — Lawyer

| Workflow | Status | Gap |
|----------|--------|-----|
| Create matter | ✅ | `cases:create` |
| Client lookup | ✅ | `clients:view` |
| Upload documents | ✅ | `documents:upload` |
| AI copilot | ✅ | Feature + `ai:access` |
| View invoices | ✅ | `invoices:view` |
| Create invoices | ❌ | Lawyer lacks `invoices:create` (by design) |

---

## Day 1 — Assistant (Secretary)

| Workflow | Status | Gap |
|----------|--------|-----|
| Client intake | ✅ | `clients:create` |
| Document prep | ✅ | `documents:upload` |
| Case edit | ❌ | No `cases:edit` — may need `cases:edit` for filing | P2 |
| Finance visibility | ❌ | Correctly hidden | — |
| HR attendance | ✅ | `dashboard:view` for check-in |

---

## Day 1 — Accountant

| Workflow | Status | Gap |
|----------|--------|-----|
| Create invoices | ✅ | — |
| Record payments | ✅ | Fixed payments RBAC |
| Accounting entries | ✅ | `financial:view` |
| Delete accounting records | ❌ | `accounting:delete` owner-only (SoD) | — |
| Payroll run | ⚠️ | View only — correct SoD |

---

## Day 1 — HR (Office Manager)

| Workflow | Status | Gap |
|----------|--------|-----|
| Employee CRUD | ✅ | Fixed `hr:manage` |
| Leave approval | ✅ | `hr:manage` on PATCH |
| Leave request (self) | ✅ | `dashboard:view` on POST |
| Attendance reports | ✅ | — |
| HR enterprise module | ⚠️ | Parallel unguarded system | P1 |
| Performance reviews | ❌ | `hrPerformance.ts` unguarded | P1 |

---

## Enterprise Quality Gaps

| Area | Finding | Priority |
|------|---------|----------|
| Auditability | RBAC changes logged; not all financial mutations audited | P2 |
| Reliability | In-memory tenant freeze lost on restart | P1 |
| Performance | No load test at 35 cases / 20 clients scale | P2 |
| Data consistency | `users.office_id` vs `office_members` dual source | P1 |
| Permission clarity | Nav hides items but no "why denied" message | P2 |

---

## AI Experience Gaps

| Area | Finding | Priority |
|------|---------|----------|
| Discoverability | AI hub buried in large sidebar | P2 |
| Limits | Credits shown inconsistently | P2 |
| Output actionability | Case analyze links exist | — |
| Trust | SA bypass logged; impersonation disables bypass | — |
| Abuse | No per-user AI rate limit beyond credits | P2 |
