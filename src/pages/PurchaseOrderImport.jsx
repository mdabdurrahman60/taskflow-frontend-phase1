import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { apiClient } from '../api/apiClient.js'
import Button from '../components/ui/Button'

const inputClass = 'h-9 w-full min-w-28 rounded-md border border-line bg-white px-2.5 text-[13px] text-ink'

function emptyItem() {
  return {
    rowId: crypto.randomUUID(),
    productName: '',
    quantity: '',
    unitPrice: '',
    lineTotal: '',
    productId: '',
    sku: '',
    unit: '',
  }
}

async function searchCatalog() {
  setError('')
  setIsSearchingCatalog(true)
  try {
    const response = await apiClient.warehouse.products({
      page: 1,
      pageSize: 100,
      ...(catalogSearch.trim() ? { search: catalogSearch.trim() } : {}),
    })
    setCatalogResults(response?.data?.items ?? [])
  } catch (requestError) {
    setError(requestError.message)
  } finally {
    setIsSearchingCatalog(false)
  }
}

function numberValue(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatAmount(value) {
  return value === null || value === undefined
    ? 'Not provided'
    : Number(value).toLocaleString('en-US', { maximumFractionDigits: 3 })
}

function normalize(value) {
  return String(value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

function suggestedMatches(item, products) {
  const sku = normalize(item.sku)
  const name = normalize(item.productName)
  const models = item.productName.match(/\b(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9-]+\b/gi) ?? []
  const matches = products.filter((product) => {
    const productSku = normalize(product.sku)
    if (sku && productSku === sku) return true
    if (name && normalize(product.name) === name) return true
    return models.some((model) =>
      productSku === normalize(model) ||
      new RegExp(`(^|[^a-z0-9])${model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(product.name))
  })
  return matches.length === 1 ? matches[0] : null
}

export default function PurchaseOrderImport({ warehouses, departments, products, canSelectDepartment, onCancel, onCreated }) {
  const [text, setText] = useState('')
  const [data, setData] = useState(null)
  const [items, setItems] = useState([])
  const [catalogResults, setCatalogResults] = useState([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [departmentId, setDepartmentId] = useState(departments.length === 1 ? departments[0].id : '')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const catalogProducts = useMemo(() =>
    [...new Map([...products, ...catalogResults].map((product) => [product.id, product])).values()],
  [products, catalogResults])

  const totals = useMemo(() => {
    const suppliedLines = items.reduce((sum, item) => sum + (numberValue(item.lineTotal) ?? 0), 0)
    const calculatedLines = items.reduce((sum, item) => {
      const quantity = numberValue(item.quantity)
      const unitPrice = numberValue(item.unitPrice)
      return sum + (quantity !== null && unitPrice !== null ? quantity * unitPrice : 0)
    }, 0)
    const clientGrandTotal = numberValue(data?.grandTotal)
    return {
      suppliedLines,
      calculatedLines,
      clientGrandTotal,
      difference: clientGrandTotal === null ? null : calculatedLines - clientGrandTotal,
    }
  }, [data, items])

  function updateItem(rowId, field, value) {
    setItems((current) => current.map((item) => item.rowId === rowId ? { ...item, [field]: value } : item))
  }

  async function processTable() {
    setError('')
    setIsProcessing(true)
    try {
      const response = await apiClient.warehouse.extractPurchaseOrderText(text)
      const extracted = response?.data ?? {}
      setData(extracted)
      setItems((extracted.items ?? []).map((item) => ({
        rowId: crypto.randomUUID(),
        productName: item.productName ?? '',
        quantity: item.quantity == null ? '' : String(item.quantity),
        unitPrice: item.unitPrice == null ? '' : String(item.unitPrice),
        lineTotal: item.lineTotal == null ? '' : String(item.lineTotal),
        productId: '',
        sku: item.sku ?? '',
        unit: item.unit ?? '',
      })))
      setIdempotencyKey(crypto.randomUUID())
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsProcessing(false)
    }
  }

  function rowValidation(item) {
    const issues = []
    const quantity = numberValue(item.quantity)
    const unitPrice = numberValue(item.unitPrice)
    const lineTotal = numberValue(item.lineTotal)
    if (!item.productName.trim()) issues.push('Product name is required.')
    if (quantity === null || quantity <= 0) issues.push('Quantity must be greater than zero.')
    if (unitPrice !== null && unitPrice < 0) issues.push('Unit price cannot be negative.')
    if (lineTotal !== null && lineTotal < 0) issues.push('Total price cannot be negative.')
    if (quantity !== null && quantity > 0 && unitPrice !== null && lineTotal !== null &&
        Math.abs(quantity * unitPrice - lineTotal) > 0.001) {
      issues.push(`Expected ${formatAmount(quantity * unitPrice)}; supplied total is ${formatAmount(lineTotal)}.`)
    }
    return issues
  }

  const invalidRows = items.filter((item) => rowValidation(item).some((issue) =>
    issue.includes('required') || issue.includes('greater than zero') || issue.includes('cannot be negative')))
  const selectedProductIds = items.map((item) => item.productId).filter(Boolean)
  const hasDuplicateMatches = new Set(selectedProductIds).size !== selectedProductIds.length
  const canCreate = Boolean(data && items.length && warehouseId && (!canSelectDepartment || departmentId) &&
    !invalidRows.length && !hasDuplicateMatches && !isCreating && items.length <= 200)

  async function createPurchaseOrder(event) {
    event.preventDefault()
    if (!canCreate) return
    setError('')
    setIsCreating(true)
    try {
      const response = await apiClient.warehouse.createPurchaseOrder({
        title: 'Imported Client PO',
        ...(canSelectDepartment ? { departmentId } : {}),
        warehouseId,
        importMethod: 'PASTED_DOCUMENT',
        sourceData: { grandTotal: totals.clientGrandTotal },
        idempotencyKey,
        items: items.map((item) => ({
          ...(item.productId ? { productId: item.productId } : {}),
          productName: item.productName.trim(),
          sku: item.sku || null,
          unit: item.unit || null,
          requiredQuantity: Number(item.quantity),
          unitPrice: numberValue(item.unitPrice),
          lineTotal: numberValue(item.lineTotal),
        })),
      })
      await onCreated(response?.data ?? {})
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!data ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Import Client PO</h3>
              <p className="text-xs text-muted">Paste a copied product table from Excel, PDF, email, or a Markdown table.</p>
            </div>
            <Button type="button" onClick={onCancel}>Cancel</Button>
          </div>
          <textarea
            aria-label="Paste client purchase order table"
            className="min-h-72 w-full rounded-md border border-line bg-white p-3 text-sm text-ink"
            maxLength={100000}
            placeholder="Paste the client PO table here..."
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="flex justify-end">
            <Button type="button" variant="primary" disabled={isProcessing || text.trim().length < 10} onClick={processTable}>
              {isProcessing ? 'Processing...' : 'Process Table'}
            </Button>
          </div>
        </section>
      ) : (
        <form className="space-y-5" onSubmit={createPurchaseOrder}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Review client PO table</h3>
              <p className="text-xs text-muted">Prices and totals are preserved as supplied. Mismatches are warnings; correct a value only when you choose to.</p>
            </div>
            <Button type="button" onClick={() => { setData(null); setError('') }}>Back to pasted table</Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {canSelectDepartment && (
              <label>
                <span className="mb-1 block text-xs font-medium text-ink">Owning department</span>
                <select className={inputClass} required value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                  <option value="">Select department</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </label>
            )}
            <label>
              <span className="mb-1 block text-xs font-medium text-ink">Warehouse</span>
              <select className={inputClass} required value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
                <option value="">Select warehouse</option>
                {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">{items.length} product row{items.length === 1 ? '' : 's'} extracted</p>
            <Button type="button" icon={Plus} onClick={() => setItems((current) => [...current, emptyItem()])}>Add product row</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Search product catalog" className={inputClass} placeholder="Search catalog by name, SKU, or model"
              value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  searchCatalog()
                }
              }} />
            <Button type="button" disabled={isSearchingCatalog} onClick={searchCatalog}>
              {isSearchingCatalog ? 'Searching...' : 'Search catalog'}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="min-w-[1100px] border-collapse text-left text-xs">
              <thead className="bg-surface text-muted">
                <tr>
                  {['Product Name', 'Quantity', 'Unit Price', 'Total Price', 'Validation', 'Catalog Match', ''].map((heading) => (
                    <th key={heading || 'remove'} className="p-2 font-medium">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const issues = rowValidation(item)
                  const match = suggestedMatches(item, catalogProducts)
                  const isMismatch = issues.some((issue) => issue.startsWith('Expected '))
                  const suggestedTotal = (numberValue(item.quantity) ?? 0) * (numberValue(item.unitPrice) ?? 0)
                  return (
                    <tr key={item.rowId} className="border-t border-line align-top">
                      <td className="min-w-72 p-1.5">
                        <input aria-label="Product Name" className={inputClass} maxLength={500} required
                          value={item.productName} onChange={(event) => updateItem(item.rowId, 'productName', event.target.value)} />
                      </td>
                      <td className="w-32 p-1.5">
                        <input aria-label="Quantity" className={inputClass} type="number" min="0.001" step="0.001" required
                          value={item.quantity} onChange={(event) => updateItem(item.rowId, 'quantity', event.target.value)} />
                      </td>
                      <td className="w-36 p-1.5">
                        <input aria-label="Unit Price" className={inputClass} type="number" min="0" step="0.001"
                          value={item.unitPrice} onChange={(event) => updateItem(item.rowId, 'unitPrice', event.target.value)} />
                      </td>
                      <td className="w-36 p-1.5">
                        <input aria-label="Total Price" className={inputClass} type="number" min="0" step="0.001"
                          value={item.lineTotal} onChange={(event) => updateItem(item.rowId, 'lineTotal', event.target.value)} />
                      </td>
                      <td className="min-w-56 p-2">
                        {issues.length
                          ? <ul className={`space-y-1 ${isMismatch ? 'text-amber-700' : 'text-red-700'}`}>
                            {issues.map((issue) => <li key={issue}>{issue}</li>)}
                          </ul>
                          : <span className="text-emerald-700">OK</span>}
                        {isMismatch && (
                          <button type="button" className="mt-1 text-[11px] font-medium text-accent underline"
                            onClick={() => updateItem(item.rowId, 'lineTotal', String(suggestedTotal))}>
                            Use calculated total
                          </button>
                        )}
                      </td>
                      <td className="min-w-56 p-1.5">
                        <select aria-label="Catalog Match" className={inputClass} value={item.productId}
                          onChange={(event) => {
                            const product = catalogProducts.find((entry) => entry.id === event.target.value)
                            setItems((current) => current.map((entry) => entry.rowId === item.rowId
                              ? { ...entry, productId: event.target.value, sku: product?.sku ?? '', unit: product?.unit ?? '' }
                              : entry))
                          }}>
                          <option value="">Leave unmatched</option>
                          {catalogProducts.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}
                        </select>
                        {!item.productId && match && (
                          <button type="button" className="mt-1 text-[11px] text-accent underline"
                            onClick={() => updateItem(item.rowId, 'productId', match.id)}>
                            Suggest exact match: {match.sku}
                          </button>
                        )}
                      </td>
                      <td className="p-1.5">
                        <Button type="button" variant="ghost" aria-label="Remove product row"
                          onClick={() => setItems((current) => current.filter((entry) => entry.rowId !== item.rowId))}>
                          <Trash2 size={15} />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {hasDuplicateMatches && (
            <p role="alert" className="text-xs text-amber-700">A catalog product is matched to more than one row. Leave one row unmatched or choose a different product.</p>
          )}

          <section className="grid gap-3 rounded-md border border-line bg-surface p-3 sm:grid-cols-3" aria-label="Grand total">
            <div><p className="text-xs text-muted">Client-provided grand total</p><p className="font-semibold text-ink">{formatAmount(totals.clientGrandTotal)}</p></div>
            <div><p className="text-xs text-muted">Sum of supplied line totals</p><p className="font-semibold text-ink">{formatAmount(totals.suppliedLines)}</p></div>
            <div>
              <p className="text-xs text-muted">Calculated from quantity × unit price</p>
              <p className="font-semibold text-ink">{formatAmount(totals.calculatedLines)}</p>
              {totals.difference !== null && Math.abs(totals.difference) > 0.001 && (
                <p className="text-xs text-amber-700">Difference from client total: {formatAmount(totals.difference)}</p>
              )}
            </div>
          </section>
          {data.warnings?.filter((warning) => !/client or company name|client po number was not found/i.test(warning)).map((warning) => (
            <p key={warning} className="text-xs text-amber-700">{warning}</p>
          ))}
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button type="button" disabled={isCreating} onClick={onCancel}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!canCreate}>
              {isCreating ? 'Creating...' : 'Create Purchase Order'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
