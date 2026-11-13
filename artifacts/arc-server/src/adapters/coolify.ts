import type {
  DeploymentHistoryItem,
  DeploymentProviderAdapter,
  DeploymentProviderCapabilities,
  ProviderApplication,
} from "./types.js";
import { unavailableNull, unverifiedNull } from "./types.js";
import type { Observation } from "../lib/types.js";

/**
 * CoolifyAdapter — Phase 1.
 * Default mode: mock (no credentials).
 * Live mode: if ARC_COOLIFY_BASE_URL + ARC_COOLIFY_TOKEN set, attempts read-only fetch;
 * on failure returns UNAVAILABLE/UNVERIFIED — never fabricates SHA/digest.
 * executeDeploy is NEVER enabled.
 */
export class CoolifyAdapter implements DeploymentProviderAdapter {
  readonly name = "coolify";
  private mode: "mock" | "live-attempt";

  constructor() {
    const base = process.env.ARC_COOLIFY_BASE_URL?.trim();
    const token = process.env.ARC_COOLIFY_TOKEN?.trim();
    this.mode = base && token ? "live-attempt" : "mock";
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

  async listApplications(): Promise<Observation<ProviderApplication[]>> {
    if (this.mode === "live-attempt") {
      return unavailableNull(
        "coolify-api",
        "Live Coolify credentials present but Phase 1 uses safe mock until operator verifies topology",
      );
    }
    const mockApp = this.mockApplication();
    return {
      value: [mockApp],
      state: "UNVERIFIED",
      source: "coolify-mock",
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

  async listDeployments(appId: string): Promise<Observation<DeploymentHistoryItem[]>> {
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
      source: "coolify-mock",
      observedAt: new Date().toISOString(),
      note: "Deployment history unavailable without Coolify operator evidence",
    };
  }

  private mockApplication(): ProviderApplication {
    return {
      id: "coolify-app-adala-mock",
      name: "Adalah AI (mock — not live Coolify)",
      repository: {
        value: "eadala/adala-ai",
        state: "UNVERIFIED",
        source: "coolify-mock+docs",
        observedAt: new Date().toISOString(),
        note: "Documented repository; live Coolify Source panel not read",
      },
      watchedBranch: {
        value: "main",
        state: "UNVERIFIED",
        source: "DEPLOY.md documentation",
        observedAt: new Date().toISOString(),
        note: "Docs say main — live UNVERIFIED",
      },
      autoDeploy: {
        value: "UNKNOWN",
        state: "UNVERIFIED",
        source: "coolify-mock",
        observedAt: new Date().toISOString(),
      },
      runningCommitSha: unverifiedNull(
        "coolify-mock",
        "Never display inferred fingerprint as VERIFIED",
      ),
      imageDigest: unverifiedNull("coolify-mock"),
      lastSuccessfulDeployAt: unverifiedNull("coolify-mock"),
      health: {
        value: "apex healthz observed separately via public probe",
        state: "UNVERIFIED",
        source: "coolify-mock",
        observedAt: new Date().toISOString(),
      },
    };
  }
}

export const coolifyAdapter = new CoolifyAdapter();
