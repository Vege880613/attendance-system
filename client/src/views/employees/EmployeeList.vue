<template>
  <div>
    <a-space style="margin-bottom:16px;">
      <a-input-search v-model:value="keyword" placeholder="搜索姓名/用户名" style="width:200px;" @search="fetchList" />
      <a-select v-model:value="roleFilter" placeholder="角色" style="width:120px;" allow-clear @change="fetchList">
        <a-select-option value="employee">员工</a-select-option>
        <a-select-option value="team_lead">班组长</a-select-option>
        <a-select-option value="dept_manager">部门经理</a-select-option>
        <a-select-option value="manager">管理人员</a-select-option>
      </a-select>
      <a-button type="primary" @click="showCreate">新增员工</a-button>
    </a-space>

    <a-table :columns="columns" :data-source="list" row-key="id" :pagination="{ pageSize: 20 }" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'role'">
          <a-tag :color="roleColor(record.role)">{{ roleLabel(record.role) }}</a-tag>
        </template>
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 'active' ? 'green' : 'red'">
            {{ record.status === 'active' ? '在职' : '离职' }}
          </a-tag>
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="showEdit(record)">编辑</a-button>
            <a-button v-if="record.status === 'active'" type="link" size="small" danger @click="onChangeStatus(record, 'resigned')">离职</a-button>
            <a-button v-else type="link" size="small" @click="onChangeStatus(record, 'active')">复职</a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-drawer :title="editing.id ? '编辑员工' : '新增员工'" :open="drawerVisible" :width="480" @close="drawerVisible = false">
      <a-form :model="editing" layout="vertical">
        <a-form-item label="用户名" name="username">
          <a-input v-model:value="editing.username" :disabled="!!editing.id" />
        </a-form-item>
        <a-form-item v-if="!editing.id" label="初始密码" name="password">
          <a-input-password v-model:value="editing.password" />
        </a-form-item>
        <a-form-item label="姓名" name="name">
          <a-input v-model:value="editing.name" />
        </a-form-item>
        <a-form-item label="工号" name="employee_id">
          <a-input v-model:value="editing.employee_id" placeholder="请输入工号（与姓名唯一）" />
        </a-form-item>
        <a-form-item label="角色" name="role">
          <a-select v-model:value="editing.role">
            <a-select-option value="employee">员工</a-select-option>
            <a-select-option value="team_lead">班组长</a-select-option>
            <a-select-option value="dept_manager">部门经理</a-select-option>
            <a-select-option value="manager">管理人员</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="所属班组" name="team_id">
          <a-select v-model:value="editing.team_id" placeholder="请选择" allow-clear>
            <a-select-option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="入职日期" name="hire_date">
          <a-date-picker v-model:value="editing.hire_date" style="width:100%;" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="onSave">保存</a-button>
        </a-form-item>
      </a-form>
    </a-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { userApi, teamApi } from '../../api'

const list = ref([])
const teams = ref([])
const keyword = ref('')
const roleFilter = ref(null)
const drawerVisible = ref(false)
const editing = reactive({ id: null, username: '', password: '', name: '', employee_id: '', role: 'employee', team_id: null, hire_date: null })

const columns = [
  { title: '用户名', dataIndex: 'username', key: 'username', width: 100 },
  { title: '工号', dataIndex: 'employee_id', key: 'employee_id', width: 100 },
  { title: '姓名', dataIndex: 'name', key: 'name', width: 80 },
  { title: '角色', dataIndex: 'role', key: 'role', width: 100 },
  { title: '班组', dataIndex: 'team_name', key: 'team_name', width: 100 },
  { title: '入职日期', dataIndex: 'hire_date', key: 'hire_date', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 60 },
  { title: '操作', key: 'action', width: 120 }
]

const roleLabel = (r) => ({ employee: '员工', team_lead: '班组长', dept_manager: '部门经理', manager: '管理人员' }[r])
const roleColor = (r) => ({ employee: 'blue', team_lead: 'orange', dept_manager: 'purple', manager: 'red' }[r])

async function fetchList() {
  const params = {}
  if (keyword.value) params.keyword = keyword.value
  if (roleFilter.value) params.role = roleFilter.value
  params.status = 'active'
  const res = await userApi.list(params)
  list.value = res.list
}

async function fetchTeams() {
  const res = await teamApi.list()
  teams.value = res.list
}

function showCreate() {
  Object.assign(editing, { id: null, username: '', password: '', name: '', role: 'employee', team_id: null, hire_date: dayjs() })
  drawerVisible.value = true
}

function showEdit(record) {
  Object.assign(editing, {
    id: record.id,
    username: record.username,
    name: record.name,
    role: record.role,
    team_id: record.team_id,
    hire_date: dayjs(record.hire_date),
    password: ''
  })
  drawerVisible.value = true
}

async function onSave() {
  if (!editing.name || !editing.hire_date) {
    message.warning('请填写完整信息')
    return
  }
  const payload = {
    name: editing.name,
    role: editing.role,
    team_id: editing.team_id,
    hire_date: dayjs(editing.hire_date).format('YYYY-MM-DD')
  }
  if (editing.id) {
    await userApi.update(editing.id, payload)
    message.success('更新成功')
  } else {
    if (!editing.username || !editing.password) {
      message.warning('请填写用户名和密码')
      return
    }
    payload.username = editing.username
    payload.password = editing.password
    await userApi.create(payload)
    message.success('创建成功')
  }
  drawerVisible.value = false
  fetchList()
}

async function onChangeStatus(record, status) {
  await userApi.updateStatus(record.id, status)
  message.success(status === 'active' ? '已复职' : '已标记离职')
  fetchList()
}

onMounted(() => {
  fetchTeams()
  fetchList()
})
</script>
