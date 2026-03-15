import { useState, useEffect, useMemo, useRef } from 'react';
import apiClient from '../../api/axios';

type Rank = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

interface MemberListItem {
  id: number;
  name: string;
  email: string;
  rank: Rank;
}

interface UnilevelRate {
  level: number;
  rate: number;
}

interface Referrer {
  id: number;
  name: string;
  email: string;
  rank: Rank;
}

interface MemberDetail {
  id: number;
  name: string;
  email: string;
  rank: Rank;
  investment_amount: number;
  wallet_address: string | null;
  revenue: number;
  referrer: Referrer | null;
}

interface UnilevelFlowItem {
  level: number;
  rate: number;
  amount: number;
  recipient: {
    id: number;
    name: string;
    email: string;
    rank: Rank;
    wallet_address: string | null;
  } | null;
}

interface BonusReceived {
  unilevel_bonus: number;
  infinity_bonus: number;
  megamatch_bonus: number;
  pool_bonus: number;
  total_bonus: number;
  calculated_at: string;
}

interface DirectReferral {
  id: number;
  name: string;
  email: string;
  rank: Rank;
  investment_amount: number;
}

interface TransferAllocationItem {
  label: string;
  pct: number;
  wallet_address: string | null;
  recipient_name: string | null;
}

interface FeeWallet {
  label: string;
  wallet_address: string;
  share_pct: number;
  actual_pct: number;
}

interface TransferAllocation {
  fee_tier: { company_fee_rate: number; affiliate_fee_rate: number };
  member: { pct: number; wallet_address: string | null };
  unilevel: TransferAllocationItem[];
  unilevel_total_pct: number;
  infinity: (TransferAllocationItem & { recipient_rank?: string })[];
  infinity_total_pct: number;
  pool_contribution: { pct: number; wallet_address: string | null; label: string };
  company: FeeWallet[];
  company_total_pct: number;
  unallocated_pct: number;
  total_pct: number;
}

interface MemberListResponse {
  members: MemberListItem[];
  unilevel_rates: UnilevelRate[];
}

interface MemberDetailResponse {
  member: MemberDetail;
  unilevel_flow: UnilevelFlowItem[];
  unilevel_rates: UnilevelRate[];
  bonus_received: BonusReceived | null;
  direct_referrals: DirectReferral[];
  transfer_allocation: TransferAllocation;
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

function fmtUsd(v: number): string {
  return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MemberInfo() {
  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [detail, setDetail] = useState<MemberDetailResponse | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch member list on mount
  useEffect(() => {
    apiClient
      .get<MemberListResponse>('/members/info.php')
      .then((res) => setMembers(res.data.members ?? []))
      .catch(() => setListError('メンバー一覧の取得に失敗しました。'))
      .finally(() => setIsLoadingList(false));
  }, []);

  // Fetch detail when selected member changes
  useEffect(() => {
    if (selectedMemberId === null) {
      setDetail(null);
      return;
    }
    setIsLoadingDetail(true);
    setDetailError(null);
    apiClient
      .get<MemberDetailResponse>('/members/info.php', { params: { id: selectedMemberId } })
      .then((res) => setDetail(res.data))
      .catch(() => setDetailError('メンバー情報の取得に失敗しました。'))
      .finally(() => setIsLoadingDetail(false));
  }, [selectedMemberId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  // Filtered member list based on search
  const filteredMembers = useMemo(() => {
    if (!searchText.trim()) return members;
    const q = searchText.trim().toLowerCase();
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [members, searchText]);

  // Selected member name for display
  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );

  if (isLoadingList) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (listError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        {listError}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <h2 className="text-2xl font-bold text-gray-800 mb-2">ユーザー情報</h2>
      <p className="text-sm text-gray-500 mb-6">
        メンバーを選択して、配当レートやユニレベル配分先を確認できます。
      </p>

      {/* Member Selector */}
      <div className="mb-8" ref={dropdownRef}>
        <label className="block text-sm font-medium text-gray-700 mb-2">メンバーを選択</label>
        <div className="relative max-w-md">
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
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="名前・メールで検索..."
            className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
          {selectedMember && (
            <button
              type="button"
              onClick={() => {
                setSelectedMemberId(null);
                setSearchText('');
                setDetail(null);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              &times;
            </button>
          )}
          {showDropdown && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {filteredMembers.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400">
                  該当するメンバーがいません
                </div>
              ) : (
                filteredMembers.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => {
                      setSelectedMemberId(m.id);
                      setSearchText(m.name);
                      setShowDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 flex items-center justify-between transition-colors ${
                      selectedMemberId === m.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                    }`}
                  >
                    <span>
                      <span className="font-medium">{m.name}</span>
                      <span className="text-gray-400 ml-2 text-xs">{m.email}</span>
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rankBadge[m.rank ?? 'none']}`}>
                      {rankLabel[m.rank ?? 'none']}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {selectedMember && (
          <p className="text-xs text-indigo-600 mt-1.5">
            選択中: {selectedMember.name}（{selectedMember.email}）
          </p>
        )}
      </div>

      {/* Loading detail */}
      {isLoadingDetail && (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      )}

      {/* Detail error */}
      {detailError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-6">
          {detailError}
        </div>
      )}

      {/* Member detail */}
      {detail && !isLoadingDetail && (
        <div className="space-y-6">
          {/* 転送設定プレビュー */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">転送設定プレビュー</h3>
            <p className="text-xs text-gray-500 mb-4">
              手数料ティア: 会社 {detail.transfer_allocation.fee_tier.company_fee_rate}% + AF {detail.transfer_allocation.fee_tier.affiliate_fee_rate}%
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">区分</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">転送先</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">ウォレット</th>
                    <th className="text-right py-3 px-4 text-gray-500 font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 本人 */}
                  <tr className="border-b border-gray-50 bg-green-50">
                    <td className="py-3 px-4 font-medium text-green-800">本人</td>
                    <td className="py-3 px-4 text-green-700">{detail.member.name}</td>
                    <td className="py-3 px-4 text-xs font-mono text-green-600 max-w-[160px] truncate" title={detail.transfer_allocation.member.wallet_address ?? ''}>
                      {detail.transfer_allocation.member.wallet_address
                        ? detail.transfer_allocation.member.wallet_address.slice(0, 6) + '...' + detail.transfer_allocation.member.wallet_address.slice(-4)
                        : '未設定'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-green-700 tabular-nums">{detail.transfer_allocation.member.pct}%</td>
                  </tr>

                  {/* Section separator: ユニレベル */}
                  {detail.transfer_allocation.unilevel.length > 0 && (
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="py-1.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">① ユニレベル（合計 {detail.transfer_allocation.unilevel_total_pct}%）</td>
                    </tr>
                  )}
                  {detail.transfer_allocation.unilevel.map((item, i) => (
                    <tr key={`uni-${i}`} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-4 text-gray-600 text-xs">{item.label}</td>
                      <td className="py-2.5 px-4 text-gray-800 font-medium">{item.recipient_name ?? <span className="text-gray-400">---</span>}</td>
                      <td className="py-2.5 px-4 text-xs font-mono text-gray-500 max-w-[160px] truncate" title={item.wallet_address ?? ''}>
                        {item.wallet_address ? item.wallet_address.slice(0, 6) + '...' + item.wallet_address.slice(-4) : '---'}
                      </td>
                      <td className="py-2.5 px-4 text-right text-indigo-700 font-semibold tabular-nums">{item.pct}%</td>
                    </tr>
                  ))}

                  {/* Section separator: インフィニティ */}
                  {detail.transfer_allocation.infinity.length > 0 && (
                    <>
                      <tr className="bg-gray-50">
                        <td colSpan={4} className="py-1.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">② インフィニティ（合計 {detail.transfer_allocation.infinity_total_pct}%）</td>
                      </tr>
                      {detail.transfer_allocation.infinity.map((item, i) => (
                        <tr key={`inf-${i}`} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 px-4 text-gray-600 text-xs">{item.label}</td>
                          <td className="py-2.5 px-4 text-gray-800 font-medium">{item.recipient_name}</td>
                          <td className="py-2.5 px-4 text-xs font-mono text-gray-500 max-w-[160px] truncate" title={item.wallet_address ?? ''}>
                            {item.wallet_address ? item.wallet_address.slice(0, 6) + '...' + item.wallet_address.slice(-4) : '---'}
                          </td>
                          <td className="py-2.5 px-4 text-right text-indigo-700 font-semibold tabular-nums">{item.pct}%</td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* Section separator: プール拠出 */}
                  {detail.transfer_allocation.pool_contribution.pct > 0 && (
                    <>
                      <tr className="bg-gray-50">
                        <td colSpan={4} className="py-1.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">④ プール拠出</td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="py-2.5 px-4 text-gray-600 text-xs">{detail.transfer_allocation.pool_contribution.label}</td>
                        <td className="py-2.5 px-4 text-gray-800 font-medium">プール</td>
                        <td className="py-2.5 px-4 text-xs font-mono text-gray-500 max-w-[160px] truncate">
                          {detail.transfer_allocation.pool_contribution.wallet_address
                            ? detail.transfer_allocation.pool_contribution.wallet_address.slice(0, 6) + '...' + detail.transfer_allocation.pool_contribution.wallet_address.slice(-4)
                            : '未設定'}
                        </td>
                        <td className="py-2.5 px-4 text-right text-indigo-700 font-semibold tabular-nums">{detail.transfer_allocation.pool_contribution.pct}%</td>
                      </tr>
                    </>
                  )}

                  {/* Section separator: 会社手数料 */}
                  {detail.transfer_allocation.company.length > 0 && (
                    <>
                      <tr className="bg-gray-50">
                        <td colSpan={4} className="py-1.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">会社手数料（合計 {detail.transfer_allocation.company_total_pct}%）</td>
                      </tr>
                      {detail.transfer_allocation.company.map((fw, i) => (
                        <tr key={`co-${i}`} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 px-4 text-gray-600 text-xs">{fw.label}</td>
                          <td className="py-2.5 px-4 text-gray-500 text-xs">（会社手数料の{fw.share_pct}%）</td>
                          <td className="py-2.5 px-4 text-xs font-mono text-gray-500 max-w-[160px] truncate" title={fw.wallet_address}>
                            {fw.wallet_address.slice(0, 6) + '...' + fw.wallet_address.slice(-4)}
                          </td>
                          <td className="py-2.5 px-4 text-right text-indigo-700 font-semibold tabular-nums">{fw.actual_pct}%</td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* Unallocated */}
                  {detail.transfer_allocation.unallocated_pct > 0 && (
                    <tr className="border-b border-gray-50 bg-yellow-50">
                      <td className="py-2.5 px-4 text-yellow-700 text-xs font-medium">未配分</td>
                      <td colSpan={2} className="py-2.5 px-4 text-yellow-600 text-xs">ボーナス原資の余剰（上位者不足等）</td>
                      <td className="py-2.5 px-4 text-right text-yellow-700 font-semibold tabular-nums">{detail.transfer_allocation.unallocated_pct}%</td>
                    </tr>
                  )}
                </tbody>

                {/* Total footer */}
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                  <tr className="font-bold text-gray-800">
                    <td className="py-3 px-4" colSpan={3}>合計</td>
                    <td className="py-3 px-4 text-right tabular-nums text-lg">{detail.transfer_allocation.total_pct}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 基本情報カード */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">基本情報</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">名前</p>
                <p className="text-sm font-medium text-gray-800">{detail.member.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">メール</p>
                <p className="text-sm text-gray-700">{detail.member.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">ランク</p>
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${rankBadge[detail.member.rank ?? 'none']}`}>
                  {rankLabel[detail.member.rank ?? 'none']}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">運用額</p>
                <p className="text-sm font-medium text-gray-800">{fmtUsd(detail.member.investment_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">収益（運用額 x 5%）</p>
                <p className="text-sm font-medium text-indigo-700">{fmtUsd(detail.member.revenue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">ウォレットアドレス</p>
                <p className="text-sm text-gray-700 font-mono break-all">
                  {detail.member.wallet_address || '未設定'}
                </p>
              </div>
              {detail.member.referrer && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="text-xs text-gray-500 mb-1">紹介者</p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{detail.member.referrer.name}</span>
                    <span className="text-gray-400 ml-2 text-xs">{detail.member.referrer.email}</span>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ml-2 ${rankBadge[detail.member.referrer.rank ?? 'none']}`}>
                      {rankLabel[detail.member.referrer.rank ?? 'none']}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 受取ボーナス内訳 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">受取ボーナス内訳</h3>
            {detail.bonus_received ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">ユニレベル</p>
                    <p className="text-lg font-bold text-gray-800 tabular-nums">
                      {fmtUsd(detail.bonus_received.unilevel_bonus)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">インフィニティ</p>
                    <p className="text-lg font-bold text-gray-800 tabular-nums">
                      {fmtUsd(detail.bonus_received.infinity_bonus)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">メガマッチ</p>
                    <p className="text-lg font-bold text-gray-800 tabular-nums">
                      {fmtUsd(detail.bonus_received.megamatch_bonus)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">プール</p>
                    <p className="text-lg font-bold text-gray-800 tabular-nums">
                      {fmtUsd(detail.bonus_received.pool_bonus)}
                    </p>
                  </div>
                  <div className="bg-indigo-50 rounded-xl shadow-sm p-4 text-center">
                    <p className="text-xs text-indigo-600 mb-1">合計</p>
                    <p className="text-lg font-bold text-indigo-700 tabular-nums">
                      {fmtUsd(detail.bonus_received.total_bonus)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  最終計算日時: {detail.bonus_received.calculated_at}
                </p>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">
                ボーナス計算がまだ実行されていません。
              </div>
            )}
          </div>

          {/* 直紹介メンバー */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">直紹介メンバー</h3>
            {detail.direct_referrals.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">名前</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">メール</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">ランク</th>
                        <th className="text-right py-3 px-4 text-gray-500 font-medium">運用額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.direct_referrals.map((ref) => (
                        <tr
                          key={ref.id}
                          className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-3 px-4 text-gray-800 font-medium">{ref.name}</td>
                          <td className="py-3 px-4 text-gray-600">{ref.email}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${rankBadge[ref.rank ?? 'none']}`}>
                              {rankLabel[ref.rank ?? 'none']}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-gray-700 tabular-nums">
                            {fmtUsd(ref.investment_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-400 text-sm">
                直紹介メンバーはいません。
              </div>
            )}
          </div>
        </div>
      )}

      {/* Placeholder when no member selected */}
      {!selectedMemberId && !isLoadingDetail && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-300 mb-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
          <p className="text-gray-400 text-sm">上の検索からメンバーを選択してください。</p>
        </div>
      )}
    </div>
  );
}
