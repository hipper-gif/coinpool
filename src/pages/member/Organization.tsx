import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../api/axios';
import type { Rank } from './Dashboard';

// ---------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------

interface MemberNode {
  id: number;
  name: string;
  rank: Rank;
  investment_amount: number;
  children: MemberNode[];
}

interface MemberShowResponse {
  id: number;
  name: string;
  rank: Rank;
  investment_amount: number;
  direct_referrals: {
    id: number;
    name: string;
    email: string;
    rank: Rank;
    investment_amount: number;
  }[];
}

// ---------------------------------------------------------------
// ランクバッジ（Dashboard と同様）
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

function RankBadge({ rank }: { rank: Rank }) {
  return (
    <span
      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${RANK_BADGE_CLASS[rank]}`}
    >
      {RANK_LABEL[rank]}
    </span>
  );
}

// ---------------------------------------------------------------
// ツリー構築（最大4段まで再帰 API 呼び出し）
// ---------------------------------------------------------------

const MAX_DEPTH = 4;

async function fetchNode(id: number, depth: number): Promise<MemberNode> {
  const res = await apiClient.get<MemberShowResponse>(`/members/show.php?id=${id}`);
  const data = res.data;

  let children: MemberNode[] = [];

  if (depth < MAX_DEPTH && data.direct_referrals.length > 0) {
    children = await Promise.all(
      data.direct_referrals.map((child) => fetchNode(child.id, depth + 1))
    );
  }

  return {
    id: data.id,
    name: data.name,
    rank: data.rank,
    investment_amount: data.investment_amount,
    children,
  };
}

// ---------------------------------------------------------------
// 数値フォーマット
// ---------------------------------------------------------------

function formatCurrency(value: number): string {
  return value.toLocaleString('ja-JP', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------
// ツリーノード表示（再帰コンポーネント）
// ---------------------------------------------------------------

interface TreeNodeProps {
  node: MemberNode;
  depth: number;
  isRoot?: boolean;
}

function TreeNode({ node, depth, isRoot = false }: TreeNodeProps) {
  return (
    <div>
      {/* ノード本体 */}
      <div
        className={`flex items-center gap-3 py-2 px-3 rounded-lg ${
          isRoot
            ? 'bg-indigo-50 border border-indigo-200'
            : 'bg-white border border-gray-100 hover:bg-gray-50'
        }`}
      >
        {/* アイコン */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
            isRoot
              ? 'bg-indigo-500 text-white'
              : 'bg-gray-200 text-gray-600'
          }`}
        >
          {node.name.charAt(0)}
        </div>

        {/* 名前 */}
        <span className="font-medium text-gray-800 text-sm min-w-0 truncate">
          {node.name}
          {isRoot && (
            <span className="ml-1.5 text-xs text-indigo-500 font-normal">（自分）</span>
          )}
        </span>

        {/* ランクバッジ */}
        <RankBadge rank={node.rank} />

        {/* 運用額 */}
        <span className="ml-auto text-sm text-gray-500 flex-shrink-0">
          {formatCurrency(node.investment_amount)}
        </span>
      </div>

      {/* 子ノード */}
      {node.children.length > 0 && (
        <div className="ml-6 mt-1 space-y-1 border-l-2 border-gray-100 pl-4">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------

export default function Organization() {
  const { user } = useAuth();

  const [tree, setTree] = useState<MemberNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const build = async () => {
      setLoading(true);
      setError(null);
      try {
        const root = await fetchNode(user.id, 1);
        setTree(root);
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'response' in err &&
          err.response &&
          typeof err.response === 'object' &&
          'data' in err.response &&
          err.response.data &&
          typeof err.response.data === 'object' &&
          'error' in err.response.data
        ) {
          setError(String((err.response.data as { error: string }).error));
        } else {
          setError('組織ツリーの取得に失敗しました。');
        }
      } finally {
        setLoading(false);
      }
    };

    build();
  }, [user]);

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
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">組織ツリー</h2>
      <p className="text-sm text-gray-500">
        自分を起点とした紹介ネットワーク（最大4段まで表示）
      </p>

      <div className="bg-white rounded-xl shadow-sm p-6">
        {tree ? (
          <div className="space-y-1">
            <TreeNode node={tree} depth={1} isRoot />
          </div>
        ) : (
          <p className="text-gray-500 text-sm">組織データがありません。</p>
        )}
      </div>

      {/* 凡例 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <p className="text-xs font-medium text-gray-500 mb-2">ランク凡例</p>
        <div className="flex flex-wrap gap-2">
          {(
            ['none', 'bronze', 'silver', 'gold', 'platinum', 'diamond'] as Rank[]
          ).map((r) => (
            <span
              key={r}
              className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${RANK_BADGE_CLASS[r]}`}
            >
              {RANK_LABEL[r]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
