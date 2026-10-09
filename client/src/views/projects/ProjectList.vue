<template>
  <div>
    <a-space style="margin-bottom:16px;">
      <a-select v-model:value="typeFilter" placeholder="类型" style="width:140px;" allow-clear @change="fetchList">
        <a-select-option value="project">项目</a-select-option>
        <a-select-option value="system_maintenance">系统维护</a-select-option>
      </a-select>
      <a-select v-model:value="statusFilter" placeholder="状态" style="width:120px;" allow-clear @change="fetchList">
        <a-select-option value="active">进行中</a-select-option>
        <a-select-option value="completed">已完成</a-select-option>
        <a-select-option value="paused">暂停</a-select-option>
      </a-select>
      <a-button type="primary" @click="showCreate" v-if="authStore.isManager">新增项目</a-button>
    </a-space>

    <a-table :columns="columns" :data-source="list" row-key="id" :pagination="{ pageSize: 20 }" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <a-tag :color="record.type === 'project' ? 'blue' : 'purple'">
            {{ record.type === 'project' ? '项目' : '系统维护' }}
          </a-tag>
        </template>
        <template v-if="column.key === 'status'">
          <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
        </template>
        <template v-if="column.key === 'action' && authStore.isManager">
          <a-button type="link" size="small" @click="showEdit(record)">编辑</a-button>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="modalVisible" :title="editing.id ? '编辑项目' : '新增项目'" @ok="onSave">
      <a-form :model="editing" layout="vertical">
        <a-form-item label="项目名称" name="name">
          <a-input v-model:value="editing.name" placeholder="请输入项目名称" />
        </a-form-item>
        <a-form-item label="类型" name="type">
          <a-select v-model:value="editing.type">
            <a-select-option value="project">项目</a-select-option>
            <a-select-option value="system_maintenance">系统维护</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="editing.description" :rows="3" placeholder="项目描述" />
        </a-form-item>
        <a-form-item label="状态" name="status" v-if="editing.id">
          <a-select v-model:value="editing.status">
            <a-select-option value="active">进行中</a-select-option>
            <a-select-option value="completed">已完成</a-select-option>
            <a-select-option value="paused">暂停</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { useAuthStore } from '../../stores/auth'
import { projectApi } from '../../api'

const authStore = useAuthStore()
const list = ref([])
const typeFilter = ref(null)
const statusFilter = ref(null)
const modalVisible = ref(false)
const editing = reactive({ id: null, name: '', type: 'project', description: '', status: 'active' })

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '描述', dataIndex: 'description', key: 'description' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
  { title: '操作', key: 'action', width: 80 }
]

const statusLabel = (s) => ({ active: '进行中', completed: '已完成', paused: '暂停' }[s])
const statusColor = (s) => ({ active: 'green', completed: 'blue', paused: 'orange' }[s])

async function fetchList() {
  const params = {}
  if (typeFilter.value) params.type = typeFilter.value
  if (statusFilter.value) params.status = statusFilter.value
  const res = await projectApi.list(params)
  list.value = res.list
}

function showCreate() {
  Object.assign(editing, { id: null, name: '', type: 'project', description: '', status: 'active' })
  modalVisible.value = true
}

function showEdit(record) {
  Object.assign(editing, record)
  modalVisible.value = true
}

async function onSave() {
  if (!editing.name) {
    message.warning('请填写项目名称')
    return
  }
  if (editing.id) {
    await projectApi.update(editing.id, editing)
    message.success('更新成功')
  } else {
    await projectApi.create(editing)
    message.success('创建成功')
  }
  modalVisible.value = false
  fetchList()
}

onMounted(fetchList)
</script>
