/**
 * users 路由 API 测试
 * 覆盖：列表查询（含权限过滤）、创建、编辑、状态变更、导出
 */
process.env.NODE_ENV = 'test'

const request = require('supertest')
const app = require('../src/app')
const { seed, loginAs, ADMIN, EMPLOYEE } = require('./seed')

let adminToken, employeeToken

beforeEach(() => {
  seed()
  adminToken = loginAs(ADMIN).token
  employeeToken = loginAs(EMPLOYEE).token
})

describe('GET /api/users', () => {
  it('管理员可获取完整列表', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.list)).toBe(true)
    expect(res.body.list.length).toBeGreaterThanOrEqual(3)
  })

  it('按关键字搜索', async () => {
    const res = await request(app).get('/api/users?keyword=admin').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.list.some(u => u.username === 'admin')).toBe(true)
  })

  it('按角色过滤', async () => {
    const res = await request(app).get('/api/users?role=employee').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.list.every(u => u.role === 'employee')).toBe(true)
  })

  it('员工也可查看列表（仅 authRequired，无角色限制）', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${employeeToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.list)).toBe(true)
  })

  it('未登录返回 401', async () => {
    const res = await request(app).get('/api/users')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/users（管理员创建员工）', () => {
  it('正常创建', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'newbie', password: '123456', name: '新员工', role: 'employee', hire_date: '2024-01-01' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id')
    expect(res.body.message).toMatch(/创建成功/)
  })

  it('缺少必填字段返回 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'x' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/缺少必要字段/)
  })

  it('用户名重复返回 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'admin', password: '123456', name: '重复', hire_date: '2024-01-01' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/用户名已存在/)
  })

  it('员工无权创建', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ username: 'x', password: '123456', name: 'x', hire_date: '2024-01-01' })
    expect(res.status).toBe(403)
  })
})

describe('PUT /api/users/:id（编辑）', () => {
  it('管理员可编辑', async () => {
    const res = await request(app)
      .put('/api/users/3')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '爱丽丝改名', role: 'employee', team_id: 1, hire_date: '2020-06-15' })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/更新成功/)
  })
})

describe('PUT /api/users/:id/status（状态变更）', () => {
  it('可设为离职', async () => {
    const res = await request(app)
      .put('/api/users/3/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resigned' })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/状态更新成功/)
  })

  it('非法状态返回 400', async () => {
    const res = await request(app)
      .put('/api/users/3/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'bogus' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/状态不合法/)
  })
})

describe('GET /api/users/export（导出 CSV）', () => {
  it('管理员可导出', async () => {
    const res = await request(app).get('/api/users/export').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.text).toMatch(/username/)
  })

  it('员工无权导出', async () => {
    const res = await request(app).get('/api/users/export').set('Authorization', `Bearer ${employeeToken}`)
    expect(res.status).toBe(403)
  })
})
