import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import apiClient from '../../api/axios';

type Rank = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

interface RankConditionRow {
  rank: Rank;
  min_investment: number;
  min_direct_referrals: number;
  min_group_investment: number;
  mm_min_investment: number;
  mm_min_direct_referrals: number;
  mm_min_group_investment: number;
  infinity_rate: number;
  megamatch_same_rate: number;
  megamatch_upper_rate: number;
  pool_distribution_rate: number;
  pool_contribution_rate: number;
}

interface UnilevelRateRow {
  level: number;
  rate: number;
}

interface ApiResponse {
  rank_conditions: RankConditionRow[];
  unilevel_rates: UnilevelRateRow[];
}

const rankLabel: Record<Rank, string> = {
  bronze: 'ブロンズ',
  silver: 'シルバー',
  gold: 'ゴールド',
  platinum: 'プラチナ',
  diamond: 'ダイヤモンド',
};

const rankOrder: Rank[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

type RankField = keyof Omit<RankConditionRow, 'rank'>;

type Tab = 'rank' | 'unilevel';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('rank');
  const [rankConditions, setRankConditions] = useState<RankConditionRow[]>([]);
  const [unilevelRates, setUnilevelRates] = useState<UnilevelRateRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiClient.get<ApiResponse>('/settings/index.php');
        setRankConditions(res.data.rank_conditions);
        setUnilevelRates(res.data.unilevel_rates);
      } catch {
        setError('設定の取得に失敗しました。');
      } finally {
        setIsLoading(false);
      }
    };
    void fetchSettings();
  }, []);

  const getRankCondition = (rank: Rank): RankConditionRow | undefined =>
    rankConditions.find((rc) => rc.rank === rank);

  const handleRankChange = (rank: Rank, field: RankField, value: string) => {
    setRankConditions((prev) =>
      prev.map((rc) =>
        rc.rank === rank ? { ...rc, [field]: Number(value) } : rc,
      ),
    );
  };

  const handleUnilevelChange = (level: number, value: string) => {
    setUnilevelRates((prev) =>
      prev.map((ur) =>
        ur.level === level ? { ...ur, rate: Number(value) } : ur,
      ),
    );
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);
    setSaveLoading(true);
    try {
      await apiClient.put('/settings/index.php', {
        rank_conditions: rankConditions,
        unilevel_rates: unilevelRates,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError('設定の保存に失敗しました。');
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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">設定</h2>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('rank')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'rank'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          ランク条件
        </button>
        <button
          onClick={() => setActiveTab('unilevel')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'unilevel'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          ユニレベル率
        </button>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-green-700 text-sm">
          設定を保存しました。
        </div>
      )}

      <form onSubmit={(e) => void handleSave(e)}>
        {activeTab === 'rank' && (
          <div className="space-y-4">
            {rankOrder.map((rank) => {
              const cond = getRankCondition(rank);
              if (!cond) return null;
              return (
                <div key={rank} className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-base font-semibold text-gray-700 mb-4">
                    {rankLabel[rank]}
                  </h3>
                  <p className="text-xs font-medium text-gray-500 mb-2 mt-1">インフィニティ条件</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <FieldInput
                      label="最低運用額 ($)"
                      value={cond.min_investment}
                      onChange={(v) => handleRankChange(rank, 'min_investment', v)}
                    />
                    <FieldInput
                      label="最低直紹介数"
                      value={cond.min_direct_referrals}
                      onChange={(v) => handleRankChange(rank, 'min_direct_referrals', v)}
                      step="1"
                    />
                    <FieldInput
                      label="最低グループ運用額 ($)"
                      value={cond.min_group_investment}
                      onChange={(v) => handleRankChange(rank, 'min_group_investment', v)}
                    />
                  </div>
                  <p className="text-xs font-medium text-gray-500 mb-2 mt-4">メガマッチ条件</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <FieldInput
                      label="MM最低運用額 ($)"
                      value={cond.mm_min_investment}
                      onChange={(v) => handleRankChange(rank, 'mm_min_investment', v)}
                    />
                    <FieldInput
                      label="MM最低直紹介数"
                      value={cond.mm_min_direct_referrals}
                      onChange={(v) => handleRankChange(rank, 'mm_min_direct_referrals', v)}
                      step="1"
                    />
                    <FieldInput
                      label="MM最低グループ運用額 ($)"
                      value={cond.mm_min_group_investment}
                      onChange={(v) => handleRankChange(rank, 'mm_min_group_investment', v)}
                    />
                  </div>
                  <p className="text-xs font-medium text-gray-500 mb-2 mt-4">ボーナス率</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <FieldInput
                      label="インフィニティ率 (%)"
                      value={cond.infinity_rate}
                      onChange={(v) => handleRankChange(rank, 'infinity_rate', v)}
                    />
                    <FieldInput
                      label="メガマッチ同ランク率 (%)"
                      value={cond.megamatch_same_rate}
                      onChange={(v) => handleRankChange(rank, 'megamatch_same_rate', v)}
                    />
                    <FieldInput
                      label="メガマッチ上位率 (%)"
                      value={cond.megamatch_upper_rate}
                      onChange={(v) => handleRankChange(rank, 'megamatch_upper_rate', v)}
                    />
                    <FieldInput
                      label="プール分配率 (%)"
                      value={cond.pool_distribution_rate}
                      onChange={(v) => handleRankChange(rank, 'pool_distribution_rate', v)}
                    />
                    <FieldInput
                      label="プール拠出率 (%)"
                      value={cond.pool_contribution_rate}
                      onChange={(v) => handleRankChange(rank, 'pool_contribution_rate', v)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'unilevel' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-700 mb-4">
              ユニレベル率
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              {unilevelRates.map((ur) => (
                <FieldInput
                  key={ur.level}
                  label={`レベル${ur.level} (%)`}
                  value={ur.rate}
                  onChange={(v) => handleUnilevelChange(ur.level, v)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={saveLoading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {saveLoading ? '保存中...' : '保存する'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface FieldInputProps {
  label: string;
  value: number;
  onChange: (value: string) => void;
  step?: string;
}

function FieldInput({ label, value, onChange, step = '0.01' }: FieldInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </div>
  );
}
