<template>
  <div>
    <a-space style="margin-bottom:16px;" v-if="authStore.isManager">
      <a-select v-model:value="selectedUser" placeholder="选择员工" style="width:160px;" @change="fetchBalance">
        <a-select-option v-for="u in employees" :key="u.id" :value="u.id">{{ u.name }}</a-select-option>
      </a-select>
    </a-space>

    <a-card :title="`${year} 年度假期余额`">
      <a-row :gutter="16">
        <a-col :span="6" v-for="item in displayBalances" :key="item.leave_type">
          <a-card :title="typeName(item)" class="balance-card" @click="item.hasBalance && showDetail(item)" :hoverable="item.hasBalance">
            <a-progress
              v-if="item.hasBalance"
              :percent="item.entitled_days > 0 ? Math.round((item.used_days / item.entitled_days) * 100) : 0"
              :format="() => `${item.used_days} / ${item.entitled_days} 天`"
            />
            <div v-else style="text-align:center;color:#999;padding:20px 0;">
              <p>无余额限制</p>
              <p style="font-size:12px;">{{ typeDesc(item) }}</p>
            </div>
            <p v-if="item.hasBalance" style="margin-top:8px;">已使用: <b>{{ item.used_days }}</b> 天</p>
            <p v-if="item.hasBalance">总额度: <b>{{ item.entitled_days }}</b> 天</p>
            <p v-if="item.hasBalance">剩余: <b style="color:#52c41a;">{{ (item.entitled_days - item.used_days).toFixed(1) }}</b> 天</p>
            <p v-if="item.hasBalance" class="click-tip">点击查看明细 →</p>
          </a-card>
        </a-col>
        <a-col v-if="displayBalances.length === 0">
          <a-empty description="暂无假期数据" />
        </a-col>
      </a-row>
    </a-card>

    <!-- 假期明细弹窗 -->
    <a-modal v-model:open="detailVisible" :title="`${detailTitle} - 请假明细`" :footer="null" width="800">
      <a-table
        :columns="detailColumns"
        :data-source="detailList"
        row-key="id"
        :pagination="{ pageSize: 10 }"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'date_range'">
            {{ record.start_date }} ~ {{ record.end_date }}
          </template>
          <template v-if="column.key === 'team_lead_name'">
            <span v-if="record.team_lead_name" style="color:#52c41a;">{{ record.team_lead_name }}</span>
            <span v-else style="color:#999;">-</span>
          </template>
          <template v-if="column.key === 'dept_manager_name'">
            <span v-if="record.dept_manager_name" style="color:#52c41a;">{{ record.dept_manager_name }}</span>
            <span v-else style="color:#999;">-</span>
          </template>
          <template v-if="column.key === 'manager_name'">
            <span v-if="record.manager_name" style="color:#52c41a;">{{ record.manager_name }}</span>
            <span v-else style="color:#999;">-</span>
          </template>
        </template>
        <template #emptyText>
          <a-empty description="暂无请假记录" />
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { leaveApi, userApi, leaveDetailApi } from '../../api'

const authStore = useAuthStore()
const balances = ref([])
const employees = ref([])
const selectedUser = ref(authStore.user.id)
const year = ref(new Date().getFullYear())

const detailVisible = ref(false)
const detailTitle = ref('')
const detailList = ref([])

// 显示所有假期类型（包括无余额的）
const displayBalances = computed(() => {
  const allTypes = ['annual', 'compensatory', 'business_trip', 'other']
  const typeNames = {
    annual: '年假',
    compensatory: '调休',
    business_trip: '公差',
    other: '其他'
  }
  return allTypes.map(type => {
    const found = balances.value.find(b => b.leave_type === type)
    return {
      leave_type: type,
      entitled_days: found ? found.entitled_days : 0,
      used_days: found ? found.used_days : 0,
      hasBalance: type === 'annual' || type === 'compensatory'
    }
  })
})

const typeName = (item) => ({
  annual: '年假',
  compensatory: '调休',
  business_trip: '公差',
  other: '其他'
}[item.leave_type])

const typeDesc = (item) => ({
  business_trip: '公差不计入假期余额',
  other: '其他类型不计入余额'
}[item.leave_type] || '')

const detailColumns = [
  { title: '日期范围', key: 'date_range', width: 160 },
  { title: '天数', dataIndex: 'days', key: 'days', width: 50 },
  { title: '原因', dataIndex: 'reason', key: 'reason' },
  { title: '班组长审批', key: 'team_lead_name', width: 80 },
  { title: '班组长意见', dataIndex: 'team_lead_comment', key: 'team_lead_comment' },
  { title: '部门经理审批', key: 'dept_manager_name', width: 80 },
  { title: '部门经理意见', dataIndex: 'dept_manager_comment', key: 'dept_manager_comment' },
  { title: '管理员确认', key: 'manager_name', width: 80 },
  { title: '管理员意见', dataIndex: 'manager_comment', key: 'manager_comment' }
]

async function fetchBalance() {
  const res = await leaveApi.balance(selectedUser.value)
  balances.value = res.list
  year.value = res.year
}

async function fetchEmployees() {
  if (!authStore.isManager) return
  const res = await userApi.list({ status: 'active' })
  employees.value = res.list
}

async function showDetail(item) {
  detailTitle.value = typeName(item)
  detailVisible.value = true
  const res = await leaveDetailApi.leaveDetail(selectedUser.value, {
    year: year.value,
    leaveType: item.leave_type
  })
  detailList.value = res.list
}

onMounted(() => {
  fetchEmployees()
  fetchBalance()
})
</script>

<style scoped>
.balance-card {
  cursor: pointer;
  transition: all 0.3s;
}
.balance-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transform: translateY(-2px);
}
.click-tip {
  font-size: 12px;
  color: #1890ff;
  margin-top: 8px;
  text-align: right;
}
</style>
