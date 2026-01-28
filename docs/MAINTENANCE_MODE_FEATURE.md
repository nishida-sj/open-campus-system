# AIメンテナンスモード機能

## 概要

プロンプト修正時に、一般ユーザーへの影響なくテストできる機能。
指定したテスターのみがメンテナンスモード中でもAI機能を使用可能。

## 実装日

2026-01-28

## 実装ファイル

| ファイル | 説明 |
|---------|------|
| `lib/usage-monitor.ts` | メンテナンスモード判定、招待コード生成・検証関数 |
| `app/admin/ai-settings/page.tsx` | 管理画面UI（メンテナンスモード切替、招待コード発行、テスターリスト管理） |
| `app/api/admin/maintenance-invite/route.ts` | 招待コード発行API |
| `app/api/line/webhook/route.ts` | LINE webhook（テスター登録コマンド処理、メンテナンスモードチェック） |
| `docs/database_ai_maintenance.sql` | DBマイグレーションSQL |

## データベース設定

`ai_settings`テーブルに以下のレコードが必要：

```sql
INSERT INTO ai_settings (setting_key, setting_value, description)
VALUES
  ('maintenance_mode', 'false', 'メンテナンスモード（true: 有効、false: 無効）'),
  ('maintenance_tester_ids', '[]', 'テスターリスト（JSON配列）'),
  ('maintenance_invite_code', '', '招待コード'),
  ('maintenance_invite_expires', '', '招待コード有効期限')
ON CONFLICT (setting_key) DO NOTHING;
```

## 機能一覧

### 1. メンテナンスモード切替

- 管理画面: AI設定 → 基本設定タブ
- ONにすると、テスター以外のユーザーには「メンテナンス中」メッセージが表示される

### 2. テスター招待コード発行

- メンテナンスモードON時のみ表示
- 「招待コードを発行」ボタンで6桁のコードを生成
- 有効期限: 10分間
- 1回使用で無効化

### 3. テスター登録（LINE側）

ユーザーがLINEボットに以下のメッセージを送信：
```
テスター登録 [コード]
```
※「テスター登録」と「コード」の間に半角スペースが必要

### 4. テスターリスト管理

- メンテナンスモードON時のみ表示
- 登録済みテスターの一覧表示
- 個別削除機能（削除後は「基本設定を保存」が必要）

## 使用フロー

```
1. 管理画面でメンテナンスモードをON
2. 「基本設定を保存」をクリック
3. 「招待コードを発行」をクリック
4. テスター希望者にコードを共有
5. テスターがLINEで「テスター登録 [コード]」を送信
6. テスターリストに自動追加
7. プロンプトを修正・テスト
8. 問題なければメンテナンスモードをOFF
9. 「基本設定を保存」をクリック
```

## 関連コミット

- `c453a50` - Feature: Add AI maintenance mode for testing prompts
- `91a6d9d` - Fix: Add default values for maintenance mode settings
- `d65223b` - Fix: Make maintenance mode toggle clickable with label wrapper
- `052a125` - Feature: Add tester invite code system for maintenance mode
- `066559b` - Feature: Add tester list management UI
- `453a40b` - UI: Show invite code and tester list only when maintenance mode is ON
- `2245a92` - UI: Clarify that space is required between command and code

## 今後の改善案

- [ ] テスターに名前/メモを付けられるようにする
- [ ] 招待コードの有効期限を選択可能にする
- [ ] テスター登録時にLINE表示名を取得して保存
- [ ] メンテナンスモード中の一般ユーザーへのメッセージをカスタマイズ可能に

## 関連ドキュメント

- `docs/database_ai_maintenance.sql` - データベースセットアップ
- `docs/AI_FEATURE_IMPLEMENTATION.md` - AI機能全体の実装ドキュメント
