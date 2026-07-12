interface MarketDataDateProps {
  date?: string | null;
}

export default function MarketDataDate({ date }: MarketDataDateProps) {
  if (!date) return null;

  return (
    <span
      aria-label={`Market data as of ${date}`}
      className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] text-muted"
      title="Latest market session represented by the quote and return calculations."
    >
      As of&nbsp;<time dateTime={date}>{date}</time>
    </span>
  );
}
