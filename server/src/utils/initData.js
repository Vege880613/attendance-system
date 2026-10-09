/**
 * 初始化管理员账号
 * 运行方式：npm run init-db
 */
const bcrypt = require('bcryptjs');
const db = require('../config/db');
require('dotenv').config();

const hash = bcrypt.hashSync('admin123', 10);
db.prepare(
  `INSERT INTO users (username, password_hash, name, role, hire_date, status)
   VALUES ('admin', ?, '系统管理员', 'manager', '2020-01-01', 'active')
   ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash`
).run(hash);

console.log('✅ 管理员账号初始化完成');
console.log('   用户名: admin');
console.log('   密码: admin123');
console.log('   角色: manager');
process.exit(0);
