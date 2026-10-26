-- 无责任迟到/早退抵扣 — 存量库迁移
-- 为 leave_balances 增加 month 维度（0=年度类型，1-12=月度类型）
-- 使用：mysql -u root -p attendance_db < docs/migrate-no-fault.sql

ALTER TABLE leave_balances ADD COLUMN month INT NOT NULL DEFAULT 0;
ALTER TABLE leave_balances DROP INDEX uk_leave_user_type_year;
ALTER TABLE leave_balances ADD UNIQUE KEY uk_leave_user_type_year_month (user_id, leave_type, year, month);

-- 清理可能因唯一键变更产生的重复（保留最早一条）
-- 一般无需执行，仅在报错时排查
