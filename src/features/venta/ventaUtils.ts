/**
 * Venta pure utilities — error parsing, totals, formatting, ticket text.
 */
import type { SaleLine } from '@/stores/saleDraft'
import { formatPrice } from '@/features/catalogo/catalogoUtils'
import type { MedioPago, ParsedRpcError, Venta } from './ventaTypes'

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const STOCK_REGEX = /stock insuficiente.*\(hay\s+(\d+),\s+pide\s+(\d+)\)/i

/**
 * Parse a Supabase RPC error message into a typed, discriminated error.
 */
export function parseRpcError(message: string): ParsedRpcError {
  const normalized = message.trim().toLowerCase()

  if (normalized.startsWith('stock insuficiente')) {
    const uuidMatch = message.match(UUID_REGEX)
    const qtyMatch = message.match(STOCK_REGEX)
    if (uuidMatch && qtyMatch) {
      return {
        kind: 'stock_insuficiente',
        productId: uuidMatch[0],
        available: Number(qtyMatch[1]),
        requested: Number(qtyMatch[2]),
      }
    }
  }

  if (normalized.startsWith('solo se puede deshacer')) {
    return { kind: 'not_last_sale' }
  }

  if (normalized.startsWith('la venta no está confirmada')) {
    return { kind: 'not_confirmed' }
  }

  if (normalized === 'usuario inactivo' || normalized === 'no autenticado') {
    return { kind: 'usuario_inactivo' }
  }

  return { kind: 'unknown', message }
}

/**
 * Compute the total for a sale draft from its lines.
 */
export function draftTotal(lines: SaleLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
}

/**
 * Build a short, human-readable reference from a UUID.
 */
export function shortRef(uuid: string): string {
  return uuid.slice(0, 8)
}

/**
 * Format a ticket date for display in Chilean Spanish.
 */
export function formatTicketDate(iso: string): string {
  const formatter = new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  return formatter.format(new Date(iso))
}

export const MEDIO_PAGO_LABELS: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transfer',
  debito: 'Débito',
  credito: 'Crédito',
}

/**
 * Build a plain-text ticket message suitable for WhatsApp sharing.
 */
export function buildWhatsAppText(v: Venta, store: string, seller?: string): string {
  const header = [store, formatTicketDate(v.created_at), `Ticket #${shortRef(v.id)}`]
    .filter(Boolean)
    .join('\n')

  const sellerLine = seller ? `Atiende: ${seller}` : ''

  const itemLines = v.items
    .map((item) => {
      const subtotal = item.cantidad * item.precio_unitario
      return `${item.nombre}\n${item.cantidad} × ${formatPrice(item.precio_unitario)} = ${formatPrice(subtotal)}`
    })
    .join('\n---\n')

  const footer = [
    '---',
    `TOTAL ${formatPrice(v.total)}`,
    MEDIO_PAGO_LABELS[v.medio_pago],
    '¡Gracias por tu compra!',
  ].join('\n')

  return [header, sellerLine, itemLines, footer].filter(Boolean).join('\n')
}
