import { useState, useEffect } from 'react';
import apiClient from '../../api/axios';

type Rank = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  rank: Rank;
  investment_amount: number;
  direct_referral_count: number;
  group_investment: number;
  referrer_id: number | null;
  referrer_name: string | null;
  total_bonus: number;
  created_at: string;
}

interface CapWarning {
  user_id: number;
  name: string;
  investment: number;
  total_outflow: number;
  cap_limit: number;
  excess: number;
}

interface Stats {
  totalMembers: number;
  totalInvestment: number;
  poolBalance: number;
  totalBonus: number;
  rankCounts: Record<Rank, number>;
  capWarnings: CapWarning[];
  bonusCapRate: number;
}

const RANKS: Rank[] = ['none', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];

const rankLabel: Record<Rank, string> = {
  none: 'なし',
  bronze: 'ブロンズ',
  silver: 'シルバー',
  gold: 'ゴールド',
  platinum: 'プラチナ',
  diamond: 'ダイヤモンド',
};

const rankBadgeColor: Record<Rank, string> = {
  none: 'bg-gray-100 text-gray-600',
  bronze: 'bg-orange-100 text-orange-700',
  silver: 'bg-slate-100 text-slate-700',
  gold: 'bg-yellow-100 text-yellow-700',
  platinum: 'bg-purple-100 text-purple-700',
  diamond: 'bg-blue-100 text-blue-700',
};

const rankBarColor: Record<Rank, string> = {
  none: 'bg-gray-400',
  bronze: 'bg-orange-500',
  silver: 'bg-slate-500',
  gold: 'bg-yellow-500',
  platinum: 'bg-purple-500',
  diamond: 'bg-blue-500',
};

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentMembers, setRecentMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [membersRes, sysRes, bonusRes] = await Promise.all([
          apiClient.get<Member[]>('/members/index.php'),
          apiClient.get<Record<string, string>>('/settings/system.php').catch(() => ({ data: {} as Record<string, string> })),
          apiClient.post<{ bonus_cap_rate: number; cap_warnings: CapWarning[] }>('/bonus/calculate.php', {}).catch(() => ({ data: { bonus_cap_rate: 0, cap_warnings: [] } })),
        ]);
        const members = membersRes.data ?? [];
        const bonusCapRate = bonusRes.data?.bonus_cap_rate ?? (parseFloat(sysRes.data?.bonus_cap_rate ?? '0') || 0);
        const capWarnings: CapWarning[] = bonusRes.data?.cap_warnings ?? [];

        const totalInvestment = members.reduce(
          (sum, m) => sum + (m.investment_amount ?? 0),
          0,
        );

        const totalBonus = members.reduce(
          (sum, m) => sum + (m.total_bonus ?? 0),
          0,
        );

        // ランク別メンバー数を集計
        const rankCounts = {} as Record<Rank, number>;
        for (const r of RANKS) {
          rankCounts[r] = 0;
        }
        for (const m of members) {
          const r = m.rank ?? 'none';
          rankCounts[r] = (rankCounts[r] ?? 0) + 1;
        }

        setStats({
          totalMembers: members.length,
          totalInvestment,
          poolBalance: 0,
          totalBonus,
          rankCounts,
          capWarnings,
          bonusCapRate,
        });

        // ID降順で最新5件
        const sorted = [...members].sort((a, b) => b.id - a.id);
        setRecentMembers(sorted.slice(0, 5));
      } catch {
        setError('データの取得に失敗しました。');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        {error}
      </div>
    );
  }

  const maxRankCount = stats
    ? Math.max(...Object.values(stats.rankCounts), 1)
    : 1;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        管理者ダッシュボード
      </h2>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            総メンバー数
          </p>
          <p className="text-3xl font-bold text-gray-800">
            {stats?.totalMembers.toLocaleString() ?? 0}
            <span className="text-sm font-normal text-gray-500 ml-1">名</span>
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            総運用額
          </p>
          <p className="text-3xl font-bold text-gray-800">
            {formatCurrency(stats?.totalInvestment ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            プール残高
          </p>
          <p className="text-3xl font-bold text-gray-800">
            {formatCurrency(stats?.poolBalance ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            合計ボーナス支給額
          </p>
          <p className="text-3xl font-bold text-indigo-700">
            {formatCurrency(stats?.totalBonus ?? 0)}
          </p>
        </div>
      </div>

      {/* ボーナスキャップ超過警告 */}
      {stats && stats.capWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 mb-8">
          <h3 className="text-sm font-bold text-amber-800 mb-2">
            ボーナス上限超過警告（上限率: {stats.bonusCapRate}%）
          </h3>
          <p className="text-xs text-amber-700 mb-3">
            以下のメンバーの投資額から発生する報酬合計が投資額の{stats.bonusCapRate}%を超えています。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-amber-700 border-b border-amber-200">
                  <th className="pb-2 pr-4">メンバー</th>
                  <th className="pb-2 pr-4 text-right">投資額</th>
                  <th className="pb-2 pr-4 text-right">発生報酬合計</th>
                  <th className="pb-2 pr-4 text-right">上限</th>
                  <th className="pb-2 text-right">超過額</th>
                </tr>
              </thead>
              <tbody>
                {stats.capWarnings.map((w) => (
                  <tr key={w.user_id} className="border-b border-amber-100">
                    <td className="py-2 pr-4 font-medium text-amber-900">{w.name}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(w.investment)}</td>
                    <td className="py-2 pr-4 text-right font-bold text-red-700">{formatCurrency(w.total_outflow)}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(w.cap_limit)}</td>
                    <td className="py-2 text-right font-bold text-red-600">+{formatCurrency(w.excess)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ランク別メンバー数（バッジ） */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-3">
          ランク別メンバー数
        </h3>
        <div className="flex flex-wrap gap-2">
          {RANKS.map((r) => (
            <span
              key={r}
              className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium ${rankBadgeColor[r]}`}
            >
              {rankLabel[r]}
              <span className="font-bold">
                {stats?.rankCounts[r] ?? 0}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ランク分布（横棒グラフ） */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            ランク分布
          </h3>
          <div className="space-y-3">
            {RANKS.map((r) => {
              const count = stats?.rankCounts[r] ?? 0;
              const pct = maxRankCount > 0 ? (count / maxRankCount) * 100 : 0;
              return (
                <div key={r} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-gray-600 text-right shrink-0">
                    {rankLabel[r]}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${rankBarColor[r]}`}
                      style={{ width: `${pct}%`, minWidth: count > 0 ? '8px' : '0' }}
                    />
                  </div>
                  <span className="w-10 text-sm font-bold text-gray-700 text-right shrink-0">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 最近登録のメンバー */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            最近登録のメンバー
          </h3>
          {recentMembers.length === 0 ? (
            <p className="text-gray-400 text-sm">メンバーがいません。</p>
          ) : (
            <div className="space-y-3">
              {recentMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {m.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {m.created_at ? formatDate(m.created_at) : '-'}
                    </p>
                  </div>
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${rankBadgeColor[m.rank ?? 'none']}`}
                  >
                    {rankLabel[m.rank ?? 'none']}
                  </span>
                  <span className="text-sm font-bold text-gray-700 shrink-0">
                    {formatCurrency(m.investment_amount ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
