import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AdminLayout from './components/layouts/AdminLayout';
import MemberLayout from './components/layouts/MemberLayout';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import Members from './pages/admin/Members';
import MemberDetail from './pages/admin/MemberDetail';
import Settings from './pages/admin/Settings';
import AdminOrganization from './pages/admin/Organization';
import FeeTable from './pages/admin/FeeTable';
import AdminReports from './pages/admin/Reports';
import ActivityLog from './pages/admin/ActivityLog';
import Rights from './pages/admin/Rights';
import MemberDashboard from './pages/member/Dashboard';
import Organization from './pages/member/Organization';
import MemberReports from './pages/member/Reports';
import Profile from './pages/Profile';

/** ルートパス: ログイン済みならrole別ダッシュボードへ、未ログインなら/loginへ */
function RootRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-500 text-lg">読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const dashboard =
    user.role === 'admin' || user.role === 'root'
      ? '/admin/dashboard'
      : '/member/dashboard';
  return <Navigate to={dashboard} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* ルート */}
      <Route path="/" element={<RootRedirect />} />

      {/* ログイン */}
      <Route path="/login" element={<Login />} />

      {/* 管理者ルート */}
      <Route
        path="/admin"
        element={
          <PrivateRoute role="admin">
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="members" element={<Members />} />
        <Route path="members/:id" element={<MemberDetail />} />
        <Route path="organization" element={<AdminOrganization />} />
        <Route path="fees" element={<FeeTable />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="rights" element={<Rights />} />
        <Route path="activity" element={<ActivityLog />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* メンバールート */}
      <Route
        path="/member"
        element={
          <PrivateRoute role="member">
            <MemberLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/member/dashboard" replace />} />
        <Route path="dashboard" element={<MemberDashboard />} />
        <Route path="organization" element={<Organization />} />
        <Route path="reports" element={<MemberReports />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* 未マッチはルートへ */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/coinpool">
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
