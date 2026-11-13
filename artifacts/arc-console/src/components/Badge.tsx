export function Badge({ state }: { state: string }) {
  const cls = `badge b-${state}`;
  return <span className={cls}>{state}</span>;
}
