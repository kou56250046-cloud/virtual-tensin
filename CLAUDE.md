# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

**バーチャル天心苑祈祷室** — 天心苑祈祷会のバーチャル共在システム。  
参加者がアバターとして俯瞰空間に集まり、存在感を共有しながら祈祷会に参加できる。

**スタック**: Next.js 16 (App Router) · Supabase (Realtime + DB) · Vercel · iron-session

## 開発コマンド

```bash
npm run dev        # 開発サーバー起動 (localhost:3000)
npm run build      # プロダクションビルド
npm run type-check # TypeScript 型チェック (npx tsc --noEmit)
```

## アーキテクチャ

```
src/
├── proxy.ts                      # 認証ガード（Next.js 16 の Proxy）
├── app/
│   ├── page.tsx                  # ログイン画面
│   ├── room/page.tsx             # 祈祷室メイン画面（要認証）
│   └── api/
│       ├── auth/login/           # 合言葉照合 → iron-session Cookie 発行
│       ├── auth/logout/          # Cookie 削除 + Supabase sessions 行削除
│       ├── auth/me/              # 現在のセッション情報取得
│       ├── session/[id]/         # アバター位置更新（PATCH）+ ハートビート（PUT）
│       └── call/                 # 通話リクエスト作成（POST）+ 応答（PATCH）
├── components/
│   ├── login/
│   │   ├── LoginForm.tsx         # 2ステップ入室フォーム
│   │   └── CharacterPicker.tsx   # 5種キャラクター選択（Canvas プレビュー付き）
│   └── room/
│       ├── RoomCanvas.tsx        # Canvas メイン（アバター描画・クリック移動）
│       ├── ChatPanel.tsx         # チャットサイドパネル（Supabase Realtime）
│       ├── CallDialog.tsx        # 話しかけ → Google Meet リンク生成
│       └── ToastNotification.tsx # 入退室・通話通知トースト
├── lib/
│   ├── session.ts                # iron-session 設定（SessionData 型含む）
│   ├── supabase/client.ts        # ブラウザ用 Supabase
│   ├── supabase/server.ts        # SSR 用 Supabase + createAdminClient()
│   └── avatars/shapes.ts         # 5種キャラクターの Canvas 描画関数
└── types/index.ts                # CharacterType, Session, Message, CallRequest 型
```

## キャラクタータイプ（5種類）

| ID | 表示名 | 特徴（俯瞰SVG） |
|----|--------|----------------|
| `student` | 小中高生 | 小さめ (scale 0.75)・ランドセル |
| `youth` | 青年 | スリム・角ばった肩ライン |
| `family_youth` | 家庭青年 | やや幅広・金バッジ |
| `senior_male` | 壮年 | 大きめ (scale 1.15)・幅広 |
| `senior_female` | 壮婦 | 髪まとめ（小円）・スカート裾 |

## 認証フロー

```
合言葉入力 → POST /api/auth/login → ACCESS_PASSPHRASE 環境変数と照合
→ 一致 → iron-session Cookie 発行 + Supabase sessions 行作成
→ 不一致 → 401
```
合言葉変更: Vercel ダッシュボード → Environment Variables → `ACCESS_PASSPHRASE` を更新 → 自動再デプロイ。

## 環境変数

```env
ACCESS_PASSPHRASE=   # 合言葉（Vercel 環境変数で管理）
SESSION_SECRET=      # 32文字以上のランダム文字列
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Supabase テーブル

`supabase/migrations/001_initial_schema.sql` を参照。  
テーブル: `sessions`（参加者）/ `messages`（チャット）/ `call_requests`（通話リクエスト）  
全テーブルで **RLS 有効**。Realtime は Supabase ダッシュボード の Replication から有効化。

## 重要な実装メモ

- **proxy.ts**: Next.js 16 では `middleware` でなく `proxy` ファイル・関数名を使う
- **iron-session**: `getIronSession<SessionData>(request, res, options)` でジェネリクス必須
- **Supabase 二重クライアント**: API Route 内では `createAdminClient()`、Client Component では `createClient()` を使う
- **アバター位置同期**: クライアント側でローカル即時反映 → PATCH API でDB更新 → Supabase Realtime で他者に反映
