import type { DataProvenanceItem, MarketScope } from '../lib/data-provenance';
import { summarizeDataProvenance } from '../lib/data-provenance';

interface DataProvenanceBarProps {
  items: DataProvenanceItem[];
  ariaLabel?: string;
  coverageLabel?: string;
  isRefreshing?: boolean;
}

function coverageSuffix(reported: number, total: number): string {
  return reported > 0 && reported < total ? ` (${reported}/${total} datasets reported)` : '';
}

function compactValues(values: string[]): string {
  if (values.length <= 3) return values.join(', ');
  return `${values.slice(0, 3).join(', ')} +${values.length - 3} more`;
}

function MarketScopeLabel({ scope }: { scope: MarketScope }) {
  const labelKinds = scope.labels.map((label) => label.split(' ').at(-1)?.toLowerCase());
  const sharedKind = labelKinds.length > 1 && labelKinds.every((kind) => kind === labelKinds[0])
    ? labelKinds[0]
    : null;
  const label = scope.labels.length === 1
    ? scope.labels[0]
    : sharedKind === 'quote'
      ? `${scope.labels.length} quotes`
      : sharedKind === 'history'
        ? `${scope.labels.length} histories`
        : `${scope.labels.length} datasets`;
  return (
    <span className="whitespace-nowrap">
      {label}: <time dateTime={scope.from}>{scope.from}</time>
      {scope.to !== scope.from && <>&ndash;<time dateTime={scope.to}>{scope.to}</time></>}
    </span>
  );
}

export default function DataProvenanceBar({
  items,
  ariaLabel = 'Market data provenance',
  coverageLabel,
  isRefreshing = false,
}: DataProvenanceBarProps) {
  if (items.length === 0) return null;
  const summary = summarizeDataProvenance(items);
  const source = summary.sources.length > 0
    ? `${compactValues(summary.sources)}${coverageSuffix(summary.sourceReportedCount, summary.itemCount)}`
    : 'not reported by API';
  const retrieved = summary.retrievedAt.length > 0
    ? `${compactValues(summary.retrievedAt)}${coverageSuffix(summary.retrievedAtReportedCount, summary.itemCount)}`
    : 'not reported by API';
  const status = summary.statuses.length > 0
    ? `${compactValues(summary.statuses)}${coverageSuffix(summary.statusReportedCount, summary.itemCount)}`
    : 'not reported by API';

  return (
    <section
      aria-label={ariaLabel}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] text-muted sm:text-xs"
    >
      <strong className="font-semibold text-secondary">Data</strong>
      {coverageLabel && <span>{coverageLabel}</span>}
      {summary.marketScopes.map((scope) => (
        <MarketScopeLabel key={`${scope.from}:${scope.to}`} scope={scope} />
      ))}
      <span>Source: {source}</span>
      <span>Retrieved: {retrieved}</span>
      <span>Freshness status: {status}</span>
      {isRefreshing && <span role="status" className="font-medium text-accent">Refreshing…</span>}
    </section>
  );
}
