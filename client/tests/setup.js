/**
 * 前端测试全局 setup
 * - 注册 Testing Library 的 jest-dom 断言（toBeInTheDocument 等）
 * - 注册 ant-design-vue（让 a-button/a-input 等组件可解析）
 * - stub 掉 @ant-design-icons-vue 的全部图标，避免组件渲染时报错
 */
import '@testing-library/jest-dom'
import Antd from 'ant-design-vue'

// antdv 的 ResponsiveObserve 依赖 window.matchMedia，jsdom 未提供
window.matchMedia = window.matchMedia || function (query) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }
}

// 让 vitest 的 render 全局可用 antdv 组件
globalThis.__ANTD_REGISTERED__ = Antd

// antdv 的图标组件在测试环境无法解析，统一 stub 为纯文本 span
vi.mock('@ant-design/icons-vue', () => {
  const icons = [
    'UserOutlined', 'LockOutlined', 'LogoutOutlined', 'TeamOutlined',
    'CalendarOutlined', 'ClockCircleOutlined', 'FormOutlined',
    'DashboardOutlined', 'BarChartOutlined', 'SettingOutlined',
  ]
  const stub = {}
  icons.forEach(name => {
    stub[name] = { template: `<span data-testid="${name}"/>`, name }
  })
  return stub
})
