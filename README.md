# バーチャル天心苑祈祷室

天心苑祈祷会のバーチャル共在システム。参加者がアバターとして俯瞰空間に集まり、存在感を共有しながら祈祷会に参加できる。

---

## 機能

- **アバター共在**: 俯瞰視点のキャンバス上にアバターが表示され、リアルタイムで位置が同期される
- **座布団着席**: 左右72席の座布団に着席・離席できる
- **チャット**: リアルタイムテキストチャット（過去8時間分・最大200文字）
- **話しかける**: アバターや座布団をクリックして Google Meet 固定リンクを共有
- **写真アバター**: 入室時に写真をアップロード（丸形表示）
- **ピンチズーム**: スマホで2本指ズーム・パン対応
- **入退室通知**: トースト通知で参加者の入退室を表示

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| 認証 | iron-session（合言葉 + Cookie） |
| DB / Realtime | Supabase |
| 画像ストレージ | Supabase Storage |
| デプロイ | Vercel |

---

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/kou56250046-cloud/virtual-tensin.git
cd virtual-tensin
npm install
```

### 2. 環境変数の設定

`.env.local` を作成して以下を設定:

```env
ACCESS_PASSPHRASE=         # 入室合言葉
SESSION_SECRET=            # 32文字以上のランダム文字列
NEXT_PUBLIC_SUPABASE_URL=  # Supabase プロジェクト URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anon キー
SUPABASE_SERVICE_ROLE_KEY= # Supabase service role キー
FIXED_MEET_LINK=           # Google Meet 固定リンク（必須）
```

### 3. Supabase のセットアップ

`supabase/migrations/001_initial_schema.sql` を Supabase ダッシュボードで実行。  
さらに以下のカラムを手動で追加:

- `sessions` テーブルに `seat_id TEXT` カラム
- Supabase ダッシュボード → Replication から `sessions` / `messages` / `call_requests` の Realtime を有効化

### 4. 開発サーバー起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) でアクセス。

---

## 開発コマンド

```bash
npm run dev        # 開発サーバー（localhost:3000）
npm run build      # プロダクションビルド
npm run start      # プロダクション起動
npx tsc --noEmit   # TypeScript 型チェック
```

---

## 認証フロー

```
合言葉入力 → POST /api/auth/login → ACCESS_PASSPHRASE と照合
→ 一致 → iron-session Cookie 発行（24時間）+ sessions INSERT
→ /room にリダイレクト
```

合言葉変更: Vercel ダッシュボード → Environment Variables → `ACCESS_PASSPHRASE` を更新 → 自動再デプロイ

---

## 通話機能

- `FIXED_MEET_LINK` 環境変数に設定した Google Meet 固定リンクを使用
- 「話しかける」ボタンで相手に通知 + リンクを表示
- 固定リンクのため後から何人でも同じルームに途中参加可能

---

## デプロイ

Vercel に連携済みの場合、`main` ブランチへのプッシュで自動デプロイ。

環境変数は Vercel ダッシュボード → Settings → Environment Variables で管理。
