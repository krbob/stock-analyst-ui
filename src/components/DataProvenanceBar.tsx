import { Fragment } from 'react';
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

function humanizeContractValue(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatInstant(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toISOString()
    .replace('T', ' ')
    .replace('.000Z', ' UTC')
    .replace('Z', ' UTC');
}

function InstantValues({ values }: { values: string[] }) {
  const visible = values.slice(0, 3);
  return (
    <>
      {visible.map((value, index) => (
        <Fragment key={value}>
          {index > 0 && ', '}
          <time dateTime={value}>{formatInstant(value)}</time>
        </Fragment>
      ))}
      {values.length > visible.length && ` +${values.length - visible.length} more`}
    </>
  );
}

function statusClass(statuses: string[]): string {
  if (statuses.includes('ERROR')) return 'text-danger';
  if (statuses.includes('PARTIAL') || statuses.includes('STALE')) return 'text-highlight';
  if (statuses.includes('FRESH')) return 'text-up';
  return 'text-secondary';
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
  const source = compactValues(summary.sources.map(humanizeContractValue));
  const status = compactValues(summary.statuses.map(humanizeContractValue));
  const adjustments = compactValues(summary.adjustments.map(humanizeContractValue));
  const unitScales = compactValues(summary.unitScales.map((scale) => `×${scale}`));

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
      <span className={`font-medium ${statusClass(summary.statuses)}`}>Market status: {status}</span>
      <span>Retrieved: <InstantValues values={summary.retrievedAt} /></span>
      {summary.marketTimestamps.length > 0 && (
        <span>
          Market observed: <InstantValues values={summary.marketTimestamps} />
          {coverageSuffix(summary.marketTimestampReportedCount, summary.itemCount)}
        </span>
      )}
      {summary.currencies.length > 0 && (
        <span>
          Currency: {compactValues(summary.currencies)}
          {coverageSuffix(summary.currencyReportedCount, summary.itemCount)}
        </span>
      )}
      <span>Adjustment: {adjustments}</span>
      <span>Unit scale: {unitScales}</span>
      {isRefreshing && <span role="status" className="font-medium text-accent">Refreshing…</span>}
    </section>
  );
}
