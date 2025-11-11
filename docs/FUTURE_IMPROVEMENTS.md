# 今後の改善候補

このドキュメントは、将来的に実装を検討すべき改善項目をまとめたものです。

---

## 📱 LINE連携フローの改善

### 現状
- ✅ 友達追加URLが正しく動作（@記号のエンコード対応済み）
- ✅ トークンコピーボタンを実装
- ユーザーは友達追加後、コピーしたトークンをLINEトーク画面に貼り付ける必要がある

### 改善候補

#### オプション1: リッチメニューボタン（推奨）
**概要**: LINEアプリ下部に常設のメニューボタンを配置し、トークン送信を簡単にする

**メリット**:
- ユーザーはボタンをタップするだけでトークン送信完了
- 視覚的にわかりやすい
- 他の機能（お問い合わせ、キャンセルなど）も追加可能

**実装方法**:
1. LINE Developers Consoleでリッチメニューを作成
2. 「申込完了」ボタンを配置
3. ボタンタップ時にトークンを自動送信（テキストまたはポストバックイベント）

**実装難易度**: 中（LINE Messaging API の Rich Menu 機能を使用）

**参考リンク**:
- [LINE Rich Menu API](https://developers.line.biz/ja/docs/messaging-api/using-rich-menus/)

---

#### オプション2: URLスキーム自動連携
**概要**: 友達追加後、LINEのURLスキームを使ってトーク画面にトークンを自動入力

**メリット**:
- ユーザーの手間が最小限
- 実装が比較的簡単

**デメリット**:
- URLスキームの仕様変更リスク
- 一部のデバイスで動作しない可能性

**実装方法**:
```typescript
// 友達追加後、トーク画面にメッセージを事前入力
const lineMessageUrl = `https://line.me/R/oaMessage/${botIdWithoutAt}/?${encodeURIComponent(token)}`;
```

**実装難易度**: 低

---

#### オプション3: QRコード
**概要**: トークンをQRコード化し、LINEアプリでスキャンして送信

**メリット**:
- 視覚的にわかりやすい
- コピー&ペーストの手間がない

**デメリット**:
- QRコード生成ライブラリが必要
- スマホ画面でQRコードをスキャンする操作が難しい（別デバイスが必要）

**実装方法**:
1. `qrcode` ライブラリでトークンをQRコード化
2. 成功ページに表示
3. ユーザーはLINEアプリのQRコードスキャン機能で読み取り

**実装難易度**: 低〜中

**必要なライブラリ**:
```bash
npm install qrcode
npm install --save-dev @types/qrcode
```

---

#### オプション4: LINE LIFF（最も高度）
**概要**: LINE Front-end Frameworkを使い、LINEアプリ内でWebページを開いてシームレスに連携

**メリット**:
- 最高のUX（LINEアプリ内で完結）
- トークン送信が自動化可能
- LINE IDを自動取得できる

**デメリット**:
- 実装難易度が高い
- LIFF アプリの登録と設定が必要

**実装方法**:
1. LINE Developers ConsoleでLIFFアプリを作成
2. Next.js アプリにLIFF SDKを統合
3. 申込完了ページをLIFFアプリとして開く
4. LINE User IDを自動取得し、データベースに直接保存

**実装難易度**: 高

**参考リンク**:
- [LINE LIFF Documentation](https://developers.line.biz/ja/docs/liff/)

---

## 推奨実装順序

1. **現状維持（コピーボタン）**: ✅ 実装済み - 当面はこれで運用
2. **オプション1（リッチメニュー）**: 次回の改善で実装を検討（UXと実装難易度のバランスが良い）
3. **オプション4（LIFF）**: 本格運用時に検討（最高のUXだが実装コスト高）

---

## 🎓 オープンキャンパス作成ページ

### 現状
- オープンキャンパスの日程は直接データベースに登録している
- 参加日程の選択肢数は固定（現在は単一選択）

### 改善内容
管理画面でオープンキャンパスイベントを作成し、申込フォームをコントロールできるようにする

#### 必要な機能
1. **イベント作成ページ**
   - イベント名、説明、開催日程（複数）の入力
   - 参加者が選択できる日程候補数の設定（例: 1つまで、3つまで、すべて）

2. **データベーススキーマ変更**
   - `open_campus_dates` テーブルに親イベントの概念を追加
   - `applicants` テーブルに複数日程選択対応（現在は `visit_date_id` が単一）

#### データベース設計案

**新テーブル: `open_campus_events`**
```sql
CREATE TABLE open_campus_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  max_date_selections INTEGER DEFAULT 1, -- 選択可能な日程数
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**`open_campus_dates` テーブルの変更**
```sql
ALTER TABLE open_campus_dates
ADD COLUMN event_id UUID REFERENCES open_campus_events(id);
```

**`applicants` テーブルの変更**
```sql
-- visit_date_id を削除し、中間テーブルで管理
CREATE TABLE applicant_visit_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_id UUID REFERENCES applicants(id) ON DELETE CASCADE,
  visit_date_id UUID REFERENCES open_campus_dates(id) ON DELETE CASCADE,
  priority INTEGER, -- 第1希望、第2希望など
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 実装難易度
- **見積もり時間**: 1〜2時間
- **難易度**: 中〜高
- **影響範囲**:
  - データベーススキーマ変更（マイグレーション必要）
  - 申込フォームUI変更（複数選択対応）
  - 管理画面の新規作成
  - LINE Webhook処理の変更（複数日程対応）

---

## 📝 その他の改善候補

### 管理画面の機能拡張
- [ ] 申込者一覧のフィルタリング機能（日程別、ステータス別）
- [ ] 申込者へのメール一斉送信機能
- [ ] ダッシュボード（申込状況の可視化）

### セキュリティ強化
- [ ] 管理画面の認証をより堅牢に（現在はパスワードのみ）
- [ ] CSRF対策の追加
- [ ] Rate Limiting（DoS対策）

### UX改善
- [ ] 申込フォームのバリデーション強化（リアルタイムエラー表示）
- [ ] 申込完了メールの送信
- [ ] LINE通知のカスタマイズ（リッチメッセージ、Flex Message）

---

**最終更新**: 2025年11月11日
**作成者**: Mikio
**バージョン**: 1.0.0
