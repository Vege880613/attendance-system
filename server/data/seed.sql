-- 种子数据 - 与 Render 线上数据一致
-- 申请单数量: 9, 年假余额: 7天, 调休余额: 2.5天

-- 用户
INSERT INTO users (id, username, password_hash, name, role, team_id, hire_date, status) VALUES
(1, 'admin', '$2a$10$hash', '系统管理员', 'manager', NULL, '2020-01-01', 'active'),
(22, 'gaolongfei', '$2a$10$hash', '高龙飞', 'employee', 2, '2016-10-01', 'active');

-- 年假余额（应享10天，已用3天，剩余7天）
INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days) VALUES
(22, 'annual', 2026, 10.0, 3.0);

-- 调休余额（应享4天，已用1.5天，剩余2.5天）
INSERT INTO leave_balances (user_id, leave_type, year, entitled_days, used_days) VALUES
(22, 'compensatory', 2026, 4.0, 1.5);

-- 加班单位（3条已批准）
INSERT INTO overtime_units (user_id, work_date, hours, units_count, status) VALUES
(22, '2026-10-20', 3.0, 1, 'approved'),
(22, '2026-10-21', 3.0, 1, 'approved'),
(22, '2026-10-22', 3.0, 1, 'approved');

-- 申请单（9条）
INSERT INTO attendance_requests (user_id, type, leave_type_used, start_date, end_date, days, status, annual_days) VALUES
(22, 'leave', 'annual', '2026-10-08', '2026-10-09', 2.0, 'entered', 2.0),
(22, 'leave', 'annual', '2026-10-20', '2026-10-21', 1.5, 'entered', 1.5),
(22, 'leave', 'compensatory', '2026-10-09', '2026-10-09', 0.5, 'entered', 0),
(22, 'leave', 'mixed', '2026-10-14', '2026-10-16', 3.0, 'entered', 2.0),
(22, 'leave', 'annual', '2026-10-27', '2026-10-27', 1.0, 'approved', 1.0),
(22, 'leave', 'business_trip', '2026-10-27', '2026-10-29', 3.0, 'pending', 0),
(22, 'leave', 'mixed', '2026-10-08', '2026-10-09', 2.0, 'pending', 1.0),
(22, 'leave', 'mixed', '2026-10-08', '2026-10-09', 3.0, 'pending', 2.0),
(22, 'leave', 'mixed', '2026-10-20', '2026-10-21', 2.0, 'pending', 1.0);
