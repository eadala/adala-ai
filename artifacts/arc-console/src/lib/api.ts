const BASE = "/api/arc";

export async function arcGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`ARC API ${path} → HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type EvidenceState =
  | "VERIFIED"
  | "UNVERIFIED"
  | "DEGRADED"
  | "FAILED"
  | "STALE"
  | "UNAVAILABLE";

export type GateResult =
  | "PASS"
  | "FAIL"
  | "BLOCKED"
  | "NOT_RUN"
  | "UNVERIFIED"
  | "EXPIRED";
