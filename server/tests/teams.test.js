/**
 * teams 路由 API 测试
 * 覆盖：列表、详情成员、创建、编辑、导出
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

describe('GET /api/teams', () => {
  it('管理员可获取团队列表（含成员数）', async () => {
    const res = await request(app).get('/api/teams').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.list.some(t => t.name === '测试一组')).toBe(true)
    expect(res.body.list[0]).toHaveProperty('member_count')
  })

  it('员工也可查看团队列表', async () => {
    const res = await request(app).get('/api/teams').set('Authorization', `Bearer ${employeeToken}`)
    expect(res.status).toBe(200)
  })
})

describe('GET /api/teams/:id/members', () => {
  it('可获取指定团队成员', async () => {
    const res = await request(app).get('/api/teams/1/members').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.list.some(u => u.username === 'alice')).toBe(true)
  })
})

describe('POST /api/teams（管理员创建团队）', () => {
  it('正常创建', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '二组', lead_user_id: 2 })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id')
  })

  it('班组名称为空返回 400', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/班组名称不能为空/)
  })

  it('员工无权创建', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ name: '二组' })
    expect(res.status).toBe(403)
  })
})

describe('PUT /api/teams/:id', () => {
  it('管理员可编辑', async () => {
    const res = await request(app)
      .put('/api/teams/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '一组改名', lead_user_id: 2 })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/更新成功/)
  })
})

describe('GET /api/teams/export（导出 CSV）', () => {
  it('管理员可导出', async () => {
    const res = await request(app).get('/api/teams/export').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
  })

  it('员工无权导出', async () => {
    const res = await request(app).get('/api/teams/export').set('Authorization', `Bearer ${employeeToken}`)
    expect(res.status).toBe(403)
  })
})
