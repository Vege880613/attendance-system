import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

  const isLoggedIn = computed(() => !!token.value)
  const userRole = computed(() => user.value?.role)
  const isManager = computed(() => user.value?.role === 'manager')
  const isTeamLead = computed(() => user.value?.role === 'team_lead')
  const isDeptManager = computed(() => user.value?.role === 'dept_manager')
  const isEmployee = computed(() => user.value?.role === 'employee')

  function setAuth(tokenValue, userValue) {
    token.value = tokenValue
    user.value = userValue
    localStorage.setItem('token', tokenValue)
    localStorage.setItem('user', JSON.stringify(userValue))
  }

  async function login(username, password) {
    const res = await authApi.login({ username, password })
    setAuth(res.token, res.user)
    return res
  }

  async function fetchMe() {
    const res = await authApi.me()
    user.value = res.user
    localStorage.setItem('user', JSON.stringify(res.user))
    return res
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return {
    token, user, isLoggedIn, userRole, isManager, isTeamLead, isDeptManager, isEmployee,
    setAuth, login, fetchMe, logout
  }
})
