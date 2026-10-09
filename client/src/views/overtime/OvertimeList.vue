<template>
  <div>
    <a-tabs v-model:activeKey="activeTab">
      <!-- Tab 1: 加班单位列表 -->
      <a-tab-pane key="units" tab="加班单位">
        <a-space style="margin-bottom:16px;">
          <a-select v-if="authStore.isManager" v-model:value="selectedUser" placeholder="选择员工" style="width:160px;" @change="fetchList">
            <a-select-option v-for="u in employees" :key="u.id" :value="u.id">{{ u.name }}</a-select-option>
          </a-select>
          <a-select v-model:value="statusFilter" placeholder="状态" style="width:140px;" allow-clear @change="fetchList">
            <a-select-option value="">全部</a-select-option>
            <a-select-option value="approved">已审核可用</a-select-option>
            <a-select-option value="pending">待审核</a-select-option>
            <a-select-option value="used">已使用(调休抵扣)</a-select-option>
          </a-select>
          <a-button type="primary" @click="fetchList">查询</a-button>
        </a-space>

        <a-table :columns="columns" :data-source="list" row-key="id" :pagination="{ pageSize: 20 }" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
            </template>
            <template v-if="column.key === 'leave_mark'">
              <a-tag v-if="record.leave_type_mark" color="cyan" @click="showLeaveInfo(record)">
                {{ leaveTypeMarkLabel(record.leave_type_mark) }}
              </a-tag>
              <span v-else style="color:#999;">-</span>
            </template>
            <template v-if="column.key === 'leave_dates'">
              <a v-if="record.leave_dates" @click="showLeaveInfo(record)">{{ formatLeaveDates(record.leave_dates) }}</a>
              <span v-else style="color:#999;">-</span>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <!-- Tab 2: 加班明细 -->
      <a-tab-pane key="detail" tab="加班明细">
        <a-space style="margin-bottom:16px;">
          <a-select v-if="authStore.isManager" v-model:value="detailUser" placeholder="选择员工" style="width:160px;" @change="fetchDetail">
            <a-select-option v-for="u in employees" :key="u.id" :value="u.id">{{ u.name }}</a-select-option>
          </a-select>
          <a-month-picker v-model:value="detailMonth" placeholder="选择月份" @change="fetchDetail" />
          <a-button type="primary" @click="fetchDetail">查询</a-button>
        </a-space>

        <a-row :gutter="16" style="margin-bottom:16px;">
          <a-col :span="6">
            <a-card>
              <a-statistic title="总加班单位" :value="summary.total_units || 0" suffix="个" />
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card>
              <a-statistic title="可用单位" :value="summary.available_units || 0" suffix="个" />
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card>
              <a-statistic title="已使用" :value="summary.used_units || 0" suffix="个" />
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card>
              <a-statistic title="待审核" :value="summary.pending_units || 0" suffix="个" />
            </a-card>
          </a-col>
        </a-row>

        <a-table :columns="detailColumns" :data-source="detailList" row-key="id" :pagination="{ pageSize: 20 }" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
            </template>
            <template v-if="column.key === 'leave_mark'">
              <a-tag v-if="record.leave_type_mark" color="cyan" @click="showLeaveInfo(record)">
                {{ leaveTypeMarkLabel(record.leave_type_mark) }}
              </a-tag>
              <span v-else style="color:#999;">-</span>
            </template>
            <template v-if="column.key === 'leave_dates'">
              <a v-if="record.leave_dates" @click="showLeaveInfo(record)">{{ formatLeaveDates(record.leave_dates) }}</a>
              <span v-else style="color:#999;">-</span>
            </template>
            <template v-if="column.key === 'project'">
              <a-tag v-if="record.project_name" color="purple">{{ record.project_name }}</a-tag>
              <span v-else style="color:#999;">-</span>
            </template>
            <template v-if="column.key === 'convert'">
              <span style="color:#52c41a;">{{ record.units_count * 0.5 }}天</span>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <!-- 请假信息弹窗 -->
    <a-modal v-model:open="leaveInfoVisible" title="关联请假信息" :footer="null">
      <p>加班日期: {{ currentLeaveInfo.work_date }}</p>
      <p>假请类型: <a-tag color="cyan">{{ leaveTypeMarkLabel(currentLeaveInfo.leave_type_mark) }}</a-tag></p>
      <p v-if="currentLeaveInfo.leave_dates">请假日期: {{ formatLeaveDates(currentLeaveInfo.leave_dates) }}</p>
      <p v-if="currentLeaveInfo.reason">申请原因: {{ currentLeaveInfo.reason }}</p>
      <p>状态: 已使用（用于抵扣调休）</p>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { overtimeApi, userApi, leaveDetailApi } from '../../api'
import dayjs from 'dayjs'

const authStore = useAuthStore()
const activeTab = ref('units')

const list = ref([])
const employees = ref([])
const selectedUser = ref(authStore.isManager ? null : authStore.user.id)
const statusFilter = ref('')

// 请假信息弹窗
const leaveInfoVisible = ref(false)
const currentLeaveInfo = ref({})

const columns = [
  { title: '日期', dataIndex: 'work_date', key: 'work_date', width: 120 },
  { title: '加班时长', dataIndex: 'hours', key: 'hours', width: 100 },
  { title: '单位数', dataIndex: 'units_count', key: 'units_count', width: 80 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '假请标记', key: 'leave_mark', width: 100 }
]

const detailList = ref([])
const detailUser = ref(authStore.isManager ? null : authStore.user.id)
const detailMonth = ref(dayjs())
const summary = ref({})

const detailColumns = [
  { title: '日期', dataIndex: 'work_date', key: 'work_date', width: 120 },
  { title: '加班时长', dataIndex: 'hours', key: 'hours', width: 80 },
  { title: '单位数', dataIndex: 'units_count', key: 'units_count', width: 70 },
  { title: '可抵扣', key: 'convert', width: 80 },
  { title: '关联项目', dataIndex: 'project', key: 'project', width: 140 },
  { title: '假请标记', key: 'leave_mark', width: 100 },
  { title: '请假日期', key: 'leave_dates', width: 160 },
  { title: '申请原因', dataIndex: 'reason', key: 'reason' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80 }
]

const statusLabel = (s) => ({ pending: '待审核', approved: '可用', used: '已使用', cancelled: '已取消' }[s])
const statusColor = (s) => ({ pending: 'orange', approved: 'green', used: 'cyan', cancelled: 'red' }[s])
const leaveTypeMarkLabel = (t) => ({ compensatory: '调休', annual: '年假', business_trip: '公差', other: '其他' }[t] || t)

function formatLeaveDates(datesJson) {
  try {
    const dates = JSON.parse(datesJson)
    if (dates.length <= 2) {
      return dates.join(', ')
    }
    return `${dates[0]} ~ ${dates[dates.length - 1]} (${dates.length}天)`
  } catch {
    return datesJson
  }
}

function showLeaveInfo(record) {
  currentLeaveInfo.value = record
  leaveInfoVisible.value = true
}

async function fetchList() {
  const params = {}
  if (selectedUser.value) params.userId = selectedUser.value
  if (statusFilter.value) params.status = statusFilter.value
  const res = await overtimeApi.list(params)
  list.value = res.list
}

async function fetchDetail() {
  if (!detailUser.value) return
  const params = { year: detailMonth.value.year() }
  if (detailMonth.value) params.yearMonth = detailMonth.value.format('YYYY-MM')
  const res = await leaveDetailApi.overtimeDetail(detailUser.value, params)
  detailList.value = res.list
  summary.value = res.summary
}

async function fetchEmployees() {
  if (!authStore.isManager) return
  const res = await userApi.list({ status: 'active' })
  employees.value = res.list
}

onMounted(() => {
  fetchEmployees()
  fetchList()
  if (detailUser.value) fetchDetail()
})
</script>
