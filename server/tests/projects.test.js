/**
 * projects 路由 API 测试
 * 覆盖：列表筛选、创建（管理员）、编辑、权限、审计日志
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
})

describe('GET /api/projects', () => {
  it('管理员可获取项目列表', async () => {
    const res = await request(app).get('/api/projects').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.list.some(p => p.name === '项目Alpha')).toBe(true)
  })

  it('按 type 过滤', async () => {
    const res = await request(app).get('/api/projects?type=project').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.list.every(p => p.type === 'project')).toBe(true)
  })

  it('员工也可查看', async () => {
    const res = await request(app).get('/api/projects').set('Authorization', `Bearer ${employeeToken}`)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/projects（管理员创建）', () => {
  it('正常创建', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '项目Beta', type: 'project', description: '测试' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id')
    expect(res.body.message).toMatch(/创建成功/)
  })

  it('项目名称为空返回 400', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/项目名称不能为空/)
  })

  it('员工无权创建', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ name: 'x' })
    expect(res.status).toBe(403)
  })

  it('创建会写审计日志', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '审计项目' })
    expect(res.status).toBe(200)
    const log = db.prepare("SELECT * FROM audit_logs WHERE action = 'create_project'").get()
    expect(log).toBeTruthy()
  })
})

describe('PUT /api/projects/:id', () => {
  it('管理员可编辑', async () => {
    const res = await request(app)
      .put('/api/projects/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Alpha改名', type: 'project', description: '更新', status: 'active' })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/更新成功/)
  })
})
