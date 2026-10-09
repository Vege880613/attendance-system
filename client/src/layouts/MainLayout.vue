<template>
  <a-layout class="main-layout">
    <a-layout-sider v-model:collapsed="collapsed" collapsible theme="light">
      <div class="logo">{{ collapsed ? '考勤' : '人员考勤管理系统' }}</div>
      <a-menu v-model:selectedKeys="selectedKeys" theme="light" mode="inline" @click="onMenuClick">
        <a-menu-item key="/dashboard">
          <dashboard-outlined /><span>仪表盘</span>
        </a-menu-item>
        <a-menu-item key="/attendance">
          <calendar-outlined /><span>月度考勤</span>
        </a-menu-item>
        <a-menu-item key="/dashboard/monthly-summary" v-if="authStore.isManager || authStore.isTeamLead">
          <bar-chart-outlined /><span>月度汇总</span>
        </a-menu-item>
        <a-menu-item key="/overtime">
          <clock-circle-outlined /><span>加班工时</span>
        </a-menu-item>
        <a-menu-item key="/leave">
          <solution-outlined /><span>假期余额</span>
        </a-menu-item>
        <a-sub-menu key="requests" v-if="authStore.isEmployee || authStore.isTeamLead || authStore.isDeptManager">
          <template #title><span><form-outlined />申请审批</span></template>
          <a-menu-item key="/requests/mine" v-if="authStore.isEmployee || authStore.isTeamLead">我的申请</a-menu-item>
          <a-menu-item key="/requests/new" v-if="authStore.isEmployee || authStore.isTeamLead">发起申请</a-menu-item>
          <a-menu-item key="/requests/review" v-if="authStore.isTeamLead">待审核</a-menu-item>
          <a-menu-item key="/requests/dept-review" v-if="authStore.isDeptManager">部门经理审批</a-menu-item>
        </a-sub-menu>
        <a-menu-item key="/requests/confirm" v-if="authStore.isManager">
          <audit-outlined /><span>待确认录入</span>
        </a-menu-item>
        <a-menu-item key="/projects">
          <appstore-outlined /><span>项目/系统</span>
        </a-menu-item>
        <a-sub-menu key="leave-mgmt" v-if="authStore.isManager">
          <template #title><span><schedule-outlined />假期管理</span></template>
          <a-menu-item key="/leave/annual-init">年假初始化</a-menu-item>
        </a-sub-menu>
        <a-sub-menu key="admin" v-if="authStore.isManager">
          <template #title><span><setting-outlined />系统管理</span></template>
          <a-menu-item key="/employees">人员管理</a-menu-item>
          <a-menu-item key="/teams">班组管理</a-menu-item>
        </a-sub-menu>
      </a-menu>
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="header">
        <span class="page-title">{{ pageTitle }}</span>
        <div class="header-right">
          <a-dropdown>
            <a-space style="cursor:pointer;">
              <a-avatar style="background-color:#1890ff">{{ userName.charAt(0) }}</a-avatar>
              <span>{{ userName }}</span>
              <a-tag :color="roleColor">{{ roleLabel }}</a-tag>
            </a-space>
            <template #overlay>
              <a-menu>
                <a-menu-item @click="onLogout">退出登录</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>
      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  DashboardOutlined, CalendarOutlined, ClockCircleOutlined,
  SolutionOutlined, FormOutlined, AuditOutlined, ScheduleOutlined,
  SettingOutlined, AppstoreOutlined, BarChartOutlined
} from '@ant-design/icons-vue'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const collapsed = ref(false)
const selectedKeys = ref([route.path])

const userName = computed(() => authStore.user?.name || '')
const roleLabel = computed(() => ({
  employee: '员工', team_lead: '班组长', manager: '管理人员'
}[authStore.userRole] || ''))
const roleColor = computed(() => ({
  employee: 'blue', team_lead: 'orange', manager: 'red'
}[authStore.userRole] || ''))
const pageTitle = computed(() => route.meta.title || '')

watch(() => route.path, (val) => { selectedKeys.value = [val] })

function onMenuClick({ key }) {
  router.push(key)
}

function onLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.main-layout { height: 100vh; }
.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 16px;
  color: #1890ff;
  border-bottom: 1px solid #f0f0f0;
}
.header {
  background: #fff;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}
.page-title { font-size: 18px; font-weight: 600; }
.content { margin: 16px; padding: 24px; background: #fff; border-radius: 4px; overflow: auto; }
</style>
