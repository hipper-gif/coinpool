import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../contexts/AuthContext';
import type { ReactNode } from 'react';

interface PrivateRouteProps {
  role: UserRole;
  children: ReactNode;
}

export default function PrivateRoute({ role, children }: PrivateRouteProps) {
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

  // rootはadminルートにもアクセス可能
  const hasAccess =
    user.role === role ||
    (role === 'admin' && user.role === 'root');

  if (!hasAccess) {
    const dashboard =
      user.role === 'admin' || user.role === 'root'
        ? '/admin/dashboard'
        : '/member/dashboard';
    return <Navigate to={dashboard} replace />;
  }

  return <>{children}</>;
}
