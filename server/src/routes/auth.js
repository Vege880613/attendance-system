const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { generateToken, authRequired } = require('../middleware/auth');

const router = require('express').Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' });
  }
  const user = db.prepare(
    'SELECT id, username, password_hash, name, role, team_id, hire_date, status FROM users WHERE username = ?'
  ).get(username);
  if (!user) return res.status(401).json({ message: '用户名或密码错误' });
  if (user.status === 'resigned') return res.status(403).json({ message: '该账号已离职' });
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ message: '用户名或密码错误' });
  }
  const token = generateToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, team_id: user.team_id, hire_date: user.hire_date }
  });
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare(
    `SELECT u.id, u.username, u.name, u.role, u.team_id, u.hire_date, u.status, t.name AS team_name
     FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = ?`
  ).get(req.user.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  res.json({ user });
});

module.exports = router;
