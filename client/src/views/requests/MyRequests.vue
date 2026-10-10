<template>
  <div>
    <a-table :columns="columns" :data-source="list" row-key="id" :pagination="{ pageSize: 20 }" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <a-tag>{{ typeLabel(record.type) }}</a-tag>
        </template>
        <template v-if="column.key === 'leave_type_used'">
          <span v-if="record.type === 'leave'">{{ leaveTypeLabel(record.leave_type_used) }}</span>
          <span v-else>-</span>
        </template>
        <template v-if="column.key === 'status'">
          <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { requestApi } from '../../api'

const list = ref([])

const columns = [
  { title: '申请类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '假期类型', dataIndex: 'leave_type_used', key: 'leave_type_used', width: 100 },
  { title: '开始日期', dataIndex: 'start_date', key: 'start_date', width: 100 },
  { title: '结束日期', dataIndex: 'end_date', key: 'end_date', width: 100 },
  { title: '天数/工时', dataIndex: 'days', key: 'days', width: 80 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80 },
  { title: '班组长意见', dataIndex: 'team_lead_comment', key: 'team_lead_comment' },
  { title: '管理员意见', dataIndex: 'manager_comment', key: 'manager_comment' }
]

const typeLabel = (t) => ({ overtime: '加班', leave: '休假', special_leave: '婚丧嫁娶' }[t])
const leaveTypeLabel = (t) => ({ annual: '年假', compensatory: '调休', business_trip: '公差', other: '其他', mixed: '混合抵扣（年假+调休）', none: '-' }[t] || '-')
const statusLabel = (s) => ({ pending: '待审核', approved: '已审核', rejected: '已驳回', entered: '已录入' }[s])
const statusColor = (s) => ({ pending: 'orange', approved: 'blue', rejected: 'red', entered: 'green' }[s])

onMounted(async () => {
  const res = await requestApi.mine()
  list.value = res.list
})
</script>
