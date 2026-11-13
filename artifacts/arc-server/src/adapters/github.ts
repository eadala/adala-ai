import type { GithubAdapter, GithubCheckSummary, GithubPrSummary } from "./types.js";
import type { Observation } from "../lib/types.js";

/**
 * GitHub read-only adapter.
 * Default: fixture data reflecting last known public API observations.
 * Optional: ARC_GITHUB_TOKEN for live reads (never exposed to browser).
 */
export class GithubReadAdapter implements GithubAdapter {
  readonly name = "github";

  async getRepository(): Promise<
    Observation<{ fullName: string; defaultBranch: string; allowAutoMerge: boolean }>
  > {
    const live = await this.tryFetch("https://api.github.com/repos/eadala/adala-ai");
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
    return {
      value: {
        fullName: "eadala/adala-ai",
        defaultBranch: "main",
        allowAutoMerge: true,
      },
      state: "UNVERIFIED",
      source: "github-fixture",
      observedAt: new Date().toISOString(),
      note: live.error,
    };
  }

  async getBranchProtection(
    branch: string,
  ): Promise<
    Observation<{ protected: boolean; requiredChecks: string[]; enforcement: string }>
  > {
    /* Public branch endpoint often returns protection summary without admin token */
    const live = await this.tryFetch(
      `https://api.github.com/repos/eadala/adala-ai/branches/${encodeURIComponent(branch)}`,
    );
    if (live.ok) {
      const j = live.json as {
        protected?: boolean;
        protection?: {
          enabled?: boolean;
          required_status_checks?: {
            contexts?: string[];
            enforcement_level?: string;
          };
        };
      };
      const contexts = j.protection?.required_status_checks?.contexts ?? [];
      return {
        value: {
          protected: !!j.protected,
          requiredChecks: contexts,
          enforcement: j.protection?.required_status_checks?.enforcement_level ?? "unknown",
        },
        state: "VERIFIED",
        source: "github-api",
        observedAt: new Date().toISOString(),
      };
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
        note: live.error,
      };
    }
    return {
      value: {
        protected: true,
        requiredChecks: [],
        enforcement: "non_admins",
      },
      state: "UNVERIFIED",
      source: "github-fixture",
      observedAt: new Date().toISOString(),
      note: live.error,
    };
  }

  async listOpenPullRequests(): Promise<Observation<GithubPrSummary[]>> {
    const live = await this.tryFetch(
      "https://api.github.com/repos/eadala/adala-ai/pulls?state=open&per_page=20",
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
      };
    }
    return {
      value: [],
      state: "UNVERIFIED",
      source: "github-fixture",
      observedAt: new Date().toISOString(),
      note: live.ok ? "unexpected payload" : live.error,
    };
  }

  async getCommitStatus(sha: string): Promise<Observation<GithubCheckSummary[]>> {
    const live = await this.tryFetch(
      `https://api.github.com/repos/eadala/adala-ai/commits/${encodeURIComponent(sha)}/check-runs?per_page=20`,
    );
    if (live.ok) {
      const runs = (live.json as { check_runs?: Array<Record<string, unknown>> }).check_runs ?? [];
      const value = runs.map((r) => ({
        name: String(r.name),
        status: String(r.status),
        conclusion: r.conclusion == null ? null : String(r.conclusion),
      }));
      return {
        value,
        state: "VERIFIED",
        source: "github-api",
        observedAt: new Date().toISOString(),
      };
    }
    return {
      value: [],
      state: "UNVERIFIED",
      source: "github-fixture",
      observedAt: new Date().toISOString(),
      note: `No CI checks loaded for ${sha.slice(0, 8)}: ${live.ok ? "" : live.error}`,
    };
  }

  private async tryFetch(
    url: string,
  ): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
    try {
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "adalah-arc-phase1",
      };
      const token = process.env.ARC_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}` };
      }
      return { ok: true, json: await res.json() };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "fetch failed" };
    }
  }
}

export const githubAdapter = new GithubReadAdapter();
