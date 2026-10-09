<template>
  <div>
    <a-tabs v-model:activeKey="activeTab">
      <!-- Tab 1: 原有手动录入功能 -->
      <a-tab-pane key="manual" tab="手动录入">
        <a-space style="margin-bottom:16px;">
          <a-month-picker v-model:value="yearMonth" placeholder="选择月份" />
          <a-select v-model:value="selectedUser" placeholder="选择员工" style="width:160px;">
            <a-select-option v-for="u in employees" :key="u.id" :value="u.id">{{ u.name }}</a-select-option>
          </a-select>
          <a-button type="primary" @click="generateDays">生成工作日</a-button>
          <a-button @click="addRow">+ 增加一行</a-button>
          <a-button type="primary" ghost @click="onSubmit" :disabled="rows.length === 0">批量录入 ({{ rows.length }}条)</a-button>
        </a-space>

        <a-table :columns="columns" :data-source="rows" row-key="_id" :pagination="false" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'day'">
              <a-input-number v-model:value="record.day" :min="1" :max="31" style="width:60px;" @change="recalc(record)" />
            </template>
            <template v-if="column.key === 'check_in'">
              <a-time-picker v-model:value="record.check_in_picker" format="HH:mm" style="width:120px;" @change="recalc(record)" />
            </template>
            <template v-if="column.key === 'check_out'">
              <a-time-picker v-model:value="record.check_out_picker" format="HH:mm" style="width:120px;" @change="recalc(record)" />
            </template>
            <template v-if="column.key === 'effective'">
              <span :style="{ color: record.effective < 8 ? '#cf1322' : '#52c41a' }">{{ record.effective }}h</span>
            </template>
            <template v-if="column.key === 'action'">
              <a-button type="link" size="small" danger @click="deleteRow(record)">删除</a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <!-- Tab 2: Excel 批量导入 -->
      <a-tab-pane key="excel" tab="Excel 批量导入">
        <a-card title="Excel 批量导入考勤">
          <a-space direction="vertical" style="width:100%;">
            <a-alert type="info" show-icon message="支持工号+姓名格式的考勤Excel文件，每个员工占2行（上班+下班），支持'休息'和'漏卡'标记">
              <template #description>
                <a-button type="link" size="small" @click="downloadTemplate">下载Excel模板</a-button>
              </template>
            </a-alert>

            <a-space>
              <a-input-number v-model:value="excelYear" :min="2020" :max="2099" style="width:100px;" addon-before="年度" />
              <a-upload
                :before-upload="handleFileSelect"
                :file-list="fileList"
                :max-count="1"
                accept=".xlsx,.xls"
              >
                <a-button><upload-outlined />选择Excel文件</a-button>
              </a-upload>
              <a-button type="primary" @click="parseExcel" :loading="parsing" :disabled="!file">
                解析预览
              </a-button>
              <a-button type="primary" danger @click="importExcel" :loading="importing" :disabled="parsedData.length === 0">
                确认导入 ({{ parsedData.length }}条)
              </a-button>
            </a-space>

            <!-- 错误提示 -->
            <a-alert v-if="parseErrors.length > 0" type="error" show-icon message="解析错误">
              <template #description>
                <ul>
                  <li v-for="(err, idx) in parseErrors" :key="idx">{{ err }}</li>
                </ul>
              </template>
            </a-alert>

            <!-- 预览表格 -->
            <div v-if="parsedData.length > 0">
              <a-tag color="green">成功解析 {{ parsedData.length }} 条记录</a-tag>
              <a-table
                :columns="previewColumns"
                :data-source="parsedData"
                row-key="day"
                :pagination="{ pageSize: 10 }"
                size="small"
                style="margin-top:8px;"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'effective'">
                    <span :style="{ color: record.effective < 8 ? '#cf1322' : '#52c41a' }">
                      {{ record.effective }}h
                      <span v-if="record.effective < 8">⚠</span>
                    </span>
                  </template>
                </template>
              </a-table>
            </div>
          </a-space>
        </a-card>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { UploadOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { userApi, attendanceApi, excelApi } from '../../api'

const activeTab = ref('manual')
const yearMonth = ref(dayjs())
const excelYearMonth = ref(dayjs())
const selectedUser = ref(null)
const employees = ref([])
const rows = ref([])
const file = ref(null)
const fileList = ref([])
const parsedData = ref([])
const parseErrors = ref([])
const parsing = ref(false)
const importing = ref(false)

// 手动录入列
const columns = [
  { title: '日期', dataIndex: 'day', key: 'day', width: 100 },
  { title: '上班打卡', key: 'check_in', width: 160 },
  { title: '下班打卡', key: 'check_out', width: 160 },
  { title: '有效工时', dataIndex: 'effective', key: 'effective', width: 100 },
  { title: '备注', dataIndex: 'remark', key: 'remark' },
  { title: '操作', key: 'action', width: 60 }
]

// Excel 预览列
const previewColumns = [
  { title: '姓名', dataIndex: 'user_name', key: 'user_name', width: 80 },
  { title: '日期', dataIndex: 'date', key: 'date', width: 100 },
  { title: '上班', dataIndex: 'check_in', key: 'check_in', width: 80 },
  { title: '下班', dataIndex: 'check_out', key: 'check_out', width: 80 },
  { title: '有效工时', key: 'effective', width: 100 }
]

onMounted(async () => {
  const res = await userApi.list({ status: 'active' })
  employees.value = res.list
})

// 手动录入功能
function generateDays() {
  if (!yearMonth.value || !selectedUser.value) {
    message.warning('请先选择月份和员工')
    return
  }
  const daysInMonth = yearMonth.value.daysInMonth()
  rows.value = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `2026-10-${String(d).padStart(2, '0')}`
    const dayOfWeek = new Date(yearMonth.value.toDate()).getDay()
    rows.value.push({
      _id: Date.now() + d, // 唯一标识
      day: d,
      check_in_picker: dayjs('08:20', 'HH:mm'),
      check_out_picker: dayjs('17:00', 'HH:mm'),
      check_in: '08:20',
      check_out: '17:00',
      effective: 8,
      remark: ''
    })
  }
}

function recalc(row) {
  if (row.check_in_picker && row.check_out_picker) {
    const inMin = row.check_in_picker.hour() * 60 + row.check_in_picker.minute()
    const outMin = row.check_out_picker.hour() * 60 + row.check_out_picker.minute()
    const standardStart = 8 * 60 + 20
    const effectiveIn = Math.max(inMin, standardStart)
    const diff = outMin - effectiveIn
    row.effective = diff > 0 ? Math.round((diff / 60) * 100) / 100 : 0
    row.check_in = row.check_in_picker.format('HH:mm')
    row.check_out = row.check_out_picker.format('HH:mm')
  }
}

// 增加一行
function addRow() {
  // 找到最大日期
  const maxDay = rows.value.length > 0 ? Math.max(...rows.value.map(r => r.day)) : 0
  const newDay = maxDay + 1
  if (newDay > 31) {
    message.warning('日期不能超过31')
    return
  }
  // 检查日期是否已存在
  if (rows.value.find(r => r.day === newDay)) {
    message.warning(`日期 ${newDay} 已存在，请直接修改该行`)
    return
  }
  const newRow = {
    _id: Date.now(), // 唯一标识
    day: newDay,
    check_in_picker: dayjs('08:20', 'HH:mm'),
    check_out_picker: dayjs('17:00', 'HH:mm'),
    check_in: '08:20',
    check_out: '17:00',
    effective: 8,
    remark: ''
  }
  rows.value.push(newRow)
  // 按日期排序
  rows.value.sort((a, b) => a.day - b.day)
}

// 删除一行
function deleteRow(row) {
  rows.value = rows.value.filter(r => r._id !== row._id)
}

async function onSubmit() {
  if (!yearMonth.value || !selectedUser.value || rows.value.length === 0) {
    message.warning('请先生成工作日数据')
    return
  }
  // 检查日期重复
  const daySet = new Set()
  for (const r of rows.value) {
    if (daySet.has(r.day)) {
      message.warning(`日期 ${r.day} 重复，请检查`)
      return
    }
    daySet.add(r.day)
  }
  const ym = yearMonth.value.format('YYYY-MM')
  const records = rows.value.map(r => ({
    user_id: selectedUser.value,
    day: r.day,
    check_in: r.check_in,
    check_out: r.check_out,
    remark: r.remark
  }))
  await attendanceApi.batchCreate({ yearMonth: ym, records })
  message.success(`成功录入 ${records.length} 条考勤`)
}

// Excel 导入功能
const excelYear = ref(new Date().getFullYear())

function handleFileSelect(fileObj) {
  file.value = fileObj
  fileList.value = [fileObj]
  parseErrors.value = []
  parsedData.value = []
  return false // 阻止自动上传
}

async function parseExcel() {
  if (!file.value) {
    message.warning('请选择Excel文件')
    return
  }
  parsing.value = true
  try {
    const base64 = await fileToBase64(file.value)
    const res = await excelApi.parseExcel({
      fileBase64: base64,
      year: excelYear.value
    })
    parsedData.value = res.parsed.map(r => {
      // 计算有效工时
      const inMin = r.check_in ? parseInt(r.check_in.split(':')[0]) * 60 + parseInt(r.check_in.split(':')[1]) : 0
      const outMin = r.check_out ? parseInt(r.check_out.split(':')[0]) * 60 + parseInt(r.check_out.split(':')[1]) : 0
      const standardStart = 8 * 60 + 20
      const effectiveIn = Math.max(inMin, standardStart)
      const diff = outMin - effectiveIn
      r.effective = diff > 0 ? Math.round((diff / 60) * 100) / 100 : 0
      return r
    })
    parseErrors.value = res.errors
    if (res.errors.length > 0) {
      message.warning(`${res.errors.length} 条数据有误`)
    } else {
      message.success(`解析成功，共 ${res.parsed.length} 条`)
    }
  } catch (e) {
    message.error('解析失败: ' + (e.response?.data?.message || e.message))
  } finally {
    parsing.value = false
  }
}

async function importExcel() {
  if (parsedData.value.length === 0) return
  importing.value = true
  try {
    await excelApi.importExcel({
      data: parsedData.value
    })
    message.success(`成功导入 ${parsedData.value.length} 条考勤`)
    parsedData.value = []
    parseErrors.value = []
    file.value = null
    fileList.value = []
  } catch (e) {
    message.error('导入失败: ' + (e.response?.data?.message || e.message))
  } finally {
    importing.value = false
  }
}

async function downloadTemplate() {
  const res = await excelApi.downloadTemplate()
  const url = URL.createObjectURL(res)
  const a = document.createElement('a')
  a.href = url
  a.download = 'attendance_template.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
</script>
