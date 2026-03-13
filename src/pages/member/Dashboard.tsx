import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../api/axios';

// ---------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------

export type Rank = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

interface MemberDetail {
  id: number;
  name: string;
  email: string;
  role: string;
  rank: Rank;
  investment_amount: number;
  wallet_address: string | null;
  referrer: {
    id: number;
    name: string;
    email: string;
    rank: Rank;
  } | null;
  direct_referrals: {
    id: number;
    name: string;
    email: string;
    rank: Rank;
    investment_amount: number;
  }[];
  bonus_snapshot: {
    unilevel_bonus: number;
    infinity_bonus: number;
    megamatch_bonus: number;
    pool_bonus: number;
    total_bonus: number;
    calculated_at: string | null;
  } | null;
}

interface BonusSnapshot {
  unilevel_bonus: number;
  infinity_bonus: number;
  megamatch_bonus: number;
  pool_bonus: number;
  total_bonus: number;
  calculated_at: string | null;
}

interface RankCondition {
  rank: Rank;
  min_investment: number;
  min_direct_referrals: number;
  min_group_investment: number;
  infinity_rate: number;
  megamatch_same_rate: number;
  megamatch_upper_rate: number;
  pool_distribution_rate: number;
  pool_contribution_rate: number;
}

interface SettingsResponse {
  rank_conditions: RankCondition[];
  unilevel_rates: { level: number; rate: number }[];
}

// ---------------------------------------------------------------
// ランクバッジ
// ---------------------------------------------------------------

const RANK_LABEL: Record<Rank, string> = {
  none: 'なし',
  bronze: 'ブロンズ',
  silver: 'シルバー',
  gold: 'ゴールド',
  platinum: 'プラチナ',
  diamond: 'ダイヤモンド',
};

const RANK_BADGE_CLASS: Record<Rank, string> = {
  none: 'bg-gray-100 text-gray-600',
  bronze: 'bg-orange-100 text-orange-700',
  silver: 'bg-slate-200 text-slate-700',
  gold: 'bg-yellow-100 text-yellow-700',
  platinum: 'bg-purple-100 text-purple-700',
  diamond: 'bg-blue-100 text-blue-700',
};

function RankBadge({ rank }: { rank: Rank }) {
  return (
    <span
      className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${RANK_BADGE_CLASS[rank]}`}
    >
      {RANK_LABEL[rank]}
    </span>
  );
}

// ---------------------------------------------------------------
// ランク順序（none が最低、diamond が最高）
// ---------------------------------------------------------------

const RANK_ORDER: Rank[] = ['none', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];

function nextRank(current: Rank): Rank | null {
  const idx = RANK_ORDER.indexOf(current);
  if (idx === -1 || idx === RANK_ORDER.length - 1) return null;
  return RANK_ORDER[idx + 1];
}

// ---------------------------------------------------------------
// 数値フォーマット
// ---------------------------------------------------------------

function formatCurrency(value: number): string {
  return value.toLocaleString('ja-JP', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

// ---------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------

export default function MemberDashboard() {
  const { user } = useAuth();

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [bonus, setBonus] = useState<BonusSnapshot | null>(null);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [memberRes, bonusRes, settingsRes] = await Promise.all([
          apiClient.get<MemberDetail>(`/members/show.php?id=${user.id}`),
          apiClient.get<BonusSnapshot>('/bonus/my.php'),
          apiClient.get<SettingsResponse>('/settings/index.php'),
        ]);
        setMember(memberRes.data);
        setBonus(bonusRes.data);
        setSettings(settingsRes.data);
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'response' in err &&
          err.response &&
          typeof err.response === 'object' &&
          'data' in err.response &&
          err.response.data &&
          typeof err.response.data === 'object' &&
          'error' in err.response.data
        ) {
          setError(String((err.response.data as { error: string }).error));
        } else {
          setError('データの取得に失敗しました。');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6">
        <p className="font-semibold">エラーが発生しました</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!member) return null;

  // ランク進捗計算
  const currentRank = member.rank;
  const nextRankName = nextRank(currentRank);
  const nextCondition = nextRankName
    ? settings?.rank_conditions.find((rc) => rc.rank === nextRankName) ?? null
    : null;
  const directCount = member.direct_referrals.length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">マイダッシュボード</h2>

      {/* 基本情報カード */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
          基本情報
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400">名前</p>
            <p className="text-lg font-semibold text-gray-800">{member.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">メールアドレス</p>
            <p className="text-base text-gray-700">{member.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">現在のランク</p>
            <RankBadge rank={currentRank} />
          </div>
          <div>
            <p className="text-xs text-gray-400">運用額</p>
            <p className="text-lg font-semibold text-gray-800">
              {formatCurrency(member.investment_amount)}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-400">ウォレットアドレス</p>
            <p className="text-sm font-mono text-gray-700 break-all">
              {member.wallet_address ?? '未設定'}
            </p>
          </div>
        </div>
      </div>

      {/* ランク進捗カード */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
          ランク進捗
        </h3>
        {nextRankName && nextCondition ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">次のランク:</span>
              <RankBadge rank={nextRankName} />
            </div>
            <div className="space-y-3">
              {/* 運用額条件 */}
              <ProgressItem
                label="運用額"
                current={member.investment_amount}
                required={nextCondition.min_investment}
                formatter={formatCurrency}
              />
              {/* 直紹介数条件 */}
              <ProgressItem
                label="直紹介人数"
                current={directCount}
                required={nextCondition.min_direct_referrals}
                formatter={(v) => `${v} 人`}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {currentRank === 'diamond'
              ? '最高ランク（ダイヤモンド）に達しています。'
              : 'ランク条件を取得できませんでした。'}
          </p>
        )}
      </div>

      {/* ボーナス内訳カード */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
          ボーナス内訳
        </h3>
        {bonus ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <BonusItem label="ユニレベル" value={bonus.unilevel_bonus} />
              <BonusItem label="インフィニティ" value={bonus.infinity_bonus} />
              <BonusItem label="メガマッチ" value={bonus.megamatch_bonus} />
              <BonusItem label="プール" value={bonus.pool_bonus} />
            </div>
            <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">合計ボーナス</span>
              <span className="text-xl font-bold text-indigo-600">
                {formatCurrency(bonus.total_bonus)}
              </span>
            </div>
            {bonus.calculated_at && (
              <p className="text-xs text-gray-400 mt-2 text-right">
                最終計算日時:{' '}
                {new Date(bonus.calculated_at).toLocaleString('ja-JP')}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500">ボーナスデータがありません。</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// サブコンポーネント
// ---------------------------------------------------------------

interface ProgressItemProps {
  label: string;
  current: number;
  required: number;
  formatter: (v: number) => string;
}

function ProgressItem({ label, current, required, formatter }: ProgressItemProps) {
  const achieved = current >= required;
  const pct = required > 0 ? Math.min((current / required) * 100, 100) : 100;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={achieved ? 'text-green-600 font-medium' : 'text-gray-500'}>
          {formatter(current)} / {formatter(required)}
          {achieved && <span className="ml-1">✓</span>}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${achieved ? 'bg-green-500' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface BonusItemProps {
  label: string;
  value: number;
}

function BonusItem({ label, value }: BonusItemProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-base font-semibold text-gray-800">{formatCurrency(value)}</p>
    </div>
  );
}
