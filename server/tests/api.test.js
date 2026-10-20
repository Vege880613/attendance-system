/**
 * Vitest + Supertest API 集成测试示例
 *
 * 运行：cd server && npm test
 *
 * 设计要点：
 * 1. 顶部先设置 NODE_ENV=test → db.js 会走 :memory: 内存 SQLite 分支
 * 2. 然后再 require('../src/app') → 此时数据库已就绪，ensureAdmin() 自动创建 admin
 * 3. globals: true 让 describe / it / expect 全局可用，无需 import
 */

// ⚠️ 必须在 require('../src/app') 之前设置，db.js 读取 NODE_ENV 来决定是否用内存库
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');

const agent = request(app);

describe('GET /api/health', () => {
  it('应返回 200 且包含 status=ok 和 timestamp', async () => {
    const res = await agent.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(() => new Date(res.body.timestamp).toISOString()).not.toThrow();
  });
});

describe('POST /api/auth/login', () => {
  it('缺少用户名或密码时应返回 400', async () => {
    const res = await agent.post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/不能为空/);
  });

  it('密码错误时应返回 401', async () => {
    const res = await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/用户名或密码错误/);
  });

  it('admin / admin123 登录成功应返回 token 和 user', async () => {
    const res = await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(20);

    expect(res.body.user).toMatchObject({
      username: 'admin',
      role: 'manager',
    });
    expect(res.body.user).toHaveProperty('id');
  });

  it('登录后可凭 token 访问 GET /api/auth/me', async () => {
    const login = await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    const token = login.body.token;
    const me = await agent
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe('admin');
  });

  it('未携带 token 访问 /api/auth/me 应返回 401', async () => {
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
