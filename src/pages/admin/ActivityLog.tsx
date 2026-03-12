import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/axios';

interface LogEntry {
  id: number;
  user_name: string | null;
  action: string;
  target_name: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

interface LogResponse {
  logs: LogEntry[];
  total: number;
}

const ACTION_LABELS: Record<string, string> = {
  login: 'ログイン',
  logout: 'ログアウト',
  member_add: 'メンバー追加',
  member_delete: 'メンバー削除',
  investment_update: '運用額更新',
  settings_update: '設定変更',
  report_confirm: 'レポート確定',
};

const ACTION_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'login', label: 'ログイン' },
  { value: 'logout', label: 'ログアウト' },
  { value: 'member_add', label: 'メンバー追加' },
  { value: 'member_delete', label: 'メンバー削除' },
  { value: 'investment_update', label: '運用額更新' },
  { value: 'settings_update', label: '設定変更' },
  { value: 'report_confirm', label: 'レポート確定' },
];

const PAGE_SIZE = 50;

export default function ActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (currentOffset: number, action: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        limit: PAGE_SIZE,
        offset: currentOffset,
      };
      if (action) {
        params.action = action;
      }
      const res = await apiClient.get<LogResponse>('/activity/index.php', { params });
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch {
      setError('アクティビティログの取得に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs(offset, actionFilter);
  }, [offset, actionFilter, fetchLogs]);

  const handleFilterChange = (value: string) => {
    setActionFilter(value);
    setOffset(0);
  };

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handlePrev = () => {
    if (offset > 0) {
      setOffset(offset - PAGE_SIZE);
    }
  };

  const handleNext = () => {
    if (offset + PAGE_SIZE < total) {
      setOffset(offset + PAGE_SIZE);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (error && logs.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">アクティビティログ</h2>

      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm font-medium text-gray-600">アクション:</label>
        <select
          value={actionFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">日時</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">操作者</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">アクション</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">対象</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    読み込み中...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    ログがありません。
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {log.user_name ?? 'システム'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-1 rounded-full">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {log.target_name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {log.ip_address ?? '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              全 {total} 件中 {offset + 1} - {Math.min(offset + PAGE_SIZE, total)} 件
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={offset === 0}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                前へ
              </button>
              <span className="text-sm text-gray-600">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={handleNext}
                disabled={offset + PAGE_SIZE >= total}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
