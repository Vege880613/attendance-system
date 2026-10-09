<template>
  <div>
    <a-alert message="管理人员确认录入后，系统将自动执行数据变更（生成加班单位、扣减假期余额等）" type="info" show-icon style="margin-bottom:16px;" />

    <a-table :columns="columns" :data-source="list" row-key="id" :pagination="{ pageSize: 20 }" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <a-tag>{{ typeLabel(record.type) }}</a-tag>
        </template>
        <template v-if="column.key === 'leaveType'">
          <a-tag v-if="record.type === 'leave'" :color="leaveTypeColor(record.leave_type_used)">{{ leaveTypeLabel(record.leave_type_used) }}</a-tag>
          <span v-else style="color:#999;">-</span>
        </template>
        <template v-if="column.key === 'balance'">
          <span v-if="record.type === 'leave' && record.leaveBalance !== undefined" :style="{ color: record.leaveBalance < record.days ? '#cf1322' : '#52c41a' }">
            余额: {{ record.leaveBalance }}天
          </span>
          <span v-else style="color:#999;">-</span>
        </template>
        <template v-if="column.key === 'deptManager'">
          <span v-if="record.type === 'leave' && record.days > 3 && record.dept_manager_name" style="color:#52c41a;">{{ record.dept_manager_name }}已审批</span>
          <span v-else style="color:#999;">-</span>
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button type="primary" size="small" @click="showModal(record, 'enter')">确认录入</a-button>
            <a-button danger size="small" @click="showModal(record, 'reject')">驳回</a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="modalVisible" :title="action === 'enter' ? '确认录入' : '驳回'" @ok="onSubmit">
      <p>申请人: {{ current?.user_name }}</p>
      <p>类型: {{ typeLabel(current?.type) }}</p>
      <p v-if="current?.type === 'leave'">
        假期类型: <a-tag :color="leaveTypeColor(current?.leave_type_used)">{{ leaveTypeLabel(current?.leave_type_used) }}</a-tag>
      </p>
      <p v-if="current?.type === 'leave' && current?.leaveBalance !== undefined">
        假期余额: <span :style="{ color: current?.leaveBalance < current?.days ? '#cf1322' : '#52c41a' }">{{ current?.leaveBalance }}天</span>
        （申请{{ current?.days }}天）
      </p>
      <p>日期: {{ current?.start_date }} ~ {{ current?.end_date }}</p>
      <p>天数/工时: {{ current?.days }}</p>
      <p>班组长意见: {{ current?.team_lead_comment || '无' }}</p>
      <p v-if="current?.dept_manager_name">部门经理审批: {{ current?.dept_manager_name }} ({{ current?.dept_manager_comment || '无' }})</p>
      <a-form-item label="管理员意见">
        <a-textarea v-model:value="comment" :rows="3" placeholder="请输入意见" />
      </a-form-item>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { requestApi } from '../../api'

const list = ref([])
const modalVisible = ref(false)
const current = ref(null)
const action = ref('enter')
const comment = ref('')

const columns = [
  { title: '申请人', dataIndex: 'user_name', key: 'user_name', width: 80 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 80 },
  { title: '假期类型', key: 'leaveType', width: 100 },
  { title: '余额', key: 'balance', width: 80 },
  { title: '开始日期', dataIndex: 'start_date', key: 'start_date', width: 100 },
  { title: '结束日期', dataIndex: 'end_date', key: 'end_date', width: 100 },
  { title: '天数/工时', dataIndex: 'days', key: 'days', width: 80 },
  { title: '部门经理审批', key: 'deptManager', width: 120 },
  { title: '操作', key: 'action', width: 120 }
]

const typeLabel = (t) => ({ overtime: '加班', leave: '休假' }[t])
const leaveTypeLabel = (t) => ({ annual: '年假', compensatory: '调休', business_trip: '公差', other: '其他', none: '无' }[t])
const leaveTypeColor = (t) => ({ annual: 'blue', compensatory: 'purple', business_trip: 'orange', other: 'default' }[t])

function showModal(record, act) {
  current.value = record
  action.value = act
  comment.value = ''
  modalVisible.value = true
}

async function onSubmit() {
  await requestApi.confirmAction(current.value.id, { action: action.value, comment: comment.value })
  message.success(action.value === 'enter' ? '已确认录入' : '已驳回')
  modalVisible.value = false
  fetchList()
}

async function fetchList() {
  const res = await requestApi.confirm()
  list.value = res.list
}

onMounted(fetchList)
</script>
