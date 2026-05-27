# バーチャル天心苑祈祷室

天心苑祈祷会のバーチャル共在システム。  
参加者がアバターとして俯瞰空間に集まり、存在感を共有しながら祈祷会に参加できる。

---

## 概要

| 項目 | 内容 |
|------|------|
| 利用シーン | 平日 22:00〜25:00 の祈祷会 |
| 同時接続 | 最大72席（座布団）+ 自由移動エリア |
| アクセス制限 | 合言葉を知る参加者のみ |
| 運用コスト | 完全無料（Supabase + Vercel 無料枠） |

---

## 利用方法

### 入室手順

1. **合言葉を入力**して「確認」ボタンを押す
   - 前回ログイン済みの場合、プロフィールが自動表示される → ワンタップで即入室可能
2. **お名前**と**プロフィール写真**（任意）を設定して「祈祷室に入室」ボタンを押す
   - 写真はスマホのカメラまたはギャラリーから選択可能
   - 自動で 200×200px に圧縮される
3. バーチャル祈祷室が開く

### 祈祷室での操作

| 操作 | 動作 |
|------|------|
| 床をタップ / クリック | アバターが移動 |
| 座布団をタップ | 着席確認ダイアログ → 着席 |
| 他人が着席中の座布団をタップ | 話しかける（Google Meet 連携） |
| 他者のアバターをタップ | 話しかける（Google Meet 連携） |
| ヘッダー「🪑 離席」ボタン | 座布団から立ち上がる |
| ヘッダー「👥 N」ボタン | 参加者一覧を表示 |
| ヘッダー「💬」ボタン（モバイル）| チャットを開閉 |
| ヘッダー「退室」ボタン | 確認後に退室 |

### スマートフォンのジェスチャー

| ジェスチャー | 動作 |
|-------------|------|
| 2本指ピンチ | ズームイン / ズームアウト（1〜4倍） |
| ズーム中に1本指ドラッグ | 画面をパン（スクロール） |
| ダブルタップ | ズームをリセット |

### 話しかける機能

1. 相手のアバターまたは着席中の座布団をタップ
2. 「📞 話しかける」ボタンを押す
3. Google Meet リンクが自動生成される
4. 相手に「📞 〇〇さんから話しかけられています」という通知が届く
5. 両者が Meet リンクから通話に参加する

---

## 管理者向け

### 合言葉の変更

1. Vercel ダッシュボード → 対象プロジェクト → **Settings → Environment Variables**
2. `ACCESS_PASSPHRASE` の値を新しい合言葉に更新
3. 「Save」→ **Redeploy**（または次回デプロイ時に自動適用）

### 環境変数一覧

```env
ACCESS_PASSPHRASE=          # 合言葉
SESSION_SECRET=             # 32文字以上のランダム文字列
NEXT_PUBLIC_SUPABASE_URL=   # Supabase プロジェクト URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anon キー
SUPABASE_SERVICE_ROLE_KEY=  # Supabase service role キー（バックエンドのみ）
```

---

## 開発環境のセットアップ

```bash
# 依存パッケージのインストール
npm install

# .env.local を作成して環境変数を設定
cp .env.local.example .env.local
# （または手動で上記の環境変数を記入）

# 開発サーバー起動
npm run dev
# → http://localhost:3000
```

### Supabase の初期セットアップ

```bash
# Supabase ダッシュボードの SQL Editor で実行
supabase/migrations/001_initial_schema.sql

# ※ 現行 DB には以下のカラムが追加されている（migration に記載なし）
# sessions.avatar_url TEXT
# sessions.seat_id TEXT
```

### Supabase Storage の設定

1. Supabase ダッシュボード → **Storage** → バケット作成
2. バケット名: `avatars`、**Public** に設定
3. **Realtime** → Database → Replication から `sessions` / `messages` / `call_requests` を有効化

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| 認証 | iron-session（合言葉 + Cookie） |
| データベース | Supabase (PostgreSQL) |
| リアルタイム | Supabase Realtime (WebSocket) |
| 画像ストレージ | Supabase Storage |
| 音声通話 | Google Meet（外部委任） |
| デプロイ | Vercel |

---

## 注意事項

- **音声・動画通信はシステムが扱わない**。通話は Google Meet に完全委任
- YouTube ライブは各自が個別に開く（システムには組み込んでいない）
- チャットは直近8時間分のみ保持される（自動削除）
- ブラウザを閉じると自動的に退室扱いになる（30秒ハートビートでタイムアウト検知）
- プロフィール写真はブラウザの localStorage に保存される。プライベートブラウザでは毎回再設定が必要
