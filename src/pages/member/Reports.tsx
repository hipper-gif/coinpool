import { useState, useEffect } from 'react';
import apiClient from '../../api/axios';

// ---------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------

interface MonthlyReport {
  year_month: string;
  unilevel_bonus: number;
  infinity_bonus: number;
  megamatch_bonus: number;
  pool_bonus: number;
  total_bonus: number;
  pool_contribution: number;
  net_bonus: number;
}

// ---------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------

function formatCurrency(value: number): string {
  return value.toLocaleString('ja-JP', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return `${y}年${parseInt(m, 10)}月`;
}

// ---------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------

export default function MemberReports() {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<MonthlyReport[]>(
          '/reports/my.php?limit=12',
        );
        setReports(res.data);
      } catch {
        setError('レポートの取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };

    void fetchReports();
  }, []);

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

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        月次レポート履歴
      </h2>

      {reports.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-gray-400">レポートデータはまだありません。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <div
              key={r.year_month}
              className="bg-white rounded-xl shadow-sm p-6"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                {formatYearMonth(r.year_month)}
              </h3>

              {/* ボーナス内訳 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <BonusItem label="ユニレベル" value={r.unilevel_bonus} />
                <BonusItem label="インフィニティ" value={r.infinity_bonus} />
                <BonusItem label="メガマッチ" value={r.megamatch_bonus} />
                <BonusItem label="プール" value={r.pool_bonus} />
              </div>

              {/* 合計・拠出・実質 */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">合計ボーナス</span>
                  <span className="text-base font-semibold text-gray-800">
                    {formatCurrency(r.total_bonus)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">プール拠出</span>
                  <span className="text-sm text-red-600">
                    -{formatCurrency(r.pool_contribution)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-gray-100 pt-2">
                  <span className="text-sm font-medium text-gray-700">
                    実質受取額
                  </span>
                  <span className="text-xl font-bold text-indigo-600">
                    {formatCurrency(r.net_bonus)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// サブコンポーネント
// ---------------------------------------------------------------

interface BonusItemProps {
  label: string;
  value: number;
}

function BonusItem({ label, value }: BonusItemProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-base font-semibold text-gray-800">
        {formatCurrency(value)}
      </p>
    </div>
  );
}
