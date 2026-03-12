import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import apiClient from '../../api/axios';

interface FeeRow {
  id?: number;
  min_amount: number;
  max_amount: number | null;
  company_fee_rate: number;
  affiliate_fee_rate: number;
}

const emptyRow = (): FeeRow => ({
  min_amount: 0,
  max_amount: null,
  company_fee_rate: 0,
  affiliate_fee_rate: 0,
});

export default function FeeTable() {
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchFees = async () => {
      try {
        const res = await apiClient.get<FeeRow[]>('/fees/index.php');
        setRows(res.data);
      } catch {
        setError('手数料テーブルの取得に失敗しました。');
      } finally {
        setIsLoading(false);
      }
    };
    void fetchFees();
  }, []);

  const handleChange = (
    index: number,
    field: keyof FeeRow,
    value: string,
  ) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (field === 'max_amount') {
          return { ...row, max_amount: value === '' ? null : Number(value) };
        }
        return { ...row, [field]: Number(value) };
      }),
    );
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);
    setSaveLoading(true);
    try {
      await apiClient.put('/fees/index.php', rows);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError('手数料テーブルの保存に失敗しました。');
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
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        手数料テーブル設定
      </h2>

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-green-700 text-sm">
          手数料テーブルを保存しました。
        </div>
      )}

      <form onSubmit={(e) => void handleSave(e)}>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    #
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    最低投資額 ($)
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    最高投資額 ($)
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    会社手数料 (%)
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    アフィリエイト報酬 (%)
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    合計 (%)
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const total = row.company_fee_rate + row.affiliate_fee_rate;
                  return (
                    <tr
                      key={index}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.min_amount}
                          onChange={(e) =>
                            handleChange(index, 'min_amount', e.target.value)
                          }
                          className="w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.max_amount ?? ''}
                          placeholder="上限なし"
                          onChange={(e) =>
                            handleChange(index, 'max_amount', e.target.value)
                          }
                          className="w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={row.company_fee_rate}
                          onChange={(e) =>
                            handleChange(
                              index,
                              'company_fee_rate',
                              e.target.value,
                            )
                          }
                          className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={row.affiliate_fee_rate}
                          onChange={(e) =>
                            handleChange(
                              index,
                              'affiliate_fee_rate',
                              e.target.value,
                            )
                          }
                          className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block min-w-[3rem] text-center font-medium rounded-full px-2.5 py-0.5 text-xs ${
                            total > 50
                              ? 'bg-red-100 text-red-700'
                              : total > 30
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {total.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="text-red-400 hover:text-red-600 transition-colors text-xs font-medium"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {rows.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">
              手数料データがありません。行を追加してください。
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={addRow}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-colors"
          >
            + 行を追加
          </button>

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
