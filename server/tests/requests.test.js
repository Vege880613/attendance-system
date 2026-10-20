/**
 * 申请路由 API 测试
 * 路由：POST /api/requests, GET /api/requests/mine, GET /api/requests/review,
 *       PUT /api/requests/:id/review, PUT /api/requests/:id/confirm
 *
 * 流程：员工发起 → 组长审核 → 管理员确认录入
 */
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const { seed, loginAs, ADMIN, EMPLOYEE, TEAM_LEAD, PROJECT } = require('./seed');

const agent = request(app);

// 一个三天以内的年假（<3 天，不会触发部门经理审批）
function makeAnnualLeaveBody({ days = 1, offset = 1 } = {}) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() + offset);
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);
  return {
    type: 'leave',
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    days,
    leave_type_used: 'annual',
    reason: '测试年假申请',
  };
}

// 加班申请
function makeOvertimeBody() {
  const today = new Date();
  return {
    type: 'overtime',
    start_date: today.toISOString().slice(0, 10),
    end_date: today.toISOString().slice(0, 10),
    days: 6, // 6 小时
    leave_type_used: 'none',
    project_id: PROJECT.id,
    reason: '周末加班',
  };
}

describe('POST /api/requests — 员工发起申请', () => {
  let empToken, adminToken;

  beforeAll(() => {
    seed();
    empToken = loginAs(EMPLOYEE).token;
    adminToken = loginAs(ADMIN).token;
  });

  it('缺少必要字段返回 400', async () => {
    const res = await agent
      .post('/api/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ type: 'leave' });
    expect(res.status).toBe(400);
  });

  it('加班申请必须选项目', async () => {
    const res = await agent
      .post('/api/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ type: 'overtime', start_date: '2026-11-01', end_date: '2026-11-01' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/必须选择项目/);
  });

  it('年假余额不足返回 400', async () => {
    // seed 里 alice 只有 5 天，申请 10 天
    const body = makeAnnualLeaveBody({ days: 10, offset: 20 });
    const res = await agent
      .post('/api/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/年假余额不足/);
  });

  it('正常发起年假申请返回 id', async () => {
    const body = makeAnnualLeaveBody({ days: 1, offset: 1 });
    const res = await agent
      .post('/api/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(typeof res.body.id).toBe('number');
  });
});

describe('GET /api/requests/mine — 员工查自己的申请', () => {
  let empToken;

  beforeAll(async () => {
    seed();
    empToken = loginAs(EMPLOYEE).token;
    // 先插一条
    await agent
      .post('/api/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send(makeAnnualLeaveBody({ days: 1, offset: 5 }));
  });

  it('应返回自己的申请列表', async () => {
    const res = await agent
      .get('/api/requests/mine')
      .set('Authorization', `Bearer ${empToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.list)).toBe(true);
    expect(res.body.list.length).toBeGreaterThanOrEqual(1);
    expect(res.body.list[0].user_id).toBe(3);
  });
});

describe('审批全流程：员工发起 → 组长审核 → 管理员确认', () => {
  let empToken, leadToken, adminToken;
  let requestId;

  beforeAll(() => {
    seed();
    empToken = loginAs(EMPLOYEE).token;
    leadToken = loginAs(TEAM_LEAD).token;
    adminToken = loginAs(ADMIN).token;
  });

  it('① 员工发起 2 天年假（<3 天无需部门经理审批）', async () => {
    const res = await agent
      .post('/api/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send(makeAnnualLeaveBody({ days: 2, offset: 10 }));
    expect(res.status).toBe(200);
    requestId = res.body.id;
  });

  it('② 组长能在 review 列表中看到待审批', async () => {
    const res = await agent
      .get('/api/requests/review')
      .set('Authorization', `Bearer ${leadToken}`);
    expect(res.status).toBe(200);
    const found = res.body.list.find(r => r.id === requestId);
    expect(found).toBeDefined();
    expect(found.status).toBe('pending');
  });

  it('③ 组长审核通过（<3 天直接变 approved，不需要部门经理）', async () => {
    const res = await agent
      .put(`/api/requests/${requestId}/review`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ action: 'approve', comment: '同意' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/审核通过$/); // 不含 "待部门经理"
  });

  it('④ 管理员确认录入 → 年假余额扣减', async () => {
    const res = await agent
      .put(`/api/requests/${requestId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve', comment: '确认' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('已确认录入');

    // 查余额：seed 5 天 - 2 天 = 3 天
    const bal = await agent
      .get('/api/leave/3')
      .set('Authorization', `Bearer ${adminToken}`);
    const annual = bal.body.list.find(b => b.leave_type === 'annual');
    expect(annual.entitled_days - annual.used_days).toBeCloseTo(3, 1);
  });
});

describe('驳回场景：组长驳回', () => {
  let empToken, leadToken;

  beforeAll(() => {
    seed();
    empToken = loginAs(EMPLOYEE).token;
    leadToken = loginAs(TEAM_LEAD).token;
  });

  it('员工发起 → 组长驳回 → 状态变 rejected', async () => {
    const create = await agent
      .post('/api/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send(makeAnnualLeaveBody({ days: 1, offset: 15 }));
    const id = create.body.id;

    const res = await agent
      .put(`/api/requests/${id}/review`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ action: 'reject', comment: '工作繁忙' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('已驳回');

    // 再 review 应提示已处理
    const again = await agent
      .put(`/api/requests/${id}/review`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ action: 'approve' });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/已处理/);
  });
});

describe('加班申请 → 组长审核后生成加班单位', () => {
  let empToken, leadToken, adminToken;

  beforeAll(() => {
    seed();
    empToken = loginAs(EMPLOYEE).token;
    leadToken = loginAs(TEAM_LEAD).token;
    adminToken = loginAs(ADMIN).token;
  });

  it('加班申请 approve 后生成 overtime_units 记录', async () => {
    const create = await agent
      .post('/api/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send(makeOvertimeBody());
    expect(create.status).toBe(200);
    const id = create.body.id;

    // 组长 approve
    await agent
      .put(`/api/requests/${id}/review`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ action: 'approve' });

    // 管理员 confirm（加班申请不会扣余额，仅变 entered）
    const confirm = await agent
      .put(`/api/requests/${id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve' });
    expect(confirm.status).toBe(200);

    // 直接查 overtime_units 表验证
    const db = require('../src/config/db');
    const units = db.prepare('SELECT * FROM overtime_units WHERE request_id = ?').all(id);
    expect(units.length).toBeGreaterThanOrEqual(1);
    units.forEach(u => {
      expect(u.user_id).toBe(3);
      expect(u.status).toBe('approved');
    });
  });
});
