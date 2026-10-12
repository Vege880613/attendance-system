<template>
  <div>
    <a-space style="margin-bottom:16px;">
      <a-button type="primary" @click="showCreate">新增班组</a-button>
      <a-button @click="exportData">📥 导出</a-button>
    </a-space>

    <a-table :columns="columns" :data-source="list" row-key="id" :pagination="false" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'created_at'">
          <span style="font-size:12px;color:#999;">{{ record.created_at || '-' }}</span>
        </template>
        <template v-if="column.key === 'updated_at'">
          <span style="font-size:12px;color:#999;">{{ record.updated_at || '-' }}</span>
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="showEdit(record)">编辑</a-button>
            <a-button type="link" size="small" @click="showMembers(record)">查看成员</a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="modalVisible" :title="editing.id ? '编辑班组' : '新增班组'" @ok="onSave">
      <a-form :model="editing" layout="vertical">
        <a-form-item label="班组名称" name="name">
          <a-input v-model:value="editing.name" />
        </a-form-item>
        <a-form-item label="班组长" name="lead_user_id">
          <a-select v-model:value="editing.lead_user_id" placeholder="请选择班组长" allow-clear show-search :filter-option="false">
            <a-select-option v-for="u in leads" :key="u.id" :value="u.id">{{ u.name }} ({{ u.username }})</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-drawer :title="`${currentTeam?.name || ''} - 成员列表`" :open="memberVisible" :width="500" @close="memberVisible = false">
      <a-table :columns="memberColumns" :data-source="members" row-key="id" :pagination="false" size="small" />
    </a-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { teamApi, userApi } from '../../api'

const list = ref([])
const leads = ref([])
const modalVisible = ref(false)
const memberVisible = ref(false)
const currentTeam = ref(null)
const members = ref([])
const editing = reactive({ id: null, name: '', lead_user_id: null })

const columns = [
  { title: '班组名称', dataIndex: 'name', key: 'name', width: 160 },
  { title: '班组长', dataIndex: 'lead_name', key: 'lead_name', width: 120 },
  { title: '成员数', dataIndex: 'member_count', key: 'member_count', width: 80 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 120 },
  { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 120 },
  { title: '操作', key: 'action', width: 160 }
]

// 导出功能
function exportData() {
  const headers = ['name', 'lead_name', 'member_count', 'created_at', 'updated_at'];
  const headerLabels = ['班组名称', '班组长', '成员数', '创建时间', '更新时间'];

  const csvRows = [headerLabels.join(',')];
  list.value.forEach(row => {
    const values = headers.map(h => {
      let val = row[h];
      if (val === null || val === undefined) val = '';
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    });
    csvRows.push(values.join(','));
  });

  const csvContent = '﻿' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `班组列表_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

const memberColumns = [
  { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
  { title: '角色', dataIndex: 'role', key: 'role', width: 100 },
  { title: '入职日期', dataIndex: 'hire_date', key: 'hire_date', width: 120 }
]

async function fetchList() {
  const res = await teamApi.list()
  list.value = res.list
}

async function fetchLeads() {
  const res = await userApi.list({ role: 'team_lead', status: 'active' })
  leads.value = res.list
}

function showCreate() {
  Object.assign(editing, { id: null, name: '', lead_user_id: null })
  modalVisible.value = true
}

function showEdit(record) {
  Object.assign(editing, { id: record.id, name: record.name, lead_user_id: record.lead_user_id })
  modalVisible.value = true
}

async function onSave() {
  if (!editing.name) {
    message.warning('请填写班组名称')
    return
  }
  if (editing.id) {
    await teamApi.update(editing.id, { name: editing.name, lead_user_id: editing.lead_user_id })
    message.success('更新成功')
  } else {
    await teamApi.create({ name: editing.name, lead_user_id: editing.lead_user_id })
    message.success('创建成功')
  }
  modalVisible.value = false
  fetchList()
}

async function showMembers(record) {
  currentTeam.value = record
  const res = await teamApi.members(record.id)
  members.value = res.list
  memberVisible.value = true
}

onMounted(() => {
  fetchList()
  fetchLeads()
})
</script>
