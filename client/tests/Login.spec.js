/**
 * Login.vue 组件测试
 * 覆盖：渲染、空字段校验、登录成功后跳转
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import Antd from 'ant-design-vue'
import Login from '../src/views/Login.vue'

// mock API 层（不真的发请求）
const loginMock = vi.fn()
vi.mock('../src/api', () => ({
  authApi: { login: (...args) => loginMock(...args) },
}))

function renderLogin() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: Login },
      { path: '/dashboard', name: 'Dashboard', component: { template: '<div/>' } },
    ],
  })
  const utils = render(Login, { global: { plugins: [pinia, router, Antd] } })
  return { ...utils, router, container: utils.container }
}

describe('Login.vue', () => {
  beforeEach(() => {
    localStorage.clear()
    loginMock.mockReset()
  })

  it('渲染标题、默认账号提示、输入框和登录按钮', () => {
    const { container } = renderLogin()
    // 标题与提示文本
    expect(container.textContent).toMatch(/人员考勤管理系统/)
    expect(container.textContent).toMatch(/admin \/ admin123/)
    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument()
    expect(container.querySelector('button')).toBeTruthy()
  })

  it('空字段提交显示校验消息', async () => {
    const { container } = renderLogin()
    await fireEvent.click(container.querySelector('button'))
    expect(await screen.findByText(/请输入用户名/)).toBeInTheDocument()
  })

  it('登录成功后写入 localStorage 并跳转到 /dashboard', async () => {
    loginMock.mockResolvedValue({ token: 'jwt-xyz', user: { id: 1, role: 'manager' } })
    const { router, container } = renderLogin()

    await fireEvent.update(screen.getByPlaceholderText('用户名'), 'admin')
    await fireEvent.update(screen.getByPlaceholderText('密码'), 'admin123')
    await fireEvent.click(container.querySelector('button'))

    await waitFor(() => expect(localStorage.getItem('token')).toBe('jwt-xyz'))
    await waitFor(() => expect(router.currentRoute.value.path).toBe('/dashboard'))
  })
})
