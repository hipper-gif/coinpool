# coinpool

配当管理Webアプリ

## 技術スタック

- **フロントエンド**: React + TypeScript + Tailwind CSS (Vite)
- **バックエンド**: PHP + MySQL
- **デプロイ先**: エックスサーバー共有レンタルサーバー

## ディレクトリ構成

```
coinpool/
├── src/              # Reactフロントエンド
├── backend/
│   ├── api/          # PHP APIエンドポイント → サーバーにアップ
│   └── config/       # DB設定など
├── dist/             # ビルド後 → サーバーにアップ
└── public/
```

## デプロイ手順

1. `npm run build` で `dist/` を生成
2. `dist/` と `backend/` を FTP/SSH でエックスサーバーにアップロード

## 注意事項

- `backend/config/database.php` はGit管理しない（認証情報を含む）
- CORSは `backend/api/.htaccess` で設定済み
