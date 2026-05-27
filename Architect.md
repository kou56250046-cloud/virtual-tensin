# Architect.md — システムアーキテクチャ詳細

バーチャル天心苑祈祷室の技術的な設計・実装詳細ドキュメント。  
リバースエンジニアリングにより 2026-05-25 時点のコードから生成。

---

## 1. 全体アーキテクチャ図

```
┌────────────────────────────────────────────────────────────────┐
│                         クライアント                           │
│                                                                │
│  ┌──────────────┐   ┌──────────────────────────────────────┐  │
│  │  LoginPage   │   │              RoomPage                │  │
│  │  (page.tsx)  │   │            (room/page.tsx)           │  │
│  │              │   │                                      │  │
│  │ LoginForm ─┐ │   │ ┌──────────┐  ┌────────────────────┐│  │
│  │ AvatarUpld │ │   │ │RoomCanvas│  │    ChatPanel       ││  │
│  └────────────┼─┘   │ │(Canvas2D)│  │ (Supabase Realtime)││  │
│               │     │ └──────────┘  └────────────────────┘│  │
│               │     │ ┌──────────┐  ┌────────────────────┐│  │
│               │     │ │CallDialog│  │ ToastNotification  ││  │
│               │     │ └──────────┘  └────────────────────┘│  │
│               │     └──────────────────────────────────────┘  │
└───────────────┼────────────────────────────────────────────────┘
                │ HTTP (fetch)          WebSocket (Realtime)
┌───────────────▼────────────────────────────────────────────────┐
│                      Next.js API Routes                        │
│                                                                │
│  /api/auth/login    POST  合言葉照合 → Cookie + DB INSERT      │
│  /api/auth/logout   POST  Cookie 削除 + DB DELETE              │
│  /api/auth/me       GET   セッション情報返却                    │
│  /api/session/[id]  PATCH 位置・avatar_url・seat_id 更新       │
│                     PUT   ハートビート（last_seen 更新）        │
│  /api/call          POST  Meet リンク生成 + DB INSERT          │
│                     PATCH 通話応答（accepted/rejected）        │
│  /api/messages/     POST  8時間以上古いメッセージ削除           │
│  cleanup                                                       │
└───────────────────────────────┬────────────────────────────────┘
                                │ Service Role Key（Admin）
┌───────────────────────────────▼────────────────────────────────┐
│                          Supabase                              │
│                                                                │
│  PostgreSQL                  Realtime           Storage        │
│  ┌──────────┐               ┌──────────┐       ┌──────────┐   │
│  │ sessions │ ←──────────── │ sessions │       │ avatars/ │   │
│  │ messages │               │ messages │       │{id}.jpg  │   │
│  │call_reqs │               │call_reqs │       └──────────┘   │
│  └──────────┘               └──────────┘                      │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. 認証・セッション管理

### 認証方式

```
iron-session (v8) — HTTPOnly Cookie "tensinen-session"
有効期間: 24時間
```

### SessionData 型（lib/session.ts）

```typescript
interface SessionData {
  sessionId?: string;    // Supabase sessions.id (UUID)
  name?: string;         // 表示名
  avatarUrl?: string | null;
  color?: string;        // 常に #8b5cf6
  isLoggedIn?: boolean;
}
```

### ログインフロー詳細

```
1. フロントエンド: 合言葉を入力（Step1）
   └→ localStorage に保存済みプロフィールがあれば自動表示
      └→ 合言葉が正しければ Step2 をスキップしてワンタップ入室可

2. フロントエンド: 写真 + 名前を入力（Step2）

3. POST /api/auth/login
   ├─ ACCESS_PASSPHRASE と照合（不一致 → 401）
   ├─ sessions INSERT（初期座標: x=400±100, y=350±75）
   └─ iron-session Cookie 発行 → { ok: true, sessionId }

4. フロントエンド: Supabase Storage にアップロード（写真がある場合）
   └→ avatars/{sessionId}.jpg に upsert
   └→ PATCH /api/session/:id で avatar_url を更新

5. localStorage に { name, avatarDataUrl } を保存

6. /room にリダイレクト
```

### proxy.ts（認証ガード）

```
GET /room/* → isLoggedIn でなければ / にリダイレクト
GET /       → isLoggedIn なら /room にリダイレクト
```

---

## 3. データベース設計

### sessions テーブル

```sql
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  avatar_url  TEXT,                    -- Supabase Storage 公開 URL（追加済み）
  color       TEXT NOT NULL DEFAULT '#8b5cf6',
  x           FLOAT DEFAULT 400,
  y           FLOAT DEFAULT 300,
  seat_id     TEXT,                    -- 'L-0-0' 形式（追加済み）
  last_seen   TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

> `character_type` カラム（初期 migration）は実装では使用していない。  
> `avatar_url`・`seat_id` は migration 未記載だが現行 DB に追加済み。

### messages テーブル

```sql
CREATE TABLE messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID REFERENCES sessions(id) ON DELETE SET NULL,
  sender_name  TEXT NOT NULL,
  content      TEXT NOT NULL CHECK (length(content) <= 200),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### call_requests テーブル

```sql
CREATE TABLE call_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
  to_session_id    UUID REFERENCES sessions(id) ON DELETE CASCADE,
  meet_link        TEXT,
  status           TEXT DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','rejected','expired')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### RLS ポリシー

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| sessions | 全員 | Service Role のみ | Service Role のみ | Service Role のみ |
| messages | 全員 | 全員（バックエンド経由） | — | Service Role のみ |
| call_requests | 全員 | Service Role のみ | Service Role のみ | — |

---

## 4. バーチャル空間（Canvas）

### キャンバス仕様

```
サイズ: 900 × 1280 px
表示: width: 100%, height: auto（アスペクト比維持）
```

### 描画レイヤー（前から順）

```
z=0  床グラデーション（木目）
z=1  天井コーファードパネル
z=2  祭壇台（木製グラデーション）
z=3  柱（左右2本）
z=4  御真影（left_1〜4.png + 金額縁）
z=5  天心苑建物アイコン（左右）
z=6  蝋燭（8本、炎グロー付き）
z=7  巾木・アウトライン
z=8  座布団グリッド（着席アバター含む）
z=9  非着席アバター（クリック移動中）
```

### 座布団グリッド

```typescript
ZABUTON_LEFT  = { startX:   0, startY: 218, areaW: 300, areaH: 1040, cols: 4, rows: 9 }
ZABUTON_RIGHT = { startX: 600, startY: 218, areaW: 300, areaH: 1040, cols: 4, rows: 9 }

// seat_id: "L-{row}-{col}" or "R-{row}-{col}"
// クッションサイズ = cellW - 18 ≒ 57px（正方形）
```

**着席中のクッション**: 色が `#9333ea`（明るい紫）に変化。クッション上に小アバター（最大 r=14px）を描画。

### タッチ・クリック処理フロー

```
クリック / タップ
  ├─ 他者アバターの範囲内（±6px）→ CallDialog 表示
  ├─ 座布団エリア内（getZabutonAt）
  │   ├─ 他者が着席中 → CallDialog 表示
  │   ├─ 自分が着席中 → 離席処理
  │   └─ 空席 → 着席確認ダイアログ
  └─ 床（自分が非着席）→ 移動（PATCH /api/session/:id）

ピンチ（2本指）
  └─ scale = clamp(1, 4, startScale × ratio)
     translate を中心点固定で計算

パン（1本指、scale > 1 のとき）
  └─ translate を指の移動量で更新

ダブルタップ（300ms 以内）
  └─ scale=1, tx=0, ty=0 にリセット
```

---

## 5. リアルタイム通信

### 購読チャンネル一覧

```typescript
// sessions の変化（全員の位置・着席状態）
supabase.channel('sessions-realtime')
  .on('postgres_changes', { event: '*', table: 'sessions' }, handler)

// 自分宛ての通話リクエスト
supabase.channel('call-realtime')
  .on('postgres_changes', {
    event: 'INSERT',
    table: 'call_requests',
    filter: `to_session_id=eq.${me.sessionId}`
  }, handler)

// チャットメッセージ
supabase.channel('messages')
  .on('postgres_changes', { event: 'INSERT', table: 'messages' }, handler)
```

### ハートビート

```typescript
// 30秒毎に PUT /api/session/:id（last_seen 更新）
const hb = setInterval(() => {
  fetch(`/api/session/${me.sessionId}`, { method: 'PUT' });
}, 30000);
```

ブラウザを閉じるとハートビートが止まり、5分以上経過したセッションをアプリ側で無効扱い。  
（Supabase Pro の pg_cron を使えば DB 側で自動削除可能）

---

## 6. アバター画像システム

### アップロードフロー

```
1. AvatarUpload コンポーネントで画像選択（スマホはカメラ/ギャラリー対応）
2. resizeImage() でクライアント側リサイズ
   - 中央正方形クロップ → 200×200px → JPEG quality 0.75 → Blob
3. Supabase Storage `avatars/{sessionId}.jpg` に upsert
4. getPublicUrl() で公開 URL 取得
5. PATCH /api/session/:id で avatar_url を DB に保存
6. localStorage の tensinen_profile に DataURL を保存
```

### 描画キャッシュ

```typescript
const imageCache = new Map<string, HTMLImageElement>();
// 未キャッシュ: loadImage() を呼び出し、ロード完了時に redraw コールバック
// キャッシュ済み: 即時描画
```

---

## 7. チャットシステム

### メッセージ取得

```typescript
// 初回: 過去8時間以内のメッセージを最大200件取得
const since = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
supabase.from('messages').select('*').gte('created_at', since).limit(200)

// 新着: Realtime の INSERT イベントで追加
```

### 自動クリーンアップ

```
ChatPanel マウント時に POST /api/messages/cleanup を呼び出す
→ 8時間以上前のメッセージを DELETE
```

---

## 8. Google Meet 通話連携

```typescript
// meet_code の生成例
function generateMeetCode(): string {
  const seg = (n: number) => Array.from(
    { length: n },
    () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]
  ).join('');
  return `${seg(3)}-${seg(4)}-${seg(3)}`;
}
// → "https://meet.google.com/xxx-xxxx-xxx"
```

**フロー**:
1. A → `POST /api/call` → Meet リンク生成 + call_requests INSERT（`pending`）
2. B の Realtime 購読が `INSERT` を検知 → トースト通知
3. A の画面に Meet リンクが表示される
4. A・B が同じ Meet リンクから参加

---

## 9. Supabase クライアント使い分け

| 用途 | 関数 | キー |
|------|------|------|
| Client Component | `createClient()` (client.ts) | ANON_KEY |
| API Route | `createAdminClient()` (server.ts) | SERVICE_ROLE_KEY |
| SSR (Server Component) | `createClient()` (server.ts) | ANON_KEY |

`createAdminClient()` は RLS をバイパスするため **API Route 内のみ** で使用する。

---

## 10. 既知の技術的負債・今後の課題

| 項目 | 状況 | 対応方針 |
|------|------|---------|
| DB migration と実装の乖離 | `character_type` が残存、`avatar_url`・`seat_id` が未定義 | migration を最新 schema に更新する |
| 古いセッション自動削除 | Supabase 無料枠では pg_cron 不可 | アプリ側クリーンアップ or 有料枠移行 |
| 通話承諾フロー | B 側に Meet リンクが届かない（Realtime で call_requests を見ていない） | RoomPage で call_requests も購読し Meet リンクを渡す |
| ハートビートによる退室検知 | 5分程度のラグが発生 | Supabase pg_cron か定期 cleanup エンドポイント |
| テスト未実装 | unit / e2e なし | Jest + Playwright の導入を検討 |
| 管理者画面なし | 参加者キック・合言葉変更は Vercel 環境変数のみ | Admin ページ実装 |
