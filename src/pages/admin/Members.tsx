import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/axios';

type Rank = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

interface Member {
  id: number;
  name: string;
  email: string;
  rank: Rank;
  investment_amount: number;
  direct_referrals: number;
  group_investment: number;
  referrer_id: number | null;
  created_at: string;
}

interface MembersResponse {
  members: Member[];
}

interface AddMemberForm {
  name: string;
  email: string;
  password: string;
  referrer_id: string;
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

  const fetchMembers = async () => {
    try {
      const res = await apiClient.get<MembersResponse>('/members/index.php');
      setMembers(res.data.members ?? []);
    } catch {
      setError('メンバー一覧の取得に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchMembers();
  }, []);

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
      setIsLoading(true);
      await fetchMembers();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string } };
      };
      setFormError(
        axiosErr.response?.data?.message ?? 'メンバーの追加に失敗しました。',
      );
    } finally {
      setFormLoading(false);
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">メンバー管理</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          ＋ メンバー追加
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">
                  名前
                </th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">
                  メール
                </th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">
                  ランク
                </th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">
                  運用額
                </th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">
                  直紹介数
                </th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">
                  グループ運用額
                </th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">
                  登録日
                </th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-8 text-gray-400"
                  >
                    メンバーがいません。
                  </td>
                </tr>
              ) : (
                members.map((m) => (
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
                      {m.direct_referrals ?? 0}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">
                      $
                      {(m.group_investment ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {m.created_at
                        ? new Date(m.created_at).toLocaleDateString('ja-JP')
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  紹介者
                </label>
                <select
                  name="referrer_id"
                  value={form.referrer_id}
                  onChange={handleFormChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">なし</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
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
