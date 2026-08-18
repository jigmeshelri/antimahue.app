/**
 * Dashboard pure utilities.
 */
import type { AlertLevel, MedioPago, StockAlert } from './dashboardTypes'

/**
 * Classify a stock alert as 'agotado' (zero stock) or 'bajo' (positive but
 * at or below the effective minimum).
 */
export function classifyAlert(alert: StockAlert): AlertLevel {
  if (alert.stock === 0) return 'agotado'
  return 'bajo'
}

/**
 * Fill in the four payment methods, defaulting missing ones to zero so the
 * breakdown UI always has four columns.
 */
export function completePaymentBreakdown(
  porMedioPago: Partial<Record<MedioPago, number>>
): Record<MedioPago, number> {
  const medios: MedioPago[] = ['efectivo', 'transferencia', 'debito', 'credito']
  const result: Record<MedioPago, number> = {
    efectivo: 0,
    transferencia: 0,
    debito: 0,
    credito: 0,
  }
  for (const medio of medios) {
    const value = porMedioPago[medio]
    if (typeof value === 'number') {
      result[medio] = value
    }
  }
  return result
}

/**
 * Return a time-of-day greeting in Spanish.
 */
export function greetingForHour(date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour >= 6 && hour < 12) return 'Buenos días'
  if (hour >= 12 && hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}
