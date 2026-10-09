<template>
  <div>
    <a-row :gutter="16">
      <a-col :span="6">
        <a-card>
          <a-statistic title="我的角色" :value="roleLabel" />
        </a-card>
      </a-col>
      <a-col :span="6" v-if="authStore.isManager">
        <a-card>
          <a-statistic title="在职员工" :value="employeeCount" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic title="可用加班单位" :value="overtimeCount" suffix="个" />
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic title="年假余额" :value="annualLeave" suffix="天" />
        </a-card>
      </a-col>
    </a-row>

    <a-card title="快捷操作" style="margin-top:16px;">
      <a-space wrap>
        <a-button type="primary" @click="$router.push('/requests/new')">发起申请</a-button>
        <a-button @click="$router.push('/attendance')">查看考勤</a-button>
        <a-button @click="$router.push('/leave')">假期余额</a-button>
        <a-button v-if="authStore.isTeamLead" @click="$router.push('/requests/review')">审核申请</a-button>
        <a-button v-if="authStore.isManager" @click="$router.push('/requests/confirm')">确认录入</a-button>
        <a-button v-if="authStore.isManager" @click="$router.push('/attendance/entry')">录入考勤</a-button>
        <a-button v-if="authStore.isManager || authStore.isTeamLead" @click="$router.push('/dashboard/monthly-summary')">月度汇总</a-button>
      </a-space>
    </a-card>

    <a-card title="最近申请" style="margin-top:16px;">
      <a-table :columns="columns" :data-source="requests" :pagination="false" row-key="id" size="small">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { requestApi, overtimeApi, leaveApi } from '../api'

const authStore = useAuthStore()
const requests = ref([])
const overtimeCount = ref(0)
const annualLeave = ref(0)
const employeeCount = ref(0)

const roleLabel = computed(() => ({
  employee: '员工', team_lead: '班组长', manager: '管理人员'
}[authStore.userRole]))

const columns = [
  { title: '类型', dataIndex: 'type', key: 'type' },
  { title: '开始', dataIndex: 'start_date', key: 'start_date' },
  { title: '结束', dataIndex: 'end_date', key: 'end_date' },
  { title: '天数/工时', dataIndex: 'days', key: 'days' },
  { title: '状态', dataIndex: 'status', key: 'status' }
]

const statusLabel = (s) => ({
  pending: '待审核', approved: '已审核', rejected: '已驳回', entered: '已录入'
}[s])
const statusColor = (s) => ({
  pending: 'orange', approved: 'blue', rejected: 'red', entered: 'green'
}[s])

onMounted(async () => {
  try {
    const res = await requestApi.mine()
    requests.value = res.list.slice(0, 5)
  } catch (e) {}
  try {
    const uid = authStore.user.id
    const ot = await overtimeApi.available(uid)
    overtimeCount.value = ot.total
  } catch (e) {}
  try {
    const uid = authStore.user.id
    const lb = await leaveApi.balance(uid)
    const annual = lb.list.find(l => l.leave_type === 'annual')
    if (annual) annualLeave.value = (annual.entitled_days - annual.used_days).toFixed(1)
  } catch (e) {}
})
</script>
