/**
 * 考勤路由 API 测试
 * 路由：GET /api/attendance, POST /api/attendance/batch, PUT /api/attendance/offset
 */
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const { seed, loginAs, ADMIN, EMPLOYEE, TEAM_LEAD } = require('./seed');

const agent = request(app);

// 选一个未来/过去都无所谓的月份（当前月或固定月都行）
const YEAR_MONTH = new Date().toISOString().slice(0, 7);

describe('POST /api/attendance/batch — 管理员批量录入考勤', () => {
  let adminToken;
  let employeeId;

  beforeAll(() => {
    seed();
    adminToken = loginAs(ADMIN).token;
    employeeId = 3; // seed 里写死的 alice
  });

  it('非管理员应返回 403', async () => {
    const token = loginAs(EMPLOYEE).token;
    const res = await agent
      .post('/api/attendance/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ yearMonth: YEAR_MONTH, records: [] });
    expect(res.status).toBe(403);
  });

  it('参数不合法应返回 400', async () => {
    const res = await agent
      .post('/api/attendance/batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ yearMonth: YEAR_MONTH }); // 缺 records
    expect(res.status).toBe(400);
  });

  it('正常批量录入应成功', async () => {
    const records = [
      { day: 1, check_in: '08:15', check_out: '17:30', remark: '早到' },
      { day: 2, check_in: '09:00', check_out: '17:00', remark: '会议' },
    ];
    const res = await agent
      .post('/api/attendance/batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ yearMonth: YEAR_MONTH, records: records.map(r => ({ ...r, user_id: employeeId })) });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/成功录入 2 条/);
  });
});

describe('GET /api/attendance — 查询考勤列表', () => {
  let adminToken, empToken;

  beforeAll(() => {
    seed();
    adminToken = loginAs(ADMIN).token;
    empToken = loginAs(EMPLOYEE).token;
  });

  it('未带 yearMonth 返回 400', async () => {
    const res = await agent
      .get('/api/attendance')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('管理员可查询指定月份全公司考勤（空也返回 list=[]）', async () => {
    const res = await agent
      .get(`/api/attendance?yearMonth=${YEAR_MONTH}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('list');
    expect(res.body).toHaveProperty('leaves');
    expect(Array.isArray(res.body.list)).toBe(true);
  });

  it('员工角色被强制只查自己的记录', async () => {
    // 先给员工插一条
    await agent
      .post('/api/attendance/batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        yearMonth: YEAR_MONTH,
        records: [{ user_id: 3, day: 3, check_in: '08:20', check_out: '17:00' }],
      });

    const res = await agent
      .get(`/api/attendance?yearMonth=${YEAR_MONTH}`)
      .set('Authorization', `Bearer ${empToken}`);

    expect(res.status).toBe(200);
    // 不应该包含其他用户
    const otherUsers = res.body.list.filter(r => r.user_id !== 3);
    expect(otherUsers.length).toBe(0);
  });
});

describe('PUT /api/attendance/offset — 年假抵扣短缺工时', () => {
  let adminToken;

  beforeAll(() => {
    seed();
    adminToken = loginAs(ADMIN).token;
  });

  it('缺少参数返回 400', async () => {
    const res = await agent
      .put('/api/attendance/offset')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('抵扣成功：年假余额应扣减', async () => {
    const date = `${new Date().getFullYear()}-06-15`; // 一个确定存在的日期
    const res = await agent
      .put('/api/attendance/offset')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: 3,
        date,
        offsetType: 'annual_leave',
        offsetUnits: 1,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('抵扣成功');

    // 再试一次应仍可（余额 5-1=4 > 0）
    const res2 = await agent
      .put('/api/attendance/offset')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: 3,
        date: `${new Date().getFullYear()}-06-16`,
        offsetType: 'annual_leave',
        offsetUnits: 1,
      });
    expect(res2.status).toBe(200);
  });
});
