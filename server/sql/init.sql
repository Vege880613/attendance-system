-- 人员考勤管理系统 — 数据库初始化脚本
-- 使用方式：mysql -u root -p < init.sql

CREATE DATABASE IF NOT EXISTS attendance_db DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE attendance_db;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(50) NOT NULL,
  role ENUM('employee','team_lead','manager') NOT NULL DEFAULT 'employee',
  team_id INT DEFAULT NULL,
  hire_date DATE NOT NULL,
  status ENUM('active','resigned') NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 班组表
CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  lead_user_id INT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 月度考勤记录
CREATE TABLE IF NOT EXISTS attendance_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  work_date DATE NOT NULL,
  check_in TIME DEFAULT NULL,
  check_out TIME DEFAULT NULL,
  effective_hours DECIMAL(4,2) DEFAULT 0,
  standard_hours DECIMAL(4,2) DEFAULT 8.00,
  is_shortage TINYINT(1) DEFAULT 0,
  offset_type ENUM('none','overtime','annual_leave') DEFAULT 'none',
  offset_units DECIMAL(4,2) DEFAULT 0,
  remark VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_date (user_id, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 加班工时单位表（每行 = 1 个 3 小时单位）
CREATE TABLE IF NOT EXISTS overtime_units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  work_date DATE NOT NULL,
  hours DECIMAL(4,2) NOT NULL DEFAULT 3.00,
  units_count INT NOT NULL DEFAULT 1,
  status ENUM('pending','approved','used','cancelled') DEFAULT 'pending',
  request_id INT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 假期余额表（年假/婚假/丧假）
CREATE TABLE IF NOT EXISTS leave_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  leave_type ENUM('annual','marriage','funeral') NOT NULL,
  year INT NOT NULL,
  entitled_days DECIMAL(5,1) NOT NULL DEFAULT 0,
  used_days DECIMAL(5,1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_type_year (user_id, leave_type, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 申请审批表
CREATE TABLE IF NOT EXISTS attendance_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('overtime','leave','special_leave') NOT NULL,
  subtype VARCHAR(50) DEFAULT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days DECIMAL(5,1) DEFAULT 0,
  overtime_units_used INT DEFAULT 0,
  leave_type_used ENUM('annual','marriage','funeral','none') DEFAULT 'none',
  reason VARCHAR(500),
  status ENUM('pending','approved','rejected','entered') DEFAULT 'pending',
  team_lead_id INT DEFAULT NULL,
  team_lead_comment VARCHAR(500),
  team_lead_time DATETIME,
  manager_id INT DEFAULT NULL,
  manager_comment VARCHAR(500),
  manager_time DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  detail TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
