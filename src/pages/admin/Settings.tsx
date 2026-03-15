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

interface SystemSettings {
  bonus_cap_rate: number;
}

interface CompanyWallet {
  id?: number;
  label: string;
  wallet_address: string;
  percentage: number;
  wallet_type: 'fee' | 'pool';
  sort_order: number;
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

type Tab = 'rank' | 'unilevel' | 'system' | 'wallets';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('rank');
  const [rankConditions, setRankConditions] = useState<RankConditionRow[]>([]);
  const [unilevelRates, setUnilevelRates] = useState<UnilevelRateRow[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({ bonus_cap_rate: 0 });
  const [companyWallets, setCompanyWallets] = useState<CompanyWallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [res, sysRes] = await Promise.all([
          apiClient.get<ApiResponse>('/settings/index.php'),
          apiClient.get<SystemSettings>('/settings/system.php'),
        ]);
        setRankConditions(res.data.rank_conditions);
        setUnilevelRates(res.data.unilevel_rates);
        setSystemSettings(sysRes.data);
        try {
          const walletsRes = await apiClient.get<{ wallets: CompanyWallet[] }>('/company-wallets/index.php');
          setCompanyWallets(walletsRes.data.wallets);
        } catch {
          // table may not exist yet — ignore
        }
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
      if (activeTab === 'system') {
        await apiClient.put('/settings/system.php', systemSettings);
      } else if (activeTab === 'wallets') {
        await apiClient.put('/company-wallets/index.php', { wallets: companyWallets });
      } else {
        await apiClient.put('/settings/index.php', {
          rank_conditions: rankConditions,
          unilevel_rates: unilevelRates,
        });
      }
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
        <button
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'system'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          システム設定
        </button>
        <button
          onClick={() => setActiveTab('wallets')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'wallets'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          会社ウォレット
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

        {activeTab === 'system' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-700 mb-4">
              システム設定
            </h3>
            <div className="max-w-sm text-sm">
              <FieldInput
                label="ボーナス上限率 (%)"
                value={systemSettings.bonus_cap_rate}
                onChange={(v) =>
                  setSystemSettings((prev) => ({ ...prev, bonus_cap_rate: Number(v) }))
                }
                step="0.1"
              />
              <p className="text-xs text-gray-500 mt-2">
                メンバーの投資額に対するボーナス合計の上限。0で無制限。
              </p>
            </div>
          </div>
        )}

        {activeTab === 'wallets' && (
          <div>
            {(() => {
              const feeTotal = companyWallets
                .filter((w) => w.wallet_type === 'fee')
                .reduce((sum, w) => sum + w.percentage, 0);
              return (
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className={`inline-block text-xs font-medium rounded-full px-3 py-1 ${
                      Math.abs(feeTotal - 100) < 0.01
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    fee合計: {feeTotal.toFixed(2)}%
                  </span>
                  {Math.abs(feeTotal - 100) >= 0.01 && (
                    <span className="text-xs text-red-600">
                      fee タイプの配分率合計が100%になっていません
                    </span>
                  )}
                </div>
              );
            })()}

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">
                        ラベル
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">
                        ウォレットアドレス
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">
                        タイプ
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">
                        配分率 (%)
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">
                        並び順
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-600">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyWallets.map((wallet, index) => (
                      <tr
                        key={index}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={wallet.label}
                            onChange={(e) =>
                              setCompanyWallets((prev) =>
                                prev.map((w, i) =>
                                  i === index ? { ...w, label: e.target.value } : w,
                                ),
                              )
                            }
                            className="w-40 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={wallet.wallet_address}
                            onChange={(e) =>
                              setCompanyWallets((prev) =>
                                prev.map((w, i) =>
                                  i === index
                                    ? { ...w, wallet_address: e.target.value }
                                    : w,
                                ),
                              )
                            }
                            className="w-64 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            placeholder="0x..."
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={wallet.wallet_type}
                            onChange={(e) =>
                              setCompanyWallets((prev) =>
                                prev.map((w, i) =>
                                  i === index
                                    ? { ...w, wallet_type: e.target.value as 'fee' | 'pool' }
                                    : w,
                                ),
                              )
                            }
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          >
                            <option value="fee">手数料配分先</option>
                            <option value="pool">プール拠出先</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={wallet.percentage}
                            onChange={(e) =>
                              setCompanyWallets((prev) =>
                                prev.map((w, i) =>
                                  i === index
                                    ? { ...w, percentage: Number(e.target.value) }
                                    : w,
                                ),
                              )
                            }
                            className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={wallet.sort_order}
                            onChange={(e) =>
                              setCompanyWallets((prev) =>
                                prev.map((w, i) =>
                                  i === index
                                    ? { ...w, sort_order: Number(e.target.value) }
                                    : w,
                                ),
                              )
                            }
                            className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setCompanyWallets((prev) =>
                                prev.filter((_, i) => i !== index),
                              )
                            }
                            className="text-red-400 hover:text-red-600 transition-colors text-xs font-medium"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {companyWallets.length === 0 && (
                <p className="text-center text-gray-400 py-8 text-sm">
                  ウォレットがありません。行を追加してください。
                </p>
              )}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() =>
                  setCompanyWallets((prev) => [
                    ...prev,
                    {
                      label: '',
                      wallet_address: '',
                      percentage: 0,
                      wallet_type: 'fee',
                      sort_order: prev.length + 1,
                    },
                  ])
                }
                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-colors"
              >
                + 行を追加
              </button>
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
