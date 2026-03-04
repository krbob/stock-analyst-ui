import { useAnalysis } from '../api/queries';

function fmtMktCap(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return n.toFixed(0);
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + (n * 100).toFixed(2) + '%';
}

function fmtNum(n: number | null, decimals = 2): string {
  return n != null ? n.toFixed(decimals) : '—';
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 py-1">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="truncate text-white">{value}</span>
    </div>
  );
}

function Recommendation({ value, count }: { value: string | null; count: number | null }) {
  if (!value) return <Item label="Rating" value="—" />;
  const colors: Record<string, string> = {
    strong_buy: 'text-green-400',
    buy: 'text-green-400',
    hold: 'text-yellow-400',
    sell: 'text-red-400',
    strong_sell: 'text-red-400',
  };
  const labels: Record<string, string> = {
    strong_buy: 'Strong Buy',
    buy: 'Buy',
    hold: 'Hold',
    sell: 'Sell',
    strong_sell: 'Strong Sell',
  };
  const display = labels[value] ?? value;
  const countStr = count != null ? ` (${count})` : '';
  return (
    <div className="flex justify-between gap-2 py-1">
      <span className="text-gray-500">Rating</span>
      <span className={colors[value] ?? 'text-white'}>{display}{countStr}</span>
    </div>
  );
}

export default function StockDetails({ symbol }: { symbol: string }) {
  const { data, isLoading, error } = useAnalysis(symbol);

  if (!symbol) return null;

  if (isLoading) {
    return (
      <div className="mt-4 flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
      </div>
    );
  }

  if (error || !data) return null;

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
        <h3 className="mb-2 text-sm font-medium text-gray-400">Fundamentals</h3>
        <div className="grid grid-cols-2 gap-x-6 text-sm">
          <Item label="P/E" value={fmtNum(data.peRatio)} />
          <Item label="EPS" value={fmtNum(data.eps)} />
          <Item label="P/B" value={fmtNum(data.pbRatio)} />
          <Item label="Mkt Cap" value={data.marketCap != null ? fmtMktCap(data.marketCap) : '—'} />
          <Item label="Yield" value={data.dividendYield != null ? fmtPct(data.dividendYield) : '—'} />
          <Item label="Div Grw" value={data.dividendGrowth != null ? fmtPct(data.dividendGrowth) : '—'} />
          <Item label="ROE" value={data.roe != null ? fmtPct(data.roe) : '—'} />
          <Item label="Beta" value={fmtNum(data.beta)} />
          <Item label="52W High" value={fmtNum(data.fiftyTwoWeekHigh)} />
          <Item label="52W Low" value={fmtNum(data.fiftyTwoWeekLow)} />
          <Item label="Sector" value={data.sector ?? '—'} />
          <Item label="Industry" value={data.industry ?? '—'} />
          <Item label="Earnings" value={data.earningsDate ?? '—'} />
          <Recommendation value={data.recommendation} count={data.analystCount} />
        </div>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
        <h3 className="mb-2 text-sm font-medium text-gray-400">Technicals</h3>
        <div className="grid grid-cols-2 gap-x-6 text-sm">
          <Item label="RSI (D)" value={fmtNum(data.rsi.daily, 1)} />
          <Item label="RSI (W)" value={fmtNum(data.rsi.weekly, 1)} />
          <Item label="RSI (M)" value={fmtNum(data.rsi.monthly, 1)} />
          <Item label="ATR" value={fmtNum(data.atr)} />
          <Item label="MACD" value={fmtNum(data.macd.macd)} />
          <Item label="Signal" value={fmtNum(data.macd.signal)} />
          <Item label="Histogram" value={fmtNum(data.macd.histogram)} />
          <div />
          <Item label="SMA 50" value={fmtNum(data.movingAverages.sma50)} />
          <Item label="SMA 200" value={fmtNum(data.movingAverages.sma200)} />
          <Item label="EMA 50" value={fmtNum(data.movingAverages.ema50)} />
          <Item label="EMA 200" value={fmtNum(data.movingAverages.ema200)} />
          <Item label="BB Upper" value={fmtNum(data.bollingerBands.upper)} />
          <Item label="BB Mid" value={fmtNum(data.bollingerBands.middle)} />
          <Item label="BB Lower" value={fmtNum(data.bollingerBands.lower)} />
        </div>
      </div>
    </div>
  );
}
