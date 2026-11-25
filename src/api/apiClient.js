const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '')
const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const noRefreshPaths = new Set(['/api/auth/csrf', '/api/auth/login', '/api/auth/refresh', '/api/auth/logout'])

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', requestId = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

let csrfToken = null
let refreshPromise = null

async function decodeResponse(response) {
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new ApiError('The server returned an invalid response.', {
      status: response.status,
      code: 'INVALID_RESPONSE',
    })
  }

  if (!response.ok) {
    const error = payload?.error
    throw new ApiError(error?.message || `Request failed (${response.status}).`, {
      status: response.status,
      code: error?.code || 'REQUEST_ERROR',
      requestId: error?.requestId || null,
    })
  }
  return payload
}

async function fetchJson(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError(`Unable to connect to TaskFlow API at ${API_BASE_URL}. Check that the backend is running.`)
  }
  return decodeResponse(response)
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  const response = await fetchJson('/api/auth/csrf')
  if (typeof response?.data?.csrfToken !== 'string' || !response.data.csrfToken) {
    throw new ApiError('The server did not provide a CSRF token.', { code: 'CSRF_TOKEN_MISSING' })
  }
  csrfToken = response.data.csrfToken
  return csrfToken
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      let csrfRetried = false
      while (true) {
        const token = await getCsrfToken()
        try {
          await fetchJson('/api/auth/refresh', {
            method: 'POST',
            headers: { 'X-CSRF-Token': token },
          })
          return
        } catch (error) {
          if (error instanceof ApiError && error.code === 'CSRF_VALIDATION_FAILED' && !csrfRetried) {
            csrfToken = null
            csrfRetried = true
            continue
          }
          if (error instanceof ApiError && error.status === 401 && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('taskflow:auth-expired'))
          }
          throw error
        }
      }
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function request(path, { method = 'GET', body, headers = {}, retryAuth = true, csrfRetried = false } = {}) {
  const upperMethod = method.toUpperCase()
  const requestHeaders = { ...headers }
  if (unsafeMethods.has(upperMethod)) {
    requestHeaders['X-CSRF-Token'] = await getCsrfToken()
  }
  const options = {
    method: upperMethod,
    headers: requestHeaders,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }

  try {
    return await fetchJson(path, options)
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.code === 'CSRF_VALIDATION_FAILED' && unsafeMethods.has(upperMethod) && !csrfRetried) {
      csrfToken = null
      return request(path, { method: upperMethod, body, headers, retryAuth: false, csrfRetried: true })
    }
    if (error.status === 401 && retryAuth && !noRefreshPaths.has(path)) {
      await refreshSession()
      return request(path, { method: upperMethod, body, headers, retryAuth: false })
    }
    throw error
  }
}

async function uploadFile(path, file, onProgress, { retryAuth = true, csrfRetried = false } = {}) {
  const token = await getCsrfToken()
  const formData = new FormData()
  formData.append('profilePicture', file)

  const payload = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}${path}`)
    xhr.withCredentials = true
    xhr.setRequestHeader('X-CSRF-Token', token)
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    })
    xhr.addEventListener('error', () => reject(new ApiError(`Unable to connect to TaskFlow API at ${API_BASE_URL}. Check that the backend is running.`)))
    xhr.addEventListener('load', () => {
      let response
      try {
        response = JSON.parse(xhr.responseText)
      } catch {
        reject(new ApiError('The server returned an invalid response.', { status: xhr.status, code: 'INVALID_RESPONSE' }))
        return
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const error = response?.error
        reject(new ApiError(error?.message || `Request failed (${xhr.status}).`, {
          status: xhr.status,
          code: error?.code || 'REQUEST_ERROR',
          requestId: error?.requestId || null,
        }))
        return
      }
      resolve(response)
    })
    xhr.send(formData)
  }).catch(async (error) => {
    if (!(error instanceof ApiError)) throw error
    if (error.code === 'CSRF_VALIDATION_FAILED' && !csrfRetried) {
      csrfToken = null
      return uploadFile(path, file, onProgress, { retryAuth: false, csrfRetried: true })
    }
    if (error.status === 401 && retryAuth) {
      await refreshSession()
      return uploadFile(path, file, onProgress, { retryAuth: false })
    }
    throw error
  })

  onProgress?.(100)
  return payload
}

export const apiClient = {
  get baseUrl() {
    return API_BASE_URL
  },

  auth: {
    csrf: getCsrfToken,
    login: async (credentials) => request('/api/auth/login', { method: 'POST', body: credentials, retryAuth: false }),
    me: () => request('/api/auth/me'),
    changePassword: (passwords) => request('/api/auth/change-password', { method: 'POST', body: passwords }),
    refresh: refreshSession,
    logout: async () => {
      try {
        return await request('/api/auth/logout', { method: 'POST', retryAuth: false })
      } finally {
        csrfToken = null
      }
    },
  },

  profile: {
    get: () => request('/api/users/me/profile'),
    update: (changes) => request('/api/users/me/profile', { method: 'PATCH', body: changes }),
    uploadPicture: (file, onProgress) => uploadFile('/api/users/me/profile-picture', file, onProgress),
    removePicture: () => request('/api/users/me/profile-picture', { method: 'DELETE' }),
  },

  employees: {
    list: () => request('/api/employees'),
    reserveId: () => request('/api/employees/next-id', { method: 'POST', body: {} }),
    get: (id) => request(`/api/employees/${encodeURIComponent(id)}`),
    create: (employee) => request('/api/employees', { method: 'POST', body: employee }),
    update: (id, changes) => request(`/api/employees/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes }),
    changeId: (id, changes) => request(`/api/employees/${encodeURIComponent(id)}/employee-id`, { method: 'PATCH', body: changes }),
    setStatus: (id, status) => request(`/api/employees/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } }),
    passwordResetStatus: (id) => request(`/api/employees/${encodeURIComponent(id)}/password-reset-status`),
    resetPassword: (id, newPassword) => request(`/api/employees/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      body: { newPassword },
    }),
  },

  departments: {
    list: ({ search = '', status = 'ALL' } = {}) => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const query = params.toString()
      return request(`/api/departments${query ? `?${query}` : ''}`)
    },
    get: (id) => request(`/api/departments/${encodeURIComponent(id)}`),
    employees: (id) => request(`/api/departments/${encodeURIComponent(id)}/employees`),
    create: (department) => request('/api/departments', { method: 'POST', body: department }),
    update: (id, changes) => request(`/api/departments/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes }),
    setStatus: (id, isActive) => request(`/api/departments/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { isActive } }),
  },

  performance: {
    summary: async ({ employeeId = null, departmentId = null, range = '90d' } = {}) => {
      try {
        const params = new URLSearchParams()
        if (employeeId) params.set('employeeId', employeeId)
        if (departmentId) params.set('departmentId', departmentId)
        if (range) params.set('range', range)
        const query = params.toString()
        return await request(`/api/performance/summary${query ? `?${query}` : ''}`)
      } catch {
        return { data: { employeeId, departmentId, range, metrics: null } }
      }
    },
    team: async ({ departmentId = null, range = '90d' } = {}) => {
      try {
        const params = new URLSearchParams()
        if (departmentId) params.set('departmentId', departmentId)
        if (range) params.set('range', range)
        const query = params.toString()
        return await request(`/api/performance/team${query ? `?${query}` : ''}`)
      } catch {
        return { data: { departmentId, range, rows: [] } }
      }
    },
    export: async ({ employeeId = null, departmentId = null, range = '90d' } = {}) => {
      try {
        const params = new URLSearchParams()
        if (employeeId) params.set('employeeId', employeeId)
        if (departmentId) params.set('departmentId', departmentId)
        if (range) params.set('range', range)
        const query = params.toString()
        return await request(`/api/performance/export${query ? `?${query}` : ''}`)
      } catch {
        return { data: { exportUrl: null, employeeId, departmentId, range } }
      }
    },
  },

  notifications: {
    list: () => request('/api/notifications'),
    markRead: (id) => request(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
    markAllRead: () => request('/api/notifications/read-all', { method: 'POST' }),
  },

  warehouse: {
    extractPurchaseOrderText: (text) => request('/api/pos/import/extract', {
      method: 'POST',
      body: { text },
    }),
    listPurchaseOrders: (filters = {}) => {
      const params = new URLSearchParams(filters)
      const query = params.toString()
      return request(`/api/pos${query ? `?${query}` : ''}`)
    },
    getPurchaseOrder: (id) => request(`/api/pos/${encodeURIComponent(id)}`),
    createPurchaseOrder: (purchaseOrder) => request('/api/pos', { method: 'POST', body: purchaseOrder }),
    updatePurchaseOrder: (id, changes) => request(`/api/pos/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes }),
    addItem: (id, item) => request(`/api/pos/${encodeURIComponent(id)}/items`, { method: 'POST', body: item }),
    updateItem: (id, changes) => request(`/api/po-items/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes }),
    removeItem: (id) => request(`/api/po-items/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    assignments: (id) => request(`/api/pos/${encodeURIComponent(id)}/assignments`),
    assign: (id, employeeIds) => request(`/api/pos/${encodeURIComponent(id)}/assignments`, {
      method: 'POST',
      body: { employeeIds },
    }),
    removeAssignment: (id, userId, reason) => request(
      `/api/pos/${encodeURIComponent(id)}/assignments/${encodeURIComponent(userId)}`,
      { method: 'DELETE', body: reason ? { reason } : undefined },
    ),
    progress: (id) => request(`/api/pos/${encodeURIComponent(id)}/progress`),
    picking: (id) => request(`/api/pos/${encodeURIComponent(id)}/picking`),
    activity: (id) => request(`/api/pos/${encodeURIComponent(id)}/activity`),
    setStatus: (id, status, reason) => request(`/api/pos/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: { status, reason },
    }),
    allocations: (itemId) => request(`/api/po-items/${encodeURIComponent(itemId)}/allocations`),
    claim: (itemId, input) => request(`/api/po-items/${encodeURIComponent(itemId)}/allocations`, {
      method: 'POST',
      body: input,
    }),
    updateAllocation: (id, changes) => request(`/api/allocations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: changes,
    }),
    release: (id, reason) => request(`/api/allocations/${encodeURIComponent(id)}/release`, {
      method: 'POST',
      body: { reason },
    }),
    submit: (id, input) => request(`/api/allocations/${encodeURIComponent(id)}/submit`, {
      method: 'POST',
      body: input,
    }),
    pendingVerifications: (id) => request(`/api/pos/${encodeURIComponent(id)}/verifications/pending`),
    verify: (id, input = {}) => request(`/api/submissions/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      body: input,
    }),
    reject: (id, reason) => request(`/api/submissions/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: { reason },
    }),
    requestCorrection: (id, reason) => request(`/api/submissions/${encodeURIComponent(id)}/request-correction`, {
      method: 'POST',
      body: { reason },
    }),
    submissionHistory: (id) => request(`/api/pos/${encodeURIComponent(id)}/submissions/history`),
    warehouses: () => request('/api/warehouse/warehouses'),
    products: (filters = {}) => {
      const params = new URLSearchParams(filters)
      const query = params.toString()
      return request(`/api/warehouse/products${query ? `?${query}` : ''}`)
    },
    createProduct: (product) => request('/api/warehouse/products', { method: 'POST', body: product }),
    createWarehouse: (warehouse) => request('/api/warehouse/warehouses', { method: 'POST', body: warehouse }),
    dashboard: () => request('/api/warehouse/dashboard'),
    myWork: (filters = {}) => {
      const params = new URLSearchParams(filters)
      const query = params.toString()
      return request(`/api/warehouse/my-work${query ? `?${query}` : ''}`)
    },
    performance: (filters = {}) => {
      const params = new URLSearchParams(filters)
      const query = params.toString()
      return request(`/api/warehouse/performance${query ? `?${query}` : ''}`)
    },
  },
}
