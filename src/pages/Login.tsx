import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // すでにログイン済みならリダイレクト
  if (user) {
    const dashboard =
      user.role === 'admin' ? '/admin/dashboard' : '/member/dashboard';
    navigate(dashboard, { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('メールアドレスを入力してください。');
      return;
    }
    if (!password.trim()) {
      setError('パスワードを入力してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      // login後にuserが更新される → useEffectでリダイレクトは不要、ここで遷移
      // AuthContext内でuserがセットされるので再レンダリング時に上のguardが発動する
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'ログインに失敗しました。';
      // axiosエラーからサーバーメッセージを取得
      const axiosErr = err as {
        response?: { data?: { message?: string } };
      };
      setError(
        axiosErr?.response?.data?.message ??
          message ??
          'メールアドレスまたはパスワードが正しくありません。'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">CoinPool</h1>
          <p className="text-sm text-gray-500 mt-1">配当管理システム</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* エラーメッセージ */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* メールアドレス */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="example@email.com"
              disabled={isSubmitting}
            />
          </div>

          {/* パスワード */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="••••••••"
              disabled={isSubmitting}
            />
          </div>

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
          >
            {isSubmitting ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
