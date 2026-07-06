/**
 * Inventory API client. Single fetch wrapper so every call carries the
 * Keycloak bearer, generates an X-Idempotency-Key on mutations, and
 * surfaces structured errors to the caller for toast rendering.
 *
 * Reads NEXT_PUBLIC_INVENTORY_API_URL. When unset, defaults to the
 * docker-compose host port (8095). For local non-docker dev override
 * to http://localhost:8090.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_INVENTORY_API_URL ?? "http://localhost:8095"

// ─── Types — shape mirrors internal/domain on the backend ──────────────────

export type ProductStatus = "draft" | "active" | "retired"

export interface Product {
  id: string
  sku: string
  slug: string
  title: string
  description: string
  category_id?: string | null
  category_ids: string[]
  brand?: string | null
  status: ProductStatus
  tags: string[]
  highlights: string[]
  meta_title?: string | null
  meta_description?: string | null
  images?: ProductImage[]
  external_product_id?: string | null
  created_at: string
  updated_at: string
  variants?: Variant[]
}

export interface ProductImage {
  id: string
  product_id: string
  url: string
  alt_text?: string
  sort_order: number
  created_at: string
}

export interface ImageRequest {
  url: string
  alt_text?: string
  sort_order?: number
}

export interface Variant {
  id: string
  product_id: string
  sku: string
  name?: string | null
  upc?: string | null
  attributes?: Record<string, unknown>
  weight_kg?: number | null
  dimensions?: Record<string, unknown> | null
  cost_cents: number
  list_price_cents: number
  compare_at_price_cents?: number | null
  currency: string
  external_variant_id?: string | null
  created_at: string
  updated_at: string
}

export interface StockLevel {
  variant_id: string
  variant_sku: string
  product_title: string
  location_id: string
  location_code: string
  on_hand: number
  held: number
  available: number
}

export type StockMovementReason =
  | "receive"
  | "sale"
  | "return"
  | "adjustment"
  | "count_correction"
  | "transfer"

export interface StockAdjustment {
  variant_id: string
  location_id: string
  delta: number
  reason: StockMovementReason
  reference?: string
}

export interface StockTransfer {
  variant_id: string
  from_location_id: string
  to_location_id: string
  quantity: number
  reference?: string
  notes?: string
}

export interface VariantLookup {
  variant_id: string
  product_id: string
  sku: string
  upc?: string
  name?: string
  product_title: string
}

export type PickTaskState =
  | "new"
  | "picking"
  | "packed"
  | "shipped"
  | "cancelled"

export type POStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled"

export interface PurchaseOrderLine {
  id: string
  po_id: string
  variant_id: string
  variant_sku?: string
  product_title?: string
  quantity: number
  unit_cost_cents: number
  received_qty: number
  outstanding_qty: number
  created_at: string
}

export interface PurchaseOrder {
  id: string
  number: string
  supplier_name: string
  supplier_ref?: string
  location_id: string
  status: POStatus
  expected_at?: string | null
  submitted_at?: string | null
  submitted_by?: string
  approved_at?: string | null
  approved_by?: string
  approval_threshold_cents?: number | null
  ordered_at?: string | null
  received_at?: string | null
  notes?: string
  total_cost_cents: number
  lines?: PurchaseOrderLine[]
  created_by?: string
  created_at: string
  updated_at: string
}

export interface PORequestPayload {
  supplier_name: string
  supplier_ref?: string
  location_id: string
  expected_at?: string | null
  notes?: string
  lines: { variant_id: string; quantity: number; unit_cost_cents: number }[]
}

export interface ReceiveRequestPayload {
  lines: { line_id: string; quantity: number }[]
  notes?: string
}

// ─── Cycle counts ──────────────────────────────────────────────────────────

export type CycleCountStatus = "open" | "closed" | "cancelled"

export interface CycleCountLine {
  id: string
  cycle_count_id: string
  variant_id: string
  variant_sku?: string
  product_title?: string
  expected_qty: number
  counted_qty?: number | null
  variance?: number | null
  notes?: string
  created_at: string
}

export interface CycleCount {
  id: string
  location_id: string
  status: CycleCountStatus
  notes?: string
  created_by?: string
  created_at: string
  closed_at?: string | null
  closed_by?: string
  updated_at: string
  lines?: CycleCountLine[]
}

export interface CycleCountRequestPayload {
  location_id: string
  notes?: string
  variants?: string[]
}

export interface RecordCountPayload {
  lines: { line_id: string; counted_qty: number; notes?: string }[]
}

// ─── Reports ────────────────────────────────────────────────────────────────

export interface StockValuationRow {
  variant_id: string
  variant_sku: string
  product_title: string
  location_id: string
  location_code: string
  on_hand: number
  cost_cents: number
  value_cents: number
}

export interface Movement {
  id: string
  variant_id: string
  variant_sku?: string
  product_title?: string
  location_id: string
  location_code?: string
  delta: number
  reason: string
  reference?: string
  actor?: string
  created_at: string
}

export interface AuditEvent {
  id: number
  entity_type: string
  entity_id: string
  action: string
  actor?: string
  actor_name?: string
  summary: string
  details?: Record<string, unknown>
  request_id?: string
  created_at: string
}

export interface PickTaskLine {
  id: string
  pick_task_id: string
  reservation_id: string
  variant_id: string
  location_id: string
  quantity: number
  picked_quantity: number
  external_line_id?: string
}

export interface PickTask {
  id: string
  external_order_id: string
  external_order_number?: string
  buyer_name?: string
  ship_to?: Record<string, unknown>
  state: PickTaskState
  carrier?: string
  tracking_number?: string
  label_url?: string
  lines?: PickTaskLine[]
  created_at: string
  picked_at?: string
  shipped_at?: string
  updated_at: string
}

export interface ApiError {
  status: number
  code: string
  detail: string
}

// ─── Fetch core ─────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | undefined> {
  // Server components import this module too, but they never hit mutating
  // routes — they read from the backend with a service-account flow in
  // prod. For now we rely on the client-side useSession hook injecting
  // the bearer. When called from a server context with no token, the
  // backend's dev bypass handles unauth dev traffic.
  if (typeof window === "undefined") return undefined
  // next-auth's getSession is dynamic-imported to keep server bundles lean.
  const mod = await import("next-auth/react")
  const session = await mod.getSession()
  return (session as { accessToken?: string } | null)?.accessToken
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function request<T>(path: string, init: RequestInit & { idempotent?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")
  const token = await getAccessToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init.idempotent) headers.set("X-Idempotency-Key", newIdempotencyKey())

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  })
  if (res.status === 401) {
    // Hard redirect to sign-in; preserves callback for resume.
    if (typeof window !== "undefined") {
      const cb = encodeURIComponent(window.location.pathname + window.location.search)
      window.location.href = `/auth/signin?callbackUrl=${cb}`
    }
    throw apiError(res.status, "unauthorized", "session expired")
  }
  if (res.status === 204) return undefined as unknown as T
  const body = await res.text()
  let parsed: unknown
  try {
    parsed = body ? JSON.parse(body) : null
  } catch {
    parsed = body
  }
  if (!res.ok) {
    const err = parsed as Partial<ApiError> | string
    if (typeof err === "string") {
      throw apiError(res.status, "error", err)
    }
    throw apiError(res.status, err.code ?? "error", err.detail ?? `HTTP ${res.status}`)
  }
  return parsed as T
}

function apiError(status: number, code: string, detail: string): ApiError {
  return { status, code, detail }
}

export function isApiError(e: unknown): e is ApiError {
  return Boolean(e && typeof e === "object" && "code" in e && "status" in e)
}

// ─── Endpoint methods ──────────────────────────────────────────────────────

export const api = {
  // Products
  listProducts: () => request<Product[]>("/api/v1/products"),
  getProduct: (id: string) => request<Product>(`/api/v1/products/${id}`),
  createProduct: (body: Partial<Product>) =>
    request<Product>("/api/v1/products", {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),
  updateProduct: (id: string, body: Partial<Product>) =>
    request<Product>(`/api/v1/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
      idempotent: true,
    }),
  addVariant: (productId: string, body: Partial<Variant>) =>
    request<Variant>(`/api/v1/products/${productId}/variants`, {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),
  addImage: (productId: string, body: ImageRequest) =>
    request<ProductImage>(`/api/v1/products/${productId}/images`, {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),
  removeImage: (productId: string, imageId: string) =>
    request<void>(`/api/v1/products/${productId}/images/${imageId}`, {
      method: "DELETE",
      idempotent: true,
    }),
  reorderImages: (productId: string, imageIds: string[]) =>
    request<void>(`/api/v1/products/${productId}/images/reorder`, {
      method: "PUT",
      body: JSON.stringify({ image_ids: imageIds }),
      idempotent: true,
    }),

  // Stock
  listStock: () => request<StockLevel[]>("/api/v1/stock"),
  adjustStock: (body: StockAdjustment) =>
    request<void>("/api/v1/stock/adjust", {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),
  transferStock: (body: StockTransfer) =>
    request<void>("/api/v1/stock/transfer", {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),

  // Scanner — resolve a barcode (SKU or UPC) to a variant. 404 = not found.
  lookupVariantByCode: (code: string) =>
    request<VariantLookup>(`/api/v1/variants/lookup?code=${encodeURIComponent(code)}`),

  // Pick tasks
  listPickTasks: (states?: PickTaskState[], limit?: number) => {
    const params = new URLSearchParams()
    if (states && states.length) params.set("state", states.join(","))
    if (limit) params.set("limit", String(limit))
    const qs = params.toString()
    return request<PickTask[]>(`/api/v1/pick-tasks${qs ? `?${qs}` : ""}`)
  },
  getPickTask: (id: string) => request<PickTask>(`/api/v1/pick-tasks/${id}`),
  startPicking: (id: string) =>
    request<PickTask>(`/api/v1/pick-tasks/${id}/pick`, { method: "POST", idempotent: true, body: "{}" }),
  markPacked: (id: string) =>
    request<PickTask>(`/api/v1/pick-tasks/${id}/pack`, { method: "POST", idempotent: true, body: "{}" }),
  ship: (id: string, body: { carrier?: string; tracking_number?: string; label_url?: string }) =>
    request<PickTask>(`/api/v1/pick-tasks/${id}/ship`, {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),
  cancel: (id: string) =>
    request<void>(`/api/v1/pick-tasks/${id}/cancel`, { method: "POST", idempotent: true, body: "{}" }),

  // Purchase orders
  listPOs: (statuses?: POStatus[], limit?: number) => {
    const params = new URLSearchParams()
    if (statuses && statuses.length) params.set("status", statuses.join(","))
    if (limit) params.set("limit", String(limit))
    const qs = params.toString()
    return request<PurchaseOrder[]>(`/api/v1/purchase-orders${qs ? `?${qs}` : ""}`)
  },
  getPO: (id: string) => request<PurchaseOrder>(`/api/v1/purchase-orders/${id}`),
  createPO: (body: PORequestPayload) =>
    request<PurchaseOrder>("/api/v1/purchase-orders", {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),
  submitPO: (id: string) =>
    request<PurchaseOrder>(`/api/v1/purchase-orders/${id}/submit`, {
      method: "POST",
      idempotent: true,
      body: "{}",
    }),
  approvePO: (id: string) =>
    request<PurchaseOrder>(`/api/v1/purchase-orders/${id}/approve`, {
      method: "POST",
      idempotent: true,
      body: "{}",
    }),
  cancelPO: (id: string) =>
    request<PurchaseOrder>(`/api/v1/purchase-orders/${id}/cancel`, {
      method: "POST",
      idempotent: true,
      body: "{}",
    }),
  receivePO: (id: string, body: ReceiveRequestPayload) =>
    request<PurchaseOrder>(`/api/v1/purchase-orders/${id}/receive`, {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),

  // Cycle counts
  listCycleCounts: (statuses?: CycleCountStatus[], limit?: number) => {
    const params = new URLSearchParams()
    if (statuses && statuses.length) params.set("status", statuses.join(","))
    if (limit) params.set("limit", String(limit))
    const qs = params.toString()
    return request<CycleCount[]>(`/api/v1/cycle-counts${qs ? `?${qs}` : ""}`)
  },
  getCycleCount: (id: string) => request<CycleCount>(`/api/v1/cycle-counts/${id}`),
  createCycleCount: (body: CycleCountRequestPayload) =>
    request<CycleCount>("/api/v1/cycle-counts", {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),
  recordCounts: (id: string, body: RecordCountPayload) =>
    request<CycleCount>(`/api/v1/cycle-counts/${id}/counts`, {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),
  closeCycleCount: (id: string) =>
    request<CycleCount>(`/api/v1/cycle-counts/${id}/close`, {
      method: "POST",
      idempotent: true,
      body: "{}",
    }),
  cancelCycleCount: (id: string) =>
    request<CycleCount>(`/api/v1/cycle-counts/${id}/cancel`, {
      method: "POST",
      idempotent: true,
      body: "{}",
    }),

  // Reports
  stockValuation: (locationId?: string) => {
    const qs = locationId ? `?location_id=${locationId}` : ""
    return request<StockValuationRow[]>(`/api/v1/reports/stock-valuation${qs}`)
  },
  movements: (params: { from?: string; to?: string; variant_id?: string; location_id?: string; limit?: number }) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== "") sp.set(k, String(v))
    }
    const qs = sp.toString()
    return request<Movement[]>(`/api/v1/reports/movements${qs ? `?${qs}` : ""}`)
  },
  auditFeed: (params: { entity_type?: string; entity_id?: string; from?: string; limit?: number }) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== "") sp.set(k, String(v))
    }
    const qs = sp.toString()
    return request<AuditEvent[]>(`/api/v1/reports/audit${qs ? `?${qs}` : ""}`)
  },
}

// ─── Phase 9.5 — catalog search + "from catalog" offer flow ───────────────

export interface CatalogItem {
  id: string
  itemNumber: string
  title: string
  description: string
  brand?: string
  slug: string
  productType: string
  status: "draft" | "published" | "suppressed"
  tags?: string[]
  highlights?: string
  categoryIds?: string[]
  variants: CatalogVariant[]
  images: CatalogImage[]
}

export interface CatalogVariant {
  id: string
  itemId: string
  variantSku: string
  gtin?: string
  name?: string
  attributeValues?: string
  weightKg?: number | null
  dimensions?: string
  isDefault: boolean
}

export interface CatalogImage {
  id: string
  itemId: string
  url: string
  altText?: string
  sortOrder: number
  isPrimary: boolean
}

export interface CatalogSearchResponse {
  content: CatalogItem[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface OfferFromCatalogVariantInput {
  catalog_variant_id: string
  internal_sku?: string
  cost_cents: number
  list_price_cents: number
  compare_at_price_cents?: number
  currency?: string
  initial_stock?: number
}

export interface OfferFromCatalogRequest {
  catalog_item_id: string
  location_id: string
  internal_sku_prefix?: string
  variants: OfferFromCatalogVariantInput[]
}

/**
 * Catalog search proxy. Hits AT-Inv's GET /api/v1/catalog/search which
 * forwards to AT product-catalog. Single-origin call keeps CORS simple.
 */
export function searchCatalog(query?: string): Promise<CatalogSearchResponse> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : ""
  return request<CatalogSearchResponse>(`/api/v1/catalog/search${qs}`)
}

/**
 * Create an AT-Inv offer + initial stock from a catalog item.
 */
export function createOfferFromCatalog(body: OfferFromCatalogRequest): Promise<Product> {
  return request<Product>(`/api/v1/offers/from-catalog`, {
    method: "POST",
    body: JSON.stringify(body),
    idempotent: true,
  })
}

// ─── Phase 9.7 — catalog admin (proxied through AT-Inv backend) ────────────
//
// AT-Inv backend exposes /api/v1/catalog/items/* as a passthrough to
// AT product-catalog. The inventory web hosts the curation UI; the
// proxy keeps a single origin and reuses our Keycloak token.

export type CatalogItemStatus = "draft" | "published" | "suppressed"

export interface CatalogItemAdmin {
  id: string
  itemNumber: string
  title: string
  description: string
  brand?: string | null
  slug: string
  productType: string
  status: CatalogItemStatus
  tags: string[]
  highlights: string  // JSON-encoded array of strings
  metaTitle?: string | null
  metaDescription?: string | null
  submittedByStore?: string | null
  submittedAt?: string | null
  publishedAt?: string | null
  suppressedAt?: string | null
  createdAt: string
  updatedAt: string
  variants: CatalogItemVariantAdmin[]
  images: CatalogItemImageAdmin[]
  categoryIds: string[]
}

export interface CatalogItemVariantAdmin {
  id: string
  itemId: string
  variantSku: string
  gtin?: string | null
  name?: string | null
  attributeValues: string
  weightKg?: number | null
  dimensions?: string | null
  imageId?: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface CatalogItemImageAdmin {
  id: string
  itemId: string
  url: string
  altText?: string | null
  sortOrder: number
  isPrimary: boolean
  createdAt: string
}

export interface CatalogItemAdminPage {
  content: CatalogItemAdmin[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface CreateCatalogItemVariantBody {
  variantSku?: string
  gtin?: string
  name?: string
  attributeValues?: string
  weightKg?: number
  dimensions?: string
  isDefault?: boolean
}

export interface CreateCatalogItemBody {
  title: string
  description?: string
  brand?: string
  productType?: string
  tags?: string[]
  highlights?: string
  metaTitle?: string
  metaDescription?: string
  categoryIds?: string[]
  variants: CreateCatalogItemVariantBody[]
}

export interface UpdateCatalogItemBody {
  title?: string
  description?: string
  brand?: string
  productType?: string
  status?: CatalogItemStatus
  tags?: string[]
  highlights?: string
  metaTitle?: string
  metaDescription?: string
  categoryIds?: string[]
}

export interface CreateCatalogImageBody {
  url: string
  altText?: string
  sortOrder?: number
  isPrimary?: boolean
}

export const catalogAdmin = {
  list: (params: { q?: string; status?: string; page?: number; size?: number } = {}) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== "") sp.set(k, String(v))
    }
    const qs = sp.toString()
    return request<CatalogItemAdminPage>(`/api/v1/catalog/items${qs ? `?${qs}` : ""}`)
  },
  get: (id: string) => request<CatalogItemAdmin>(`/api/v1/catalog/items/${id}`),
  create: (body: CreateCatalogItemBody) =>
    request<CatalogItemAdmin>("/api/v1/catalog/items", {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),
  update: (id: string, body: UpdateCatalogItemBody) =>
    request<CatalogItemAdmin>(`/api/v1/catalog/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      idempotent: true,
    }),
  publish: (id: string) =>
    request<CatalogItemAdmin>(`/api/v1/catalog/items/${id}/publish`, {
      method: "POST",
      idempotent: true,
      body: "{}",
    }),
  suppress: (id: string) =>
    request<CatalogItemAdmin>(`/api/v1/catalog/items/${id}/suppress`, {
      method: "POST",
      idempotent: true,
      body: "{}",
    }),
  addVariant: (itemId: string, body: CreateCatalogItemVariantBody) =>
    request<CatalogItemVariantAdmin>(`/api/v1/catalog/items/${itemId}/variants`, {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),
  addImage: (itemId: string, body: CreateCatalogImageBody) =>
    request<CatalogItemImageAdmin>(`/api/v1/catalog/items/${itemId}/images`, {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),
  removeImage: (itemId: string, imageId: string) =>
    request<void>(`/api/v1/catalog/items/${itemId}/images/${imageId}`, {
      method: "DELETE",
      idempotent: true,
    }),
  reorderImages: (itemId: string, imageIds: string[]) =>
    request<void>(`/api/v1/catalog/items/${itemId}/images/reorder`, {
      method: "PUT",
      body: JSON.stringify({ imageIds }),
      idempotent: true,
    }),
}

// ─── Phase 8 — Returns ──────────────────────────────────────────────────────

export type ReturnStatus = "requested" | "received" | "processed" | "cancelled"
export type ReturnCondition = "new" | "opened" | "damaged" | "defective" | "unknown"
export type ReturnDisposition = "restock" | "scrap" | "refund_only"

export interface ReturnLineModel {
  id: string
  return_id: string
  variant_id: string
  variant_sku?: string
  product_title?: string
  location_id?: string | null
  quantity: number
  condition: ReturnCondition
  disposition?: ReturnDisposition | null
  refund_amount_cents?: number | null
  notes?: string
  created_at: string
}

export interface ReturnModel {
  id: string
  number: string
  external_order_id: string
  external_order_number?: string
  external_return_id?: string | null
  status: ReturnStatus
  reason?: string
  buyer_name?: string
  rma_url?: string
  notes?: string
  created_by?: string
  requested_at: string
  received_at?: string | null
  processed_at?: string | null
  processed_by?: string
  updated_at: string
  lines?: ReturnLineModel[]
}

export interface CreateReturnPayload {
  external_order_id: string
  external_order_number?: string
  external_return_id?: string
  reason?: string
  buyer_name?: string
  rma_url?: string
  notes?: string
  lines: Array<{
    variant_id: string
    quantity: number
    condition?: ReturnCondition
    notes?: string
  }>
}

export interface ProcessReturnPayload {
  lines: Array<{
    line_id: string
    disposition: ReturnDisposition
    condition?: ReturnCondition
    location_id?: string
    refund_amount_cents?: number
    notes?: string
  }>
  notes?: string
}

export const returnsApi = {
  list: (statuses?: ReturnStatus[], limit?: number) => {
    const sp = new URLSearchParams()
    if (statuses && statuses.length) sp.set("status", statuses.join(","))
    if (limit) sp.set("limit", String(limit))
    const qs = sp.toString()
    return request<ReturnModel[]>(`/api/v1/returns${qs ? `?${qs}` : ""}`)
  },
  get: (id: string) => request<ReturnModel>(`/api/v1/returns/${id}`),
  create: (body: CreateReturnPayload) =>
    request<ReturnModel>("/api/v1/returns", {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),
  markReceived: (id: string) =>
    request<ReturnModel>(`/api/v1/returns/${id}/receive`, {
      method: "POST",
      idempotent: true,
      body: "{}",
    }),
  process: (id: string, body: ProcessReturnPayload) =>
    request<ReturnModel>(`/api/v1/returns/${id}/process`, {
      method: "POST",
      body: JSON.stringify(body),
      idempotent: true,
    }),
  cancel: (id: string) =>
    request<ReturnModel>(`/api/v1/returns/${id}/cancel`, {
      method: "POST",
      idempotent: true,
      body: "{}",
    }),
}

// ─── Phase 9 — Notifications ───────────────────────────────────────────────
export interface NotificationModel {
  id: string
  user_id: string
  kind: string
  title: string
  body?: string
  link_href?: string
  read_at?: string | null
  created_at: string
}

export const notificationsApi = {
  list: (unreadOnly = false, limit = 20) =>
    request<NotificationModel[]>(
      `/api/v1/notifications?unread_only=${unreadOnly}&limit=${limit}`,
    ),
  unreadCount: () =>
    request<{ count: number }>(`/api/v1/notifications/unread-count`),
  markRead: (id: string) =>
    request<void>(`/api/v1/notifications/${id}/read`, {
      method: "POST",
      idempotent: true,
      body: "{}",
    }),
  markAllRead: () =>
    request<{ updated: number }>(`/api/v1/notifications/read-all`, {
      method: "POST",
      idempotent: true,
      body: "{}",
    }),
}
