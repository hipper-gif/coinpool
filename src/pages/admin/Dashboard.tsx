import { useState, useEffect } from 'react';
import apiClient from '../../api/axios';

type Rank = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

interface Member {
  id: number;
  name: string;
  email: string;
  rank: Rank;
  investment_amount: number;
  direct_referrals: number;
  group_investment: number;
  referrer_id: number | null;
  created_at: string;
}

interface MembersResponse {
  members: Member[];
}

interface Stats {
  totalMembers: number;
  totalInvestment: number;
  poolBalance: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentMembers, setRecentMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiClient.get<MembersResponse>('/members/index.php');
        const members = res.data.members ?? [];

        const totalInvestment = members.reduce(
          (sum, m) => sum + (m.investment_amount ?? 0),
          0,
        );

        // プール残高: 全メンバーの運用額の合計の一定割合（仮: 5%）として表示
        const poolBalance = totalInvestment * 0.05;

        setStats({
          totalMembers: members.length,
          totalInvestment,
          poolBalance,
        });

        // 登録日降順で最新5件
        const sorted = [...members].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setRecentMembers(sorted.slice(0, 5));
      } catch {
        setError('データの取得に失敗しました。');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, []);

  const rankLabel: Record<Rank, string> = {
    none: 'なし',
    bronze: 'ブロンズ',
    silver: 'シルバー',
    gold: 'ゴールド',
    platinum: 'プラチナ',
    diamond: 'ダイヤモンド',
  };

  const rankColor: Record<Rank, string> = {
    none: 'bg-gray-100 text-gray-600',
    bronze: 'bg-orange-100 text-orange-700',
    silver: 'bg-slate-100 text-slate-700',
    gold: 'bg-yellow-100 text-yellow-700',
    platinum: 'bg-purple-100 text-purple-700',
    diamond: 'bg-blue-100 text-blue-700',
  };

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

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        管理者ダッシュボード
      </h2>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">総メンバー数</p>
          <p className="text-3xl font-bold text-gray-800">
            {stats?.totalMembers.toLocaleString() ?? 0}
            <span className="text-base font-normal text-gray-500 ml-1">名</span>
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">総運用額</p>
          <p className="text-3xl font-bold text-gray-800">
            $
            {stats?.totalInvestment.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) ?? '0.00'}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">プール残高</p>
          <p className="text-3xl font-bold text-gray-800">
            $
            {stats?.poolBalance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) ?? '0.00'}
          </p>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">
                    名前
                  </th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">
                    ランク
                  </th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">
                    運用額
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentMembers.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="py-2 px-3 text-gray-800">{m.name}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${rankColor[m.rank ?? 'none']}`}
                      >
                        {rankLabel[m.rank ?? 'none']}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700">
                      $
                      {(m.investment_amount ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
