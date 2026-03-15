import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

type Rank = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

interface BonusSnapshot {
  unilevel_bonus: number;
  infinity_bonus: number;
  megamatch_bonus: number;
  pool_bonus: number;
  total_bonus: number;
  calculated_at: string;
}

interface Referrer {
  id: number;
  name: string;
  email: string;
  rank: Rank;
}

interface DirectReferral {
  id: number;
  name: string;
  email: string;
  rank: Rank;
  investment_amount: number;
}

interface SimpleMember {
  id: number;
  name: string;
}

interface MemberDetailData {
  id: number;
  name: string;
  email: string;
  role: string;
  rank: Rank;
  investment_amount: number;
  wallet_address: string | null;
  referrer: Referrer | null;
  direct_referrals: DirectReferral[];
  bonus_snapshot: BonusSnapshot | null;
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

const allRanks: Rank[] = ['none', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isRoot = currentUser?.role === 'root';

  const [member, setMember] = useState<MemberDetailData | null>(null);
  const [allMembers, setAllMembers] = useState<SimpleMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [investmentInput, setInvestmentInput] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // root用編集フィールド
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('member');
  const [editRank, setEditRank] = useState<Rank>('none');
  const [editReferrerId, setEditReferrerId] = useState('');
  const [editWalletAddress, setEditWalletAddress] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchMember = async () => {
    try {
      const res = await apiClient.get<MemberDetailData>(
        `/members/show.php?id=${id}`,
      );
      setMember(res.data);
      setInvestmentInput(String(res.data.investment_amount ?? 0));
      setEditName(res.data.name);
      setEditEmail(res.data.email);
      setEditRole(res.data.role);
      setEditRank(res.data.rank ?? 'none');
      setEditReferrerId(res.data.referrer?.id != null ? String(res.data.referrer.id) : '');
      setEditWalletAddress(res.data.wallet_address ?? '');
      setEditPassword('');
    } catch {
      setError('メンバー情報の取得に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchMember();
    if (isRoot) {
      void apiClient.get<SimpleMember[]>('/members/index.php').then((res) => {
        setAllMembers((res.data ?? []).map((m) => ({ id: m.id, name: m.name })));
      });
    }
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
        response?: { data?: { error?: string } };
      };
      setSaveError(
        axiosErr.response?.data?.error ?? '運用額の更新に失敗しました。',
      );
    } finally {
      setSaveLoading(false);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(false);
    setEditLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: editName,
        email: editEmail,
        role: editRole,
        rank: editRank,
        referrer_id: editReferrerId !== '' ? Number(editReferrerId) : null,
        wallet_address: editWalletAddress || null,
      };
      if (editPassword !== '') {
        payload.password = editPassword;
      }
      await apiClient.put(`/members/show.php?id=${id}`, payload);
      setEditSuccess(true);
      setEditPassword('');
      await fetchMember();
      setTimeout(() => setEditSuccess(false), 3000);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: string } };
      };
      setEditError(
        axiosErr.response?.data?.error ?? 'メンバー情報の更新に失敗しました。',
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/members/show.php?id=${id}`);
      void navigate('/admin/members');
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
        {isRoot ? (
          <>
            {editError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-red-700 text-sm">
                {editError}
              </div>
            )}
            {editSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-green-700 text-sm">
                メンバー情報を更新しました。
              </div>
            )}
            <form onSubmit={(e) => void handleEditSave(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メール</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ロール</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="admin">管理者</option>
                    <option value="member">メンバー</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ランク</label>
                  <select
                    value={editRank}
                    onChange={(e) => setEditRank(e.target.value as Rank)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {allRanks.map((r) => (
                      <option key={r} value={r}>{rankLabel[r]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">紹介者</label>
                  <select
                    value={editReferrerId}
                    onChange={(e) => setEditReferrerId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="">なし</option>
                    {allMembers
                      .filter((m) => m.id !== Number(id))
                      .map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ウォレットアドレス</label>
                  <input
                    type="text"
                    value={editWalletAddress}
                    onChange={(e) => setEditWalletAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    パスワード
                    <span className="text-xs text-gray-400 ml-1">（変更する場合のみ）</span>
                  </label>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="変更しない場合は空欄"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={editLoading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {editLoading ? '更新中...' : '基本情報を更新'}
              </button>
            </form>
          </>
        ) : (
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
                {member.referrer?.name ?? 'なし'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-gray-500 mb-0.5">ウォレットアドレス</p>
              <p className="text-gray-800 font-mono text-xs break-all">
                {member.wallet_address ?? '未設定'}
              </p>
            </div>
          </div>
        )}
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
                { label: 'ユニレベル', key: 'unilevel_bonus' },
                { label: 'インフィニティ', key: 'infinity_bonus' },
                { label: 'メガマッチ', key: 'megamatch_bonus' },
                { label: 'プール', key: 'pool_bonus' },
                { label: '合計', key: 'total_bonus' },
              ] as const
            ).map(({ label, key }) => (
              <div
                key={key}
                className={`rounded-lg p-4 text-center ${key === 'total_bonus' ? 'bg-indigo-50' : 'bg-gray-50'}`}
              >
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p
                  className={`text-base font-bold ${key === 'total_bonus' ? 'text-indigo-700' : 'text-gray-800'}`}
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
          直属メンバー ({member.direct_referrals?.length ?? 0}名)
        </h3>
        {!member.direct_referrals || member.direct_referrals.length === 0 ? (
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
                {member.direct_referrals.map((dm) => (
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

      {/* メンバー削除（管理者ユーザーには非表示） */}
      {member.role !== 'admin' && member.role !== 'root' && member.role !== 'pool' && (
        <div className="mt-6 border-t border-gray-200 pt-6">
          {deleteError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-red-700 text-sm">
              {deleteError}
            </div>
          )}
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            メンバーを削除
          </button>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              削除の確認
            </h3>
            <p className="text-sm text-gray-600 mb-5">
              本当に <span className="font-semibold text-gray-800">{member.name}</span> を削除しますか？この操作は取り消せません。
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
                  setShowDeleteDialog(false);
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
    </div>
  );
}
