-- 短信注册所需的 session 字段
ALTER TABLE sessions
  ADD COLUMN sms_phone TEXT;

ALTER TABLE sessions
  ADD COLUMN sms_code TEXT;

ALTER TABLE sessions
  ADD COLUMN sms_expires_at INTEGER;

ALTER TABLE sessions
  ADD COLUMN sms_verify_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE sessions
  ADD COLUMN sms_locked_until INTEGER;

-- 索引: 加快按 phone 查 session
CREATE INDEX sessions_sms_phone_idx ON sessions(sms_phone);
