import { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/axios';

type Rank = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

interface MemberRight {
  id: number;
  name: string;
  email: string;
  rank: Rank;
  wallet_address: string | null;
  investment: number;
  unilevel_pct: number;
  infinity_pct: number;
  megamatch_pct: number;
  pool_pct: number;
  total_pct: number;
  total_bonus: number;
}

interface RightsResponse {
  total_investment: number;
  total_revenue: number;
  members: MemberRight[];
}

const rankLabel: Record<Rank, string> = {
  none: 'なし',
  bronze: 'ブロンズ',
  silver: 'シルバー',
  gold: 'ゴールド',
  platinum: 'プラチナ',
  diamond: 'ダイヤモンド',
};

const rankBadge: Record<Rank, string> = {
  none: 'bg-gray-100 text-gray-600',
  bronze: 'bg-orange-100 text-orange-700',
  silver: 'bg-slate-100 text-slate-700',
  gold: 'bg-yellow-100 text-yellow-700',
  platinum: 'bg-purple-100 text-purple-700',
  diamond: 'bg-blue-100 text-blue-700',
};

function fmtPct(v: number): string {
  if (v === 0) return '—';
  return v < 0.01 ? v.toFixed(4) + '%' : v.toFixed(2) + '%';
}

function fmtUsd(v: number): string {
  return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Rights() {
  const [data, setData] = useState<RightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiClient
      .get<RightsResponse>('/bonus/rights.php')
      .then((res) => setData(res.data))
      .catch(() => setError('配当権データの取得に失敗しました。'))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.members;
    const q = search.trim().toLowerCase();
    return data.members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [data, search]);

  const totalPctSum = useMemo(
    () => filtered.reduce((sum, m) => sum + m.total_pct, 0),
    [filtered],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        {error ?? 'データがありません。'}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">配当権一覧</h2>
      <p className="text-sm text-gray-500 mb-6">
        発生収益（総運用額 {fmtUsd(data.total_investment)} × 5% = {fmtUsd(data.total_revenue)}）に対する各メンバーの配当権%
      </p>

      {/* サマリー */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">メンバー数</p>
          <p className="text-xl font-bold text-gray-800">{data.members.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">総運用額</p>
          <p className="text-xl font-bold text-gray-800">{fmtUsd(data.total_investment)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">発生収益</p>
          <p className="text-xl font-bold text-gray-800">{fmtUsd(data.total_revenue)}</p>
        </div>
        <div className="bg-indigo-50 rounded-xl shadow-sm p-4 text-center">
          <p className="text-xs text-indigo-600 mb-1">配当権 合計</p>
          <p className="text-xl font-bold text-indigo-700">{totalPctSum.toFixed(2)}%</p>
        </div>
      </div>

      {/* 検索 */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="名前・メールで検索..."
          className="w-full max-w-sm border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">名前</th>
                <th className="text-left py-3 px-3 text-gray-500 font-medium">ランク</th>
                <th className="text-right py-3 px-3 text-gray-500 font-medium">ユニレベル</th>
                <th className="text-right py-3 px-3 text-gray-500 font-medium">インフィニティ</th>
                <th className="text-right py-3 px-3 text-gray-500 font-medium">メガマッチ</th>
                <th className="text-right py-3 px-3 text-gray-500 font-medium">プール</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">合計%</th>
                <th className="text-left py-3 px-3 text-gray-500 font-medium">ウォレット</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400">
                    該当するメンバーがいません。
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="text-gray-800 font-medium">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.email}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${rankBadge[m.rank ?? 'none']}`}>
                        {rankLabel[m.rank ?? 'none']}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-gray-700 tabular-nums">{fmtPct(m.unilevel_pct)}</td>
                    <td className="py-3 px-3 text-right text-gray-700 tabular-nums">{fmtPct(m.infinity_pct)}</td>
                    <td className="py-3 px-3 text-right text-gray-700 tabular-nums">{fmtPct(m.megamatch_pct)}</td>
                    <td className="py-3 px-3 text-right text-gray-700 tabular-nums">{fmtPct(m.pool_pct)}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-indigo-700 font-bold tabular-nums">{fmtPct(m.total_pct)}</span>
                    </td>
                    <td className="py-3 px-3 text-xs text-gray-500 font-mono max-w-[120px] truncate" title={m.wallet_address ?? ''}>
                      {m.wallet_address
                        ? m.wallet_address.slice(0, 6) + '...' + m.wallet_address.slice(-4)
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr className="font-semibold text-gray-700">
                  <td className="py-3 px-4">合計</td>
                  <td className="py-3 px-3"></td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {fmtPct(filtered.reduce((s, m) => s + m.unilevel_pct, 0))}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {fmtPct(filtered.reduce((s, m) => s + m.infinity_pct, 0))}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {fmtPct(filtered.reduce((s, m) => s + m.megamatch_pct, 0))}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {fmtPct(filtered.reduce((s, m) => s + m.pool_pct, 0))}
                  </td>
                  <td className="py-3 px-4 text-right text-indigo-700 tabular-nums">
                    {totalPctSum.toFixed(2)}%
                  </td>
                  <td className="py-3 px-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
