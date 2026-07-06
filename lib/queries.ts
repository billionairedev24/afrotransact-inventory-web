"use client"

/**
 * Typed TanStack Query hooks for every inventory endpoint.
 *
 * Convention: every mutation invalidates the queries whose data it can
 * have changed. Anyone touching this file should add invalidations in
 * the same commit as the mutation — stale list views are the #1
 * complaint with hand-rolled mutations.
 */

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  api,
  isApiError,
  type ApiError,
  type ImageRequest,
  type ProductImage,
  type AuditEvent,
  type CycleCount,
  type CycleCountRequestPayload,
  type CycleCountStatus,
  type Movement,
  type PickTask,
  type PickTaskState,
  type POStatus,
  type Product,
  type PurchaseOrder,
  type PORequestPayload,
  type ReceiveRequestPayload,
  type RecordCountPayload,
  type StockAdjustment,
  type StockTransfer,
  type StockLevel,
  type StockValuationRow,
  type Variant,
} from "./api"

// ─── Query keys (string-namespaced) ────────────────────────────────────────

export const keys = {
  products:           () => ["products"] as const,
  product:            (id: string) => ["products", id] as const,
  stock:              () => ["stock"] as const,
  pickTasks:          (states?: PickTaskState[]) => ["pick-tasks", states ?? "all"] as const,
  pickTask:           (id: string) => ["pick-tasks", id] as const,
  purchaseOrders:     (statuses?: POStatus[]) => ["purchase-orders", statuses ?? "all"] as const,
  purchaseOrder:      (id: string) => ["purchase-orders", id] as const,
  cycleCounts:        (statuses?: CycleCountStatus[]) => ["cycle-counts", statuses ?? "all"] as const,
  cycleCount:         (id: string) => ["cycle-counts", id] as const,
  valuation:          (locationId?: string) => ["reports", "valuation", locationId ?? "all"] as const,
  movements:          (params: Record<string, string | number | undefined>) => ["reports", "movements", params] as const,
  audit:              (params: Record<string, string | number | undefined>) => ["reports", "audit", params] as const,
}

// ─── Products ──────────────────────────────────────────────────────────────

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: keys.products(),
    queryFn: api.listProducts,
  })
}

export function useProduct(id: string | undefined) {
  return useQuery<Product>({
    queryKey: keys.product(id ?? ""),
    queryFn: () => api.getProduct(id!),
    enabled: Boolean(id),
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation<Product, ApiError, Partial<Product>>({
    mutationFn: api.createProduct,
    onSuccess: (p) => {
      toast.success(`Created ${p.title}`)
      void qc.invalidateQueries({ queryKey: keys.products() })
    },
    onError: toastError("Could not create product"),
  })
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient()
  return useMutation<Product, ApiError, Partial<Product>>({
    mutationFn: (body) => api.updateProduct(id, body),
    onSuccess: () => {
      toast.success("Product updated")
      void qc.invalidateQueries({ queryKey: keys.product(id) })
      void qc.invalidateQueries({ queryKey: keys.products() })
    },
    onError: toastError("Could not update product"),
  })
}

export function useAddVariant(productId: string) {
  const qc = useQueryClient()
  return useMutation<Variant, ApiError, Partial<Variant>>({
    mutationFn: (body) => api.addVariant(productId, body),
    onSuccess: () => {
      toast.success("Variant added")
      void qc.invalidateQueries({ queryKey: keys.product(productId) })
      void qc.invalidateQueries({ queryKey: keys.stock() })
    },
    onError: toastError("Could not add variant"),
  })
}

export function useProductImageActions(productId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.product(productId) })
  return {
    add: useMutation<ProductImage, ApiError, ImageRequest>({
      mutationFn: (body) => api.addImage(productId, body),
      onSuccess: () => { toast.success("Image added"); invalidate() },
      onError: toastError("Could not add image"),
    }),
    remove: useMutation<void, ApiError, string>({
      mutationFn: (imageId) => api.removeImage(productId, imageId),
      onSuccess: () => { toast.success("Image removed"); invalidate() },
      onError: toastError("Could not remove image"),
    }),
    reorder: useMutation<void, ApiError, string[]>({
      mutationFn: (imageIds) => api.reorderImages(productId, imageIds),
      onSuccess: () => invalidate(),
      onError: toastError("Could not reorder images"),
    }),
  }
}

// ─── Stock ──────────────────────────────────────────────────────────────────

export function useStock() {
  return useQuery<StockLevel[]>({
    queryKey: keys.stock(),
    queryFn: api.listStock,
  })
}

export function useAdjustStock() {
  const qc = useQueryClient()
  return useMutation<void, ApiError, StockAdjustment>({
    mutationFn: api.adjustStock,
    onSuccess: () => {
      toast.success("Stock adjusted")
      void qc.invalidateQueries({ queryKey: keys.stock() })
    },
    onError: toastError("Could not adjust stock"),
  })
}

export function useTransferStock() {
  const qc = useQueryClient()
  return useMutation<void, ApiError, StockTransfer>({
    mutationFn: api.transferStock,
    onSuccess: () => {
      toast.success("Stock transferred")
      void qc.invalidateQueries({ queryKey: keys.stock() })
    },
    onError: toastError("Could not transfer stock"),
  })
}

// ─── Pick tasks ─────────────────────────────────────────────────────────────

export function usePickTasks(states?: PickTaskState[], limit?: number) {
  return useQuery<PickTask[]>({
    queryKey: keys.pickTasks(states),
    queryFn: () => api.listPickTasks(states, limit),
    refetchInterval: 15_000, // queue is operational; keep it warm
  })
}

export function usePickTask(id: string | undefined) {
  return useQuery<PickTask>({
    queryKey: keys.pickTask(id ?? ""),
    queryFn: () => api.getPickTask(id!),
    enabled: Boolean(id),
  })
}

export function usePickTaskTransition(id: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.pickTask(id) })
    void qc.invalidateQueries({ queryKey: ["pick-tasks"] })
    void qc.invalidateQueries({ queryKey: keys.stock() })
  }

  // Optimistic state flip on the detail query. We snapshot the current
  // PickTask, patch the state, return the snapshot as context. If the
  // mutation fails we restore from snapshot in onError. onSettled invalidates
  // so the server's authoritative view replaces the local guess.
  function optimisticState(nextState: PickTaskState) {
    return {
      onMutate: async () => {
        await qc.cancelQueries({ queryKey: keys.pickTask(id) })
        const prev = qc.getQueryData<PickTask>(keys.pickTask(id))
        if (prev) qc.setQueryData<PickTask>(keys.pickTask(id), { ...prev, state: nextState })
        return { prev }
      },
      onError: (_err: ApiError, _vars: unknown, ctx?: { prev?: PickTask }) => {
        if (ctx?.prev) qc.setQueryData(keys.pickTask(id), ctx.prev)
      },
      onSettled: () => invalidate(),
    }
  }

  return {
    startPicking: useMutation<PickTask, ApiError, void, { prev?: PickTask }>({
      mutationKey: ["pick-task", id, "start"],
      mutationFn: () => api.startPicking(id),
      ...optimisticState("picking"),
      onSuccess: () => toast.success("Picking started"),
    }),
    markPacked: useMutation<PickTask, ApiError, void, { prev?: PickTask }>({
      mutationKey: ["pick-task", id, "pack"],
      mutationFn: () => api.markPacked(id),
      ...optimisticState("packed"),
      onSuccess: () => toast.success("Marked as packed"),
    }),
    ship: useMutation<PickTask, ApiError, { carrier?: string; tracking_number?: string; label_url?: string }, { prev?: PickTask }>({
      mutationKey: ["pick-task", id, "ship"],
      mutationFn: (body) => api.ship(id, body),
      ...optimisticState("shipped"),
      onSuccess: () => toast.success("Shipment recorded"),
    }),
    cancel: useMutation<void, ApiError, void, { prev?: PickTask }>({
      mutationKey: ["pick-task", id, "cancel"],
      mutationFn: () => api.cancel(id),
      ...optimisticState("cancelled"),
      onSuccess: () => toast.success("Pick task cancelled"),
    }),
  }
}

// ─── Purchase orders ────────────────────────────────────────────────────────

export function usePurchaseOrders(statuses?: POStatus[], limit?: number) {
  return useQuery<PurchaseOrder[]>({
    queryKey: keys.purchaseOrders(statuses),
    queryFn: () => api.listPOs(statuses, limit),
  })
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery<PurchaseOrder>({
    queryKey: keys.purchaseOrder(id ?? ""),
    queryFn: () => api.getPO(id!),
    enabled: Boolean(id),
  })
}

export function useCreatePO() {
  const qc = useQueryClient()
  return useMutation<PurchaseOrder, ApiError, PORequestPayload>({
    mutationFn: api.createPO,
    onSuccess: (po) => {
      toast.success(`Created ${po.number}`)
      void qc.invalidateQueries({ queryKey: ["purchase-orders"] })
    },
    onError: toastError("Could not create PO"),
  })
}

export function usePOTransition(id: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.purchaseOrder(id) })
    void qc.invalidateQueries({ queryKey: ["purchase-orders"] })
    void qc.invalidateQueries({ queryKey: keys.stock() })
    void qc.invalidateQueries({ queryKey: ["notifications"] })
  }
  return {
    submit: useMutation<PurchaseOrder, ApiError>({
      mutationKey: ["po", id, "submit"],
      mutationFn: () => api.submitPO(id),
      onSuccess: (po) => {
        toast.success(po.status === "ordered" ? "PO sent to supplier" : "Submitted for approval")
        invalidate()
      },
      onError: toastError("Could not submit PO"),
    }),
    approve: useMutation<PurchaseOrder, ApiError>({
      mutationKey: ["po", id, "approve"],
      mutationFn: () => api.approvePO(id),
      onSuccess: () => { toast.success("PO approved and sent to supplier"); invalidate() },
      onError: toastError("Could not approve PO"),
    }),
    cancel: useMutation<PurchaseOrder, ApiError>({
      mutationFn: () => api.cancelPO(id),
      onSuccess: () => { toast.success("PO cancelled"); invalidate() },
      onError: toastError("Could not cancel PO"),
    }),
    receive: useMutation<PurchaseOrder, ApiError, ReceiveRequestPayload>({
      mutationFn: (body) => api.receivePO(id, body),
      onSuccess: () => { toast.success("Receipt recorded"); invalidate() },
      onError: toastError("Could not record receipt"),
    }),
  }
}

// ─── Cycle counts ───────────────────────────────────────────────────────────

export function useCycleCounts(statuses?: CycleCountStatus[], limit?: number) {
  return useQuery<CycleCount[]>({
    queryKey: keys.cycleCounts(statuses),
    queryFn: () => api.listCycleCounts(statuses, limit),
  })
}

export function useCycleCount(id: string | undefined) {
  return useQuery<CycleCount>({
    queryKey: keys.cycleCount(id ?? ""),
    queryFn: () => api.getCycleCount(id!),
    enabled: Boolean(id),
  })
}

export function useCreateCycleCount() {
  const qc = useQueryClient()
  return useMutation<CycleCount, ApiError, CycleCountRequestPayload>({
    mutationFn: api.createCycleCount,
    onSuccess: () => {
      toast.success("Cycle count opened")
      void qc.invalidateQueries({ queryKey: ["cycle-counts"] })
    },
    onError: toastError("Could not open cycle count"),
  })
}

export function useCycleCountActions(id: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.cycleCount(id) })
    void qc.invalidateQueries({ queryKey: ["cycle-counts"] })
    void qc.invalidateQueries({ queryKey: keys.stock() })
  }
  return {
    record: useMutation<CycleCount, ApiError, RecordCountPayload>({
      mutationFn: (body) => api.recordCounts(id, body),
      onSuccess: () => { toast.success("Counts saved"); invalidate() },
      onError: toastError("Could not save counts"),
    }),
    close: useMutation<CycleCount, ApiError>({
      mutationFn: () => api.closeCycleCount(id),
      onSuccess: () => { toast.success("Count closed; variances posted"); invalidate() },
      onError: toastError("Could not close count"),
    }),
    cancel: useMutation<CycleCount, ApiError>({
      mutationFn: () => api.cancelCycleCount(id),
      onSuccess: () => { toast.success("Count cancelled"); invalidate() },
      onError: toastError("Could not cancel count"),
    }),
  }
}

// ─── Reports ────────────────────────────────────────────────────────────────

export function useStockValuation(locationId?: string) {
  return useQuery<StockValuationRow[]>({
    queryKey: keys.valuation(locationId),
    queryFn: () => api.stockValuation(locationId),
  })
}

export function useMovements(params: { from?: string; to?: string; variant_id?: string; location_id?: string; limit?: number }) {
  return useQuery<Movement[]>({
    queryKey: keys.movements(params as Record<string, string | number | undefined>),
    queryFn: () => api.movements(params),
  })
}

export function useAuditFeed(params: { entity_type?: string; entity_id?: string; from?: string; limit?: number }) {
  return useQuery<AuditEvent[]>({
    queryKey: keys.audit(params as Record<string, string | number | undefined>),
    queryFn: () => api.auditFeed(params),
  })
}

// ─── Phase 9.5 — catalog search + offer-from-catalog ──────────────────────

import {
  createOfferFromCatalog,
  searchCatalog,
  type CatalogSearchResponse,
  type OfferFromCatalogRequest,
} from "./api"

export function useCatalogSearch(query: string) {
  return useQuery<CatalogSearchResponse>({
    queryKey: ["catalog", "search", query],
    queryFn: () => searchCatalog(query),
    staleTime: 30_000,
  })
}

export function useCreateOfferFromCatalog() {
  const qc = useQueryClient()
  return useMutation<Product, ApiError, OfferFromCatalogRequest>({
    mutationFn: createOfferFromCatalog,
    onSuccess: (p) => {
      toast.success(`Created offer for ${p.title}`)
      void qc.invalidateQueries({ queryKey: keys.products() })
      void qc.invalidateQueries({ queryKey: keys.stock() })
    },
    onError: toastError("Could not create offer"),
  })
}

// ─── Error helper ───────────────────────────────────────────────────────────

function toastError(prefix: string) {
  return (e: unknown) => {
    const detail = isApiError(e) ? e.detail || e.code : (e as Error).message
    toast.error(`${prefix}: ${detail}`)
  }
}

// ─── Phase 9.7 — catalog admin hooks ───────────────────────────────────────

import {
  catalogAdmin,
  type CatalogItemAdmin,
  type CatalogItemAdminPage,
  type CatalogItemImageAdmin,
  type CatalogItemStatus,
  type CatalogItemVariantAdmin,
  type CreateCatalogImageBody,
  type CreateCatalogItemBody,
  type CreateCatalogItemVariantBody,
  type UpdateCatalogItemBody,
} from "./api"

const catalogKeys = {
  list: (params: { q?: string; status?: string; page?: number; size?: number }) =>
    ["catalog-admin", "list", params] as const,
  item: (id: string) => ["catalog-admin", "item", id] as const,
}

export function useCatalogAdminList(params: { q?: string; status?: string; page?: number; size?: number }) {
  return useQuery<CatalogItemAdminPage>({
    queryKey: catalogKeys.list(params),
    queryFn: () => catalogAdmin.list(params),
    placeholderData: (prev) => prev,
  })
}

export function useCatalogAdminItem(id: string | undefined) {
  return useQuery<CatalogItemAdmin>({
    queryKey: catalogKeys.item(id ?? ""),
    queryFn: () => catalogAdmin.get(id!),
    enabled: Boolean(id),
  })
}

export function useCreateCatalogItem() {
  const qc = useQueryClient()
  return useMutation<CatalogItemAdmin, ApiError, CreateCatalogItemBody>({
    mutationFn: catalogAdmin.create,
    onSuccess: (item) => {
      toast.success(`Created ${item.itemNumber}`)
      void qc.invalidateQueries({ queryKey: ["catalog-admin"] })
    },
    onError: toastError("Could not create catalog item"),
  })
}

export function useCatalogItemActions(id: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: catalogKeys.item(id) })
    void qc.invalidateQueries({ queryKey: ["catalog-admin"] })
  }

  function optimisticStatus(nextStatus: CatalogItemStatus) {
    return {
      onMutate: async () => {
        await qc.cancelQueries({ queryKey: catalogKeys.item(id) })
        const prev = qc.getQueryData<CatalogItemAdmin>(catalogKeys.item(id))
        if (prev) qc.setQueryData<CatalogItemAdmin>(catalogKeys.item(id), { ...prev, status: nextStatus })
        return { prev }
      },
      onError: (_err: ApiError, _vars: unknown, ctx?: { prev?: CatalogItemAdmin }) => {
        if (ctx?.prev) qc.setQueryData(catalogKeys.item(id), ctx.prev)
      },
      onSettled: () => invalidate(),
    }
  }

  return {
    update: useMutation<CatalogItemAdmin, ApiError, UpdateCatalogItemBody>({
      mutationKey: ["catalog-item", id, "update"],
      mutationFn: (body) => catalogAdmin.update(id, body),
      onSuccess: () => { toast.success("Saved"); invalidate() },
      onError: toastError("Could not save"),
    }),
    publish: useMutation<CatalogItemAdmin, ApiError, void, { prev?: CatalogItemAdmin }>({
      mutationKey: ["catalog-item", id, "publish"],
      mutationFn: () => catalogAdmin.publish(id),
      ...optimisticStatus("published"),
      onSuccess: () => toast.success("Published"),
    }),
    suppress: useMutation<CatalogItemAdmin, ApiError, void, { prev?: CatalogItemAdmin }>({
      mutationKey: ["catalog-item", id, "suppress"],
      mutationFn: () => catalogAdmin.suppress(id),
      ...optimisticStatus("suppressed"),
      onSuccess: () => toast.success("Suppressed"),
    }),
    addVariant: useMutation<CatalogItemVariantAdmin, ApiError, CreateCatalogItemVariantBody>({
      mutationFn: (body) => catalogAdmin.addVariant(id, body),
      onSuccess: () => { toast.success("Variant added"); invalidate() },
      onError: toastError("Add variant failed"),
    }),
    addImage: useMutation<CatalogItemImageAdmin, ApiError, CreateCatalogImageBody>({
      mutationFn: (body) => catalogAdmin.addImage(id, body),
      onSuccess: () => { toast.success("Image added"); invalidate() },
      onError: toastError("Add image failed"),
    }),
    removeImage: useMutation<void, ApiError, string>({
      mutationFn: (imageId) => catalogAdmin.removeImage(id, imageId),
      onSuccess: () => { toast.success("Image removed"); invalidate() },
      onError: toastError("Remove failed"),
    }),
  }
}

export type { CatalogItemStatus }

// ─── Phase 8 — Returns hooks ───────────────────────────────────────────────

import {
  returnsApi,
  type CreateReturnPayload,
  type ProcessReturnPayload,
  type ReturnModel,
  type ReturnStatus,
} from "./api"

const returnsKeys = {
  list: (statuses?: ReturnStatus[]) => ["returns", "list", statuses ?? "all"] as const,
  one: (id: string) => ["returns", id] as const,
}

export function useReturns(statuses?: ReturnStatus[], limit?: number) {
  return useQuery<ReturnModel[]>({
    queryKey: returnsKeys.list(statuses),
    queryFn: () => returnsApi.list(statuses, limit),
  })
}

export function useReturn(id: string | undefined) {
  return useQuery<ReturnModel>({
    queryKey: returnsKeys.one(id ?? ""),
    queryFn: () => returnsApi.get(id!),
    enabled: Boolean(id),
  })
}

export function useCreateReturn() {
  const qc = useQueryClient()
  return useMutation<ReturnModel, ApiError, CreateReturnPayload>({
    mutationFn: returnsApi.create,
    onSuccess: (r) => {
      toast.success(`Opened ${r.number}`)
      void qc.invalidateQueries({ queryKey: ["returns"] })
    },
    onError: toastError("Could not open return"),
  })
}

export function useReturnActions(id: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: returnsKeys.one(id) })
    void qc.invalidateQueries({ queryKey: ["returns"] })
    void qc.invalidateQueries({ queryKey: keys.stock() })
  }

  function optimisticStatus(nextStatus: ReturnStatus) {
    return {
      onMutate: async () => {
        await qc.cancelQueries({ queryKey: returnsKeys.one(id) })
        const prev = qc.getQueryData<ReturnModel>(returnsKeys.one(id))
        if (prev) qc.setQueryData<ReturnModel>(returnsKeys.one(id), { ...prev, status: nextStatus })
        return { prev }
      },
      onError: (_err: ApiError, _vars: unknown, ctx?: { prev?: ReturnModel }) => {
        if (ctx?.prev) qc.setQueryData(returnsKeys.one(id), ctx.prev)
      },
      onSettled: () => invalidate(),
    }
  }

  return {
    markReceived: useMutation<ReturnModel, ApiError, void, { prev?: ReturnModel }>({
      mutationKey: ["return", id, "received"],
      mutationFn: () => returnsApi.markReceived(id),
      ...optimisticStatus("received"),
      onSuccess: () => toast.success("Marked received"),
    }),
    process: useMutation<ReturnModel, ApiError, ProcessReturnPayload, { prev?: ReturnModel }>({
      mutationKey: ["return", id, "process"],
      mutationFn: (body) => returnsApi.process(id, body),
      ...optimisticStatus("processed"),
      onSuccess: () => toast.success("Return processed"),
    }),
    cancel: useMutation<ReturnModel, ApiError, void, { prev?: ReturnModel }>({
      mutationKey: ["return", id, "cancel"],
      mutationFn: () => returnsApi.cancel(id),
      ...optimisticStatus("cancelled"),
      onSuccess: () => toast.success("Return cancelled"),
    }),
  }
}

// ─── Dashboard composite ───────────────────────────────────────────────────
//
// Fans five list queries out in parallel via `useQueries` so the dashboard
// hero stats render in one round-trip. Each cell can resolve independently;
// the consumer reads `isLoading` (any pending) and individual slices off
// the returned object.

export interface DashboardSnapshot {
  products: Product[]
  stock: StockLevel[]
  openPicks: PickTask[]
  openPOs: PurchaseOrder[]
  openReturns: ReturnModel[]
  openCycleCounts: CycleCount[]
  movements: Movement[]
  isLoading: boolean
  isError: boolean
}

export function useDashboard(): DashboardSnapshot {
  // 7-day window so the sparkline has data even on a quiet afternoon.
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const results = useQueries({
    queries: [
      { queryKey: keys.products(),                              queryFn: api.listProducts,                                                   staleTime: 60_000 },
      { queryKey: keys.stock(),                                 queryFn: api.listStock,                                                       staleTime: 30_000 },
      { queryKey: keys.pickTasks(["new", "picking", "packed"]), queryFn: () => api.listPickTasks(["new", "picking", "packed"], 50),           staleTime: 15_000, refetchInterval: 15_000 },
      { queryKey: keys.purchaseOrders(["ordered", "partially_received"]), queryFn: () => api.listPOs(["ordered", "partially_received"], 50),  staleTime: 30_000 },
      { queryKey: returnsKeys.list(["requested", "received"]),  queryFn: () => returnsApi.list(["requested", "received"], 50),                staleTime: 30_000 },
      { queryKey: keys.cycleCounts(["open"]),                   queryFn: () => api.listCycleCounts(["open"], 50),                             staleTime: 30_000 },
      { queryKey: keys.movements({ from: since, limit: 500 }),  queryFn: () => api.movements({ from: since, limit: 500 }),                    staleTime: 60_000 },
    ],
  })
  const [products, stock, openPicks, openPOs, openReturns, openCycleCounts, movements] = results
  return {
    products:         (products.data as Product[]) ?? [],
    stock:            (stock.data as StockLevel[]) ?? [],
    openPicks:        (openPicks.data as PickTask[]) ?? [],
    openPOs:          (openPOs.data as PurchaseOrder[]) ?? [],
    openReturns:      (openReturns.data as ReturnModel[]) ?? [],
    openCycleCounts:  (openCycleCounts.data as CycleCount[]) ?? [],
    movements:        (movements.data as Movement[]) ?? [],
    isLoading:        results.some((r) => r.isLoading),
    isError:          results.some((r) => r.isError),
  }
}

// ─── Phase 9 — Notifications ───────────────────────────────────────────────

import {
  notificationsApi,
  type NotificationModel,
} from "./api"

const notifKeys = {
  list:        (unreadOnly: boolean) => ["notifications", "list", unreadOnly] as const,
  unreadCount: () => ["notifications", "unread-count"] as const,
}

/** Poll the unread count every 30s so the bell badge stays warm without
 *  webhooks/SSE. Cheap COUNT query on an indexed (user_id, read_at IS NULL). */
export function useUnreadNotificationCount() {
  return useQuery<{ count: number }>({
    queryKey: notifKeys.unreadCount(),
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

export function useNotifications(unreadOnly = false) {
  return useQuery<NotificationModel[]>({
    queryKey: notifKeys.list(unreadOnly),
    queryFn: () => notificationsApi.list(unreadOnly, 20),
    refetchInterval: 30_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation<void, ApiError, string>({
    mutationFn: notificationsApi.markRead,
    onMutate: async (id) => {
      // Optimistic: flip read_at locally so the badge drops immediately.
      await qc.cancelQueries({ queryKey: ["notifications"] })
      const prevLists = qc.getQueriesData<NotificationModel[]>({ queryKey: ["notifications", "list"] })
      const prevCount = qc.getQueryData<{ count: number }>(notifKeys.unreadCount())
      for (const [key, list] of prevLists) {
        if (!list) continue
        qc.setQueryData<NotificationModel[]>(key, list.map((n) =>
          n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n
        ))
      }
      if (prevCount) {
        qc.setQueryData(notifKeys.unreadCount(), { count: Math.max(0, prevCount.count - 1) })
      }
      return { prevLists, prevCount }
    },
    onError: (_e, _id, ctx) => {
      const c = ctx as { prevLists?: [readonly unknown[], NotificationModel[] | undefined][]; prevCount?: { count: number } } | undefined
      if (c?.prevLists) for (const [key, val] of c.prevLists) qc.setQueryData(key, val)
      if (c?.prevCount) qc.setQueryData(notifKeys.unreadCount(), c.prevCount)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation<{ updated: number }, ApiError>({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.setQueryData(notifKeys.unreadCount(), { count: 0 })
      void qc.invalidateQueries({ queryKey: ["notifications"] })
    },
    onError: toastError("Could not mark all read"),
  })
}
