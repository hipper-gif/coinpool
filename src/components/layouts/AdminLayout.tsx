import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { label: 'ダッシュボード', to: '/admin/dashboard' },
  { label: 'メンバー管理', to: '/admin/members' },
  { label: '設定', to: '/admin/settings' },
];

export default function AdminLayout() {
  const { logout, user } = useAuth();

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* サイドバー */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
        {/* ロゴ */}
        <div className="px-6 py-5 border-b border-gray-700">
          <h1 className="text-xl font-bold tracking-wide">CoinPool</h1>
          <p className="text-xs text-gray-400 mt-1">管理者</p>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* ユーザー情報 & ログアウト */}
        <div className="px-4 py-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 px-4 mb-2 truncate">
            {user?.name}
          </p>
          <button
            onClick={logout}
            className="w-full text-left px-4 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            ログアウト
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
