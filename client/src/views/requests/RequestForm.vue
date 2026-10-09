<template>
  <div>
    <a-card title="发起申请">
      <a-form :model="form" layout="vertical" @finish="onSubmit">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="申请类型" name="type" :rules="[{required:true}]">
              <a-select v-model:value="form.type" placeholder="请选择" @change="onTypeChange">
                <a-select-option value="overtime">加班申请</a-select-option>
                <a-select-option value="leave">休假申请</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8" v-if="form.type === 'leave'">
            <a-form-item label="假期类型" name="leave_type_used" :rules="[{required:true,message:'请选择假期类型'}]">
              <a-select v-model:value="form.leave_type_used" placeholder="请选择" @change="onLeaveTypeChange">
                <a-select-option value="annual">年假</a-select-option>
                <a-select-option value="compensatory">调休</a-select-option>
                <a-select-option value="mixed">混合抵扣（年假+调休）</a-select-option>
                <a-select-option value="business_trip">公差（无余额限制）</a-select-option>
                <a-select-option value="other">其他（无余额限制）</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 加班申请必须选择项目 -->
        <a-row :gutter="16" v-if="form.type === 'overtime'">
          <a-col :span="12">
            <a-form-item label="关联项目/系统" name="project_id" :rules="[{required:true,message:'请选择项目或系统'}]">
              <a-select v-model:value="form.project_id" placeholder="请选择加班关联的项目或系统" show-search :filter-option="filterOption">
                <a-select-opt-group label="项目">
                  <a-select-option v-for="p in projects.filter(p => p.type === 'project')" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </a-select-option>
                </a-select-opt-group>
                <a-select-opt-group label="系统维护">
                  <a-select-option v-for="p in projects.filter(p => p.type === 'system_maintenance')" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </a-select-option>
                </a-select-opt-group>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 日期选择（带上午/下午） -->
        <a-row :gutter="16" v-if="form.type === 'leave'">
          <a-col :span="6">
            <a-form-item label="开始日期" name="start_date" :rules="[{required:true,message:'请选择开始日期'}]">
              <a-date-picker v-model:value="form.start_date" style="width:100%;" @change="calcDays" />
            </a-form-item>
          </a-col>
          <a-col :span="4">
            <a-form-item label="开始时段" name="start_half">
              <a-select v-model:value="form.start_half" @change="calcDays">
                <a-select-option value="am">上午</a-select-option>
                <a-select-option value="pm">下午</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="结束日期" name="end_date" :rules="[{required:true,message:'请选择结束日期'}]">
              <a-date-picker v-model:value="form.end_date" style="width:100%;" @change="calcDays" />
            </a-form-item>
          </a-col>
          <a-col :span="4">
            <a-form-item label="结束时段" name="end_half">
              <a-select v-model:value="form.end_half" @change="calcDays">
                <a-select-option value="am">上午</a-select-option>
                <a-select-option value="pm">下午</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="4">
            <a-form-item label="请假天数">
              <a-input-number v-model:value="form.days" :min="0.5" :step="0.5" style="width:100%;" />
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 调休/混合：选择加班条目 -->
        <a-row :gutter="16" v-if="form.type === 'leave' && (form.leave_type_used === 'compensatory' || form.leave_type_used === 'mixed')">
          <a-col :span="24">
            <a-form-item :label="form.leave_type_used === 'mixed' ? '调休部分 - 选择加班条目' : '选择加班条目'">
              <a-alert type="info" show-icon :message="compensatoryInfo" />
              <a-table
                :columns="unitColumns"
                :data-source="availableUnits"
                row-key="id"
                :pagination="{ pageSize: 10 }"
                size="small"
                :row-selection="{ selectedRowKeys: form.overtime_unit_ids, onChange: onUnitSelect }"
                style="margin-top:8px;"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'convert'">
                    <span style="color:#52c41a;">0.5天</span>
                  </template>
                </template>
              </a-table>
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 混合抵扣：年假天数 -->
        <a-row :gutter="16" v-if="form.type === 'leave' && form.leave_type_used === 'mixed'">
          <a-col :span="8">
            <a-form-item label="年假抵扣天数">
              <a-input-number v-model:value="form.annual_days" :min="0" :step="0.5" style="width:100%;" @change="onAnnualDaysChange" />
              <div style="font-size:12px;color:#999;">年假余额: {{ annualBalance }}天</div>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="调休抵扣天数">
              <a-input-number v-model:value="form.comp_days" :min="0" :step="0.5" style="width:100%;" :value="compDaysFromUnits" disabled />
              <div style="font-size:12px;color:#999;">根据所选加班条目自动计算</div>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="合计">
              <div style="padding:8px;background:#f0f0f0;border-radius:4px;">
                {{ (form.annual_days || 0) + compDaysFromUnits }} 天
                <span v-if="Math.abs((form.annual_days || 0) + compDaysFromUnits - form.days) > 0.01" style="color:#cf1322;">
                  （与请假天数 {{ form.days }} 不匹配）
                </span>
                <span v-else style="color:#52c41a;">✓</span>
              </div>
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 调休余额提示 -->
        <a-row :gutter="16" v-if="form.type === 'leave' && form.leave_type_used === 'compensatory'">
          <a-col :span="24">
            <a-alert type="info" show-icon :message="`调休余额: ${currentBalance} 天 (1单位=0.5天, 1天需3单位)`" />
          </a-col>
        </a-row>

        <!-- 加班申请：小时数 -->
        <a-row :gutter="16" v-if="form.type === 'overtime'">
          <a-col :span="8">
            <a-form-item label="开始日期" name="start_date" :rules="[{required:true}]">
              <a-date-picker v-model:value="form.start_date" style="width:100%;" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="结束日期" name="end_date" :rules="[{required:true}]">
              <a-date-picker v-model:value="form.end_date" style="width:100%;" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="加班小时数" name="days" :rules="[{required:true}]">
              <a-input-number v-model:value="form.days" :min="3" :step="3" style="width:100%;" />
              <div style="font-size:12px;color:#999;margin-top:4px;">
                将生成 {{ Math.floor(form.days / 3) }} 个加班单位（每3小时=1单位）
              </div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="申请事由" name="reason">
          <a-textarea v-model:value="form.reason" :rows="3" placeholder="请输入事由" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit">提交申请</a-button>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { useAuthStore } from '../../stores/auth'
import { requestApi, projectApi, leaveApi, overtimeApi } from '../../api'

const authStore = useAuthStore()

const form = reactive({
  type: 'overtime',
  leave_type_used: 'annual',
  start_date: null,
  end_date: null,
  start_half: 'am',
  end_half: 'pm',
  days: 0,
  annual_days: 0,
  reason: '',
  project_id: null,
  overtime_unit_ids: []
})

const projects = ref([])
const availableUnits = ref([])
const currentBalance = ref(0)
const annualBalance = ref(0)

const unitColumns = [
  { title: '日期', dataIndex: 'work_date', key: 'work_date', width: 100 },
  { title: '时长', dataIndex: 'hours', key: 'hours', width: 60 },
  { title: '单位数', dataIndex: 'units_count', key: 'units_count', width: 60 },
  { title: '可抵扣', key: 'convert', width: 70 }
]

const selectedUnits = computed(() => {
  return availableUnits.value.filter(u => form.overtime_unit_ids.includes(u.id))
})

// 计算加班单位对应的天数：3单位=1天，余1或2单位=0.5天
const compDaysFromUnits = computed(() => {
  const totalUnits = selectedUnits.value.reduce((sum, u) => sum + u.units_count, 0)
  return Math.floor(totalUnits / 3) + (totalUnits % 3 > 0 ? 0.5 : 0)
})

const compensatoryInfo = computed(() => {
  const totalUnits = selectedUnits.value.reduce((sum, u) => sum + u.units_count, 0)
  const days = Math.floor(totalUnits / 3) + (totalUnits % 3) * 0.5
  return `已选 ${selectedUnits.value.length} 条加班单位，累计可抵扣 ${days} 天（3单位=1天，1单位=0.5天）`
})

function filterOption(input, option) {
  return option.label.toLowerCase().includes(input.toLowerCase())
}

function onTypeChange() {
  form.overtime_unit_ids = []
  form.project_id = null
}

function onLeaveTypeChange() {
  form.overtime_unit_ids = []
  if (form.leave_type_used === 'compensatory' || form.leave_type_used === 'mixed') {
    fetchAvailableUnits()
  }
  if (form.leave_type_used !== 'business_trip' && form.leave_type_used !== 'other') {
    fetchBalance()
  }
}

function onAnnualDaysChange() {
  // 年假天数变化
}

function onUnitSelect(selectedKeys) {
  form.overtime_unit_ids = selectedKeys
  if (form.leave_type_used === 'mixed') {
    form.comp_days = compDaysFromUnits.value
  }
}

// 根据日期和上午/下午自动计算天数
// 规则：开始日上午=1天，下午=0.5天；结束日上午=0天，下午=1天
function calcDays() {
  if (!form.start_date || !form.end_date) return

  const start = dayjs(form.start_date)
  const end = dayjs(form.end_date)

  if (end.isBefore(start)) return

  const diffDays = end.diff(start, 'day')
  let days = 0

  if (diffDays === 0) {
    // 同一天
    if (form.start_half === 'am' && form.end_half === 'pm') {
      days = 1
    } else {
      days = 0.5
    }
  } else {
    // 跨天
    days += form.start_half === 'am' ? 1 : 0.5  // 开始天：AM=全天，PM=半天
    days += form.end_half === 'pm' ? 1 : 0.5    // 结束天：PM=全天，AM=半天
    days += (diffDays - 1) * 1                   // 中间天
  }

  form.days = days
}

async function fetchProjects() {
  const res = await projectApi.list({ status: 'active' })
  projects.value = res.list
}

async function fetchAvailableUnits() {
  const res = await overtimeApi.available(authStore.user.id)
  availableUnits.value = res.list
}

async function fetchBalance() {
  const res = await leaveApi.balance(authStore.user.id)
  const comp = res.list.find(b => b.leave_type === 'compensatory')
  currentBalance.value = comp ? (comp.entitled_days - comp.used_days).toFixed(1) : 0
  const annual = res.list.find(b => b.leave_type === 'annual')
  annualBalance.value = annual ? (annual.entitled_days - annual.used_days).toFixed(1) : 0
}

async function onSubmit() {
  // 验证
  if (form.type === 'leave' && form.leave_type_used === 'compensatory') {
    if (form.overtime_unit_ids.length === 0) {
      message.error('调休申请必须选择加班条目')
      return
    }
    if (Math.abs(compDaysFromUnits.value - form.days) > 0.01) {
      message.error(`选择的加班条目累计可抵扣 ${compDaysFromUnits.value} 天，与申请天数 ${form.days} 天不匹配`)
      return
    }
  }

  if (form.type === 'leave' && form.leave_type_used === 'mixed') {
    const totalDeduction = (form.annual_days || 0) + compDaysFromUnits.value
    if (Math.abs(totalDeduction - form.days) > 0.01) {
      message.error(`年假${form.annual_days || 0}天 + 调休${compDaysFromUnits.value}天 = ${totalDeduction}天，与请假天数${form.days}天不匹配`)
      return
    }
  }

  const payload = {
    type: form.type,
    start_date: form.start_date ? dayjs(form.start_date).format('YYYY-MM-DD') : null,
    end_date: form.end_date ? dayjs(form.end_date).format('YYYY-MM-DD') : null,
    days: form.days,
    leave_type_used: form.type === 'leave' ? form.leave_type_used : null,
    annual_days: form.leave_type_used === 'mixed' ? form.annual_days : null,
    reason: form.reason,
    project_id: form.project_id,
    overtime_unit_ids: form.overtime_unit_ids
  }
  await requestApi.create(payload)
  message.success('申请已提交，等待审核')
  Object.assign(form, {
    type: 'overtime',
    leave_type_used: 'annual',
    start_date: null,
    end_date: null,
    start_half: 'am',
    end_half: 'pm',
    days: 0,
    annual_days: 0,
    reason: '',
    project_id: null,
    overtime_unit_ids: []
  })
}

onMounted(() => {
  fetchProjects()
})
</script>
