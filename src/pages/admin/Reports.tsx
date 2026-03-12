import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/axios';

// ---------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------

type Rank = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

interface ReportMember {
  user_id: number;
  name: string;
  rank: Rank;
  unilevel_bonus: number;
  infinity_bonus: number;
  megamatch_bonus: number;
  pool_bonus: number;
  total_bonus: number;
  pool_contribution: number;
  net_bonus: number;
}

interface ReportSummary {
  total_unilevel: number;
  total_infinity: number;
  total_megamatch: number;
  total_pool: number;
  total_bonus: number;
  total_pool_contribution: number;
  total_net: number;
}

interface ReportResponse {
  year_month: string;
  members: ReportMember[];
  summary: ReportSummary;
}

interface ConfirmResponse {
  message: string;
  year_month: string;
  count: number;
}

// ---------------------------------------------------------------
// ヘルパー
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

function formatCurrency(value: number): string {
  return value.toLocaleString('ja-JP', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function getCurrentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

// ---------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------

export default function AdminReports() {
  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);

  const fetchReport = useCallback(async (ym: string) => {
    setLoading(true);
    setError(null);
    setConfirmMessage(null);
    try {
      const res = await apiClient.get<ReportResponse>(
        `/reports/index.php?year_month=${ym}`,
      );
      setReport(res.data);
    } catch {
      setError('レポートの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReport(yearMonth);
  }, [yearMonth, fetchReport]);

  const handleConfirm = async () => {
    if (!window.confirm(`${yearMonth} のレポートを確定しますか？`)) return;

    setConfirming(true);
    setConfirmMessage(null);
    setError(null);
    try {
      const res = await apiClient.post<ConfirmResponse>(
        '/reports/index.php',
        { year_month: yearMonth },
      );
      setConfirmMessage(res.data.message);
      // 確定後にリロード
      await fetchReport(yearMonth);
    } catch {
      setError('レポートの確定に失敗しました。');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">月次レポート</h2>

      {/* 月選択 */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => setYearMonth((prev) => shiftMonth(prev, -1))}
          className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium text-gray-700 transition"
        >
          前月
        </button>
        <input
          type="month"
          value={yearMonth}
          onChange={(e) => setYearMonth(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="button"
          onClick={() => setYearMonth((prev) => shiftMonth(prev, 1))}
          className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium text-gray-700 transition"
        >
          次月
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={confirming}
          className="ml-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
        >
          {confirming ? '確定中...' : 'レポート確定'}
        </button>
      </div>

      {/* メッセージ */}
      {confirmMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 mb-4 text-sm">
          {confirmMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* テーブル */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      ) : report && report.members.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">
                    名前
                  </th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">
                    ランク
                  </th>
                  <th className="text-right py-3 px-4 text-gray-600 font-medium">
                    ユニレベル
                  </th>
                  <th className="text-right py-3 px-4 text-gray-600 font-medium">
                    インフィニティ
                  </th>
                  <th className="text-right py-3 px-4 text-gray-600 font-medium">
                    メガマッチ
                  </th>
                  <th className="text-right py-3 px-4 text-gray-600 font-medium">
                    プール
                  </th>
                  <th className="text-right py-3 px-4 text-gray-600 font-medium">
                    合計
                  </th>
                  <th className="text-right py-3 px-4 text-gray-600 font-medium">
                    プール拠出
                  </th>
                  <th className="text-right py-3 px-4 text-gray-600 font-medium">
                    実質受取
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.members.map((m) => (
                  <tr
                    key={m.user_id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition"
                  >
                    <td className="py-2.5 px-4 text-gray-800 font-medium">
                      {m.name}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${RANK_BADGE_CLASS[m.rank ?? 'none']}`}
                      >
                        {RANK_LABEL[m.rank ?? 'none']}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-700">
                      {formatCurrency(m.unilevel_bonus)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-700">
                      {formatCurrency(m.infinity_bonus)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-700">
                      {formatCurrency(m.megamatch_bonus)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-700">
                      {formatCurrency(m.pool_bonus)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-800 font-semibold">
                      {formatCurrency(m.total_bonus)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-red-600">
                      {formatCurrency(m.pool_contribution)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-indigo-600 font-semibold">
                      {formatCurrency(m.net_bonus)}
                    </td>
                  </tr>
                ))}
                {/* 合計行 */}
                <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                  <td className="py-3 px-4 text-gray-800" colSpan={2}>
                    合計
                  </td>
                  <td className="py-3 px-4 text-right text-gray-800">
                    {formatCurrency(report.summary.total_unilevel)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-800">
                    {formatCurrency(report.summary.total_infinity)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-800">
                    {formatCurrency(report.summary.total_megamatch)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-800">
                    {formatCurrency(report.summary.total_pool)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-800">
                    {formatCurrency(report.summary.total_bonus)}
                  </td>
                  <td className="py-3 px-4 text-right text-red-600">
                    {formatCurrency(report.summary.total_pool_contribution)}
                  </td>
                  <td className="py-3 px-4 text-right text-indigo-600">
                    {formatCurrency(report.summary.total_net)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-gray-400">
            {yearMonth} のレポートデータはありません。
          </p>
          <p className="text-gray-400 text-sm mt-1">
            「レポート確定」ボタンで現在のボーナスデータを保存できます。
          </p>
        </div>
      )}
    </div>
  );
}
