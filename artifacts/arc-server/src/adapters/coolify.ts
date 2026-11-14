import type {
  DeploymentHistoryItem,
  DeploymentProviderAdapter,
  DeploymentProviderCapabilities,
  ProviderApplication,
} from "./types.js";
import { unavailableNull, unverifiedNull } from "./types.js";
import type { Observation } from "../lib/types.js";
import { coolifyAllowedOrigins, safeFetchJson } from "./httpSafe.js";
import { redactSecrets } from "../lib/auditStore.js";

export type CoolifyFixtureMode =
  | "success"
  | "auth_failure"
  | "permission_failure"
  | "timeout"
  | "malformed"
  | "missing_fields"
  | "version_mismatch"
  | "rate_limit";

/**
 * Coolify read-only adapter — Phase 2B.
 * Default: versioned mock fixture. Never connects to production Coolify.
 * executeDeploy is NEVER enabled. No mutation methods.
 */
export class CoolifyAdapter implements DeploymentProviderAdapter {
  readonly name = "coolify";
  private mode: "mock" | "live-blocked";
  fixtureMode: CoolifyFixtureMode = "success";
  readonly apiVersionExpected = "v1";

  constructor() {
    /* Phase 2B: refuse live production Coolify even if creds present */
    const forceLive = (process.env.ARC_COOLIFY_ALLOW_LIVE ?? "").toLowerCase() === "true";
    const base = process.env.ARC_COOLIFY_BASE_URL?.trim();
    const token = process.env.ARC_COOLIFY_TOKEN?.trim();
    this.mode = forceLive && base && token ? "live-blocked" : "mock";
    /* live-blocked: credentials exist but Phase 2B still does not call production */
  }

  capabilities(): DeploymentProviderCapabilities {
    return {
      listApplications: true,
      readConfig: true,
      readWatchedBranch: true,
      readDeployments: true,
      readImageMetadata: true,
      readHealth: true,
      executeDeploy: false,
    };
  }

  /** Hard deny any mutation attempt */
  async executeDeploy(): Promise<never> {
    throw new Error("coolify_mutation_forbidden");
  }

  async listApplications(): Promise<Observation<ProviderApplication[]>> {
    const sim = this.simulateFixtureError<ProviderApplication[]>();
    if (sim) return sim;
    if (this.mode === "live-blocked") {
      return unavailableNull(
        "coolify-api",
        "Phase 2B blocks live Coolify production connections (ARC_COOLIFY_ALLOW_LIVE required + still reported UNVERIFIED)",
      );
    }
    return {
      value: [this.mockApplication()],
      state: "UNVERIFIED",
      source: "coolify-mock-v1",
      observedAt: new Date().toISOString(),
      note: "Synthetic fixture — production SHA/digest remain UNVERIFIED",
    };
  }

  async getApplication(id: string): Promise<Observation<ProviderApplication | null>> {
    const list = await this.listApplications();
    if (list.state !== "VERIFIED" && list.state !== "UNVERIFIED") {
      return { ...list, value: null };
    }
    const found = list.value?.find((a) => a.id === id) ?? null;
    return {
      value: found,
      state: found ? "UNVERIFIED" : "UNAVAILABLE",
      source: list.source,
      observedAt: new Date().toISOString(),
      note: list.note,
    };
  }

  async getEnvironmentMetadata(appId: string): Promise<
    Observation<{ name: string; apiVersion: string }>
  > {
    const sim = this.simulateFixtureError<{ name: string; apiVersion: string }>();
    if (sim) return sim;
    if (appId !== "coolify-app-adala-mock") {
      return unavailableNull("coolify-mock-v1", "Unknown application");
    }
    return {
      value: { name: "production-mock", apiVersion: this.apiVersionExpected },
      state: "UNVERIFIED",
      source: "coolify-mock-v1",
      observedAt: new Date().toISOString(),
    };
  }

  async listDeployments(appId: string): Promise<Observation<DeploymentHistoryItem[]>> {
    const sim = this.simulateFixtureError<DeploymentHistoryItem[]>();
    if (sim) return sim;
    if (appId !== "coolify-app-adala-mock") {
      return unavailableNull("coolify-mock", "Unknown application id");
    }
    return {
      value: [
        {
          id: "dep-mock-1",
          status: "unknown",
          commitSha: unverifiedNull("coolify-mock", "Running commit not attested"),
          createdAt: unverifiedNull("coolify-mock"),
          actor: unverifiedNull("coolify-mock"),
        },
      ],
      state: "UNVERIFIED",
      source: "coolify-mock-v1",
      observedAt: new Date().toISOString(),
      note: "Never infer production identity from branch or CI alone",
    };
  }

  async getDeploymentStatus(_appId: string, deploymentId: string): Promise<
    Observation<{ id: string; status: string }>
  > {
    const sim = this.simulateFixtureError<{ id: string; status: string }>();
    if (sim) return sim;
    return {
      value: { id: deploymentId, status: "unknown" },
      state: "UNVERIFIED",
      source: "coolify-mock-v1",
      observedAt: new Date().toISOString(),
    };
  }

  async getImageInfo(appId: string): Promise<Observation<{ digest: string | null }>> {
    void appId;
    return {
      value: { digest: null },
      state: "UNVERIFIED",
      source: "coolify-mock-v1",
      observedAt: new Date().toISOString(),
      note: "Image digest unavailable — report UNVERIFIED",
    };
  }

  async probeUserUrl(url: string): Promise<{ allowed: boolean; error?: string }> {
    const r = await safeFetchJson(url, {
      allowOrigins: coolifyAllowedOrigins(),
      timeoutMs: 2000,
      headers: { Authorization: "Bearer [never-logged]" },
    });
    if (!r.ok) return { allowed: false, error: String(redactSecrets(r.error)) };
    return { allowed: true };
  }

  private simulateFixtureError<T>(): Observation<T> | null {
    const ts = new Date().toISOString();
    switch (this.fixtureMode) {
      case "auth_failure":
        return {
          value: null,
          state: "UNAVAILABLE",
          source: "coolify-mock-v1",
          observedAt: ts,
          note: "authentication_failure",
        };
      case "permission_failure":
        return {
          value: null,
          state: "UNAVAILABLE",
          source: "coolify-mock-v1",
          observedAt: ts,
          note: "permission_denied",
        };
      case "timeout":
        return {
          value: null,
          state: "UNAVAILABLE",
          source: "coolify-mock-v1",
          observedAt: ts,
          note: "timeout",
        };
      case "malformed":
        return {
          value: null,
          state: "FAILED",
          source: "coolify-mock-v1",
          observedAt: ts,
          note: "malformed_response",
        };
      case "missing_fields":
        return {
          value: null,
          state: "UNVERIFIED",
          source: "coolify-mock-v1",
          observedAt: ts,
          note: "missing_fields",
        };
      case "version_mismatch":
        return {
          value: null,
          state: "UNVERIFIED",
          source: "coolify-mock-v1",
          observedAt: ts,
          note: "api_version_mismatch",
        };
      case "rate_limit":
        return {
          value: null,
          state: "DEGRADED",
          source: "coolify-mock-v1",
          observedAt: ts,
          note: "rate_limited",
        };
      default:
        return null;
    }
  }

  private mockApplication(): ProviderApplication {
    return {
      id: "coolify-app-adala-mock",
      name: "Adalah AI (mock — not live Coolify)",
      repository: {
        value: "eadala/adala-ai",
        state: "UNVERIFIED",
        source: "coolify-mock-v1",
        observedAt: new Date().toISOString(),
        note: "Documented repository; live Coolify Source panel not read",
      },
      watchedBranch: {
        value: "main",
        state: "UNVERIFIED",
        source: "coolify-mock-v1",
        observedAt: new Date().toISOString(),
        note: "Watched branch must not imply deployed commit",
      },
      autoDeploy: {
        value: "UNKNOWN",
        state: "UNVERIFIED",
        source: "coolify-mock-v1",
        observedAt: new Date().toISOString(),
      },
      runningCommitSha: unverifiedNull(
        "coolify-mock-v1",
        "Never display inferred fingerprint as VERIFIED",
      ),
      imageDigest: unverifiedNull("coolify-mock-v1"),
      lastSuccessfulDeployAt: unverifiedNull("coolify-mock-v1"),
      health: {
        value: "apex healthz observed separately via public probe",
        state: "UNVERIFIED",
        source: "coolify-mock-v1",
        observedAt: new Date().toISOString(),
      },
    };
  }
}

export const coolifyAdapter = new CoolifyAdapter();
