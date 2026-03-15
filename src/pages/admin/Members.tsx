import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/axios';
import ExportButton from '../../components/ExportButton';

type Rank = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

type SortKey = 'name' | 'rank' | 'investment_amount' | 'group_investment';
type SortOrder = 'asc' | 'desc';

interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  rank: Rank;
  investment_amount: number;
  direct_referral_count: number;
  group_investment: number;
  referrer_id: number | null;
  referrer_name: string | null;
}

interface AddMemberForm {
  name: string;
  email: string;
  password: string;
  referrer_id: string;
}

const allRanks: Rank[] = ['none', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];

const rankLabel: Record<Rank, string> = {
  none: 'なし',
  bronze: 'ブロンズ',
  silver: 'シルバー',
  gold: 'ゴールド',
  platinum: 'プラチナ',
  diamond: 'ダイヤモンド',
};

const rankOrder: Record<Rank, number> = {
  none: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  diamond: 5,
};

const rankBadge: Record<Rank, string> = {
  none: 'bg-gray-100 text-gray-600',
  bronze: 'bg-orange-100 text-orange-700',
  silver: 'bg-slate-100 text-slate-700',
  gold: 'bg-yellow-100 text-yellow-700',
  platinum: 'bg-purple-100 text-purple-700',
  diamond: 'bg-blue-100 text-blue-700',
};

const sortKeyLabel: Record<SortKey, string> = {
  name: '名前',
  rank: 'ランク',
  investment_amount: '運用額',
  group_investment: 'グループ運用額',
};

function SortIcon({ sortKey, currentKey, order }: { sortKey: SortKey; currentKey: SortKey | null; order: SortOrder }) {
  const isActive = sortKey === currentKey;
  return (
    <span className="inline-flex flex-col ml-1 leading-none text-[10px]">
      <span className={isActive && order === 'asc' ? 'text-indigo-600' : 'text-gray-300'}>&#9650;</span>
      <span className={isActive && order === 'desc' ? 'text-indigo-600' : 'text-gray-300'}>&#9660;</span>
    </span>
  );
}

export default function Members() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState<AddMemberForm>({
    name: '',
    email: '',
    password: '',
    referrer_id: '',
  });

  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 紹介者検索
  const [referrerQuery, setReferrerQuery] = useState('');
  const [showReferrerDropdown, setShowReferrerDropdown] = useState(false);
  const referrerRef = useRef<HTMLDivElement>(null);

  // 検索・フィルター・ソート state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRanks, setSelectedRanks] = useState<Set<Rank>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showRankDropdown, setShowRankDropdown] = useState(false);

  const fetchMembers = async () => {
    try {
      const res = await apiClient.get<Member[]>('/members/index.php');
      setMembers(res.data ?? []);
    } catch {
      setError('メンバー一覧の取得に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchMembers();
  }, []);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!showRankDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-rank-dropdown]')) {
        setShowRankDropdown(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showRankDropdown]);

  const toggleRank = (rank: Rank) => {
    setSelectedRanks((prev) => {
      const next = new Set(prev);
      if (next.has(rank)) {
        next.delete(rank);
      } else {
        next.add(rank);
      }
      return next;
    });
  };

  // 紹介者候補のフィルタリング
  const referrerCandidates = useMemo(() => {
    if (!referrerQuery.trim()) return members;
    const q = referrerQuery.trim().toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        String(m.id).includes(q),
    );
  }, [members, referrerQuery]);

  // 紹介者ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!showReferrerDropdown) return;
    const handler = (e: MouseEvent) => {
      if (referrerRef.current && !referrerRef.current.contains(e.target as Node)) {
        setShowReferrerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showReferrerDropdown]);

  const handleSortClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // フィルタ・ソート済みメンバー
  const filteredMembers = useMemo(() => {
    let result = [...members];

    // 検索フィルタ
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q),
      );
    }

    // ランクフィルタ
    if (selectedRanks.size > 0) {
      result = result.filter((m) => selectedRanks.has(m.rank ?? 'none'));
    }

    // ソート
    if (sortKey) {
      result.sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case 'name':
            cmp = a.name.localeCompare(b.name, 'ja');
            break;
          case 'rank':
            cmp = rankOrder[a.rank ?? 'none'] - rankOrder[b.rank ?? 'none'];
            break;
          case 'investment_amount':
            cmp = (a.investment_amount ?? 0) - (b.investment_amount ?? 0);
            break;
          case 'group_investment':
            cmp = (a.group_investment ?? 0) - (b.group_investment ?? 0);
            break;
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [members, searchQuery, selectedRanks, sortKey, sortOrder]);

  const handleRowClick = (id: number) => {
    void navigate(`/admin/members/${id}`);
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);
    try {
      await apiClient.post('/members/index.php', {
        name: form.name,
        email: form.email,
        password: form.password,
        referrer_id: form.referrer_id !== '' ? Number(form.referrer_id) : null,
      });
      setShowModal(false);
      setForm({ name: '', email: '', password: '', referrer_id: '' });
      setReferrerQuery('');
      setIsLoading(true);
      await fetchMembers();
    } catch (err: unknown) {
      let message = 'メンバーの追加に失敗しました。';
      if (err instanceof Error && 'response' in err) {
        const res = (err as { response?: { data?: unknown } }).response;
        if (
          res?.data &&
          typeof res.data === 'object' &&
          'error' in res.data &&
          typeof (res.data as { error?: unknown }).error === 'string'
        ) {
          message = (res.data as { error: string }).error;
        }
      }
      setFormError(message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/members/show.php?id=${deleteTarget.id}`);
      setDeleteTarget(null);
      setIsLoading(true);
      await fetchMembers();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: string } };
      };
      setDeleteError(
        axiosErr.response?.data?.error ?? 'メンバーの削除に失敗しました。',
      );
    } finally {
      setDeleteLoading(false);
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

  const rankFilterLabel =
    selectedRanks.size === 0
      ? '全てのランク'
      : [...selectedRanks].map((r) => rankLabel[r]).join(', ');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">メンバー管理</h2>
        <div className="flex items-center gap-3">
          <ExportButton />
          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            ＋ メンバー追加
          </button>
        </div>
      </div>

      {/* 検索バー・ランクフィルター・件数表示 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* 検索バー */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="名前・メールで検索..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
        </div>

        {/* ランクフィルター（複数選択ドロップダウン） */}
        <div className="relative" data-rank-dropdown>
          <button
            type="button"
            onClick={() => setShowRankDropdown((prev) => !prev)}
            className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-[140px]"
          >
            <span className="truncate max-w-[180px]">{rankFilterLabel}</span>
            <svg className="h-4 w-4 text-gray-400 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
          {showRankDropdown && (
            <div className="absolute z-20 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
              {selectedRanks.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedRanks(new Set())}
                  className="w-full text-left px-3 py-1.5 text-xs text-indigo-600 hover:bg-gray-50"
                >
                  選択をクリア
                </button>
              )}
              {allRanks.map((rank) => (
                <label
                  key={rank}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedRanks.has(rank)}
                    onChange={() => toggleRank(rank)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${rankBadge[rank]}`}>
                    {rankLabel[rank]}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 件数表示 */}
        <span className="text-sm text-gray-500 whitespace-nowrap">
          {filteredMembers.length}件 / 全{members.length}件
        </span>
      </div>

      {/* ソート中の表示 */}
      {sortKey && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-500">
            ソート: {sortKeyLabel[sortKey]}（{sortOrder === 'asc' ? '昇順' : '降順'}）
          </span>
          <button
            type="button"
            onClick={() => {
              setSortKey(null);
              setSortOrder('asc');
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            クリア
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th
                  className="text-left py-3 px-4 text-gray-500 font-medium cursor-pointer select-none hover:text-gray-700"
                  onClick={() => handleSortClick('name')}
                >
                  <span className="inline-flex items-center">
                    名前
                    <SortIcon sortKey="name" currentKey={sortKey} order={sortOrder} />
                  </span>
                </th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">
                  メール
                </th>
                <th
                  className="text-left py-3 px-4 text-gray-500 font-medium cursor-pointer select-none hover:text-gray-700"
                  onClick={() => handleSortClick('rank')}
                >
                  <span className="inline-flex items-center">
                    ランク
                    <SortIcon sortKey="rank" currentKey={sortKey} order={sortOrder} />
                  </span>
                </th>
                <th
                  className="text-right py-3 px-4 text-gray-500 font-medium cursor-pointer select-none hover:text-gray-700"
                  onClick={() => handleSortClick('investment_amount')}
                >
                  <span className="inline-flex items-center justify-end">
                    運用額
                    <SortIcon sortKey="investment_amount" currentKey={sortKey} order={sortOrder} />
                  </span>
                </th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">
                  直紹介数
                </th>
                <th
                  className="text-right py-3 px-4 text-gray-500 font-medium cursor-pointer select-none hover:text-gray-700"
                  onClick={() => handleSortClick('group_investment')}
                >
                  <span className="inline-flex items-center justify-end">
                    グループ運用額
                    <SortIcon sortKey="group_investment" currentKey={sortKey} order={sortOrder} />
                  </span>
                </th>
                <th className="py-3 px-4 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-8 text-gray-400"
                  >
                    {members.length === 0
                      ? 'メンバーがいません。'
                      : '条件に一致するメンバーがいません。'}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => handleRowClick(m.id)}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 text-gray-800 font-medium">
                      {m.name}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{m.email}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${rankBadge[m.rank ?? 'none']}`}
                      >
                        {rankLabel[m.rank ?? 'none']}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">
                      $
                      {(m.investment_amount ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">
                      {m.direct_referral_count ?? 0}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">
                      $
                      {(m.group_investment ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {m.role !== 'admin' && m.role !== 'root' && m.role !== 'pool' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(m);
                          }}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="削除"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              削除の確認
            </h3>
            {deleteError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-red-700 text-sm">
                {deleteError}
              </div>
            )}
            <p className="text-sm text-gray-600 mb-5">
              本当に <span className="font-semibold text-gray-800">{deleteTarget.name}</span> を削除しますか？この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => void handleDelete()}
                disabled={deleteLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {deleteLoading ? '削除中...' : '削除する'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* メンバー追加モーダル */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              メンバー追加
            </h3>
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
                {formError}
              </div>
            )}
            <form onSubmit={(e) => void handleAddMember(e)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名前
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メール
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード
                </label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleFormChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div ref={referrerRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  紹介者
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="名前・メール・IDで検索..."
                    value={referrerQuery}
                    onChange={(e) => {
                      setReferrerQuery(e.target.value);
                      setShowReferrerDropdown(true);
                      if (e.target.value === '') {
                        setForm((prev) => ({ ...prev, referrer_id: '' }));
                      }
                    }}
                    onFocus={() => setShowReferrerDropdown(true)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {form.referrer_id && (
                    <button
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, referrer_id: '' }));
                        setReferrerQuery('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
                    >
                      &times;
                    </button>
                  )}
                  {showReferrerDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, referrer_id: '' }));
                          setReferrerQuery('');
                          setShowReferrerDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
                      >
                        紹介者なし
                      </button>
                      {referrerCandidates.map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => {
                            setForm((prev) => ({ ...prev, referrer_id: String(m.id) }));
                            setReferrerQuery(m.name);
                            setShowReferrerDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center justify-between ${
                            form.referrer_id === String(m.id) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                          }`}
                        >
                          <span>
                            <span className="font-medium">{m.name}</span>
                            <span className="text-gray-400 ml-2 text-xs">{m.email}</span>
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${rankBadge[m.rank ?? 'none']}`}>
                            {rankLabel[m.rank ?? 'none']}
                          </span>
                        </button>
                      ))}
                      {referrerCandidates.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-400">
                          該当するメンバーがいません
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {form.referrer_id && (
                  <p className="text-xs text-indigo-600 mt-1">
                    選択中: {members.find((m) => String(m.id) === form.referrer_id)?.name ?? ''}
                    （ID: {form.referrer_id}）
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  {formLoading ? '追加中...' : '追加する'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormError(null);
                    setForm({
                      name: '',
                      email: '',
                      password: '',
                      referrer_id: '',
                    });
                    setReferrerQuery('');
                    setShowReferrerDropdown(false);
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
