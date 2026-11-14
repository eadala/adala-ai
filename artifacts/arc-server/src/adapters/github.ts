import type { GithubAdapter, GithubCheckSummary, GithubPrSummary } from "./types.js";
import type { Observation } from "../lib/types.js";
import { githubAllowOrigins, safeFetchJson } from "./httpSafe.js";
import { redactSecrets } from "../lib/auditStore.js";

const ALLOWED_REPOS = new Set(
  (process.env.ARC_GITHUB_REPO_ALLOWLIST ?? "eadala/adala-ai")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

const API = "https://api.github.com";
const DEFAULT_PAGE_SIZE = Math.min(
  Number(process.env.ARC_GITHUB_PAGE_SIZE ?? 20),
  50,
);
const CACHE_TTL_MS = Number(process.env.ARC_GITHUB_CACHE_TTL_MS ?? 60_000);

export type GithubObservationMeta = {
  source: string;
  retrievalTimestamp: string;
  sourceIdentifier: string;
  verificationStatus: Observation<unknown>["state"];
  commitSha: string | null;
  cacheAgeMs: number;
};

type CacheEntry = { at: number; payload: unknown };

/**
 * GitHub read-only adapter — Phase 2C-1.
 * Live mode requires ARC_GITHUB_MODE=live + ARC_GITHUB_TOKEN (narrow scope).
 * Without authorized credentials, live verification is BLOCKED (fixture retained).
 */
export class GithubReadAdapter implements GithubAdapter {
  readonly name = "github";
  private mode: "fixture" | "live";
  /** Test/sim hooks */
  simulateRateLimit = false;
  simulateTimeout = false;
  private cache = new Map<string, CacheEntry>();

  constructor() {
    this.mode =
      (process.env.ARC_GITHUB_MODE ?? "fixture").toLowerCase() === "live"
        ? "live"
        : "fixture";
  }

  /** Test-only: switch adapter mode without reconstructing */
  setModeForTest(mode: "fixture" | "live"): void {
    this.mode = mode;
  }

  liveStatus(): { status: "fixture" | "live_ready" | "BLOCKED"; reason: string } {
    if (this.mode !== "live") {
      return {
        status: "fixture",
        reason: "ARC_GITHUB_MODE is not live — fixture validation only",
      };
    }
    if (!process.env.ARC_GITHUB_TOKEN?.trim()) {
      return {
        status: "BLOCKED",
        reason: "ARC_GITHUB_TOKEN missing — authorized read-only credential unavailable",
      };
    }
    return {
      status: "live_ready",
      reason: "Token present; repository allowlist still enforced",
    };
  }

  assertReadOnly(): void {
    /* no mutation methods */
  }

  assertRepoAllowed(fullName: string): boolean {
    return ALLOWED_REPOS.has(fullName);
  }

  /** Unauthorized repository access must fail closed */
  async getRepositoryFor(fullName: string): Promise<Observation<{ fullName: string }>> {
    if (!this.assertRepoAllowed(fullName)) {
      return {
        value: null,
        state: "UNAVAILABLE",
        source: "github-adapter",
        observedAt: new Date().toISOString(),
        note: "repository_not_allowlisted",
      };
    }
    const base = await this.getRepository();
    return {
      value: base.value ? { fullName: base.value.fullName } : null,
      state: base.state,
      source: base.source,
      observedAt: base.observedAt,
      note: base.note,
    };
  }

  withMeta<T>(
    obs: Observation<T>,
    sourceIdentifier: string,
    commitSha: string | null = null,
    cachedAt?: number,
  ): Observation<T> & { meta: GithubObservationMeta } {
    const now = Date.now();
    return {
      ...obs,
      meta: {
        source: obs.source,
        retrievalTimestamp: obs.observedAt,
        sourceIdentifier,
        verificationStatus: obs.state,
        commitSha,
        cacheAgeMs: cachedAt != null ? Math.max(0, now - cachedAt) : 0,
      },
    };
  }

  async getRepository(): Promise<
    Observation<{ fullName: string; defaultBranch: string; allowAutoMerge: boolean }>
  > {
    if (this.mode === "live" && this.assertRepoAllowed("eadala/adala-ai")) {
      const live = await this.apiGet(`/repos/eadala/adala-ai`);
      if (live.ok) {
        const j = live.json as {
          full_name: string;
          default_branch: string;
          allow_auto_merge: boolean;
        };
        return {
          value: {
            fullName: j.full_name,
            defaultBranch: j.default_branch,
            allowAutoMerge: !!j.allow_auto_merge,
          },
          state: "VERIFIED",
          source: "github-api",
          observedAt: new Date().toISOString(),
        };
      }
      if (live.error === "rate_limited") {
        return {
          value: null,
          state: "DEGRADED",
          source: "github-api",
          observedAt: new Date().toISOString(),
          note: "rate_limited",
        };
      }
      if (live.error === "timeout") {
        return {
          value: null,
          state: "UNAVAILABLE",
          source: "github-api",
          observedAt: new Date().toISOString(),
          note: "timeout",
        };
      }
    }
    return {
      value: {
        fullName: "eadala/adala-ai",
        defaultBranch: "main",
        allowAutoMerge: true,
      },
      state: "UNVERIFIED",
      source: "github-fixture",
      observedAt: new Date().toISOString(),
      note: "Fixture metadata — not live production evidence",
    };
  }

  async getBranchProtection(
    branch: string,
  ): Promise<
    Observation<{ protected: boolean; requiredChecks: string[]; enforcement: string }>
  > {
    if (this.mode === "live") {
      const live = await this.apiGet(
        `/repos/eadala/adala-ai/branches/${encodeURIComponent(branch)}`,
      );
      if (live.ok) {
        const j = live.json as {
          protected?: boolean;
          protection?: {
            required_status_checks?: {
              contexts?: string[];
              enforcement_level?: string;
            };
          };
        };
        return {
          value: {
            protected: !!j.protected,
            requiredChecks: j.protection?.required_status_checks?.contexts ?? [],
            enforcement:
              j.protection?.required_status_checks?.enforcement_level ?? "unknown",
          },
          state: "VERIFIED",
          source: "github-api",
          observedAt: new Date().toISOString(),
        };
      }
    }
    if (branch === "develop") {
      return {
        value: {
          protected: true,
          requiredChecks: [
            "Gate 1 — TypeScript",
            "Gate 2 — ESLint",
            "Gate 3 — Build & Bundle Budget",
            "Gate 4 — Security Scan",
          ],
          enforcement: "non_admins",
        },
        state: "UNVERIFIED",
        source: "github-fixture",
        observedAt: new Date().toISOString(),
      };
    }
    return {
      value: { protected: true, requiredChecks: [], enforcement: "non_admins" },
      state: "UNVERIFIED",
      source: "github-fixture",
      observedAt: new Date().toISOString(),
    };
  }

  async listOpenPullRequests(
    page = 1,
  ): Promise<Observation<GithubPrSummary[]> & { page: number; pageSize: number }> {
    const pageSize = DEFAULT_PAGE_SIZE;
    if (this.mode === "live") {
      const live = await this.apiGet(
        `/repos/eadala/adala-ai/pulls?state=open&per_page=${pageSize}&page=${page}`,
      );
      if (live.ok && Array.isArray(live.json)) {
        const value = (live.json as Array<Record<string, unknown>>).map((p) => ({
          number: p.number as number,
          title: p.title as string,
          state: p.state as string,
          merged: false,
          headSha: (p.head as { sha: string }).sha,
          baseRef: (p.base as { ref: string }).ref,
        }));
        return {
          value,
          state: "VERIFIED",
          source: "github-api",
          observedAt: new Date().toISOString(),
          page,
          pageSize,
        };
      }
    }
    return {
      value: [
        {
          number: 9999,
          title: "[fixture] ARC Phase 2C-1",
          state: "open",
          merged: false,
          headSha: "c9d4966516198ff15e36a9f4d1b51fb2617fda9d",
          baseRef: "main",
        },
      ],
      state: "UNVERIFIED",
      source: "github-fixture",
      observedAt: new Date().toISOString(),
      note: "Fixture PR list",
      page,
      pageSize,
    };
  }

  async getCommitStatus(sha: string): Promise<Observation<GithubCheckSummary[]>> {
    if (!/^[0-9a-f]{40}$/i.test(sha) && !/^[0-9a-f]{7,40}$/i.test(sha)) {
      return {
        value: null,
        state: "FAILED",
        source: "github-adapter",
        observedAt: new Date().toISOString(),
        note: "invalid_commit_sha",
      };
    }
    if (this.mode === "live") {
      const live = await this.apiGet(
        `/repos/eadala/adala-ai/commits/${encodeURIComponent(sha)}/check-runs?per_page=${DEFAULT_PAGE_SIZE}`,
      );
      if (live.ok) {
        const runs =
          (live.json as { check_runs?: Array<Record<string, unknown>> }).check_runs ?? [];
        return {
          value: runs.map((r) => ({
            name: String(r.name),
            status: String(r.status),
            conclusion: r.conclusion == null ? null : String(r.conclusion),
          })),
          state: "VERIFIED",
          source: "github-api",
          observedAt: new Date().toISOString(),
        };
      }
    }
    return {
      value: [
        { name: "Gate 1 — TypeScript", status: "completed", conclusion: "success" },
        { name: "Gate 4 — Security Scan", status: "completed", conclusion: "success" },
      ],
      state: "UNVERIFIED",
      source: "github-fixture",
      observedAt: new Date().toISOString(),
      note: `Fixture checks for ${sha.slice(0, 8)} — workflow success ≠ human review ≠ release approval ≠ deployed identity`,
    };
  }

  async verifyCommitImmutable(sha: string): Promise<
    Observation<{ sha: string; treeSha: string | null }>
  > {
    if (!/^[0-9a-f]{40}$/i.test(sha)) {
      return {
        value: null,
        state: "FAILED",
        source: "github-adapter",
        observedAt: new Date().toISOString(),
        note: "commit_sha_must_be_full_40_hex",
      };
    }
    if (this.mode === "live") {
      const live = await this.apiGet(`/repos/eadala/adala-ai/git/commits/${sha}`);
      if (live.ok) {
        const j = live.json as { sha?: string; tree?: { sha?: string } };
        return {
          value: { sha: String(j.sha ?? sha), treeSha: j.tree?.sha ?? null },
          state: "VERIFIED",
          source: "github-api",
          observedAt: new Date().toISOString(),
        };
      }
    }
    return {
      value: { sha, treeSha: null },
      state: "UNVERIFIED",
      source: "github-fixture",
      observedAt: new Date().toISOString(),
      note: "Fixture commit verify — tree SHA not live-attested",
    };
  }

  async getReleaseMetadata(tag?: string): Promise<
    Observation<{ tag: string; draft: boolean; prerelease: boolean; targetCommitish: string }>
  > {
    if (this.mode === "live") {
      const path = tag
        ? `/repos/eadala/adala-ai/releases/tags/${encodeURIComponent(tag)}`
        : `/repos/eadala/adala-ai/releases?per_page=1`;
      const live = await this.apiGet(path);
      if (live.ok) {
        const j = Array.isArray(live.json) ? live.json[0] : live.json;
        if (j && typeof j === "object") {
          const r = j as Record<string, unknown>;
          return {
            value: {
              tag: String(r.tag_name),
              draft: !!r.draft,
              prerelease: !!r.prerelease,
              targetCommitish: String(r.target_commitish),
            },
            state: "VERIFIED",
            source: "github-api",
            observedAt: new Date().toISOString(),
          };
        }
      }
    }
    return {
      value: null,
      state: "UNVERIFIED",
      source: "github-fixture",
      observedAt: new Date().toISOString(),
      note: "No release tag in fixture — UNVERIFIED",
    };
  }

  async getPullRequestReviews(prNumber: number): Promise<
    Observation<Array<{ user: string; state: string }>>
  > {
    if (this.mode === "live") {
      const live = await this.apiGet(
        `/repos/eadala/adala-ai/pulls/${prNumber}/reviews?per_page=${DEFAULT_PAGE_SIZE}`,
      );
      if (live.ok && Array.isArray(live.json)) {
        return {
          value: (live.json as Array<Record<string, unknown>>).map((r) => ({
            user: String((r.user as { login?: string })?.login ?? "unknown"),
            state: String(r.state),
          })),
          state: "VERIFIED",
          source: "github-api",
          observedAt: new Date().toISOString(),
        };
      }
    }
    return {
      value: [{ user: "fixture-reviewer", state: "APPROVED" }],
      state: "UNVERIFIED",
      source: "github-fixture",
      observedAt: new Date().toISOString(),
      note: "Human review fixture — distinct from workflow success",
    };
  }

  /**
   * GitHub must never be used to assert production deployed identity.
   */
  productionDeployedIdentityFromGithub(): Observation<{
    commitSha: string | null;
    imageDigest: string | null;
  }> {
    return {
      value: { commitSha: null, imageDigest: null },
      state: "UNVERIFIED",
      source: "policy",
      observedAt: new Date().toISOString(),
      note: "INV-005: deployed production identity is not inferred from GitHub",
    };
  }

  sanitizeForLog(input: unknown): unknown {
    return redactSecrets(input);
  }

  async probeUrl(url: string): Promise<{ allowed: boolean; error?: string }> {
    const r = await safeFetchJson(url, {
      allowOrigins: githubAllowOrigins(),
      timeoutMs: 2000,
    });
    if (!r.ok) return { allowed: false, error: r.error };
    return { allowed: true };
  }

  private async apiGet(
    path: string,
  ): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
    if (this.simulateRateLimit) return { ok: false, error: "rate_limited" };
    if (this.simulateTimeout) return { ok: false, error: "timeout" };

    const cacheKey = path;
    const hit = this.cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return { ok: true, json: hit.payload };
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "adalah-arc-phase2c1",
    };
    const token = process.env.ARC_GITHUB_TOKEN?.trim();
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await safeFetchJson(`${API}${path}`, {
      allowOrigins: githubAllowOrigins(),
      headers,
      timeoutMs: 8000,
    });
    if (!r.ok) {
      const err = String(redactSecrets(r.error));
      if (r.status === 403 && /rate/i.test(err)) return { ok: false, error: "rate_limited" };
      return { ok: false, error: err };
    }
    if (r.status === 401 || r.status === 403) {
      return { ok: false, error: `auth_or_permission_${r.status}` };
    }
    this.cache.set(cacheKey, { at: Date.now(), payload: r.json });
    return { ok: true, json: r.json };
  }
}

export const githubAdapter = new GithubReadAdapter();
