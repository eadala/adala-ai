import type { EvidenceState, Observation } from "../lib/types.js";

export type DeploymentProviderCapabilities = {
  listApplications: boolean;
  readConfig: boolean;
  readWatchedBranch: boolean;
  readDeployments: boolean;
  readImageMetadata: boolean;
  readHealth: boolean;
  /** Phase 1: always false */
  executeDeploy: boolean;
};

export type ProviderApplication = {
  id: string;
  name: string;
  repository: Observation<string>;
  watchedBranch: Observation<string>;
  autoDeploy: Observation<"ON" | "OFF" | "PAUSED" | "UNKNOWN">;
  runningCommitSha: Observation<string>;
  imageDigest: Observation<string>;
  lastSuccessfulDeployAt: Observation<string>;
  health: Observation<string>;
};

export type DeploymentHistoryItem = {
  id: string;
  status: string;
  commitSha: Observation<string>;
  createdAt: Observation<string>;
  actor: Observation<string>;
};

export interface DeploymentProviderAdapter {
  readonly name: string;
  capabilities(): DeploymentProviderCapabilities;
  listApplications(): Promise<Observation<ProviderApplication[]>>;
  getApplication(id: string): Promise<Observation<ProviderApplication | null>>;
  listDeployments(appId: string): Promise<Observation<DeploymentHistoryItem[]>>;
}

export type GithubPrSummary = {
  number: number;
  title: string;
  state: string;
  merged: boolean;
  headSha: string;
  baseRef: string;
};

export type GithubCheckSummary = {
  name: string;
  status: string;
  conclusion: string | null;
};

export interface GithubAdapter {
  readonly name: string;
  getRepository(): Promise<Observation<{ fullName: string; defaultBranch: string; allowAutoMerge: boolean }>>;
  getBranchProtection(branch: string): Promise<Observation<{ protected: boolean; requiredChecks: string[]; enforcement: string }>>;
  listOpenPullRequests(): Promise<Observation<GithubPrSummary[]>>;
  getCommitStatus(sha: string): Promise<Observation<GithubCheckSummary[]>>;
}

export function unverifiedNull<T>(source: string, note?: string): Observation<T> {
  return {
    value: null,
    state: "UNVERIFIED" satisfies EvidenceState,
    source,
    observedAt: new Date().toISOString(),
    note,
  };
}

export function unavailableNull<T>(source: string, note?: string): Observation<T> {
  return {
    value: null,
    state: "UNAVAILABLE",
    source,
    observedAt: new Date().toISOString(),
    note,
  };
}
