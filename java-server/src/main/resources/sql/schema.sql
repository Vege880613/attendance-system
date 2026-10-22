-- =============================================================
-- 考勤系统 MySQL Schema（由 server/src/config/db.js 转换）
-- 权威来源：Node 版 db.js 的 9 张表
-- 注意：ENUM 用 VARCHAR + 应用层校验（避免 MySQL ENUM 修改成本）
-- =============================================================

CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'employee',
  team_id BIGINT DEFAULT NULL,
  hire_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  employee_id VARCHAR(255) DEFAULT NULL,
  company_hire_date DATE DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by VARCHAR(255) DEFAULT NULL,
  UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS teams (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  lead_user_id BIGINT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS attendance_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  work_date DATE NOT NULL,
  check_in VARCHAR(10) DEFAULT NULL,
  check_out VARCHAR(10) DEFAULT NULL,
  effective_hours DECIMAL(10,2) DEFAULT 0,
  standard_hours DECIMAL(10,2) DEFAULT 8.00,
  is_shortage TINYINT(1) DEFAULT 0,
  offset_type VARCHAR(50) DEFAULT 'none',
  offset_units DECIMAL(10,2) DEFAULT 0,
  is_reset_before TINYINT(1) DEFAULT 0,
  remark VARCHAR(500) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by VARCHAR(255) DEFAULT NULL,
  approved_at DATETIME DEFAULT NULL,
  approved_by VARCHAR(255) DEFAULT NULL,
  rejected_at DATETIME DEFAULT NULL,
  rejected_by VARCHAR(255) DEFAULT NULL,
  UNIQUE KEY uk_att_user_date (user_id, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS overtime_units (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  work_date DATE NOT NULL,
  hours DECIMAL(10,2) NOT NULL DEFAULT 3.00,
  units_count INT NOT NULL DEFAULT 1,
  status VARCHAR(50) DEFAULT 'pending',
  request_id BIGINT DEFAULT NULL,
  leave_request_id BIGINT DEFAULT NULL,
  leave_type_mark VARCHAR(50) DEFAULT NULL,
  leave_dates TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by VARCHAR(255) DEFAULT NULL,
  approved_at DATETIME DEFAULT NULL,
  approved_by VARCHAR(255) DEFAULT NULL,
  rejected_at DATETIME DEFAULT NULL,
  rejected_by VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS leave_balances (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  leave_type VARCHAR(50) NOT NULL,
  year INT NOT NULL,
  entitled_days DECIMAL(10,2) NOT NULL DEFAULT 0,
  used_days DECIMAL(10,2) NOT NULL DEFAULT 0,
  reset_used_days DECIMAL(10,2) DEFAULT 0,
  reset_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by VARCHAR(255) DEFAULT NULL,
  UNIQUE KEY uk_leave_user_type_year (user_id, leave_type, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS attendance_requests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  type VARCHAR(50) NOT NULL,
  subtype VARCHAR(50) DEFAULT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days DECIMAL(10,2) DEFAULT 0,
  overtime_units_used INT DEFAULT 0,
  leave_type_used VARCHAR(50) DEFAULT 'none',
  reason VARCHAR(500) DEFAULT NULL,
  project_id BIGINT DEFAULT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  team_lead_id BIGINT DEFAULT NULL,
  team_lead_comment VARCHAR(500) DEFAULT NULL,
  team_lead_time DATETIME DEFAULT NULL,
  dept_manager_id BIGINT DEFAULT NULL,
  dept_manager_comment VARCHAR(500) DEFAULT NULL,
  dept_manager_time DATETIME DEFAULT NULL,
  manager_id BIGINT DEFAULT NULL,
  manager_comment VARCHAR(500) DEFAULT NULL,
  manager_time DATETIME DEFAULT NULL,
  needs_dept_manager TINYINT(1) DEFAULT 0,
  is_reset_before TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by VARCHAR(255) DEFAULT NULL,
  approved_at DATETIME DEFAULT NULL,
  approved_by VARCHAR(255) DEFAULT NULL,
  rejected_at DATETIME DEFAULT NULL,
  rejected_by VARCHAR(255) DEFAULT NULL,
  annual_days DECIMAL(10,2) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT DEFAULT NULL,
  action VARCHAR(255) NOT NULL,
  detail VARCHAR(1000) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS projects (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'project',
  description VARCHAR(500) DEFAULT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS holidays (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  year INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  updated_by VARCHAR(255) DEFAULT NULL,
  UNIQUE KEY uk_holidays_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
