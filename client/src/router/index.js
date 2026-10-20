import { createRouter, createWebHistory } from 'vue-router'

// 鉴权信息直接读 localStorage（和 auth store 同一数据源），
// 避免在 router 守卫里调用 Pinia store —— 守卫执行时 Pinia 尚无激活组件上下文，
// getActivePinia() 会抛错导致整个应用白屏。
function getAuthState() {
  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  return { isLoggedIn: !!token, userRole: user?.role }
}

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '仪表盘' }
      },
      {
        path: 'dashboard/monthly-summary',
        name: 'MonthlySummary',
        component: () => import('../views/dashboard/MonthlySummary.vue'),
        meta: { title: '月度汇总', roles: ['manager', 'team_lead'] }
      },
      {
        path: 'attendance',
        name: 'Attendance',
        component: () => import('../views/attendance/MonthlyList.vue'),
        meta: { title: '月度考勤', roles: ['employee', 'team_lead', 'manager'] }
      },
      {
        path: 'attendance/entry',
        name: 'AttendanceEntry',
        component: () => import('../views/attendance/AttendanceForm.vue'),
        meta: { title: '考勤录入', roles: ['manager'] }
      },
      {
        path: 'overtime',
        name: 'Overtime',
        component: () => import('../views/overtime/OvertimeList.vue'),
        meta: { title: '加班工时', roles: ['employee', 'team_lead', 'manager'] }
      },
      {
        path: 'leave',
        name: 'Leave',
        component: () => import('../views/leave/LeaveBalance.vue'),
        meta: { title: '假期余额', roles: ['employee', 'team_lead', 'manager'] }
      },
      {
        path: 'leave/annual-init',
        name: 'AnnualInit',
        component: () => import('../views/leave/AnnualInit.vue'),
        meta: { title: '年假初始化', roles: ['manager'] }
      },
      {
        path: 'requests/mine',
        name: 'MyRequests',
        component: () => import('../views/requests/MyRequests.vue'),
        meta: { title: '我的申请', roles: ['employee', 'team_lead'] }
      },
      {
        path: 'requests/new',
        name: 'NewRequest',
        component: () => import('../views/requests/RequestForm.vue'),
        meta: { title: '发起申请', roles: ['employee', 'team_lead'] }
      },
      {
        path: 'requests/review',
        name: 'ReviewRequests',
        component: () => import('../views/requests/ReviewList.vue'),
        meta: { title: '待审核', roles: ['team_lead', 'manager'] }
      },
      {
        path: 'requests/dept-review',
        name: 'DeptReviewRequests',
        component: () => import('../views/requests/DeptReviewList.vue'),
        meta: { title: '部门经理审批', roles: ['dept_manager', 'manager'] }
      },
      {
        path: 'requests/confirm',
        name: 'ConfirmRequests',
        component: () => import('../views/requests/ConfirmList.vue'),
        meta: { title: '待确认录入', roles: ['manager'] }
      },
      {
        path: 'employees',
        name: 'Employees',
        component: () => import('../views/employees/EmployeeList.vue'),
        meta: { title: '人员管理', roles: ['manager'] }
      },
      {
        path: 'teams',
        name: 'Teams',
        component: () => import('../views/teams/TeamList.vue'),
        meta: { title: '班组管理', roles: ['manager'] }
      },
      {
        path: 'projects',
        name: 'Projects',
        component: () => import('../views/projects/ProjectList.vue'),
        meta: { title: '项目管理', roles: ['employee', 'team_lead', 'manager'] }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const { isLoggedIn, userRole } = getAuthState()
  if (to.meta.public) {
    return next()
  }
  if (!isLoggedIn) {
    return next('/login')
  }
  if (to.meta.roles && !to.meta.roles.includes(userRole)) {
    return next('/dashboard')
  }
  next()
})

export default router
