import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/axios';
import type { Rank } from '../member/Dashboard';

// ---------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------

interface MemberRaw {
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

interface MemberNode {
  id: number;
  name: string;
  rank: Rank;
  investment_amount: number;
  children: MemberNode[];
  depth: number;
}

interface UnilevelRate {
  level: number;
  rate: number;
}

interface RankRates {
  infinity_rate: number;
  megamatch_same_rate: number;
  megamatch_upper_rate: number;
  pool_distribution_rate: number;
  pool_contribution_rate: number;
}

interface RatesResponse {
  unilevel_rates: UnilevelRate[];
  rank_conditions: Record<string, RankRates>;
}

// ---------------------------------------------------------------
// 定数
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

const RANK_BORDER: Record<Rank, string> = {
  none: 'border-l-gray-300',
  bronze: 'border-l-orange-400',
  silver: 'border-l-slate-400',
  gold: 'border-l-yellow-400',
  platinum: 'border-l-purple-400',
  diamond: 'border-l-blue-400',
};

// ---------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------

function buildTree(members: MemberRaw[]): MemberNode[] {
  const filtered = members.filter((m) => m.role !== 'root' && m.role !== 'pool');

  const nodeMap = new Map<number, MemberNode>();
  for (const m of filtered) {
    nodeMap.set(m.id, {
      id: m.id,
      name: m.name,
      rank: m.rank,
      investment_amount: m.investment_amount,
      children: [],
      depth: 1,
    });
  }

  const roots: MemberNode[] = [];
  for (const m of filtered) {
    const node = nodeMap.get(m.id);
    if (!node) continue;
    if (m.referrer_id === null || !nodeMap.has(m.referrer_id)) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(m.referrer_id);
      if (parent) parent.children.push(node);
    }
  }

  function setDepths(nodes: MemberNode[], depth: number) {
    for (const n of nodes) {
      n.depth = depth;
      setDepths(n.children, depth + 1);
    }
  }
  setDepths(roots, 1);

  return roots;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function countDescendants(node: MemberNode): number {
  let count = 0;
  for (const child of node.children) {
    count += 1 + countDescendants(child);
  }
  return count;
}

// ---------------------------------------------------------------
// ツリーノード
// ---------------------------------------------------------------

interface TreeNodeProps {
  node: MemberNode;
  isRoot?: boolean;
  expandedMap: Map<number, boolean>;
  onToggle: (id: number) => void;
  onNodeClick: (id: number) => void;
  unilevelRates: UnilevelRate[];
  rankConditions: Record<string, RankRates>;
}

function TreeNode({
  node,
  isRoot = false,
  expandedMap,
  onToggle,
  onNodeClick,
  unilevelRates,
  rankConditions,
}: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedMap.get(node.id) ?? false;

  // ユニレベル率（この深さのレベルに対応）
  const unilevelRate = unilevelRates.find((r) => r.level === node.depth);

  // ランクボーナス率
  const rankRates = node.rank !== 'none' ? rankConditions[node.rank] : null;

  return (
    <div className={isRoot ? '' : 'relative'}>
      {/* 接続線（ルート以外） */}
      {!isRoot && (
        <div className="absolute -left-4 top-0 bottom-0 w-px bg-gray-200" />
      )}
      {!isRoot && (
        <div className="absolute -left-4 top-5 w-4 h-px bg-gray-200" />
      )}

      {/* ノードカード */}
      <div
        className={`relative border-l-4 rounded-lg shadow-sm bg-white mb-2 transition-all hover:shadow-md ${RANK_BORDER[node.rank ?? 'none']} ${
          isRoot ? 'ring-1 ring-indigo-200 bg-indigo-50/30' : ''
        }`}
      >
        <div className="px-3 py-2.5 sm:px-4 sm:py-3">
          {/* 上段: トグル + アバター + 名前 + ランク */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) onToggle(node.id);
              }}
              className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-xs transition-colors ${
                hasChildren
                  ? 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 cursor-pointer'
                  : 'text-transparent cursor-default'
              }`}
            >
              {hasChildren && (
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>

            <div
              onClick={() => onNodeClick(node.id)}
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer ${
                isRoot
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {node.name.charAt(0)}
            </div>

            <span
              className="font-semibold text-gray-800 text-sm truncate min-w-0 cursor-pointer"
              onClick={() => onNodeClick(node.id)}
            >
              {node.name}
            </span>

            <span
              className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${RANK_BADGE_CLASS[node.rank ?? 'none']}`}
            >
              {RANK_LABEL[node.rank ?? 'none']}
            </span>
          </div>

          {/* 下段: 金額 + 紹介数 + 権利率 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 ml-[52px]">
            <span className="text-xs text-gray-500">
              {formatCurrency(node.investment_amount)}
            </span>
            {hasChildren && (
              <span className="text-xs text-gray-400">
                直紹介 {node.children.length}名
                {countDescendants(node) > node.children.length && (
                  <span className="ml-0.5">(傘下{countDescendants(node)})</span>
                )}
              </span>
            )}
            {unilevelRate && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                L{node.depth} {unilevelRate.rate.toFixed(2)}%
              </span>
            )}
            {rankRates && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                IB {rankRates.infinity_rate.toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        {/* 詳細率情報（ランクありの場合、展開時のみ） */}
        {rankRates && isExpanded && (
          <div className="px-3 pb-2.5 pt-0 sm:px-4">
            <div className="flex flex-wrap gap-1.5 ml-[52px]">
              <span className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded whitespace-nowrap">
                MM同 {rankRates.megamatch_same_rate}%
              </span>
              <span className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded whitespace-nowrap">
                MM上 {rankRates.megamatch_upper_rate}%
              </span>
              <span className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded whitespace-nowrap">
                Pool分 {rankRates.pool_distribution_rate}%
              </span>
              <span className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded whitespace-nowrap">
                Pool拠 {rankRates.pool_contribution_rate}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 子ノード */}
      {hasChildren && isExpanded && (
        <div className="ml-4 pl-3 sm:ml-8 sm:pl-4 relative">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              expandedMap={expandedMap}
              onToggle={onToggle}
              onNodeClick={onNodeClick}
              unilevelRates={unilevelRates}
              rankConditions={rankConditions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------

export default function AdminOrganization() {
  const navigate = useNavigate();
  const [trees, setTrees] = useState<MemberNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMap, setExpandedMap] = useState<Map<number, boolean>>(new Map());
  const [unilevelRates, setUnilevelRates] = useState<UnilevelRate[]>([]);
  const [rankConditions, setRankConditions] = useState<Record<string, RankRates>>({});

  // 全ノードIDを収集
  const collectIds = useCallback((nodes: MemberNode[]): number[] => {
    const ids: number[] = [];
    for (const n of nodes) {
      ids.push(n.id);
      ids.push(...collectIds(n.children));
    }
    return ids;
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [membersRes, ratesRes] = await Promise.all([
          apiClient.get<MemberRaw[]>('/members/index.php'),
          apiClient.get<RatesResponse>('/settings/rates.php'),
        ]);

        const roots = buildTree(membersRes.data ?? []);
        setTrees(roots);

        setUnilevelRates(ratesRes.data.unilevel_rates);
        setRankConditions(ratesRes.data.rank_conditions);

        // デフォルト: ルートノードのみ展開
        const initialMap = new Map<number, boolean>();
        for (const root of roots) {
          initialMap.set(root.id, true);
        }
        setExpandedMap(initialMap);
      } catch {
        setError('組織ツリーの取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };

    void fetchAll();
  }, []);

  const handleToggle = (id: number) => {
    setExpandedMap((prev) => {
      const next = new Map(prev);
      next.set(id, !prev.get(id));
      return next;
    });
  };

  const handleExpandAll = () => {
    const allIds = collectIds(trees);
    const next = new Map<number, boolean>();
    for (const id of allIds) next.set(id, true);
    setExpandedMap(next);
  };

  const handleCollapseAll = () => {
    setExpandedMap(new Map());
  };

  const handleNodeClick = (id: number) => {
    void navigate(`/admin/members/${id}`);
  };

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

  // 統計
  const totalNodes = collectIds(trees).length;

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">組織ツリー</h2>
        <p className="text-sm text-gray-500 mt-1">
          全メンバーの紹介ネットワークとボーナス権利率
        </p>
      </div>

      {/* ツールバー */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-500">全 {totalNodes} 名</span>
        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={handleExpandAll}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition"
          >
            全て展開
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="text-xs text-gray-600 hover:text-gray-800 font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
          >
            全て折りたたむ
          </button>
        </div>
      </div>

      {/* ユニレベル率の凡例 */}
      {unilevelRates.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            ユニレベルボーナス率（階層別）
          </p>
          <div className="flex flex-wrap gap-2">
            {unilevelRates.map((r) => (
              <span
                key={r.level}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full"
              >
                <span>Level {r.level}</span>
                <span className="text-emerald-500">→</span>
                <span>{r.rate.toFixed(2)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ツリー本体 */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 overflow-x-auto">
        {trees.length > 0 ? (
          <div>
            {trees.map((root) => (
              <TreeNode
                key={root.id}
                node={root}
                isRoot
                expandedMap={expandedMap}
                onToggle={handleToggle}
                onNodeClick={handleNodeClick}
                unilevelRates={unilevelRates}
                rankConditions={rankConditions}
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-8">
            組織データがありません。
          </p>
        )}
      </div>

      {/* ランク凡例 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          ランク別ボーナス率
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(['bronze', 'silver', 'gold', 'platinum', 'diamond'] as Rank[]).map((r) => {
            const rates = rankConditions[r];
            if (!rates) return null;
            return (
              <div key={r} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${RANK_BADGE_CLASS[r]}`}>
                <span className="font-bold">{RANK_LABEL[r]}</span>
                <span className="opacity-70">
                  IB {rates.infinity_rate}% / MM {rates.megamatch_same_rate}% / Pool {rates.pool_distribution_rate}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
