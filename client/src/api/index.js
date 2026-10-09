import request from './request'

export const authApi = {
  login: (data) => request.post('/auth/login', data),
  me: () => request.get('/auth/me')
}

export const userApi = {
  list: (params) => request.get('/users', { params }),
  create: (data) => request.post('/users', data),
  update: (id, data) => request.put(`/users/${id}`, data),
  updateStatus: (id, status) => request.put(`/users/${id}/status`, { status })
}

export const teamApi = {
  list: () => request.get('/teams'),
  create: (data) => request.post('/teams', data),
  update: (id, data) => request.put(`/teams/${id}`, data),
  members: (id) => request.get(`/teams/${id}/members`)
}

export const attendanceApi = {
  list: (params) => request.get('/attendance', { params }),
  batchCreate: (data) => request.post('/attendance/batch', data),
  offset: (data) => request.put('/attendance/offset', data)
}

export const overtimeApi = {
  list: (params) => request.get('/overtime', { params }),
  available: (userId) => request.get(`/overtime/available/${userId}`)
}

export const leaveApi = {
  balance: (userId) => request.get(`/leave/${userId}`),
  initAnnual: (data) => request.post('/leave/annual/init', data),
  clearAnnual: (data) => request.post('/leave/annual/clear', data)
}

export const requestApi = {
  create: (data) => request.post('/requests', data),
  mine: () => request.get('/requests/mine'),
  review: () => request.get('/requests/review'),
  deptReview: () => request.get('/requests/dept-review'),
  confirm: () => request.get('/requests/confirm'),
  reviewAction: (id, data) => request.put(`/requests/${id}/review`, data),
  deptReviewAction: (id, data) => request.put(`/requests/${id}/dept-review`, data),
  confirmAction: (id, data) => request.put(`/requests/${id}/confirm`, data)
}

export const projectApi = {
  list: (params) => request.get('/projects', { params }),
  create: (data) => request.post('/projects', data),
  update: (id, data) => request.put(`/projects/${id}`, data)
}

export const excelApi = {
  parseExcel: (data) => request.post('/excel/parse-excel', data),
  importExcel: (data) => request.post('/excel/import', data),
  downloadTemplate: () => request.get('/excel/template', { responseType: 'blob' })
}

export const leaveDetailApi = {
  leaveDetail: (userId, params) => request.get(`/leave-detail/detail/${userId}`, { params }),
  overtimeDetail: (userId, params) => request.get(`/leave-detail/overtime-detail/${userId}`, { params })
}

export const dashboardApi = {
  summary: (params) => request.get('/dashboard/summary', { params })
}

export const holidayApi = {
  list: (params) => request.get('/holidays', { params }),
  create: (data) => request.post('/holidays', data),
  delete: (id) => request.delete(`/holidays/${id}`)
}
