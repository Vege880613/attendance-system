const express = require('express');
const cors = require('cors');
require('dotenv').config();

// 加载数据库配置（自动建表）
require('./config/db');

// 确保 admin 用户存在
const bcrypt = require('bcryptjs');
const db = require('./config/db');
const ensureAdmin = () => {
  const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!admin) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      "INSERT INTO users (username, password_hash, name, role, hire_date, status) VALUES ('admin', ?, '系统管理员', 'manager', '2020-01-01', 'active')"
    ).run(hash);
    console.log('✅ 已创建默认管理员账号 (admin/admin123)');
  }
};
ensureAdmin();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const teamRoutes = require('./routes/teams');
const attendanceRoutes = require('./routes/attendance');
const overtimeRoutes = require('./routes/overtime');
const leaveRoutes = require('./routes/leave');
const requestRoutes = require('./routes/requests');
const projectRoutes = require('./routes/projects');
const excelImportRoutes = require('./routes/excelImport');
const leaveDetailRoutes = require('./routes/leaveDetail');
const dashboardRoutes = require('./routes/dashboard');
const holidayRoutes = require('./routes/holidays');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/overtime', overtimeRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/excel', excelImportRoutes);
app.use('/api/leave-detail', leaveDetailRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/holidays', holidayRoutes);

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: '服务器内部错误', detail: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;
