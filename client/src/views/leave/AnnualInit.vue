<template>
  <div>
    <a-space style="margin-bottom:16px;">
      <a-input-number v-model:value="year" :min="2020" :max="2099" style="width:120px;" addon-before="年度" />
      <a-button type="primary" @click="preview">预览年假分配</a-button>
      <a-button type="primary" danger @click="onInit">确认初始化</a-button>
    </a-space>

    <a-alert type="info" show-icon message="年假按工龄分档：1-10年5天，10-20年10天，20+年15天。调休余额由加班工时自动转入。" style="margin-bottom:16px;" />

    <a-table :columns="columns" :data-source="previewList" row-key="id" :pagination="{ pageSize: 20 }" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'entitled'">
          <a-input-number v-model:value="record.adjusted" :min="0" :max="30" :step="0.5" style="width:100px;" />
        </template>
        <template v-if="column.key === 'tenure'">
          {{ calcTenure(record.hire_date) }} 年
        </template>
        <template v-if="column.key === 'compensatory'">
          <span style="color:#722ed1;">{{ record.compUnits || 0 }} 单位 = {{ (record.compUnits || 0) * 0.5 }} 天</span>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { userApi, leaveApi } from '../../api'
import { annualLeaveDays } from '../../utils/rules'

const year = ref(new Date().getFullYear())
const previewList = ref([])

const columns = [
  { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
  { title: '入职日期', dataIndex: 'hire_date', key: 'hire_date', width: 120 },
  { title: '工龄', key: 'tenure', width: 80 },
  { title: '系统计算年假(天)', dataIndex: 'system_days', key: 'system_days', width: 140 },
  { title: '调整后年假(天)', dataIndex: 'adjusted', key: 'entitled', width: 140 },
  { title: '调休余额(加班转入)', key: 'compensatory', width: 160 }
]

function calcTenure(hireDate) {
  return year.value - dayjs(hireDate).year()
}

async function preview() {
  const res = await userApi.list({ status: 'active' })
  previewList.value = res.list.map(u => ({
    id: u.id,
    name: u.name,
    hire_date: u.hire_date,
    system_days: annualLeaveDays(u.hire_date, year.value),
    adjusted: annualLeaveDays(u.hire_date, year.value),
    compUnits: 0
  }))
}

async function onInit() {
  if (previewList.value.length === 0) {
    message.warning('请先预览')
    return
  }
  const adjustments = previewList.value
    .filter(u => u.adjusted !== u.system_days)
    .map(u => ({ userId: u.id, entitledDays: u.adjusted }))
  await leaveApi.initAnnual({ year: year.value, adjustments })
  message.success(`${year.value} 年年假初始化完成`)
}

onMounted(preview)
</script>
