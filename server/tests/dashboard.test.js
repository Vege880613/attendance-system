/**
 * dashboard 路由 API 测试
 * 覆盖：月度汇总（权限：manager/team_lead）、缺参 yearMonth 校验、团队过滤
 */
process.env.NODE_ENV = 'test'

const request = require('supertest')
const app = require('../src/app')
const db = require('../src/config/db')
const { seed, loginAs, ADMIN, EMPLOYEE, TEAM_LEAD } = require('./seed')

let adminToken, leadToken, employeeToken

beforeEach(() => {
  seed()
  adminToken = loginAs(ADMIN).token
  leadToken = loginAs(TEAM_LEAD).token
  employeeToken = loginAs(EMPLOYEE).token
  // 给员工录入一条考勤（正常）
  db.prepare(
    `INSERT OR IGNORE INTO attendance_records (user_id, work_date, check_in, check_out, effective_hours)
     VALUES (3, '2026-10-01', '08:20', '17:00', 8.67)`
  ).run()
})

describe('GET /api/dashboard/summary', () => {
  it('管理员可获取汇总', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary?yearMonth=2026-10')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('yearMonth', '2026-10')
    expect(Array.isArray(res.body.list)).toBe(true)
    expect(res.body.list.some(s => s.userName === '爱丽丝')).toBe(true)
  })

  it('汇总含每日明细与统计', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary?yearMonth=2026-10')
      .set('Authorization', `Bearer ${adminToken}`)
    const alice = res.body.list.find(s => s.userName === '爱丽丝')
    expect(alice).toBeTruthy()
    expect(alice.summary).toHaveProperty('workDays')
    expect(alice.summary).toHaveProperty('annualLeaveRemaining')
    expect(Array.isArray(alice.dailyDetails)).toBe(true)
  })

  it('组长只能看到本团队', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary?yearMonth=2026-10')
      .set('Authorization', `Bearer ${leadToken}`)
    expect(res.status).toBe(200)
    // 组长在测试一组，应能看到 alice
    expect(res.body.list.every(s => s.teamName === '测试一组')).toBe(true)
  })

  it('缺 yearMonth 返回 400', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/请指定年月/)
  })

  it('员工无权访问', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary?yearMonth=2026-10')
      .set('Authorization', `Bearer ${employeeToken}`)
    expect(res.status).toBe(403)
  })
})
