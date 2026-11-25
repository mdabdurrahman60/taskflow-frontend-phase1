import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { Plus, RefreshCw, Warehouse as WarehouseIcon } from 'lucide-react'
import { apiClient } from '../api/apiClient.js'
import { useAuth } from '../auth/AuthContext.jsx'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import RoleGuard from '../components/layout/RoleGuard'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import PurchaseOrderImport from './PurchaseOrderImport.jsx'

const inputClass = 'h-9 w-full rounded-md border border-line bg-white px-2.5 text-[13px] text-ink'
const labelClass = 'mb-1 block text-[12px] font-medium text-ink'

function dataOf(response) {
  return response?.data ?? {}
}

function isSalesDepartment(department) {
  return /sales/i.test(`${department?.code ?? ''} ${department?.name ?? ''}`)
}

function isWarehouseDepartment(department) {
  return /(warehouse|logistics|distribution)/i.test(`${department?.code ?? ''} ${department?.name ?? ''}`)
}

function statusTone(status) {
  if (['COMPLETED', 'DISPATCHED', 'READY_FOR_DISPATCH'].includes(status)) return 'green'
  if (['PENDING_VERIFICATION', 'PICKING_IN_PROGRESS', 'PARTIALLY_PICKED'].includes(status)) return 'amber'
  if (status === 'CANCELLED') return 'red'
  return 'blue'
}

function newLine() {
  return { productId: '', requiredQuantity: '1', notes: '' }
}

export default function WarehousePage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const requestedPoId = searchParams.get('po')
  const [orders, setOrders] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [products, setProducts] = useState([])
  const [departments, setDepartments] = useState([])
  const [employees, setEmployees] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [selected, setSelected] = useState(null)
  const [progress, setProgress] = useState(null)
  const [picking, setPicking] = useState(null)
  const [work, setWork] = useState([])
  const [pending, setPending] = useState([])
  const [activity, setActivity] = useState([])
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [form, setForm] = useState({ title: '', departmentId: '', warehouseId: '', items: [newLine()] })
  const [productForm, setProductForm] = useState({ sku: '', name: '', unit: 'pcs' })
  const [warehouseForm, setWarehouseForm] = useState({ code: '', name: '', departmentId: '' })
  const [poEdit, setPoEdit] = useState({ title: '', notes: '' })
  const [newItem, setNewItem] = useState(newLine())
  const [quantityEdits, setQuantityEdits] = useState({})
  const [claimValues, setClaimValues] = useState({})
  const [submitValues, setSubmitValues] = useState({})
  const [reviewReasons, setReviewReasons] = useState({})
  const [assignmentIds, setAssignmentIds] = useState([])

  const role = user?.role
  const canCreate = role === 'SUPERADMIN' || role === 'ADMIN' ||
    (['MANAGER', 'EXECUTIVE'].includes(role) && isSalesDepartment(user?.department)) ||
    (role === 'MANAGER' && isWarehouseDepartment(user?.department))
  const canImportDocument = role === 'SUPERADMIN' || role === 'ADMIN' ||
    (['MANAGER', 'EXECUTIVE'].includes(role) && isSalesDepartment(user?.department))
  const canSelectDepartment = role === 'SUPERADMIN' || role === 'ADMIN'
  const canManageCatalog = role === 'SUPERADMIN' || role === 'ADMIN'
  const selectedWarehouse = warehouses.find((entry) => entry.id === selected?.warehouse?.id)
  const canAssign = Boolean(selected && (
    role === 'SUPERADMIN' ||
    (role === 'ADMIN' && departments.some((department) => department.id === selected.warehouse?.departmentId)) ||
    (role === 'MANAGER' && isWarehouseDepartment(user?.department) &&
      user?.departmentId === selected.warehouse?.departmentId)
  ))
  const canVerify = Boolean(selected && (
    role === 'SUPERADMIN' ||
    (role === 'ADMIN' && departments.some((department) => department.id === selected.warehouse?.departmentId)) ||
    (role === 'MANAGER' && isWarehouseDepartment(user?.department) &&
      user?.departmentId === selected.warehouse?.departmentId)
  ))
  const canPick = Boolean(selected && ['SUPPORT', 'MANAGER'].includes(role) &&
    (role !== 'MANAGER' || (
      isWarehouseDepartment(user?.department) &&
      user?.departmentId === selected.warehouse?.departmentId
    )) &&
    selected.assignments?.some((assignment) => assignment.employee?.id === user?.id))
  const canManageDetails = Boolean(selected && (
    role === 'SUPERADMIN' ||
    (role === 'ADMIN' && (
      departments.some((department) => department.id === selected.department?.id) ||
      departments.some((department) => department.id === selected.warehouse?.departmentId)
    )) ||
    (role === 'MANAGER' && isSalesDepartment(user?.department) && user?.departmentId === selected.department?.id) ||
    (role === 'EXECUTIVE' && isSalesDepartment(user?.department) &&
      user?.departmentId === selected.department?.id && selected.createdBy?.id === user?.id)
  ) && ['DRAFT', 'OPEN', 'ASSIGNED'].includes(selected.status))

  const refreshOrders = useCallback(async (query = search) => {
    const response = await apiClient.warehouse.listPurchaseOrders({
      page: 1,
      pageSize: 50,
      ...(query.trim() ? { search: query.trim() } : {}),
    })
    const nextOrders = dataOf(response).items ?? []
    setOrders(nextOrders)
    setSelectedId((current) => current && nextOrders.some((order) => order.id === current)
      ? current
      : nextOrders[0]?.id ?? '')
  }, [search])

  const refreshDetail = useCallback(async () => {
    if (!selectedId) {
      setSelected(null)
      setProgress(null)
      setPicking(null)
      setWork([])
      setPending([])
      setActivity([])
      return
    }
    const [orderResponse, progressResponse, pickingResponse, workResponse, activityResponse] = await Promise.all([
      apiClient.warehouse.getPurchaseOrder(selectedId),
      apiClient.warehouse.progress(selectedId),
      apiClient.warehouse.picking(selectedId),
      apiClient.warehouse.myWork(),
      apiClient.warehouse.activity(selectedId),
    ])
    setSelected(dataOf(orderResponse))
    setProgress(dataOf(progressResponse))
    setPicking(dataOf(pickingResponse))
    setWork(dataOf(workResponse).filter((entry) => entry.purchaseOrder.id === selectedId))
    setActivity(dataOf(activityResponse).items ?? [])
    if (canVerify) {
      const response = await apiClient.warehouse.pendingVerifications(selectedId)
      setPending(dataOf(response).items ?? [])
    } else {
      setPending([])
    }
  }, [selectedId, canVerify])

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      apiClient.warehouse.listPurchaseOrders({ page: 1, pageSize: 50 }),
      apiClient.warehouse.warehouses(),
      apiClient.warehouse.products({ page: 1, pageSize: 100 }),
    ]).then(async ([ordersResponse, warehousesResponse, productsResponse]) => {
      if (!active) return
      const nextOrders = dataOf(ordersResponse).items ?? []
      setOrders(nextOrders)
      setSelectedId(nextOrders.find((order) => order.id === requestedPoId)?.id ?? nextOrders[0]?.id ?? '')
      setWarehouses(dataOf(warehousesResponse) ?? [])
      setProducts(dataOf(productsResponse).items ?? [])
      if (canSelectDepartment) {
        const response = await apiClient.departments.list()
        if (active) {
          const departmentData = dataOf(response)
          setDepartments(departmentData.items ?? departmentData)
        }
      }
      if (['SUPERADMIN', 'ADMIN', 'MANAGER'].includes(role)) {
        const response = await apiClient.employees.list()
        if (active) {
          const employeeData = dataOf(response)
          setEmployees(Array.isArray(employeeData) ? employeeData : employeeData.items ?? [])
        }
      }
    }).catch((requestError) => {
      if (active) setError(requestError.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [canSelectDepartment, requestedPoId, role])

  useEffect(() => {
    let active = true
    setError('')
    refreshDetail().catch((requestError) => {
      if (active) setError(requestError.message)
    })
    return () => { active = false }
  }, [refreshDetail])

  useEffect(() => {
    if (!selected) return
    setPoEdit({ title: selected.title ?? '', notes: selected.notes ?? '' })
    setQuantityEdits(Object.fromEntries((selected.items ?? []).map((item) => [item.id, item.requiredQuantity])))
  }, [selected])

  useEffect(() => {
    if (!selectedId) return undefined
    const socket = io(apiClient.baseUrl, { withCredentials: true })
    const joinRoom = () => {
      socket.emit('purchase-order:join', { purchaseOrderId: selectedId }, (result) => {
        if (result?.error) setError('Live updates are unavailable for this purchase order.')
      })
    }
    socket.on('connect', joinRoom)
    socket.on('warehouse:event', (event) => {
      if (event?.purchaseOrderId === selectedId) {
        refreshDetail().catch((requestError) => setError(requestError.message))
        refreshOrders().catch((requestError) => setError(requestError.message))
      }
    })
    socket.on('connect_error', () => setError('Live updates could not connect. Refresh the page to retry.'))
    return () => {
      socket.emit('purchase-order:leave', { purchaseOrderId: selectedId })
      socket.disconnect()
    }
  }, [selectedId, refreshDetail, refreshOrders])

  const myAssignments = useMemo(() => work.filter((entry) =>
    ['ACTIVE', 'PICKING'].includes(entry.status)), [work])
  const employeesForWarehouse = employees.filter((employee) =>
    employee.status === 'ACTIVE' &&
    employee.departmentId === selected?.warehouse?.departmentId &&
    (employee.role === 'SUPPORT' || employee.role === 'MANAGER'))

  async function perform(action, successMessage) {
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(successMessage)
      await Promise.all([refreshDetail(), refreshOrders()])
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function createPO(event) {
    event.preventDefault()
    const departmentId = canSelectDepartment ? form.departmentId : user?.departmentId
    await perform(async () => {
      const response = await apiClient.warehouse.createPurchaseOrder({
        title: form.title,
        departmentId: departmentId || undefined,
        warehouseId: form.warehouseId,
        items: form.items.map((item) => ({
          productId: item.productId,
          requiredQuantity: Number(item.requiredQuantity),
          ...(item.notes ? { notes: item.notes } : {}),
        })),
      })
      setCreateOpen(false)
      setForm({ title: '', departmentId: '', warehouseId: '', items: [newLine()] })
      setSelectedId(dataOf(response).id)
    }, 'Purchase order created.')
  }

  async function importedPOCreated(order) {
    setMessage('Imported purchase order created.')
    setError('')
    setImportOpen(false)
    setCreateOpen(false)
    await refreshOrders()
    setSelectedId(order.id)
  }

  async function claimItem(item) {
    await perform(() => apiClient.warehouse.claim(item.id, {
      quantity: Number(claimValues[item.id]),
      idempotencyKey: crypto.randomUUID(),
    }), 'Quantity reserved.')
  }

  async function submitAllocation(allocation) {
    await perform(() => apiClient.warehouse.submit(allocation.id, {
      actualQuantity: Number(submitValues[allocation.id]),
      idempotencyKey: crypto.randomUUID(),
    }), 'Picked quantity submitted for verification.')
  }

  async function setPOStatus(status) {
    await perform(() => apiClient.warehouse.setStatus(selected.id, status), `Purchase order marked ${status.replaceAll('_', ' ').toLowerCase()}.`)
  }

  async function createCatalogProduct(event) {
    event.preventDefault()
    await perform(async () => {
      await apiClient.warehouse.createProduct(productForm)
      const response = await apiClient.warehouse.products({ page: 1, pageSize: 100 })
      setProducts(dataOf(response).items ?? [])
      setProductForm({ sku: '', name: '', unit: 'pcs' })
    }, 'Product added to the catalog.')
  }

  async function createCatalogWarehouse(event) {
    event.preventDefault()
    await perform(async () => {
      await apiClient.warehouse.createWarehouse(warehouseForm)
      const response = await apiClient.warehouse.warehouses()
      setWarehouses(dataOf(response) ?? [])
      setWarehouseForm({ code: '', name: '', departmentId: '' })
    }, 'Warehouse added.')
  }

  async function savePurchaseOrderDetails(event) {
    event.preventDefault()
    await perform(() => apiClient.warehouse.updatePurchaseOrder(selected.id, poEdit), 'Purchase order updated.')
  }

  async function addPurchaseOrderItem(event) {
    event.preventDefault()
    await perform(async () => {
      await apiClient.warehouse.addItem(selected.id, {
        productId: newItem.productId,
        requiredQuantity: Number(newItem.requiredQuantity),
        ...(newItem.notes ? { notes: newItem.notes } : {}),
      })
      setNewItem(newLine())
    }, 'Product added to purchase order.')
  }

  return (
    <RoleGuard pageKey="warehouse">
      <PageHeader
        title="Warehouse & purchase orders"
        description="Coordinate assignments, reserve quantities, submit picks and verify dispatch readiness."
        actions={(
          <>
            <Button icon={RefreshCw} onClick={() => perform(refreshOrders, 'Purchase orders refreshed.')}>Refresh</Button>
            {canCreate && <Button variant="primary" icon={Plus} onClick={() => {
              setImportOpen(false)
              setCreateOpen((open) => !open)
            }}>New purchase order</Button>}
          </>
        )}
      />

      {error && <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}

      {createOpen && (
        <Card className="mb-5">
          <CardHeader title="Create purchase order" description="Every item quantity is validated again by the API." />
          <CardBody>
            {importOpen ? (
              <PurchaseOrderImport
                warehouses={warehouses}
                departments={departments}
                products={products}
                canSelectDepartment={canSelectDepartment}
                onCancel={() => setImportOpen(false)}
                onCreated={importedPOCreated}
              />
            ) : (
            <form className="space-y-4" onSubmit={createPO}>
              <div className="grid gap-3 md:grid-cols-3">
                <label>
                  <span className={labelClass}>Title</span>
                  <input className={inputClass} value={form.title} required maxLength={180}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
                </label>
                {canSelectDepartment && (
                  <label>
                    <span className={labelClass}>Sales / owning department</span>
                    <select className={inputClass} value={form.departmentId} required
                      onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}>
                      <option value="">Select department</option>
                      {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                  </label>
                )}
                <label>
                  <span className={labelClass}>Warehouse</span>
                  <select className={inputClass} value={form.warehouseId} required
                    onChange={(event) => setForm((current) => ({ ...current, warehouseId: event.target.value }))}>
                    <option value="">Select warehouse</option>
                    {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="space-y-2">
                {form.items.map((item, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[1fr_150px_1fr_auto]">
                    <select className={inputClass} value={item.productId} required
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        items: current.items.map((line, lineIndex) => lineIndex === index
                          ? { ...line, productId: event.target.value } : line),
                      }))}>
                      <option value="">Select product</option>
                      {products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name} ({product.unit})</option>)}
                    </select>
                    <input className={inputClass} type="number" min="0.001" step="0.001" required
                      aria-label="Required quantity" value={item.requiredQuantity}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        items: current.items.map((line, lineIndex) => lineIndex === index
                          ? { ...line, requiredQuantity: event.target.value } : line),
                      }))} />
                    <input className={inputClass} placeholder="Item notes (optional)" value={item.notes}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        items: current.items.map((line, lineIndex) => lineIndex === index
                          ? { ...line, notes: event.target.value } : line),
                      }))} />
                    <Button type="button" variant="ghost" disabled={form.items.length === 1}
                      onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, row) => row !== index) }))}>
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" icon={Plus} onClick={() => setForm((current) => ({ ...current, items: [...current.items, newLine()] }))}>Add product</Button>
              </div>
              {products.length === 0 && <p className="text-sm text-muted">No active products are configured. Ask an administrator to add catalog products.</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
                {canImportDocument && <Button type="button" onClick={() => setImportOpen(true)}>Import Client PO</Button>}
                <Button type="submit" variant="primary" disabled={!products.length || !warehouses.length}>Create PO</Button>
              </div>
            </form>
            )}
          </CardBody>
        </Card>
      )}

      {canManageCatalog && (
        <div className="mb-5 grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Product catalog" description="Catalog entries are shared by purchase orders." />
            <CardBody>
              <form className="grid gap-2 sm:grid-cols-4" onSubmit={createCatalogProduct}>
                <input aria-label="Product SKU" className={inputClass} placeholder="SKU" required maxLength={64}
                  value={productForm.sku} onChange={(event) => setProductForm((current) => ({ ...current, sku: event.target.value }))} />
                <input aria-label="Product name" className={inputClass} placeholder="Product name" required maxLength={180}
                  value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} />
                <input aria-label="Unit of measure" className={inputClass} placeholder="Unit" required maxLength={32}
                  value={productForm.unit} onChange={(event) => setProductForm((current) => ({ ...current, unit: event.target.value }))} />
                <Button type="submit" variant="primary">Add product</Button>
              </form>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Warehouse locations" description="Each warehouse inherits an existing department scope." />
            <CardBody>
              <form className="grid gap-2 sm:grid-cols-4" onSubmit={createCatalogWarehouse}>
                <input aria-label="Warehouse code" className={inputClass} placeholder="Code" required maxLength={32}
                  value={warehouseForm.code} onChange={(event) => setWarehouseForm((current) => ({ ...current, code: event.target.value }))} />
                <input aria-label="Warehouse name" className={inputClass} placeholder="Warehouse name" required maxLength={160}
                  value={warehouseForm.name} onChange={(event) => setWarehouseForm((current) => ({ ...current, name: event.target.value }))} />
                <select aria-label="Warehouse department" className={inputClass} required value={warehouseForm.departmentId}
                  onChange={(event) => setWarehouseForm((current) => ({ ...current, departmentId: event.target.value }))}>
                  <option value="">Department</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
                <Button type="submit" variant="primary">Add warehouse</Button>
              </form>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="min-h-[400px]">
          <CardHeader title="Purchase orders" description={`${orders.length} shown`}
            actions={<input aria-label="Search purchase orders" className={`${inputClass} w-36`} placeholder="Search"
              value={search} onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && refreshOrders()} />} />
          <CardBody className="space-y-2">
            {loading && <p className="text-sm text-muted">Loading warehouse data…</p>}
            {!loading && orders.length === 0 && <p className="py-6 text-center text-sm text-muted">No purchase orders are available in your scope.</p>}
            {orders.map((order) => (
              <button key={order.id} type="button" onClick={() => setSelectedId(order.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${selectedId === order.id ? 'border-brand-300 bg-brand-50' : 'border-line hover:bg-surface'}`}>
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{order.poNumber}</span>
                  <Badge tone={statusTone(order.status)}>{order.status.replaceAll('_', ' ')}</Badge>
                </span>
                <span className="mt-1 block truncate text-sm text-muted">{order.title}</span>
                <span className="mt-1 block text-xs text-faint">{order.warehouse?.name}</span>
              </button>
            ))}
          </CardBody>
        </Card>

        {selected ? (
          <div className="space-y-5">
            <Card>
              <CardHeader title={`${selected.poNumber} · ${selected.title}`}
                description={`${selected.warehouse?.name ?? 'Warehouse'} · Created by ${selected.createdBy?.name ?? '—'}${selected.sourcePoNumber ? ` · Client PO ${selected.sourcePoNumber}` : ''}`}
                actions={<Badge tone={statusTone(selected.status)}>{selected.status.replaceAll('_', ' ')}</Badge>} />
              <CardBody className="space-y-4">
                {selected.importMethod === 'PASTED_DOCUMENT' && selected.sourceData && (
                  <dl className="grid gap-2 rounded-md border border-line bg-surface p-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      ['PO date', selected.sourceData.poDate],
                      ['Contact', selected.sourceData.contactName],
                      ['Phone', selected.sourceData.contactNumber],
                      ['Email', selected.sourceData.email],
                      ['Payment terms', selected.sourceData.paymentTerms],
                      ['Delivery terms', selected.sourceData.deliveryTerms],
                      ['Delivery address', selected.sourceData.deliveryAddress],
                      ['Billing address', selected.sourceData.billingAddress],
                      ['Document grand total', selected.sourceData.grandTotal],
                    ].filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => (
                      <div key={label}>
                        <dt className="font-medium text-muted">{label}</dt>
                        <dd className="whitespace-pre-wrap text-ink">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="flex flex-wrap gap-2">
                  {canVerify && selected.status !== 'READY_FOR_DISPATCH' && (
                    <Button variant="primary" onClick={() => setPOStatus('READY_FOR_DISPATCH')}>Authorize dispatch</Button>
                  )}
                  {canVerify && selected.status === 'READY_FOR_DISPATCH' && (
                    <Button variant="primary" onClick={() => setPOStatus('DISPATCHED')}>Mark dispatched</Button>
                  )}
                  {canVerify && selected.status === 'DISPATCHED' && (
                    <Button onClick={() => setPOStatus('COMPLETED')}>Complete PO</Button>
                  )}
                  {selected.status !== 'CANCELLED' && <span className="ml-auto text-xs text-muted">Live progress updates {error.includes('Live updates') ? 'disconnected' : 'enabled'}</span>}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="border-b border-line text-xs uppercase text-faint">
                      <tr><th className="py-2">Product</th><th>Required</th><th>Unit price</th><th>Discount</th><th>VAT / tax</th><th>Line total</th><th>Reserved</th><th>Pending</th><th>Verified</th><th>Available</th><th>Claim</th>{canManageDetails && <th>PO edit</th>}</tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {(progress?.items ?? selected.items ?? []).map((item) => {
                        const quantities = item.progress ?? {}
                        return (
                          <tr key={item.id}>
                            <td className="py-3 pr-3">
                              <p className="font-medium text-ink">{item.productName}</p>
                              <p className="text-xs text-muted">{item.sku || 'No SKU'} · {item.unit || 'No unit'}</p>
                              {item.description && <p className="mt-1 max-w-xs whitespace-pre-wrap text-xs text-muted">{item.description}</p>}
                              {Object.keys(item.additionalFields ?? {}).length > 0 && (
                                <p className="mt-1 text-[11px] text-faint">
                                  {Object.entries(item.additionalFields).map(([key, value]) => `${key}: ${value}`).join(' · ')}
                                </p>
                              )}
                            </td>
                            <td>{item.requiredQuantity}</td>
                            <td>{item.unitPrice ?? '—'}</td>
                            <td>{item.discount ?? '—'}</td>
                            <td>{item.tax ?? '—'}</td>
                            <td>{item.lineTotal ?? '—'}</td>
                            <td>{quantities.activeReservedQuantity ?? '0.000'}</td>
                            <td>{quantities.submittedQuantity ?? '0.000'}</td>
                            <td>{quantities.verifiedQuantity ?? '0.000'}</td>
                            <td className="font-medium">{quantities.availableQuantity ?? '0.000'}</td>
                            <td>
                              {canPick && Number(quantities.availableQuantity) > 0 ? (
                                <div className="flex items-center gap-1">
                                  <input aria-label={`Quantity to claim for ${item.productName}`} className={`${inputClass} w-20`}
                                    type="number" min="0.001" step="0.001" value={claimValues[item.id] ?? ''}
                                    onChange={(event) => setClaimValues((current) => ({ ...current, [item.id]: event.target.value }))} />
                                  <Button size="sm" onClick={() => claimItem(item)} disabled={!claimValues[item.id]}>Claim</Button>
                                </div>
                              ) : <span className="text-xs text-faint">—</span>}
                            </td>
                            {canManageDetails && (
                              <td>
                                <div className="flex items-center gap-1">
                                  <input aria-label={`Required quantity for ${item.productName}`} className={`${inputClass} w-20`}
                                    type="number" min="0.001" step="0.001"
                                    value={quantityEdits[item.id] ?? item.requiredQuantity}
                                    onChange={(event) => setQuantityEdits((current) => ({ ...current, [item.id]: event.target.value }))} />
                                  <Button size="sm" onClick={() => perform(() => apiClient.warehouse.updateItem(item.id, {
                                    requiredQuantity: Number(quantityEdits[item.id]),
                                  }), 'Purchase order item updated.')}>Save</Button>
                                  <Button size="sm" variant="danger" onClick={() => perform(() => apiClient.warehouse.removeItem(item.id), 'Purchase order item removed.')}>Remove</Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>

            {canManageDetails && (
              <Card>
                <CardHeader title="Edit purchase order" description="Details and quantities lock once picking history exists." />
                <CardBody className="space-y-3">
                  <form className="grid gap-2 md:grid-cols-[1fr_2fr_auto]" onSubmit={savePurchaseOrderDetails}>
                    <input aria-label="Purchase order title" className={inputClass} required maxLength={180}
                      value={poEdit.title} onChange={(event) => setPoEdit((current) => ({ ...current, title: event.target.value }))} />
                    <input aria-label="Purchase order notes" className={inputClass} maxLength={5000} placeholder="Notes"
                      value={poEdit.notes} onChange={(event) => setPoEdit((current) => ({ ...current, notes: event.target.value }))} />
                    <Button type="submit" variant="primary">Save details</Button>
                  </form>
                  <form className="grid gap-2 md:grid-cols-[1fr_150px_1fr_auto]" onSubmit={addPurchaseOrderItem}>
                    <select className={inputClass} value={newItem.productId} required
                      onChange={(event) => setNewItem((current) => ({ ...current, productId: event.target.value }))}>
                      <option value="">Add product</option>
                      {products.filter((product) => !(selected.items ?? []).some((item) => item.productId === product.id))
                        .map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}
                    </select>
                    <input aria-label="New item required quantity" className={inputClass} type="number" min="0.001" step="0.001"
                      required value={newItem.requiredQuantity}
                      onChange={(event) => setNewItem((current) => ({ ...current, requiredQuantity: event.target.value }))} />
                    <input aria-label="New item notes" className={inputClass} placeholder="Item notes"
                      value={newItem.notes} onChange={(event) => setNewItem((current) => ({ ...current, notes: event.target.value }))} />
                    <Button type="submit">Add item</Button>
                  </form>
                </CardBody>
              </Card>
            )}

            {canAssign && (
              <Card>
                <CardHeader title="Warehouse assignment" description="Assignment removals preserve employee and picking history." />
                <CardBody className="flex flex-wrap items-end gap-2">
                  <label className="min-w-[220px] flex-1">
                    <span className={labelClass}>Warehouse employees</span>
                    <select multiple className={`${inputClass} h-24`} value={assignmentIds}
                      onChange={(event) => setAssignmentIds([...event.target.selectedOptions].map((option) => option.value))}>
                      {employeesForWarehouse.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role}</option>)}
                    </select>
                  </label>
                  <Button onClick={() => perform(() => apiClient.warehouse.assign(selected.id, assignmentIds), 'Employees assigned.')}
                    disabled={!assignmentIds.length}>Assign selected</Button>
                  <div className="w-full flex flex-wrap gap-2">
                    {(selected.assignments ?? []).map((assignment) => (
                      <Badge key={assignment.id} tone="neutral">
                        {assignment.employee?.name}
                        {canAssign && <button type="button" className="ml-1 text-brand-700"
                          aria-label={`Remove ${assignment.employee?.name}`}
                          onClick={() => perform(() => apiClient.warehouse.removeAssignment(selected.id, assignment.employee.id, 'Assignment removed by supervisor.'), 'Assignment removed.')}>×</button>}
                      </Badge>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {myAssignments.length > 0 && (
              <Card>
                <CardHeader title="My picking work" description="Submitting a pick releases any uncollected balance from that claim." />
                <CardBody className="space-y-3">
                  {myAssignments.map((allocation) => (
                    <div key={allocation.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line p-3">
                      <div className="min-w-40 flex-1">
                        <p className="font-medium">{allocation.item.productName} · {allocation.item.sku}</p>
                        <p className="text-xs text-muted">{allocation.remainingQuantity} reserved · expires {new Date(allocation.expiresAt).toLocaleString()}</p>
                      </div>
                      {allocation.status === 'ACTIVE' && <Button size="sm" onClick={() => perform(() => apiClient.warehouse.updateAllocation(allocation.id, { action: 'START' }), 'Picking started.')}>Start</Button>}
                      <input aria-label="Actual picked quantity" className={`${inputClass} w-28`} type="number"
                        min="0.001" step="0.001" max={allocation.remainingQuantity} value={submitValues[allocation.id] ?? ''}
                        onChange={(event) => setSubmitValues((current) => ({ ...current, [allocation.id]: event.target.value }))} />
                      <Button size="sm" variant="primary" disabled={!submitValues[allocation.id]}
                        onClick={() => submitAllocation(allocation)}>Submit pick</Button>
                      <Button size="sm" variant="ghost" onClick={() => perform(() => apiClient.warehouse.release(allocation.id, 'Released by employee.'), 'Allocation released.')}>Release</Button>
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}

            {canVerify && (
              <Card>
                <CardHeader title="Pending verification" description={`${pending.length} submissions awaiting review`} />
                <CardBody className="space-y-2">
                  {pending.length === 0 && <p className="text-sm text-muted">No submissions are waiting for verification.</p>}
                  {pending.map((submission) => (
                    <div key={submission.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line p-3">
                      <div className="min-w-40 flex-1">
                        <p className="font-medium">{submission.item.productName} · {submission.actualQuantity} {submission.item.unit}</p>
                        <p className="text-xs text-muted">Picked by {submission.employee.name} · {new Date(submission.submittedAt).toLocaleString()}</p>
                      </div>
                      <Button size="sm" variant="primary" onClick={() => perform(() => apiClient.warehouse.verify(submission.id), 'Submission verified.')}>Verify</Button>
                      <input aria-label="Rejection reason" className={`${inputClass} w-52`}
                        placeholder="Reason required to reject"
                        value={reviewReasons[submission.id] ?? ''}
                        onChange={(event) => setReviewReasons((current) => ({ ...current, [submission.id]: event.target.value }))} />
                      <Button size="sm" variant="danger" disabled={!reviewReasons[submission.id]}
                        onClick={() => perform(() => apiClient.warehouse.reject(submission.id, reviewReasons[submission.id]), 'Submission rejected and quantity released.')}>Reject</Button>
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader title="Activity history" description="Audit events are append-only through the warehouse API." />
              <CardBody className="space-y-2">
                {activity.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 border-b border-line pb-2 last:border-0">
                    <span className="mt-1 h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{entry.action.replaceAll('_', ' ')}</p>
                      <p className="text-xs text-muted">{entry.actor?.name ?? 'System'} · {new Date(entry.createdAt).toLocaleString()}</p>
                      {entry.notes && <p className="mt-1 text-xs text-muted">{entry.notes}</p>}
                    </div>
                  </div>
                ))}
                {activity.length === 0 && <p className="text-sm text-muted">No warehouse activity yet.</p>}
              </CardBody>
            </Card>
          </div>
        ) : (
          <Card className="flex min-h-[400px] items-center justify-center">
            <CardBody className="text-center">
              <WarehouseIcon className="mx-auto h-8 w-8 text-faint" />
              <p className="mt-3 text-sm text-muted">Select a purchase order to view warehouse progress.</p>
              {orders.length === 0 && <p className="mt-1 text-xs text-faint">No purchase orders are visible in your authorized scope.</p>}
            </CardBody>
          </Card>
        )}
      </div>

      <div className="sr-only" aria-live="polite">
        {selectedWarehouse?.name ?? ''} {loading ? 'Loading' : 'Ready'}
      </div>
    </RoleGuard>
  )
}
