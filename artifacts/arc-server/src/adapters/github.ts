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

export type GithubObservationMeta = {
  source: string;
  retrievalTimestamp: string;
  sourceIdentifier: string;
  verificationStatus: Observation<unknown>["state"];
  commitSha: string | null;
  cacheAgeMs: number;
};

/**
 * GitHub read-only adapter.
 * Prefer fixture when ARC_GITHUB_MODE=fixture (default Phase 2B).
 * Live reads only with token + allowlisted repo; never mutates.
 */
export class GithubReadAdapter implements GithubAdapter {
  readonly name = "github";
  private mode: "fixture" | "live";

  constructor() {
    this.mode =
      (process.env.ARC_GITHUB_MODE ?? "fixture").toLowerCase() === "live"
        ? "live"
        : "fixture";
  }

  /** Explicit: no mutation surface */
  assertReadOnly(): void {
    /* Intentionally empty — class has no deploy/mutate methods */
  }

  async getRepository(): Promise<
    Observation<{ fullName: string; defaultBranch: string; allowAutoMerge: boolean }>
  > {
    if (this.mode === "live" && ALLOWED_REPOS.has("eadala/adala-ai")) {
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

  async listOpenPullRequests(): Promise<Observation<GithubPrSummary[]>> {
    if (this.mode === "live") {
      const live = await this.apiGet(`/repos/eadala/adala-ai/pulls?state=open&per_page=20`);
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
        };
      }
    }
    return {
      value: [
        {
          number: 9999,
          title: "[fixture] ARC Phase 2B",
          state: "open",
          merged: false,
          headSha: "df7a79eb9ad7bceb20831282a71659e43c7515a6",
          baseRef: "main",
        },
      ],
      state: "UNVERIFIED",
      source: "github-fixture",
      observedAt: new Date().toISOString(),
      note: "Fixture PR list",
    };
  }

  async getCommitStatus(sha: string): Promise<Observation<GithubCheckSummary[]>> {
    if (this.mode === "live") {
      const live = await this.apiGet(
        `/repos/eadala/adala-ai/commits/${encodeURIComponent(sha)}/check-runs?per_page=20`,
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
      note: `Fixture checks for ${sha.slice(0, 8)} — workflow success ≠ release approval`,
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
        `/repos/eadala/adala-ai/pulls/${prNumber}/reviews?per_page=20`,
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

  /** SSRF probe helper for tests */
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
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "adalah-arc-phase2b",
    };
    const token = process.env.ARC_GITHUB_TOKEN?.trim();
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await safeFetchJson(`${API}${path}`, {
      allowOrigins: githubAllowOrigins(),
      headers,
      timeoutMs: 8000,
    });
    if (!r.ok) {
      return { ok: false, error: String(redactSecrets(r.error)) };
    }
    if (r.status === 401 || r.status === 403) {
      return { ok: false, error: `auth_or_permission_${r.status}` };
    }
    return { ok: true, json: r.json };
  }
}

export const githubAdapter = new GithubReadAdapter();
