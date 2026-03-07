-- 未回答質問ログテーブル
-- AIが回答できなかった質問を記録・蓄積するテーブル

CREATE TABLE IF NOT EXISTS unanswered_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  line_user_id TEXT NOT NULL,
  user_message TEXT NOT NULL,
  ai_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_unanswered_tenant_date ON unanswered_questions(tenant_id, created_at DESC);

ALTER TABLE unanswered_questions ENABLE ROW LEVEL SECURITY;
