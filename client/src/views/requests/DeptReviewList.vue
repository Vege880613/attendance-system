<template>
  <div>
    <a-alert message="审批超过3天的请假申请" type="info" show-icon style="margin-bottom:16px;" />
    <a-table :columns="columns" :data-source="list" row-key="id" :pagination="{ pageSize: 20 }" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'leaveType'">
          <a-tag :color="leaveTypeColor(record.leave_type_used)">{{ leaveTypeLabel(record.leave_type_used) }}</a-tag>
        </template>
        <template v-if="column.key === 'balance'">
          <span :style="{ color: record.leaveBalance < record.days ? '#cf1322' : '#52c41a' }">
            余额: {{ record.leaveBalance }}天
          </span>
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button type="primary" size="small" @click="showModal(record, 'approve')">通过</a-button>
            <a-button danger size="small" @click="showModal(record, 'reject')">驳回</a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="modalVisible" :title="action === 'approve' ? '审批通过' : '驳回'" @ok="onSubmit">
      <p>申请人: {{ current?.user_name }}</p>
      <p>假期类型: <a-tag :color="leaveTypeColor(current?.leave_type_used)">{{ leaveTypeLabel(current?.leave_type_used) }}</a-tag></p>
      <p>
        假期余额: <span :style="{ color: (current?.leaveBalance || 0) < (current?.days || 0) ? '#cf1322' : '#52c41a' }">{{ current?.leaveBalance }}天</span>
        （申请{{ current?.days }}天）
      </p>
      <p>日期: {{ current?.start_date }} ~ {{ current?.end_date }}</p>
      <p>班组长意见: {{ current?.team_lead_comment || '无' }}</p>
      <p>原因: {{ current?.reason }}</p>
      <a-form-item label="审批意见">
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
const action = ref('approve')
const comment = ref('')

const columns = [
  { title: '申请人', dataIndex: 'user_name', key: 'user_name', width: 80 },
  { title: '假期类型', dataIndex: 'leave_type_used', key: 'leaveType', width: 100 },
  { title: '余额', key: 'balance', width: 80 },
  { title: '开始日期', dataIndex: 'start_date', key: 'start_date', width: 100 },
  { title: '结束日期', dataIndex: 'end_date', key: 'end_date', width: 100 },
  { title: '天数', dataIndex: 'days', key: 'days', width: 60 },
  { title: '班组长意见', dataIndex: 'team_lead_comment', key: 'team_lead_comment' },
  { title: '操作', key: 'action', width: 120 }
]

const leaveTypeLabel = (t) => ({ annual: '年假', compensatory: '调休', mixed: '混合抵扣（年假+调休）', business_trip: '公差', other: '其他' }[t])
const leaveTypeColor = (t) => ({ annual: 'blue', compensatory: 'purple', mixed: 'cyan', business_trip: 'orange', other: 'default' }[t])

function showModal(record, act) {
  current.value = record
  action.value = act
  comment.value = ''
  modalVisible.value = true
}

async function onSubmit() {
  await requestApi.deptReviewAction(current.value.id, { action: action.value, comment: comment.value })
  message.success(action.value === 'approve' ? '审批通过' : '已驳回')
  modalVisible.value = false
  fetchList()
}

async function fetchList() {
  const res = await requestApi.deptReview()
  list.value = res.list
}

onMounted(fetchList)
</script>
