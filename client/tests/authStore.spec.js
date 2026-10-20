/**
 * auth store 单元测试
 * 覆盖：login 持久化、角色计算属性、logout 清除
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../src/stores/auth'

const loginMock = vi.fn()
vi.mock('../src/api', () => ({
  authApi: { login: (...args) => loginMock(...args), me: vi.fn() },
}))

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    loginMock.mockReset()
  })

  it('login 写入 token/user 到 state 和 localStorage', async () => {
    loginMock.mockResolvedValue({ token: 'jwt-abc', user: { id: 1, role: 'manager' } })
    const store = useAuthStore()

    await store.login('admin', 'admin123')

    expect(store.token).toBe('jwt-abc')
    expect(store.user).toEqual({ id: 1, role: 'manager' })
    expect(localStorage.getItem('token')).toBe('jwt-abc')
    expect(loginMock).toHaveBeenCalledWith({ username: 'admin', password: 'admin123' })
  })

  it('角色计算属性正确', async () => {
    loginMock.mockResolvedValue({ token: 't', user: { id: 3, role: 'employee' } })
    const store = useAuthStore()
    await store.login('alice', '123456')

    expect(store.isEmployee).toBe(true)
    expect(store.isManager).toBe(false)
    expect(store.isLoggedIn).toBe(true)
    expect(store.userRole).toBe('employee')
  })

  it('logout 清除 state 和 localStorage', () => {
    const store = useAuthStore()
    store.setAuth('tok', { role: 'manager' })
    store.logout()

    expect(store.token).toBe('')
    expect(store.user).toBeNull()
    expect(store.isLoggedIn).toBe(false)
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('localStorage 已有 token 时初始化自动恢复', () => {
    localStorage.setItem('token', 'restore-tok')
    localStorage.setItem('user', JSON.stringify({ id: 2, role: 'team_lead' }))
    const store = useAuthStore()

    expect(store.token).toBe('restore-tok')
    expect(store.isTeamLead).toBe(true)
  })
})
