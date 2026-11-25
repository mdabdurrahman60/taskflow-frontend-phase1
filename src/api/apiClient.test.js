import test from 'node:test'
import assert from 'node:assert/strict'

const originalFetch = globalThis.fetch

test.afterEach(() => {
  globalThis.fetch = originalFetch
})

test('API requests include credentials and get a CSRF token before mutations', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/api/auth/csrf')) {
      return Response.json({ data: { csrfToken: 'csrf-test-token' } })
    }
    return Response.json({ data: [] })
  }

  const { apiClient } = await import('./apiClient.js')
  await apiClient.employees.create({ name: 'Test' })

  assert.equal(calls.length, 2)
  assert.equal(calls[0].options.credentials, 'include')
  assert.equal(calls[1].options.credentials, 'include')
  assert.equal(calls[1].options.headers['X-CSRF-Token'], 'csrf-test-token')
  assert.equal(calls[1].options.body, JSON.stringify({ name: 'Test' }))
})

test('API errors preserve backend status, code, and safe message', async () => {
  globalThis.fetch = async () => Response.json({
    error: { code: 'FORBIDDEN', message: 'Not permitted.', requestId: 'request-1' },
  }, { status: 403 })

  const { apiClient, ApiError } = await import('./apiClient.js')
  await assert.rejects(apiClient.employees.list(), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 403)
    assert.equal(error.code, 'FORBIDDEN')
    assert.equal(error.message, 'Not permitted.')
    assert.equal(error.requestId, 'request-1')
    return true
  })
})

test('department requests use scoped endpoints, query encoding, credentials, and CSRF on mutations', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/api/auth/csrf')) {
      return Response.json({ data: { csrfToken: 'department-csrf-token' } })
    }
    return Response.json({ data: [] })
  }

  const { apiClient } = await import('./apiClient.js')
  await apiClient.departments.list({ search: 'people ops', status: 'ACTIVE' })
  await apiClient.departments.setStatus('department-id', false)

  const listCall = calls.find(({ url }) => url.includes('/api/departments?'))
  const mutationCall = calls.find(({ url }) => url.endsWith('/api/departments/department-id/status'))
  assert.ok(listCall.url.includes('search=people+ops'))
  assert.ok(listCall.url.includes('status=ACTIVE'))
  assert.equal(listCall.options.credentials, 'include')
  assert.equal(mutationCall.options.credentials, 'include')
  assert.ok(mutationCall.options.headers['X-CSRF-Token'])
  assert.equal(mutationCall.options.body, JSON.stringify({ isActive: false }))
})

test('Employee ID changes use the scoped employee endpoint and CSRF-protected PATCH', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/api/auth/csrf')) {
      return Response.json({ data: { csrfToken: 'employee-id-csrf-token' } })
    }
    return Response.json({ data: { employeeId: 'MIT045' } })
  }

  const { apiClient } = await import('./apiClient.js')
  await apiClient.employees.changeId('employee-id', {
    employeeId: 'MIT045',
    reason: 'Correcting a personnel record',
  })

  const mutation = calls.find(({ url }) => url.endsWith('/api/employees/employee-id/employee-id'))
  assert.ok(mutation)
  assert.equal(mutation.options.method, 'PATCH')
  assert.equal(mutation.options.credentials, 'include')
  assert.ok(mutation.options.headers['X-CSRF-Token'])
  assert.equal(mutation.options.body, JSON.stringify({
    employeeId: 'MIT045',
    reason: 'Correcting a personnel record',
  }))
})

test('pasted PO extraction uses the authenticated, CSRF-protected extraction endpoint', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/api/auth/csrf')) {
      return Response.json({ data: { csrfToken: 'po-import-csrf-token' } })
    }
    return Response.json({ data: { items: [], warnings: [] } })
  }

  const { apiClient } = await import('./apiClient.js')
  const text = 'PO Number: C-100\nDescription | Qty\nWidget | 2'
  await apiClient.warehouse.extractPurchaseOrderText(text)

  const request = calls.find(({ url }) => url.endsWith('/api/pos/import/extract'))
  assert.ok(request)
  assert.equal(request.options.method, 'POST')
  assert.equal(request.options.credentials, 'include')
  assert.ok(request.options.headers['X-CSRF-Token'])
  assert.equal(request.options.body, JSON.stringify({ text }))
})
