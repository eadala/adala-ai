/**
 * GitHub REST API client — uses GITHUB_TOKEN (PAT or fine-grained token).
 * GitHub API client for Deployment Center.
 */

const GITHUB_API = "https://api.github.com";

export interface GitHubRepo {
  full_name:        string;
  default_branch:   string;
  description:      string | null;
  stargazers_count: number;
  forks_count:      number;
  open_issues_count: number;
  visibility:       string;
  language:         string | null;
  html_url:         string;
}

export interface GitHubCommit {
  sha:     string;
  message: string;
  author:  string;
  date:    string;
  url:     string;
}

export interface GitHubPR {
  number: number;
  title:  string;
  state:  string;
  user:   string;
  url:    string;
}

export interface GitHubBranch {
  name:      string;
  protected: boolean;
  sha:       string;
}

function getGitHubToken(): string | null {
  const token = process.env.GITHUB_TOKEN?.trim();
  return token || null;
}

async function githubFetch<T>(path: string): Promise<T | null> {
  const token = getGitHubToken();
  if (!token) return null;

  try {
    const res = await fetch(`${GITHUB_API}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "adala-api-server",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchGitHubRepo(owner: string, repo: string): Promise<GitHubRepo | null> {
  const data = await githubFetch<Record<string, unknown>>(`/repos/${owner}/${repo}`);
  if (!data || data.message) return null;
  return {
    full_name:         String(data.full_name ?? `${owner}/${repo}`),
    default_branch:    String(data.default_branch ?? "main"),
    description:       (data.description as string | null) ?? null,
    stargazers_count:  Number(data.stargazers_count ?? 0),
    forks_count:       Number(data.forks_count ?? 0),
    open_issues_count: Number(data.open_issues_count ?? 0),
    visibility:        String(data.visibility ?? "private"),
    language:          (data.language as string | null) ?? null,
    html_url:          String(data.html_url ?? ""),
  };
}

export async function fetchLatestCommits(owner: string, repo: string, perPage = 10): Promise<GitHubCommit[]> {
  const data = await githubFetch<Record<string, unknown>[]>(
    `/repos/${owner}/${repo}/commits?per_page=${perPage}`
  );
  if (!Array.isArray(data)) return [];
  return data.map((c) => ({
    sha:     String(c.sha ?? "").slice(0, 7),
    message: String((c.commit as any)?.message ?? "").split("\n")[0].slice(0, 80),
    author:  (c.commit as any)?.author?.name ?? (c.author as any)?.login ?? "unknown",
    date:    (c.commit as any)?.author?.date ?? new Date().toISOString(),
    url:     String(c.html_url ?? ""),
  }));
}

export async function fetchOpenPRs(owner: string, repo: string): Promise<GitHubPR[]> {
  const data = await githubFetch<Record<string, unknown>[]>(
    `/repos/${owner}/${repo}/pulls?state=open&per_page=5`
  );
  if (!Array.isArray(data)) return [];
  return data.map((p) => ({
    number: Number(p.number),
    title:  String(p.title ?? "").slice(0, 60),
    state:  String(p.state ?? "open"),
    user:   (p.user as any)?.login ?? "unknown",
    url:    String(p.html_url ?? ""),
  }));
}

export async function fetchBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
  const data = await githubFetch<Record<string, unknown>[]>(
    `/repos/${owner}/${repo}/branches?per_page=10`
  );
  if (!Array.isArray(data)) return [];
  return data.map((b) => ({
    name:      String(b.name ?? ""),
    protected: Boolean(b.protected),
    sha:       String((b.commit as any)?.sha ?? "").slice(0, 7),
  }));
}

export function parseRepo(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = (fullName ?? "eadala/adala-ai").split("/");
  return { owner: owner ?? "eadala", repo: repo ?? "adala-ai" };
}
