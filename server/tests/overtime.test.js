/**
 * overtime 路由 API 测试
 * 覆盖：列表（员工自限/管理员筛选）、available 计数、导出权限
 */
process.env.NODE_ENV = 'test'

const request = require('supertest')
const app = require('../src/app')
const db = require('../src/config/db')
const { seed, loginAs, ADMIN, EMPLOYEE } = require('./seed')

let adminToken, employeeToken

beforeEach(() => {
  seed()
  adminToken = loginAs(ADMIN).token
  employeeToken = loginAs(EMPLOYEE).token
  db.prepare('DELETE FROM overtime_units').run()
  // 给员工 3 条加班记录（2 条 approved，1 条 pending）
  const stmt = db.prepare(
    `INSERT INTO overtime_units (user_id, work_date, hours, units_count, status)
     VALUES (?, ?, ?, ?, ?)`
  )
  stmt.run(3, '2026-06-01', 3, 1, 'approved')
  stmt.run(3, '2026-06-02', 6, 2, 'approved')
  stmt.run(3, '2026-06-03', 3, 1, 'pending')
})

describe('GET /api/overtime', () => {
  it('员工只能看到自己的记录', async () => {
    const res = await request(app).get('/api/overtime').set('Authorization', `Bearer ${employeeToken}`)
    expect(res.status).toBe(200)
    expect(res.body.list.length).toBe(3)
    expect(res.body.list.every(o => o.user_id === 3)).toBe(true)
  })

  it('管理员可按 status 过滤', async () => {
    const res = await request(app).get('/api/overtime?status=approved').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.list.every(o => o.status === 'approved')).toBe(true)
  })

  it('管理员可按 userId 过滤', async () => {
    const res = await request(app).get('/api/overtime?userId=3').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.list.every(o => o.user_id === 3)).toBe(true)
  })

  it('未登录返回 401', async () => {
    const res = await request(app).get('/api/overtime')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/overtime/available/:userId', () => {
  it('返回 approved 记录', async () => {
    const res = await request(app).get('/api/overtime/available/3').set('Authorization', `Bearer ${employeeToken}`)
    expect(res.status).toBe(200)
    expect(res.body.list.every(o => o.status === 'approved')).toBe(true)
    expect(res.body.list.length).toBe(2)
  })
})

describe('GET /api/overtime/export（导出 CSV）', () => {
  it('管理员可导出', async () => {
    const res = await request(app).get('/api/overtime/export').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.text).toMatch(/user_name/)
  })

  it('员工无权导出', async () => {
    const res = await request(app).get('/api/overtime/export').set('Authorization', `Bearer ${employeeToken}`)
    expect(res.status).toBe(403)
  })
})
