/**
 * GitHub Client via Replit Connectors SDK
 * ────────────────────────────────────────
 * يستخدم الاتصال الرسمي بـ GitHub عبر Replit Connectors
 * بدلاً من المفتاح الشخصي أو متغيرات البيئة.
 */

import { ReplitConnectors } from "@replit/connectors-sdk";

/* نُنشئ instance واحد لكل طلب (لا تخزين مؤقت — التوكن ينتهي) */
function getGitHubConnector() {
  return new ReplitConnectors();
}

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

/* ── Fetch repo info ─────────────────────────────────── */
export async function fetchGitHubRepo(owner: string, repo: string): Promise<GitHubRepo | null> {
  try {
    const connectors = getGitHubConnector();
    const res  = await connectors.proxy("github", `/repos/${owner}/${repo}`, { method: "GET" });
    const data = await res.json() as any;
    if (data?.message) return null; // e.g. "Not Found"
    return {
      full_name:        data.full_name        ?? `${owner}/${repo}`,
      default_branch:   data.default_branch   ?? "main",
      description:      data.description      ?? null,
      stargazers_count: data.stargazers_count  ?? 0,
      forks_count:      data.forks_count       ?? 0,
      open_issues_count: data.open_issues_count ?? 0,
      visibility:       data.visibility        ?? "private",
      language:         data.language          ?? null,
      html_url:         data.html_url          ?? "",
    };
  } catch { return null; }
}

/* ── Fetch latest commits ───────────────────────────── */
export async function fetchLatestCommits(owner: string, repo: string, perPage = 10): Promise<GitHubCommit[]> {
  try {
    const connectors = getGitHubConnector();
    const res  = await connectors.proxy("github", `/repos/${owner}/${repo}/commits?per_page=${perPage}`, { method: "GET" });
    const data = await res.json() as any[];
    if (!Array.isArray(data)) return [];
    return data.map(c => ({
      sha:     (c.sha as string).slice(0, 7),
      message: (c.commit?.message as string ?? "").split("\n")[0].slice(0, 80),
      author:  c.commit?.author?.name ?? c.author?.login ?? "unknown",
      date:    c.commit?.author?.date ?? new Date().toISOString(),
      url:     c.html_url ?? "",
    }));
  } catch { return []; }
}

/* ── Fetch open PRs ─────────────────────────────────── */
export async function fetchOpenPRs(owner: string, repo: string): Promise<GitHubPR[]> {
  try {
    const connectors = getGitHubConnector();
    const res  = await connectors.proxy("github", `/repos/${owner}/${repo}/pulls?state=open&per_page=5`, { method: "GET" });
    const data = await res.json() as any[];
    if (!Array.isArray(data)) return [];
    return data.map(p => ({
      number: p.number,
      title:  (p.title as string ?? "").slice(0, 60),
      state:  p.state ?? "open",
      user:   p.user?.login ?? "unknown",
      url:    p.html_url ?? "",
    }));
  } catch { return []; }
}

/* ── Fetch branches ─────────────────────────────────── */
export async function fetchBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
  try {
    const connectors = getGitHubConnector();
    const res  = await connectors.proxy("github", `/repos/${owner}/${repo}/branches?per_page=10`, { method: "GET" });
    const data = await res.json() as any[];
    if (!Array.isArray(data)) return [];
    return data.map(b => ({
      name:      b.name ?? "",
      protected: b.protected ?? false,
      sha:       (b.commit?.sha as string ?? "").slice(0, 7),
    }));
  } catch { return []; }
}

/* ── Parse owner/repo from full_name ─────────────────── */
export function parseRepo(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = (fullName ?? "adalah-ai/platform").split("/");
  return { owner: owner ?? "adalah-ai", repo: repo ?? "platform" };
}
