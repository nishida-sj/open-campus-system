# 同一申込者の判断方法

## 概要

同じ人が複数のオープンキャンパスに申し込むケースにおいて、LINE情報を使って同一申込者を判断する方法を説明します。

## データベース構造

### applicantsテーブル
申込者の基本情報を保存するテーブル

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | UUID | 申込者ID（主キー） |
| name | VARCHAR | 氏名 |
| email | VARCHAR | メールアドレス |
| phone | VARCHAR | 電話番号 |
| line_user_id | VARCHAR | LINE User ID（LINE連携後に設定） |
| status | VARCHAR | ステータス（pending/completed/expired） |

## 同一申込者の判断ロジック

### 1. LINE User IDによる判断（最も確実）

**判断方法**:
```sql
SELECT
  a1.id AS applicant_id_1,
  a2.id AS applicant_id_2,
  a1.line_user_id,
  a1.name AS name_1,
  a2.name AS name_2
FROM applicants a1
JOIN applicants a2 ON a1.line_user_id = a2.line_user_id
WHERE a1.id < a2.id
  AND a1.line_user_id IS NOT NULL;
```

**特徴**:
- ✅ **最も確実**: LINEアカウントは1人1つなので、同じ`line_user_id`を持つレコードは同一人物
- ✅ **精度100%**: 誤判定なし
- ❌ **制限**: LINE連携完了後のみ判断可能

### 2. メールアドレスによる判断（次に確実）

**判断方法**:
```sql
SELECT
  email,
  COUNT(*) as申込回数,
  ARRAY_AGG(id) as申込者ID一覧,
  ARRAY_AGG(name) as氏名一覧
FROM applicants
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;
```

**特徴**:
- ✅ **LINE連携前でも判断可能**
- ✅ **高精度**: 多くの場合、メールアドレスは個人固有
- ⚠️ **注意**: 家族で共有メールを使うケースあり（親のメアド）

### 3. 名前 + 電話番号の組み合わせ（補助的）

**判断方法**:
```sql
SELECT
  name,
  phone,
  COUNT(*) as申込回数,
  ARRAY_AGG(id) as申込者ID一覧
FROM applicants
WHERE name IS NOT NULL
  AND phone IS NOT NULL
GROUP BY name, phone
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;
```

**特徴**:
- ✅ **どの段階でも判断可能**
- ⚠️ **精度中程度**: 同姓同名や家族の電話番号共有のケースあり
- 💡 **用途**: 他の方法と組み合わせて使用

## 実装例

### ダッシュボードで同一申込者を表示

```typescript
// 同じLINE User IDを持つ申込者を取得
const { data: duplicates } = await supabaseAdmin
  .from('applicants')
  .select('id, name, email, line_user_id, created_at')
  .not('line_user_id', 'is', null)
  .order('line_user_id');

// グループ化
const grouped = duplicates?.reduce((acc, curr) => {
  const key = curr.line_user_id!;
  if (!acc[key]) acc[key] = [];
  acc[key].push(curr);
  return acc;
}, {} as Record<string, any[]>);

// 2件以上の申込がある人のみフィルタ
const actualDuplicates = Object.values(grouped).filter(
  (group) => group.length > 1
);
```

### 申込時に同一人物の可能性を通知

```typescript
// 新規申込時にチェック
const { data: existingApplicants } = await supabaseAdmin
  .from('applicants')
  .select('id, name, email')
  .eq('email', newApplicant.email)
  .neq('id', newApplicant.id);

if (existingApplicants && existingApplicants.length > 0) {
  console.log('⚠️ 同じメールアドレスでの申込履歴あり:', existingApplicants);
  // 管理画面に通知を表示するなど
}
```

## 推奨される判断フロー

```
┌─────────────────────┐
│ 申込者データ取得    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ LINE User IDあり？  │
└──────┬──────────────┘
       │Yes
       ▼
┌─────────────────────┐
│ LINE User IDで判定  │ ← 最優先（精度100%）
│ 同じID = 同一人物   │
└──────┬──────────────┘
       │No
       ▼
┌─────────────────────┐
│ メールアドレスあり？│
└──────┬──────────────┘
       │Yes
       ▼
┌─────────────────────┐
│ メールで判定        │ ← 次に優先（精度高）
│ 同じメール = 同一？ │
└──────┬──────────────┘
       │疑わしい
       ▼
┌─────────────────────┐
│ 名前+電話で補助判定 │ ← 補助的（精度中）
└─────────────────────┘
```

## 管理画面での表示例

### メッセージ配信画面での重複表示

```tsx
{applicant.line_user_id && (
  <span className="text-xs text-orange-600">
    ⚠️ 複数申込（LINE: {otherApplicationsCount}件）
  </span>
)}
```

### 統計ダッシュボードでの重複カウント

```typescript
// ユニークな申込者数（LINE連携済みの場合）
const uniqueApplicantsCount = new Set(
  applicants
    .filter(a => a.line_user_id)
    .map(a => a.line_user_id)
).size;

// 総申込数
const totalApplicationsCount = applicants.length;

// 重複申込率
const duplicateRate =
  ((totalApplicationsCount - uniqueApplicantsCount) / totalApplicationsCount * 100)
  .toFixed(1);
```

## SQLクエリ集

### 1. 同一LINE User IDの重複申込者を抽出

```sql
SELECT
  line_user_id,
  COUNT(*) as 申込回数,
  STRING_AGG(name, ', ') as 氏名一覧,
  STRING_AGG(id::TEXT, ', ') as 申込ID一覧
FROM applicants
WHERE line_user_id IS NOT NULL
  AND status != 'cancelled'
GROUP BY line_user_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;
```

### 2. メールアドレス重複を確認

```sql
SELECT
  email,
  COUNT(DISTINCT line_user_id) as LINE連携数,
  COUNT(*) as 申込回数,
  ARRAY_AGG(DISTINCT name) as 氏名一覧
FROM applicants
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;
```

### 3. 申込者ごとの詳細（参加イベント一覧付き）

```sql
SELECT
  a.id,
  a.name,
  a.email,
  a.line_user_id,
  COUNT(avd.id) as 参加イベント数,
  STRING_AGG(DISTINCT oe.name, ', ') as イベント一覧
FROM applicants a
LEFT JOIN applicant_visit_dates avd ON a.id = avd.applicant_id
LEFT JOIN open_campus_dates ocd ON avd.visit_date_id = ocd.id
LEFT JOIN open_campus_events oe ON ocd.event_id = oe.id
WHERE a.line_user_id IS NOT NULL
GROUP BY a.id, a.name, a.email, a.line_user_id
HAVING COUNT(avd.id) > 1
ORDER BY COUNT(avd.id) DESC;
```

## 注意事項

### プライバシー配慮
- 同一申込者の情報は管理者のみ閲覧可能
- LINE User IDは外部に公開しない
- 申込者間で情報を共有しない

### データ整合性
- 同一人物が異なる氏名で申込んだ場合の対応
- 名義変更（結婚等）への対応
- アカウント統合機能の検討

### 運用上の推奨事項
1. **定期的な重複チェック**: 月1回程度、重複申込者を確認
2. **自動通知**: 同一メールアドレスで2回目の申込があった場合に通知
3. **統計レポート**: 実際の参加者数（ユニーク）と申込数の差異を把握

## まとめ

| 判断方法 | 精度 | タイミング | 推奨度 |
|---------|------|-----------|--------|
| LINE User ID | ⭐⭐⭐⭐⭐ | LINE連携後 | 最優先 |
| メールアドレス | ⭐⭐⭐⭐ | 申込時から | 次優先 |
| 名前+電話番号 | ⭐⭐⭐ | 申込時から | 補助的 |

**結論**: LINE User IDが最も確実な同一人物の判断基準です。LINE連携を促進することで、より正確な申込者管理が可能になります。
