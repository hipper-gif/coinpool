import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { label: 'ダッシュボード', to: '/admin/dashboard' },
  { label: 'メンバー管理', to: '/admin/members' },
  { label: '配当権一覧', to: '/admin/rights' },
  { label: 'ユーザー情報', to: '/admin/member-info' },
  { label: '組織ツリー', to: '/admin/organization' },
  { label: '手数料テーブル', to: '/admin/fees' },
  { label: '月次レポート', to: '/admin/reports' },
  { label: 'アクティビティ', to: '/admin/activity' },
  { label: '設定', to: '/admin/settings' },
];

export default function AdminLayout() {
  const { logout, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* モバイルヘッダー */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center gap-3 bg-gray-900 px-4 py-3 text-white md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1 text-gray-300 hover:text-white"
          aria-label="メニューを開く"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <img src="/coinpool/logo.png" alt="CoinPool" className="h-7 w-7 rounded-lg" />
        <span className="text-lg font-bold tracking-wide">CoinPool</span>
      </div>

      {/* オーバーレイ（モバイルのみ） */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col shrink-0 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:static md:z-auto`}
      >
        {/* ロゴ */}
        <div className="px-6 py-5 border-b border-gray-700 flex items-center gap-3">
          <img src="/coinpool/logo.png" alt="CoinPool" className="w-9 h-9 rounded-lg" />
          <div>
            <h1 className="text-xl font-bold tracking-wide">CoinPool</h1>
            <p className="text-xs text-gray-400">{user?.role === 'root' ? 'システム管理者' : '管理者'}</p>
          </div>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeSidebar}
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
          <NavLink
            to="/admin/profile"
            onClick={closeSidebar}
            className={({ isActive }) =>
              `block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            プロフィール
          </NavLink>
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
        <main className="flex-1 overflow-y-auto p-4 pt-16 md:p-8 md:pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
