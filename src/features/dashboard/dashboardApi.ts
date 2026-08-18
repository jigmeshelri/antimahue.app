/**
 * Dashboard API layer — wraps the `resumen_dashboard()` RPC.
 *
 * The RPC returns everything in one call and enforces role-based cost hiding
 * server-side (REQ-DASH-1/D2). This module only parses the JSON shape.
 */
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { DashboardSummary, MedioPago, StockAlert } from './dashboardTypes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function parseNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback
}

function parseString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function parsePaymentBreakdown(value: unknown): Partial<Record<MedioPago, number>> {
  const data = asRecord(value)
  if (!data) return {}

  const result: Partial<Record<MedioPago, number>> = {}
  const medios: MedioPago[] = ['efectivo', 'transferencia', 'debito', 'credito']
  for (const medio of medios) {
    const v = data[medio]
    if (typeof v === 'number') {
      result[medio] = v
    }
  }
  return result
}

function parseStockAlert(value: unknown): StockAlert {
  const data = asRecord(value) ?? {}
  return {
    id: parseString(data.id),
    nombre: parseString(data.nombre),
    stock: parseNumber(data.stock),
    stock_minimo: parseNumber(data.stock_minimo),
  }
}

function parseDashboardSummary(raw: Json): DashboardSummary {
  const data = asRecord(raw) ?? {}
  const ventasHoy = asRecord(data.ventas_hoy) ?? {}
  const valorInvRaw = data.valor_inventario
  const valorInv = valorInvRaw === null ? null : asRecord(valorInvRaw)
  const alertasRaw = Array.isArray(data.alertas_stock) ? data.alertas_stock : []

  return {
    ventas_hoy: {
      total: parseNumber(ventasHoy.total),
      cantidad: parseNumber(ventasHoy.cantidad),
      por_medio_pago: parsePaymentBreakdown(ventasHoy.por_medio_pago),
    },
    valor_inventario: valorInv
      ? {
          a_costo: parseNumber(valorInv.a_costo),
          a_venta: parseNumber(valorInv.a_venta),
        }
      : null,
    alertas_stock: alertasRaw.map(parseStockAlert),
  }
}

/**
 * Fetch the full dashboard summary from the backend.
 */
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc('resumen_dashboard')

  if (error) {
    throw new Error('No se pudo cargar el dashboard')
  }

  return parseDashboardSummary(data as Json)
}
