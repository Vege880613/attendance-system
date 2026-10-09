<template>
  <div class="login-container">
    <a-card title="人员考勤管理系统" class="login-card">
      <h2 style="text-align:center;margin-bottom:24px;">登 录</h2>
      <a-form :model="form" @finish="onSubmit">
        <a-form-item name="username" :rules="[{required:true,message:'请输入用户名'}]">
          <a-input v-model:value="form.username" placeholder="用户名" size="large">
            <template #prefix><user-outlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item name="password" :rules="[{required:true,message:'请输入密码'}]">
          <a-input-password v-model:value="form.password" placeholder="密码" size="large">
            <template #prefix><lock-outlined /></template>
          </a-input-password>
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" block size="large" :loading="loading">登录</a-button>
        </a-form-item>
      </a-form>
      <div class="login-tip">
        <p>默认管理员: admin / admin123</p>
      </div>
    </a-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const form = reactive({ username: '', password: '' })

async function onSubmit() {
  loading.value = true
  try {
    await authStore.login(form.username, form.password)
    message.success('登录成功')
    router.push('/dashboard')
  } catch (err) {
    // 错误已由拦截器处理
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.login-card {
  width: 400px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}
.login-tip {
  text-align: center;
  color: #999;
  font-size: 12px;
  margin-top: 12px;
}
</style>
