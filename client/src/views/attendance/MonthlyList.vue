<template>
  <div>
    <a-space style="margin-bottom:16px;">
      <a-month-picker v-model:value="yearMonth" placeholder="选择月份" />
      <a-select v-if="authStore.isManager" v-model:value="selectedUser" placeholder="选择员工" style="width:160px;" @change="fetchList">
        <a-select-option v-for="u in employees" :key="u.id" :value="u.id">{{ u.name }}</a-select-option>
      </a-select>
      <a-button type="primary" @click="fetchList">查询</a-button>
    </a-space>

    <a-table
      :columns="columns"
      :data-source="records"
      row-key="id"
      :pagination="{ pageSize: 31 }"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'work_date'">
          {{ record.work_date }}
        </template>
        <template v-if="column.key === 'effective_hours'">
          <span :style="{ color: record.is_shortage ? '#cf1322' : 'inherit', fontWeight: record.is_shortage ? 600 : 400 }">
            {{ record.effective_hours }}h
            <span v-if="record.is_shortage">⚠ 短缺</span>
          </span>
        </template>
        <template v-if="column.key === 'offset'">
          <span v-if="record.offset_type !== 'none'" style="color:#52c41a;">
            {{ offsetLabel(record.offset_type) }} {{ record.offset_units }}
          </span>
          <a-button v-else-if="record.is_shortage && authStore.isManager" type="link" size="small" @click="showOffset(record)">
            抵扣
          </a-button>
        </template>
      </template>
      <template #bodyRow="{ record }">
        <tr :class="{ 'shortage-row': record.is_shortage && record.offset_type === 'none' }" />
      </template>
    </a-table>

    <!-- 抵扣弹窗 -->
    <a-modal v-model:open="offsetVisible" title="考勤抵扣" @ok="onOffset" :confirm-loading="offsetLoading" width="600">
      <p>日期: {{ currentRecord?.work_date }}，有效工时: {{ currentRecord?.effective_hours }}h（缺卡 {{ (8 - currentRecord?.effective_hours).toFixed(2) }}h）</p>
      <a-form layout="vertical">
        <a-form-item label="抵扣方式">
          <a-radio-group v-model:value="offsetForm.offsetType" @change="onOffsetTypeChange">
            <a-radio value="annual_leave">年假抵扣</a-radio>
            <a-radio value="compensatory_leave">调休抵扣（需选加班条目）</a-radio>
          </a-radio-group>
        </a-form-item>

        <!-- 年假余额提示 -->
        <a-form-item v-if="offsetForm.offsetType === 'annual_leave'">
          <a-alert type="info" :message="`年假余额: ${annualBalance} 天`" />
        </a-form-item>

        <!-- 调休：选择加班条目 -->
        <a-form-item v-if="offsetForm.offsetType === 'compensatory_leave'" label="选择加班条目">
          <a-alert type="info" show-icon :message="`已选 ${selectedUnits.length} 条，累计可抵扣 ${selectedDays} 天（1-2单位=0.5天，3单位=1天）`" />
          <a-table
            :columns="unitColumns"
            :data-source="availableUnits"
            row-key="id"
            :pagination="{ pageSize: 5 }"
            size="small"
            :row-selection="{ selectedRowKeys: offsetForm.overtimeUnitIds, onChange: onUnitSelect }"
            style="margin-top:8px;"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'convert'">
                <span style="color:#52c41a;">0.5天</span>
              </template>
            </template>
          </a-table>
        </a-form-item>

        <a-form-item v-if="offsetForm.offsetType !== 'compensatory_leave'" label="抵扣数量（1单位=0.5天）">
          <a-input-number v-model:value="offsetForm.offsetUnits" :min="1" :step="1" style="width:100%;" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { useAuthStore } from '../../stores/auth'
import { attendanceApi, userApi, overtimeApi, leaveApi } from '../../api'

const authStore = useAuthStore()
const yearMonth = ref(dayjs())
const selectedUser = ref(authStore.isManager ? null : authStore.user.id)
const records = ref([])
const employees = ref([])
const offsetVisible = ref(false)
const currentRecord = ref(null)
const offsetLoading = ref(false)
const annualBalance = ref(0)
const availableUnits = ref([])

const offsetForm = ref({
  offsetType: 'overtime',
  offsetUnits: 1,
  overtimeUnitIds: []
})

const unitColumns = [
  { title: '日期', dataIndex: 'work_date', key: 'work_date', width: 100 },
  { title: '时长', dataIndex: 'hours', key: 'hours', width: 60 },
  { title: '可抵扣', key: 'convert', width: 70 }
]

const selectedUnits = computed(() => {
  return availableUnits.value.filter(u => offsetForm.value.overtimeUnitIds.includes(u.id))
})

const selectedDays = computed(() => {
  const totalUnits = selectedUnits.value.reduce((sum, u) => sum + u.units_count, 0)
  return Math.floor(totalUnits / 3) + (totalUnits % 3 > 0 ? 0.5 : 0)
})

const offsetLabel = ({
  annual_leave: '年假抵扣',
  compensatory_leave: '调休抵扣'
}[type] || type)

const columns = [
  { title: '日期', dataIndex: 'work_date', key: 'work_date', width: 120 },
  { title: '上班打卡', dataIndex: 'check_in', key: 'check_in', width: 100 },
  { title: '下班打卡', dataIndex: 'check_out', key: 'check_out', width: 100 },
  { title: '有效工时', dataIndex: 'effective_hours', key: 'effective_hours', width: 120 },
  { title: '备注', dataIndex: 'remark', key: 'remark' },
  { title: '抵扣', key: 'offset', width: 160 }
]

async function fetchList() {
  if (!yearMonth.value) return
  const ym = yearMonth.value.format('YYYY-MM')
  const params = { yearMonth: ym, userId: selectedUser.value }
  const res = await attendanceApi.list(params)

  // 获取该月所有工作日，补充缺失的日期（无考勤的显示为旷工）
  const [year, month] = ym.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const allRecords = []

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${ym}-${String(d).padStart(2, '0')}`
    const dayOfWeek = new Date(dateStr).getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    if (isWeekend) continue // 跳过周末

    const existing = res.list.find(r => r.work_date === dateStr)
    if (existing) {
      allRecords.push(existing)
    } else {
      // 无考勤记录，显示为旷工（可抵扣）
      allRecords.push({
        id: null,
        user_id: selectedUser.value,
        work_date: dateStr,
        check_in: '',
        check_out: '',
        effective_hours: 0,
        standard_hours: 8,
        is_shortage: 1,
        offset_type: 'none',
        offset_units: 0,
        remark: ''
      })
    }
  }

  records.value = allRecords
}

async function fetchEmployees() {
  if (!authStore.isManager) return
  const res = await userApi.list({ status: 'active' })
  employees.value = res.list
}

async function showOffset(record) {
  currentRecord.value = record
  offsetForm.value = { offsetType: 'overtime', offsetUnits: 1, overtimeUnitIds: [] }
  offsetVisible.value = true

  // 获取年假余额
  const year = new Date(record.work_date).getFullYear()
  const balRes = await leaveApi.balance(record.user_id)
  const annual = balRes.list.find(b => b.leave_type === 'annual')
  annualBalance.value = annual ? (annual.entitled_days - annual.used_days).toFixed(1) : 0

  // 获取可用加班单位
  const otRes = await overtimeApi.available(record.user_id)
  availableUnits.value = otRes.list
}

function onOffsetTypeChange() {
  offsetForm.value.overtimeUnitIds = []
  offsetForm.value.offsetUnits = 1
}

function onUnitSelect(selectedKeys) {
  offsetForm.value.overtimeUnitIds = selectedKeys
}

async function onOffset() {
  offsetLoading.value = true
  try {
    const payload = {
      userId: currentRecord.value.user_id,
      date: currentRecord.value.date || currentRecord.value.work_date,
      offsetType: offsetForm.value.offsetType,
      offsetUnits: offsetForm.value.offsetType === 'compensatory_leave' ? selectedDays.value * 2 : offsetForm.value.offsetUnits,
      overtimeUnitIds: offsetForm.value.overtimeUnitIds
    }
    await attendanceApi.offset(payload)
    message.success('抵扣成功')
    offsetVisible.value = false
    fetchList()
  } catch (e) {
    message.error(e.response?.data?.message || '抵扣失败')
  } finally {
    offsetLoading.value = false
  }
}

onMounted(() => {
  fetchEmployees()
  fetchList()
})
</script>
