import { useState, useEffect } from 'react';
import apiClient from '../../api/axios';

type Rank = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

interface RankCondition {
  min_investment: number;
  min_direct_referrals: number;
  min_group_investment: number;
  infinity_rate: number;
  mega_match_same_rate: number;
  mega_match_upper_rate: number;
  pool_distribution_rate: number;
  pool_contribution_rate: number;
}

interface UnilevelRates {
  level1: number;
  level2: number;
  level3: number;
  level4: number;
}

interface SettingsData {
  rank_conditions: Record<Rank, RankCondition>;
  unilevel_rates: UnilevelRates;
}

interface SettingsResponse {
  settings: SettingsData;
}

const rankLabel: Record<Rank, string> = {
  bronze: 'ブロンズ',
  silver: 'シルバー',
  gold: 'ゴールド',
  platinum: 'プラチナ',
  diamond: 'ダイヤモンド',
};

const rankOrder: Rank[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

const defaultRankCondition: RankCondition = {
  min_investment: 0,
  min_direct_referrals: 0,
  min_group_investment: 0,
  infinity_rate: 0,
  mega_match_same_rate: 0,
  mega_match_upper_rate: 0,
  pool_distribution_rate: 0,
  pool_contribution_rate: 0,
};

const defaultSettings: SettingsData = {
  rank_conditions: {
    bronze: { ...defaultRankCondition },
    silver: { ...defaultRankCondition },
    gold: { ...defaultRankCondition },
    platinum: { ...defaultRankCondition },
    diamond: { ...defaultRankCondition },
  },
  unilevel_rates: { level1: 0, level2: 0, level3: 0, level4: 0 },
};

type Tab = 'rank' | 'unilevel';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('rank');
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiClient.get<SettingsResponse>('/settings/index.php');
        setSettings(res.data.settings);
      } catch {
        setError('設定の取得に失敗しました。');
      } finally {
        setIsLoading(false);
      }
    };
    void fetchSettings();
  }, []);

  const handleRankChange = (
    rank: Rank,
    field: keyof RankCondition,
    value: string,
  ) => {
    setSettings((prev) => ({
      ...prev,
      rank_conditions: {
        ...prev.rank_conditions,
        [rank]: {
          ...prev.rank_conditions[rank],
          [field]: Number(value),
        },
      },
    }));
  };

  const handleUnilevelChange = (
    level: keyof UnilevelRates,
    value: string,
  ) => {
    setSettings((prev) => ({
      ...prev,
      unilevel_rates: {
        ...prev.unilevel_rates,
        [level]: Number(value),
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);
    setSaveLoading(true);
    try {
      await apiClient.put('/settings/index.php', { settings });
      setSaveSuccess(true);
      // 3秒後に成功メッセージを消す
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string } };
      };
      setSaveError(
        axiosErr.response?.data?.message ?? '設定の保存に失敗しました。',
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

      {/* タブ */}
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
        {/* ランク条件タブ */}
        {activeTab === 'rank' && (
          <div className="space-y-4">
            {rankOrder.map((rank) => {
              const cond = settings.rank_conditions[rank] ?? defaultRankCondition;
              return (
                <div key={rank} className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-base font-semibold text-gray-700 mb-4">
                    {rankLabel[rank]}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <FieldInput
                      label="最低運用額 ($)"
                      value={cond.min_investment}
                      onChange={(v) => handleRankChange(rank, 'min_investment', v)}
                    />
                    <FieldInput
                      label="最低直紹介数"
                      value={cond.min_direct_referrals}
                      onChange={(v) =>
                        handleRankChange(rank, 'min_direct_referrals', v)
                      }
                      step="1"
                    />
                    <FieldInput
                      label="最低グループ運用額 ($)"
                      value={cond.min_group_investment}
                      onChange={(v) =>
                        handleRankChange(rank, 'min_group_investment', v)
                      }
                    />
                    <FieldInput
                      label="インフィニティ率 (%)"
                      value={cond.infinity_rate}
                      onChange={(v) =>
                        handleRankChange(rank, 'infinity_rate', v)
                      }
                    />
                    <FieldInput
                      label="メガマッチ同ランク率 (%)"
                      value={cond.mega_match_same_rate}
                      onChange={(v) =>
                        handleRankChange(rank, 'mega_match_same_rate', v)
                      }
                    />
                    <FieldInput
                      label="メガマッチ上位率 (%)"
                      value={cond.mega_match_upper_rate}
                      onChange={(v) =>
                        handleRankChange(rank, 'mega_match_upper_rate', v)
                      }
                    />
                    <FieldInput
                      label="プール分配率 (%)"
                      value={cond.pool_distribution_rate}
                      onChange={(v) =>
                        handleRankChange(rank, 'pool_distribution_rate', v)
                      }
                    />
                    <FieldInput
                      label="プール拠出率 (%)"
                      value={cond.pool_contribution_rate}
                      onChange={(v) =>
                        handleRankChange(rank, 'pool_contribution_rate', v)
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ユニレベル率タブ */}
        {activeTab === 'unilevel' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-700 mb-4">
              ユニレベル率
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              {(
                ['level1', 'level2', 'level3', 'level4'] as (keyof UnilevelRates)[]
              ).map((level) => (
                <FieldInput
                  key={level}
                  label={`レベル${level.replace('level', '')} (%)`}
                  value={settings.unilevel_rates[level]}
                  onChange={(v) => handleUnilevelChange(level, v)}
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
