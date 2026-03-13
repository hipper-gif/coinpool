import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/axios';
import type { User } from '../contexts/AuthContext';

interface ProfileResponse {
  message: string;
  user: User;
}

export default function Profile() {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setWalletAddress(user.wallet_address ?? '');
    }
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    // パスワード確認バリデーション
    if (showPasswordSection && newPassword) {
      if (newPassword !== confirmPassword) {
        setErrorMessage('新しいパスワードと確認用パスワードが一致しません');
        return;
      }
      if (newPassword.length < 6) {
        setErrorMessage('新しいパスワードは6文字以上で入力してください');
        return;
      }
      if (!currentPassword) {
        setErrorMessage('現在のパスワードを入力してください');
        return;
      }
    }

    // 送信データを構築
    const data: Record<string, string | null> = {};
    if (name !== user?.name) data.name = name;
    if (email !== user?.email) data.email = email;
    if (walletAddress !== (user?.wallet_address ?? '')) data.wallet_address = walletAddress || null;
    if (showPasswordSection && newPassword) {
      data.current_password = currentPassword;
      data.new_password = newPassword;
    }

    if (Object.keys(data).length === 0) {
      setErrorMessage('変更する項目がありません');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.put<ProfileResponse>('/auth/profile.php', data);
      updateUser(res.data.user);
      setSuccessMessage(res.data.message);
      // パスワードフィールドをクリア
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setErrorMessage(
        error.response?.data?.error ?? 'エラーが発生しました'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">プロフィール編集</h1>

      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded-md text-sm">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
        {/* 基本情報 */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            名前
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        <div>
          <label htmlFor="walletAddress" className="block text-sm font-medium text-gray-700 mb-1">
            ウォレットアドレス
          </label>
          <input
            id="walletAddress"
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="0x..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
          />
        </div>

        {/* パスワード変更セクション */}
        <div className="border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => {
              setShowPasswordSection(!showPasswordSection);
              if (showPasswordSection) {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }
            }}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
          >
            {showPasswordSection ? 'パスワード変更をキャンセル' : 'パスワードを変更する'}
          </button>

          {showPasswordSection && (
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  現在のパスワード
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  新しいパスワード
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="6文字以上"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  新しいパスワード（確認）
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* 保存ボタン */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
