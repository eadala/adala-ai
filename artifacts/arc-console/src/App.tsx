import { useEffect, useState, type ReactNode } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { arcGet, type EvidenceState, type GateResult } from "./lib/api";
import { Badge } from "./components/Badge";

const NAV = [
  ["/", "Executive Overview"],
  ["/applications", "Applications"],
  ["/releases", "Releases"],
  ["/compare", "Release Comparison"],
  ["/gates", "Security Gates"],
  ["/approvals", "Approval Center"],
  ["/deployments", "Deployment History"],
  ["/monitoring", "Monitoring"],
  ["/incidents", "Incidents"],
  ["/backup", "Backup Readiness"],
  ["/audit", "Audit Trail"],
  ["/settings", "Settings"],
] as const;

function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");
  return (
    <div className="shell" dir={dir}>
      <aside className="nav">
        <h1 className="brand">Adalah Release Control</h1>
        <div className="brand-sub">ARC · Phase 1 read-only MVP</div>
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className={loc === href ? "active" : ""}>
            {label}
          </Link>
        ))}
        <button
          type="button"
          style={{
            marginTop: "1rem",
            border: "1px solid var(--line)",
            background: "white",
            borderRadius: 8,
            padding: "0.4rem 0.6rem",
            cursor: "pointer",
          }}
          onClick={() => setDir((d) => (d === "ltr" ? "rtl" : "ltr"))}
        >
          {dir === "ltr" ? "العربية RTL" : "English LTR"}
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

function OverviewPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    arcGet<Record<string, unknown>>("/overview")
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, []);
  if (err) return <p className="muted">{err}</p>;
  if (!data) return <p className="muted">Loading overview…</p>;
  const prodSha = data.productionCommitSha as {
    state: EvidenceState;
    value: string | null;
    source: string;
    observedAt: string;
    note?: string;
  };
  const coolify = data.coolify as { state: string; note?: string };
  const backup = data.backup as { readiness: GateResult; note: string };
  const mon = (data.monitoring as Array<{ metric: string; value: string | null; state: string; observedAt: string; source: string }>) ?? [];
  return (
    <>
      <h2 className="page-title">Executive Overview</h2>
      <p className="page-lead">
        Control plane for Adalah AI releases. Production-changing actions are disabled.
        Unknown production identity stays UNVERIFIED.
      </p>
      <div className="banner">
        Deployment execution: <strong>DISABLED</strong> · Coolify adapter: mock/
        {String(coolify?.state)} · Backup readiness: {backup?.readiness}
      </div>
      <div className="grid">
        <div className="card span-4 metric">
          <span className="label">Application</span>
          <strong>{(data.application as { name: string })?.name}</strong>
          <span className="muted">{(data.application as { domain: string })?.domain}</span>
        </div>
        <div className="card span-4 metric">
          <span className="label">Environment / Hosting</span>
          <strong>{(data.environment as { name: string })?.name}</strong>
          <span className="muted">
            {(data.environment as { hostingProvider: string })?.hostingProvider} ·{" "}
            {(data.environment as { deploymentProvider: string })?.deploymentProvider}
          </span>
        </div>
        <div className="card span-4 metric">
          <span className="label">Production Git SHA</span>
          <Badge state={prodSha.state} />
          <span className="value">{prodSha.value ?? "—"}</span>
          <span className="muted">
            {prodSha.source} · {prodSha.observedAt}
            {prodSha.note ? ` · ${prodSha.note}` : ""}
          </span>
        </div>
        <div className="card span-12">
          <h3>Operational signals</h3>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>State</th>
                <th>Source</th>
                <th>Observed</th>
              </tr>
            </thead>
            <tbody>
              {mon.map((m) => (
                <tr key={m.metric}>
                  <td>{m.metric}</td>
                  <td className="mono">{m.value ?? "—"}</td>
                  <td>
                    <Badge state={m.state} />
                  </td>
                  <td className="muted">{m.source}</td>
                  <td className="mono">{m.observedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ReleasesPage() {
  const [releases, setReleases] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    arcGet<{ releases: Array<Record<string, unknown>> }>("/releases").then((d) =>
      setReleases(d.releases),
    );
  }, []);
  return (
    <>
      <h2 className="page-title">Releases</h2>
      <p className="page-lead">Immutable commit/tree identities. Never deploy from mutable branch tips.</p>
      <div className="card span-12">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Commit</th>
              <th>Tree</th>
              <th>Image</th>
              <th>Review</th>
              <th>Deploy</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((r) => (
              <tr key={String(r.id)}>
                <td>{String(r.id)}</td>
                <td className="mono">{String(r.commitSha).slice(0, 12)}…</td>
                <td className="mono">{String(r.treeSha).slice(0, 12)}…</td>
                <td className="mono">{String(r.imageDigest ?? "UNVERIFIED")}</td>
                <td>
                  <Badge state={String(r.reviewStatus)} />
                </td>
                <td>{String(r.deploymentStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ComparePage() {
  const [cmp, setCmp] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    arcGet<Record<string, unknown>>("/releases/compare/rel-frozen-rc/rel-guc-rc").then(setCmp);
  }, []);
  if (!cmp) return <p className="muted">Loading comparison…</p>;
  const c = cmp.comparison as Record<string, unknown>;
  return (
    <>
      <h2 className="page-title">Release Comparison</h2>
      <p className="page-lead">Frozen historical RC vs modernized GUC security candidate.</p>
      <div className="grid">
        <div className="card span-6">
          <h3>Left (frozen)</h3>
          <div className="mono">{(cmp.left as { commitSha: string }).commitSha}</div>
        </div>
        <div className="card span-6">
          <h3>Right (proposed RC)</h3>
          <div className="mono">{(cmp.right as { commitSha: string }).commitSha}</div>
        </div>
        <div className="card span-12 stack">
          <div>Commit changed: {String(c.commitChanged)}</div>
          <div>Tree changed: {String(c.treeChanged)}</div>
          <div>
            Security: {(c.securityDelta as { to: string }).to}
          </div>
          <div>
            Database: {(c.databaseDelta as { to: string }).to}
          </div>
          <div>
            Risks added: {((c.knownRisksAdded as string[]) ?? []).join("; ") || "—"}
          </div>
        </div>
      </div>
    </>
  );
}

function GatesPage() {
  const [ev, setEv] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    arcGet<Record<string, unknown>>("/gates/rel-guc-rc").then(setEv);
  }, []);
  if (!ev) return <p className="muted">Evaluating gates…</p>;
  const gates = (ev.gates as Array<Record<string, unknown>>) ?? [];
  return (
    <>
      <h2 className="page-title">Security Gates</h2>
      <p className="page-lead">
        Policy {String(ev.policyVersion)} · Deployment allowed:{" "}
        <strong>{String(ev.deploymentAllowed)}</strong>
      </p>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Gate</th>
              <th>Result</th>
              <th>Blocks</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {gates.map((g) => (
              <tr key={String(g.id)}>
                <td>{String(g.category)}</td>
                <td>{String(g.name)}</td>
                <td>
                  <Badge state={String(g.result)} />
                </td>
                <td>{String(g.blocksDeployment)}</td>
                <td className="mono">
                  {(g.evidence as { reference?: string; sourceSystem?: string } | null)?.reference ??
                    "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SimpleListPage({
  title,
  lead,
  path,
  render,
}: {
  title: string;
  lead: string;
  path: string;
  render: (data: unknown) => ReactNode;
}) {
  const [data, setData] = useState<unknown>(null);
  useEffect(() => {
    arcGet(path).then(setData).catch(() => setData({ error: true }));
  }, [path]);
  return (
    <>
      <h2 className="page-title">{title}</h2>
      <p className="page-lead">{lead}</p>
      <div className="card">{data ? render(data) : <span className="muted">Loading…</span>}</div>
    </>
  );
}

function ApprovalsPage() {
  return (
    <>
      <h2 className="page-title">Approval Center</h2>
      <p className="page-lead">
        Separation of duties enforced server-side. AI agents cannot approve. Execution remains
        disabled.
      </p>
      <div className="banner">
        Phase 1 UI is read-oriented. Use authenticated API to request/decide approvals in tests.
      </div>
      <div className="card stack">
        <div>1. Request deployment review (release_manager)</div>
        <div>2. Independent reviewer approves bound SHA + digest</div>
        <div>3. Production operator executes only when kill-switch + all gates PASS</div>
        <div>4. Material SHA/digest change invalidates prior approval</div>
      </div>
    </>
  );
}

function SettingsPage() {
  const [gh, setGh] = useState<Record<string, unknown> | null>(null);
  const [cf, setCf] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    arcGet<Record<string, unknown>>("/github/repository").then(setGh);
    arcGet<Record<string, unknown>>("/coolify/applications").then(setCf);
  }, []);
  return (
    <>
      <h2 className="page-title">Settings & Integrations</h2>
      <p className="page-lead">Provider adapters. Credentials never sent to the browser.</p>
      <div className="grid">
        <div className="card span-6">
          <h3>GitHub</h3>
          <pre className="mono" style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(gh, null, 2)}
          </pre>
        </div>
        <div className="card span-6">
          <h3>Coolify</h3>
          <pre className="mono" style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(cf, null, 2)}
          </pre>
        </div>
      </div>
    </>
  );
}

export function App() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={OverviewPage} />
        <Route path="/applications">
          <SimpleListPage
            title="Applications & Environments"
            lead="Logical inventory separate from customer tenants."
            path="/environments"
            render={(d) => (
              <pre className="mono">{JSON.stringify(d, null, 2)}</pre>
            )}
          />
        </Route>
        <Route path="/releases" component={ReleasesPage} />
        <Route path="/compare" component={ComparePage} />
        <Route path="/gates" component={GatesPage} />
        <Route path="/approvals" component={ApprovalsPage} />
        <Route path="/deployments">
          <SimpleListPage
            title="Deployment History"
            lead="Coolify mock history — live digest UNVERIFIED."
            path="/coolify/applications/coolify-app-adala-mock/deployments"
            render={(d) => <pre className="mono">{JSON.stringify(d, null, 2)}</pre>}
          />
        </Route>
        <Route path="/monitoring">
          <SimpleListPage
            title="Monitoring"
            lead="Read-only observations with explicit evidence states."
            path="/monitoring"
            render={(d) => <pre className="mono">{JSON.stringify(d, null, 2)}</pre>}
          />
        </Route>
        <Route path="/incidents">
          <SimpleListPage
            title="Incidents"
            lead="Pre-existing production defects tracked separately from RC."
            path="/incidents"
            render={(d) => <pre className="mono">{JSON.stringify(d, null, 2)}</pre>}
          />
        </Route>
        <Route path="/backup">
          <SimpleListPage
            title="Backup Readiness"
            lead="Schedule ≠ restore proof."
            path="/backup"
            render={(d) => <pre className="mono">{JSON.stringify(d, null, 2)}</pre>}
          />
        </Route>
        <Route path="/audit">
          <div>
            <h2 className="page-title">Audit Trail</h2>
            <p className="page-lead">Append-only events. Requires operator auth (auditor role).</p>
            <div className="banner">Open via API with X-ARC-* headers in Phase 1.</div>
          </div>
        </Route>
        <Route path="/settings" component={SettingsPage} />
      </Switch>
    </Shell>
  );
}
