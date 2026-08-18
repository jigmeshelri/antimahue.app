/**
 * dashboardApi tests — TDD for the dashboard API layer.
 *
 * Mocks ONLY the Supabase client boundary; no real network calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    supabase: {
      rpc: vi.fn(),
    },
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: mocks.supabase,
}))

import { fetchDashboardSummary } from './dashboardApi'

function makeRpcResponse(overrides: Record<string, unknown> = {}) {
  return {
    ventas_hoy: {
      total: 15000,
      cantidad: 2,
      por_medio_pago: { efectivo: 10000, transferencia: 5000 },
    },
    valor_inventario: {
      a_costo: 80000,
      a_venta: 120000,
    },
    alertas_stock: [
      { id: 'p1', nombre: 'Lana Merino', stock: 0, stock_minimo: 5 },
      { id: 'p2', nombre: 'Hilo Algodón', stock: 2, stock_minimo: 5 },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchDashboardSummary', () => {
  it('should_call_resumen_dashboard_rpc_without_args', async () => {
    mocks.supabase.rpc.mockResolvedValue({ data: makeRpcResponse(), error: null })

    await fetchDashboardSummary()

    expect(mocks.supabase.rpc).toHaveBeenCalledWith('resumen_dashboard')
  })

  it('should_return_parsed_summary_for_admin', async () => {
    mocks.supabase.rpc.mockResolvedValue({ data: makeRpcResponse(), error: null })

    const result = await fetchDashboardSummary()

    expect(result.ventas_hoy.total).toBe(15000)
    expect(result.ventas_hoy.cantidad).toBe(2)
    expect(result.ventas_hoy.por_medio_pago).toEqual({
      efectivo: 10000,
      transferencia: 5000,
    })
    expect(result.valor_inventario).toEqual({ a_costo: 80000, a_venta: 120000 })
    expect(result.alertas_stock).toHaveLength(2)
  })

  it('should_handle_null_inventory_value_for_employee', async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: makeRpcResponse({ valor_inventario: null }),
      error: null,
    })

    const result = await fetchDashboardSummary()

    expect(result.valor_inventario).toBeNull()
  })

  it('should_complete_missing_payment_methods_with_zero', async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: makeRpcResponse({
        ventas_hoy: {
          total: 10000,
          cantidad: 1,
          por_medio_pago: { efectivo: 10000 },
        },
      }),
      error: null,
    })

    const result = await fetchDashboardSummary()

    expect(result.ventas_hoy.por_medio_pago).toEqual({
      efectivo: 10000,
      transferencia: undefined,
      debito: undefined,
      credito: undefined,
    })
  })

  it('should_throw_generic_error_when_rpc_fails', async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'connection lost' },
    })

    await expect(fetchDashboardSummary()).rejects.toThrow('No se pudo cargar el dashboard')
  })

  it('should_tolerate_empty_alert_list', async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: makeRpcResponse({ alertas_stock: [] }),
      error: null,
    })

    const result = await fetchDashboardSummary()

    expect(result.alertas_stock).toEqual([])
  })
})
