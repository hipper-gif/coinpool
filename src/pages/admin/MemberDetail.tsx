import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../api/axios';

type Rank = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

interface BonusSnapshot {
  unilevel: number;
  infinity: number;
  mega_match: number;
  pool: number;
  total: number;
}

interface DirectMember {
  id: number;
  name: string;
  email: string;
  rank: Rank;
  investment_amount: number;
}

interface MemberDetail {
  id: number;
  name: string;
  email: string;
  rank: Rank;
  investment_amount: number;
  referrer_id: number | null;
  referrer_name: string | null;
  direct_referrals: number;
  group_investment: number;
  bonus_snapshot: BonusSnapshot | null;
  direct_members: DirectMember[];
  created_at: string;
}

interface MemberDetailResponse {
  member: MemberDetail;
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

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [investmentInput, setInvestmentInput] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchMember = async () => {
    try {
      const res = await apiClient.get<MemberDetailResponse>(
        `/members/show.php?id=${id}`,
      );
      setMember(res.data.member);
      setInvestmentInput(String(res.data.member.investment_amount ?? 0));
    } catch {
      setError('メンバー情報の取得に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchMember();
  }, [id]);

  const handleSaveInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);
    setSaveLoading(true);
    try {
      await apiClient.put(`/members/show.php?id=${id}`, {
        investment_amount: Number(investmentInput),
      });
      setSaveSuccess(true);
      await fetchMember();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string } };
      };
      setSaveError(
        axiosErr.response?.data?.message ?? '運用額の更新に失敗しました。',
      );
    } finally {
      setSaveLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        {error ?? 'メンバーが見つかりません。'}
      </div>
    );
  }

  const bonus = member.bonus_snapshot;

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => void navigate('/admin/members')}
          className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          ← メンバー一覧
        </button>
        <h2 className="text-2xl font-bold text-gray-800">メンバー詳細</h2>
      </div>

      {/* 基本情報 */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h3 className="text-base font-semibold text-gray-700 mb-4">
          基本情報
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 mb-0.5">名前</p>
            <p className="text-gray-800 font-medium">{member.name}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">メール</p>
            <p className="text-gray-800">{member.email}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">ランク</p>
            <span
              className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${rankBadge[member.rank ?? 'none']}`}
            >
              {rankLabel[member.rank ?? 'none']}
            </span>
          </div>
          <div>
            <p className="text-gray-500 mb-0.5">紹介者</p>
            <p className="text-gray-800">
              {member.referrer_name ?? 'なし'}
            </p>
          </div>
        </div>
      </div>

      {/* 運用額入力フォーム */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h3 className="text-base font-semibold text-gray-700 mb-4">
          運用額
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          現在の運用額:{' '}
          <span className="text-gray-800 font-semibold">
            $
            {(member.investment_amount ?? 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </p>
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-red-700 text-sm">
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-green-700 text-sm">
            運用額を更新しました。
          </div>
        )}
        <form
          onSubmit={(e) => void handleSaveInvestment(e)}
          className="flex gap-3 items-end"
        >
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              新しい運用額 ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={investmentInput}
              onChange={(e) => setInvestmentInput(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <button
            type="submit"
            disabled={saveLoading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            {saveLoading ? '更新中...' : '更新する'}
          </button>
        </form>
      </div>

      {/* ボーナス内訳 */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h3 className="text-base font-semibold text-gray-700 mb-4">
          ボーナス内訳
        </h3>
        {!bonus ? (
          <p className="text-sm text-gray-400">ボーナスデータがありません。</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(
              [
                { label: 'ユニレベル', key: 'unilevel' },
                { label: 'インフィニティ', key: 'infinity' },
                { label: 'メガマッチ', key: 'mega_match' },
                { label: 'プール', key: 'pool' },
                { label: '合計', key: 'total' },
              ] as const
            ).map(({ label, key }) => (
              <div
                key={key}
                className={`rounded-lg p-4 text-center ${key === 'total' ? 'bg-indigo-50' : 'bg-gray-50'}`}
              >
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p
                  className={`text-base font-bold ${key === 'total' ? 'text-indigo-700' : 'text-gray-800'}`}
                >
                  $
                  {(bonus[key] ?? 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 直属メンバー一覧 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-base font-semibold text-gray-700 mb-4">
          直属メンバー ({member.direct_members?.length ?? 0}名)
        </h3>
        {!member.direct_members || member.direct_members.length === 0 ? (
          <p className="text-sm text-gray-400">直属メンバーはいません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">
                    名前
                  </th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">
                    メール
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
                {member.direct_members.map((dm) => (
                  <tr
                    key={dm.id}
                    onClick={() => void navigate(`/admin/members/${dm.id}`)}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 text-gray-800">{dm.name}</td>
                    <td className="py-2 px-3 text-gray-600">{dm.email}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${rankBadge[dm.rank ?? 'none']}`}
                      >
                        {rankLabel[dm.rank ?? 'none']}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700">
                      $
                      {(dm.investment_amount ?? 0).toLocaleString(undefined, {
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
