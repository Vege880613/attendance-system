const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'attendance-system-secret-key-change-me',
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );
}

// JWT 鉴权中间件
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: '未提供认证令牌' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'attendance-system-secret-key-change-me');
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: '令牌无效或已过期' });
  }
}

// 角色校验中间件工厂
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: '未认证' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: '无权访问该资源' });
    }
    next();
  };
}

module.exports = { generateToken, authRequired, requireRole };
