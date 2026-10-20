/**
 * holidays 路由 API 测试
 * 覆盖：列表（按年过滤）、创建（管理员/唯一性）、删除、权限
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
  // 预设一条节假日
  db.prepare(
    `INSERT OR IGNORE INTO holidays (date, name, type, year) VALUES ('2026-10-01', '国庆节', 'holiday', 2026)`
  ).run()
})

describe('GET /api/holidays', () => {
  it('管理员可获取列表', async () => {
    const res = await request(app).get('/api/holidays').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.list.some(h => h.name === '国庆节')).toBe(true)
  })

  it('按 year 过滤', async () => {
    const res = await request(app).get('/api/holidays?year=2026').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.list.every(h => h.year === 2026)).toBe(true)
  })

  it('员工也可查看', async () => {
    const res = await request(app).get('/api/holidays').set('Authorization', `Bearer ${employeeToken}`)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/holidays（管理员创建）', () => {
  it('正常创建', async () => {
    const res = await request(app)
      .post('/api/holidays')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2026-01-01', name: '元旦', type: 'holiday', year: 2026 })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id')
  })

  it('缺必填字段返回 400', async () => {
    const res = await request(app)
      .post('/api/holidays')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2026-01-01' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/缺少必要字段/)
  })

  it('重复日期返回 400', async () => {
    const res = await request(app)
      .post('/api/holidays')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2026-10-01', name: '重复', type: 'holiday', year: 2026 })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/该日期已存在/)
  })

  it('员工无权创建', async () => {
    const res = await request(app)
      .post('/api/holidays')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ date: '2026-12-25', name: '圣诞', type: 'holiday', year: 2026 })
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/holidays/:id', () => {
  it('管理员可删除', async () => {
    const row = db.prepare("SELECT id FROM holidays WHERE date='2026-10-01'").get()
    const res = await request(app)
      .delete(`/api/holidays/${row.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/删除成功/)
  })

  it('员工无权删除', async () => {
    const row = db.prepare("SELECT id FROM holidays WHERE date='2026-10-01'").get()
    const res = await request(app)
      .delete(`/api/holidays/${row.id}`)
      .set('Authorization', `Bearer ${employeeToken}`)
    expect(res.status).toBe(403)
  })
})
