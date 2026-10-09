import axios from 'axios'
import { message } from 'ant-design-vue'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
})

request.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    if (error.response) {
      const { status, data } = error.response
      if (status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        message.error('登录已过期，请重新登录')
        window.location.href = '/login'
      } else {
        message.error(data?.message || '请求失败')
      }
    } else {
      message.error('网络错误，请检查服务器是否启动')
    }
    return Promise.reject(error)
  }
)

export default request
