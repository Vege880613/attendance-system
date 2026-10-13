<template>
  <div>
    <a-space style="margin-bottom:16px;">
      <a-month-picker v-model:value="yearMonth" placeholder="选择月份" />
      <a-select v-model:value="selectedUser" placeholder="选择员工（可选）" style="width:160px;" allow-clear @change="fetchSummary">
        <a-select-option v-for="u in employees" :key="u.id" :value="u.id">{{ u.name }}</a-select-option>
      </a-select>
      <a-button type="primary" @click="fetchSummary" :loading="loading">查询</a-button>
      <a-button @click="exportData">📥 导出</a-button>
    </a-space>

    <!-- 汇总统计卡片 -->
    <a-row :gutter="16" style="margin-bottom:16px;">
      <a-col :span="4">
        <a-card>
          <a-statistic title="总人数" :value="list.length" />
        </a-card>
      </a-col>
      <a-col :span="4">
        <a-card>
          <a-statistic title="正常出勤" :value="totalNormal" style="color:#52c41a;" />
        </a-card>
      </a-col>
      <a-col :span="4">
        <a-card>
          <a-statistic title="缺卡/旷工" :value="totalShortage" style="color:#cf1322;" />
        </a-card>
      </a-col>
      <a-col :span="4">
        <a-card>
          <a-statistic title="请假" :value="totalLeave" style="color:#1890ff;" />
        </a-card>
      </a-col>
      <a-col :span="4">
        <a-card>
          <a-statistic title="加班单位" :value="totalOvertime" style="color:#722ed1;" />
        </a-card>
      </a-col>
      <a-col :span="4">
        <a-card>
          <a-statistic title="工作日" :value="daysInMonth" />
        </a-card>
      </a-col>
    </a-row>

    <!-- 员工汇总表格 -->
    <a-card title="员工月度汇总">
      <a-table
        :columns="summaryColumns"
        :data-source="filteredList"
        row-key="userId"
        :pagination="{ pageSize: 20 }"
        size="small"
        :expand-row-on-click="true"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'shortageDays'">
            <span :style="{ color: record.summary.shortageDays > 0 ? '#cf1322' : '#52c41a' }">
              {{ record.summary.shortageDays }}
            </span>
          </template>
          <template v-if="column.key === 'leaveDays'">
            <span style="color:#1890ff;">{{ record.summary.leaveDays }}</span>
          </template>
          <template v-if="column.key === 'absentDays'">
            <span :style="{ color: record.summary.absentDays > 0 ? '#cf1322' : 'inherit' }">
              {{ record.summary.absentDays }}
            </span>
          </template>
        </template>

        <!-- 展开行：每日明细 -->
        <template #expandedRowRender="{ record }">
          <a-card title="每日明细" size="small" style="margin:0;">
            <a-table
              :columns="dailyColumns"
              :data-source="record.dailyDetails"
              row-key="date"
              :pagination="false"
              size="small"
            >
              <template #bodyCell="{ column, record: day }">
                <template v-if="column.key === 'date'">
                  <span :style="{ color: day.type === 'weekend' ? '#999' : 'inherit' }">
                    {{ day.date }} ({{ weekDay(day.dayOfWeek) }})
                  </span>
                </template>
                <template v-if="column.key === 'status'">
                  <a-tag v-if="day.type === 'weekend'" color="default">休息</a-tag>
                  <a-tag v-else-if="day.type === 'leave'" color="blue">{{ day.leaveTypeName }}</a-tag>
                  <a-tag v-else-if="day.status === '旷工'" color="red">旷工</a-tag>
                  <a-tag v-else-if="day.isShortage" color="orange">缺卡</a-tag>
                  <a-tag v-else-if="day.offsetType && day.offsetType !== 'none'" color="green">{{ day.offsetLabel || '已抵扣' }}</a-tag>
                  <a-tag v-else color="green">正常</a-tag>
                </template>
                <template v-if="column.key === 'time'">
                  <span v-if="day.type === 'attendance'">
                    {{ day.checkIn || '-' }} ~ {{ day.checkOut || '-' }}
                  </span>
                  <span v-else-if="day.type === 'leave'" style="color:#1890ff;">
                    {{ day.leaveTypeName }}
                  </span>
                  <span v-else>-</span>
                </template>
                <template v-if="column.key === 'effectiveHours'">
                  <span :style="{ color: day.isShortage ? '#cf1322' : '#52c41a' }">
                    {{ day.effectiveHours }}h
                  </span>
                </template>
                <template v-if="column.key === 'remark'">
                  <span v-if="day.type === 'leave'">{{ day.leaveReason || '-' }}</span>
                  <span v-else>{{ day.remark || '-' }}</span>
                </template>
              </template>
            </a-table>
          </a-card>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { dashboardApi, userApi } from '../../api'
import dayjs from 'dayjs'

const authStore = useAuthStore()
const yearMonth = ref(dayjs())
const selectedUser = ref(null)
const list = ref([])
const employees = ref([])
const loading = ref(false)
const daysInMonth = ref(30)

const weekDay = (d) => ['日', '一', '二', '三', '四', '五', '六'][d]

const summaryColumns = [
  { title: '姓名', dataIndex: 'userName', key: 'userName', width: 80 },
  { title: '工号', dataIndex: 'employee_id', key: 'employee_id', width: 80 },
  { title: '班组', dataIndex: 'teamName', key: 'teamName', width: 100 },
  { title: '工作日', dataIndex: ['summary', 'workDays'], key: 'workDays', width: 70 },
  { title: '正常', dataIndex: ['summary', 'normalDays'], key: 'normalDays', width: 60 },
  { title: '缺卡', dataIndex: ['summary', 'shortageDays'], key: 'shortageDays', width: 60 },
  { title: '请假', dataIndex: ['summary', 'leaveDays'], key: 'leaveDays', width: 60 },
  { title: '旷工', dataIndex: ['summary', 'absentDays'], key: 'absentDays', width: 60 },
  { title: '加班单位', dataIndex: ['summary', 'overtimeUnits'], key: 'overtimeUnits', width: 80 },
  { title: '年假剩余', dataIndex: ['summary', 'annualLeaveRemaining'], key: 'annualLeaveRemaining', width: 80 },
  { title: '调休剩余', dataIndex: ['summary', 'compLeaveRemaining'], key: 'compLeaveRemaining', width: 80 }
]

const dailyColumns = [
  { title: '日期', dataIndex: 'date', key: 'date', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80 },
  { title: '打卡时间', key: 'time', width: 160 },
  { title: '有效工时', dataIndex: 'effectiveHours', key: 'effectiveHours', width: 80 },
  { title: '备注', dataIndex: 'remark', key: 'remark' }
]

const filteredList = computed(() => {
  if (!selectedUser.value) return list.value
  return list.value.filter(item => item.userId === selectedUser.value)
})

const totalNormal = computed(() => filteredList.value.reduce((sum, i) => sum + i.summary.normalDays, 0))
const totalShortage = computed(() => filteredList.value.reduce((sum, i) => sum + i.summary.shortageDays + i.summary.absentDays, 0))
const totalLeave = computed(() => filteredList.value.reduce((sum, i) => sum + i.summary.leaveDays, 0))
const totalOvertime = computed(() => filteredList.value.reduce((sum, i) => sum + i.summary.overtimeUnits, 0))

async function fetchSummary() {
  if (!yearMonth.value) return
  loading.value = true
  try {
    const res = await dashboardApi.summary({ yearMonth: yearMonth.value.format('YYYY-MM') })
    list.value = res.list
    daysInMonth.value = res.daysInMonth
  } finally {
    loading.value = false
  }
}

// 导出功能 - 两个 sheet
async function exportData() {
  // 动态导入 xlsx 库
  const XLSX = await import('xlsx')

  // Sheet1: 汇总数据
  const summaryHeaders = ['姓名', '工号', '班组', '工作日', '正常', '缺卡', '请假', '旷工', '加班单位', '年假剩余', '调休剩余']
  const summaryData = [summaryHeaders]
  list.value.forEach(row => {
    const s = row.summary || {}
    summaryData.push([
      row.userName || '',
      row.employeeId || '',
      row.teamName || '',
      s.workDays || 0,
      s.normalDays || 0,
      s.shortageDays || 0,
      s.leaveDays || 0,
      s.absentDays || 0,
      s.overtimeUnits || 0,
      s.annualLeaveRemaining || 0,
      s.compLeaveRemaining || 0
    ])
  })

  // Sheet2: 明细数据（全部字段）
  const detailHeaders = ['姓名', '工号', '班组', '日期', '星期', '状态', '类型', '上班打卡', '下班打卡', '有效工时', '假期类型', '请假原因', '备注', '抵扣类型', '抵扣数量']
  const detailData = [detailHeaders]
  list.value.forEach(row => {
    const dailyDetails = row.dailyDetails || []
    dailyDetails.forEach(day => {
      detailData.push([
        row.userName || '',
        row.employeeId || '',
        row.teamName || '',
        day.date || '',
        ['日', '一', '二', '三', '四', '五', '六'][day.dayOfWeek] || '',
        day.status || '',
        day.type || '',
        day.checkIn || '',
        day.checkOut || '',
        day.effectiveHours || 0,
        day.leaveTypeName || '',
        day.leaveReason || '',
        day.remark || '',
        day.offsetType || '',
        day.offsetUnits || 0
      ])
    })
  })

  // 创建工作簿
  const wb = XLSX.utils.book_new()
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
  const ws2 = XLSX.utils.aoa_to_sheet(detailData)
  XLSX.utils.book_append_sheet(wb, ws1, '汇总数据')
  XLSX.utils.book_append_sheet(wb, ws2, '明细数据')

  // 导出文件
  const fileName = `月度汇总_${yearMonth.value?.format('YYYY-MM') || ''}_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, fileName)
}

async function fetchEmployees() {
  const res = await userApi.list({ status: 'active' })
  employees.value = res.list.filter(u => u.role !== 'manager')
}

onMounted(() => {
  fetchEmployees()
  fetchSummary()
})
</script>
