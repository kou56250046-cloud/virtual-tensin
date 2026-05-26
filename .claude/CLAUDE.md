# プロジェクト設定（最終更新: 2026-05-26）

## 現在の実装スタック

| レイヤー | 採用技術 | バージョン |
|---------|----------|-----------|
| フレームワーク | Next.js (App Router) | 16.2.6 |
| UI ランタイム | React | 19.2.4 |
| スタイリング | Tailwind CSS | v4 |
| 認証 | iron-session（合言葉 + Cookie） | ^8.0.4 |
| DB / Realtime | Supabase (`@supabase/supabase-js`, `@supabase/ssr`) | ^2.106.1 |
| 画像ストレージ | Supabase Storage（`avatars` バケット） | — |
| デプロイ | Vercel | — |
| 言語 | TypeScript (strict) | ^5 |

---

## 開発コマンド

```bash
npm run dev        # 開発サーバー起動 (localhost:3000)
npm run build      # プロダクションビルド
npm run start      # プロダクション起動
npx tsc --noEmit   # TypeScript 型チェック
```

---

## アーキテクチャ概観

```
src/
├── proxy.ts                        # 認証ガード（Next.js 16 の proxy 関数）
├── app/
│   ├── page.tsx                    # ログイン画面（木目背景・蝋燭グロー）
│   ├── room/page.tsx               # 祈祷室メイン（要認証）
│   └── api/
│       ├── auth/login/             # POST: 合言葉照合 → iron-session Cookie 発行 + sessions INSERT
│       ├── auth/logout/            # POST: Cookie 削除 + sessions DELETE
│       ├── auth/me/                # GET: 現在のセッション情報
│       ├── session/[id]/           # PATCH: 位置・avatar_url・seat_id 更新
│       │                           # PUT:   ハートビート（last_seen 更新）
│       ├── call/                   # POST: Google Meet 固定リンク取得 + call_requests INSERT
│       │                           # PATCH: 通話応答（accepted / rejected）
│       └── messages/cleanup/       # POST: 8時間以上古いメッセージを削除
├── components/
│   ├── login/
│   │   ├── LoginForm.tsx           # 2ステップ入室フォーム（合言葉 → プロフィール）
│   │   └── AvatarUpload.tsx        # 写真アップロード UI（カメラ/ギャラリー対応）
│   └── room/
│       ├── RoomCanvas.tsx          # Canvas メイン（背景描画・アバター・座布団・ズーム/パン）
│       ├── ChatPanel.tsx           # チャットサイドパネル（Supabase Realtime）
│       ├── CallDialog.tsx          # 話しかける → Google Meet 固定リンク共有
│       └── ToastNotification.tsx   # 入退室・通話通知（4秒で自動消去）
├── lib/
│   ├── session.ts                  # iron-session 設定（SessionData 型・cookieName: tensinen-session）
│   ├── imageResize.ts              # 画像を 200×200px/JPEG0.75 にリサイズ（クライアント側）
│   ├── profileStorage.ts           # localStorage でプロフィール永続保存
│   ├── zabuton.ts                  # 座布団グリッド定数・座標計算ユーティリティ
│   ├── supabase/client.ts          # ブラウザ用 Supabase クライアント
│   ├── supabase/server.ts          # SSR 用 Supabase + createAdminClient()
│   └── avatars/shapes.ts           # 丸形写真アバター描画（画像キャッシュ付き）
└── types/index.ts                  # Session / Message / CallRequest 型
```

---

## Supabase テーブル（現在の実装）

> `supabase/migrations/001_initial_schema.sql` は初期版。実際の DB は以下のカラムを持つ。

### `sessions`
| カラム | 型 | 備考 |
|-------|----|------|
| id | UUID PK | gen_random_uuid() |
| name | TEXT | 表示名（必須） |
| avatar_url | TEXT \| null | Supabase Storage の公開 URL |
| color | TEXT | `#8b5cf6`（紫で全員統一） |
| x | FLOAT | Canvas 上の X 座標 |
| y | FLOAT | Canvas 上の Y 座標 |
| seat_id | TEXT \| null | `L-行-列` or `R-行-列`（着席中のみ） |
| last_seen | TIMESTAMPTZ | 30秒毎ハートビートで更新 |
| created_at | TIMESTAMPTZ | — |

### `messages`
| カラム | 型 | 備考 |
|-------|----|------|
| id | UUID PK | — |
| session_id | UUID \| null | sessions(id) ON DELETE SET NULL |
| sender_name | TEXT | — |
| content | TEXT | 最大200文字 |
| created_at | TIMESTAMPTZ | — |

### `call_requests`
| カラム | 型 | 備考 |
|-------|----|------|
| id | UUID PK | — |
| from_session_id | UUID | sessions(id) ON DELETE CASCADE |
| to_session_id | UUID | sessions(id) ON DELETE CASCADE |
| meet_link | TEXT \| null | Google Meet 固定リンク（FIXED_MEET_LINK） |
| status | TEXT | `pending / accepted / rejected / expired` |
| created_at | TIMESTAMPTZ | — |

全テーブルで **RLS 有効**。API Route 内は `createAdminClient()` で Service Role キーを使用。

---

## 座布団グリッド仕様（zabuton.ts）

```
CANVAS: 900 × 1280 px

ZABUTON_LEFT:  x=0,   y=218, w=300, h=1040, cols=4, rows=9  → 36席
ZABUTON_RIGHT: x=600, y=218, w=300, h=1040, cols=4, rows=9  → 36席
合計: 72席

seat_id 形式: L-{row}-{col} または R-{row}-{col}
```

- 空席クリック → 着席確認ダイアログ → `PATCH /api/session/:id` で `seat_id` 更新
- 着席中の座布団クリック（他人） → 話しかけるダイアログ
- 自分の座布団クリック or ヘッダー「離席」ボタン → `seat_id: null` に更新

---

## アバターシステム

| 状態 | 描画方法 |
|------|---------|
| 写真あり（非着席） | 丸クリップ写真 + 名前ラベル（AVATAR_RADIUS=24px） |
| 写真なし（非着席） | イニシャル入り色円 + 名前ラベル |
| 着席中（写真あり） | 座布団上に小アバター（最大14px）+ 短縮名 |
| 着席中（写真なし） | 色円＋イニシャル（座布団上）|
| 自分（選択状態） | 金色リング表示 |

写真は `Supabase Storage avatars/{sessionId}.jpg`（200×200px/JPEG0.75 に圧縮済み）。  
プロフィールは `localStorage` の `tensinen_profile` キーに永続保存。次回ログイン時に自動復元。

---

## ピンチズーム / パン（RoomCanvas.tsx）

| 操作 | 動作 |
|------|------|
| 2本指ピンチ | ズーム 1〜4倍（中心点固定） |
| ズーム中に1本指ドラッグ | パン |
| ダブルタップ | ズームリセット（scale=1, tx/ty=0） |

CSS `transform: translate(tx, ty) scale(scale)` で実装。`transformOrigin: '0 0'`。

---

## 認証フロー

```
Step1: 合言葉入力（フロントエンド）
  → localStorage にプロフィールがあればプレビュー表示・ワンタップ入室

Step2: プロフィール設定（名前 + 写真）
  → POST /api/auth/login
    - ACCESS_PASSPHRASE 環境変数と照合
    - sessions INSERT（初期座標: x=400±100, y=350±75）
    - iron-session Cookie 発行（24時間有効）
  → 写真があれば Supabase Storage にアップロード → PATCH で avatar_url 更新
  → /room にリダイレクト
```

合言葉変更: Vercel ダッシュボード → Environment Variables → `ACCESS_PASSPHRASE` を更新 → 再デプロイ。

---

## リアルタイム同期

| チャンネル | テーブル | イベント | 処理 |
|-----------|---------|---------|------|
| `sessions-realtime` | sessions | INSERT | 他者入室 → トースト |
| `sessions-realtime` | sessions | UPDATE | アバター位置・座布団状態を即座に反映 |
| `sessions-realtime` | sessions | DELETE | 退室 → トースト |
| `call-realtime` | call_requests | INSERT (to_session_id=自分) | 通話通知トースト |
| `messages` | messages | INSERT | チャットに追加 |

ハートビート: 30秒毎に `PUT /api/session/:id`（`last_seen` 更新）。

---

## チャット仕様

- 過去8時間以内のメッセージを取得（最大200件）
- ChatPanel マウント時に `POST /api/messages/cleanup` でバックグラウンド削除
- 最大文字数: 200文字
- 自分のメッセージ: 右寄せ（amber背景）、他者: 左寄せ（white/10背景）
- 入力欄フォーカス時に最新メッセージへ自動スクロール（`requestAnimationFrame` + `behavior: auto`）

---

## 通話仕様（call/route.ts）

- `FIXED_MEET_LINK` 環境変数（Vercel 設定）の Google Meet 固定リンクを使用
- 未設定時はエラーを返す（ランダム生成なし）
- 固定リンクのため何人でも同じルームに途中参加可能
- 話しかけた相手へ Supabase Realtime で通知（call_requests INSERT イベント）

---

## 御真影・背景描画（RoomCanvas.tsx）

| 要素 | 描画方法 |
|------|---------|
| 床 | 木目グラデーション（`#e8c98a`→`#c49050`） |
| 天井 | オフホワイト (`#f8f4ee`) + コーファードパネル |
| 祭壇台 | ブラウン系グラデーション |
| 柱 | 左右2本（Canvas グラデーション） |
| 御真影 | `/portraits/left_1〜left_4.png`（金額縁付き）|
| 建物アイコン | Canvas 描画（三角屋根・金色 + 「天心苑」テキスト）|
| 蝋燭 | 8本（炎グロー付き） |
| 花 | 🌸 cx=450（キャンバス中央） |
| 中央通路 | 透明ハイライト |

### 御真影の座標（cx, cy, w, h）

| 御真影 | cx | cy | w | h | 備考 |
|--------|----|----|---|---|------|
| left_1 | 270 | 82 | 66 | 90 | 小・左 |
| left_2 | 352 | 81 | 62 | 87 | 小・左寄り |
| left_3 | 450 | 75 | 106 | 136 | 大・中央（花 cx=450 と同位置） |
| left_4 | 552 | 81 | 62 | 86 | 小・右（left_3 との隙間 8px） |

フレーム幅 fw=5px、フレーム色 `#c8a832`（ゴールド）。

---

## 環境変数

```env
ACCESS_PASSPHRASE=          # 合言葉（Vercel 環境変数で管理）
SESSION_SECRET=             # 32文字以上のランダム文字列
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FIXED_MEET_LINK=            # Google Meet 固定リンク（必須・未設定時は通話エラー）
```

---

## 重要な実装メモ

- **proxy.ts**: Next.js 16 では `middleware` ではなく `proxy` ファイル名・関数名
- **iron-session**: `getIronSession<SessionData>(request, res, options)` でジェネリクス必須
- **Supabase 二重クライアント**: API Route → `createAdminClient()`、Client Component → `createClient()`
- **アバター位置同期**: ローカル即時反映 → PATCH API でDB更新 → Realtime で他者に反映
- **character_type は廃止**: 初期 migration にカラムがあるが実装では未使用（写真アバターに移行）
- **全員カラー統一**: `#8b5cf6`（紫）。個別カラー選択は廃止
- **seat_id は migration 未定義**: 現行 DB には追加カラムあり（migration と乖離）
- **FIXED_MEET_LINK 必須**: ランダム生成は廃止。未設定時は通話ボタン押下でエラーメッセージ表示
