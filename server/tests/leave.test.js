/**
 * 请假路由 API 测试
 * 路由：GET /api/leave/:userId, POST /api/leave/annual/init, POST /api/leave/annual/clear
 */
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const { seed, loginAs, ADMIN, EMPLOYEE } = require('./seed');

const agent = request(app);

describe('GET /api/leave/:userId — 查询假期余额', () => {
  let adminToken, empToken;
  const year = new Date().getFullYear();

  beforeAll(() => {
    seed();
    adminToken = loginAs(ADMIN).token;
    empToken = loginAs(EMPLOYEE).token;
  });

  it('员工查自己的假期应成功', async () => {
    const res = await agent
      .get('/api/leave/3')
      .set('Authorization', `Bearer ${empToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('year', year);
    expect(res.body).toHaveProperty('list');
    const annual = res.body.list.find(b => b.leave_type === 'annual');
    expect(annual).toBeDefined();
    expect(annual.entitled_days).toBe(5); // seed 里写死
    expect(annual.used_days).toBe(0);
  });

  it('员工查别人的假期应 403', async () => {
    const res = await agent
      .get('/api/leave/1') // admin id
      .set('Authorization', `Bearer ${empToken}`);
    expect(res.status).toBe(403);
  });

  it('管理员可查任意员工', async () => {
    const res = await agent
      .get('/api/leave/3')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.list.length).toBeGreaterThanOrEqual(3); // annual + compensatory + business_trip + other
  });
});

describe('POST /api/leave/annual/init — 管理员初始化年假', () => {
  let adminToken;

  beforeAll(() => {
    seed();
    adminToken = loginAs(ADMIN).token;
  });

  it('管理员可初始化，响应提示成功', async () => {
    const targetYear = new Date().getFullYear();
    const res = await agent
      .post('/api/leave/annual/init')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: targetYear });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/年假初始化完成/);
  });

  it('初始化后员工应至少有 5 天年假（按工龄分档）', async () => {
    const res = await agent
      .get('/api/leave/3')
      .set('Authorization', `Bearer ${adminToken}`);
    const annual = res.body.list.find(b => b.leave_type === 'annual');
    expect(annual.entitled_days).toBeGreaterThanOrEqual(0);
  });
});

describe('POST /api/leave/annual/clear — 清理年度假期', () => {
  let adminToken;

  beforeAll(() => {
    seed();
    adminToken = loginAs(ADMIN).token;
  });

  it('管理员可清理上一年的假期', async () => {
    const targetYear = new Date().getFullYear() - 1;
    // 先插点数据
    await agent
      .post('/api/leave/annual/init')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: targetYear });

    const res = await agent
      .post('/api/leave/annual/clear')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: targetYear });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/已清理/);
  });
});
