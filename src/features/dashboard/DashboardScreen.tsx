/**
 * DashboardScreen — main home screen for Antimahue.
 *
 * Shows today's sales, inventory value, low-stock alerts and quick search.
 * Cost data is hidden server-side for non-admin users (REQ-DASH-6).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useStore } from '@nanostores/react'
import {
  ArchiveBoxIcon,
  ArrowsClockwiseIcon,
  CurrencyDollarIcon,
  TrendUpIcon,
} from '@phosphor-icons/react'
import BottomNav from '@/components/organisms/BottomNav'
import { formatPrice } from '@/features/catalogo/catalogoUtils'
import { $auth } from '@/stores/auth'
import { showToast } from '@/stores/ui'
import { fetchDashboardSummary } from './dashboardApi'
import { completePaymentBreakdown } from './dashboardUtils'
import type { DashboardSummary } from './dashboardTypes'
import {
  AlertStrip,
  DashboardHeader,
  PaymentBreakdown,
  QuickSearch,
  StatCard,
  StockAlertList,
} from './components'

function deriveUserName(auth: ReturnType<typeof $auth.get>): string {
  const displayName = auth.user?.user_metadata?.display_name
  if (typeof displayName === 'string' && displayName.trim()) {
    return displayName
  }
  const email = auth.user?.email
  if (email) {
    return email.split('@')[0]
  }
  return 'Usuario'
}

export default function DashboardScreen() {
  const navigate = useNavigate()
  const auth = useStore($auth)

  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const userName = useMemo(() => deriveUserName(auth), [auth])
  const isAdmin = auth.rol === 'admin'

  useEffect(() => {
    let cancelled = false

    fetchDashboardSummary()
      .then((data) => {
        if (cancelled) return
        setSummary(data)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Error al cargar el dashboard'
        setError(message)
        showToast(message, 'error')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const handleRefresh = () => {
    setLoading(true)
    setError(null)
    setRefreshKey((k) => k + 1)
  }

  const handleNavigate = (path: string) => navigate(path)

  const alertCount = summary?.alertas_stock.length ?? 0
  const paymentBreakdown = useMemo(
    () => completePaymentBreakdown(summary?.ventas_hoy.por_medio_pago ?? {}),
    [summary]
  )

  const renderContent = () => {
    if (loading && !summary) {
      return (
        <div role="status" aria-busy="true" className="space-y-[10px]">
          <div className="h-[48px] animate-pulse rounded-card-sm bg-bg-card" />
          <div className="flex gap-[9px]">
            <div className="h-[90px] flex-1 animate-pulse rounded-card bg-bg-card" />
            <div className="h-[90px] flex-1 animate-pulse rounded-card bg-bg-card" />
          </div>
          <div className="h-[72px] animate-pulse rounded-card bg-bg-card" />
          <div className="h-[120px] animate-pulse rounded-card bg-bg-card" />
        </div>
      )
    }

    if (error && !summary) {
      return (
        <div className="flex flex-col items-center justify-center rounded-card border border-border-sand bg-bg-card p-[24px] text-center">
          <p className="mb-[12px] text-[14px] text-text-primary">{error}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-card bg-madera px-[16px] py-[8px] text-[14px] font-medium text-bg-pantalla"
          >
            Reintentar
          </button>
        </div>
      )
    }

    if (!summary) return null

    return (
      <div className="space-y-[10px]">
        <div className="flex items-center justify-between">
          <AlertStrip alertCount={alertCount} onNavigate={handleNavigate} />
          <button
            type="button"
            aria-label="Actualizar"
            onClick={handleRefresh}
            disabled={loading}
            className="ml-[8px] flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-card bg-bg-card text-text-secondary disabled:opacity-50"
          >
            <ArrowsClockwiseIcon size={18} weight="bold" />
          </button>
        </div>

        <div className="flex gap-[9px]">
          <StatCard
            icon={<TrendUpIcon size={14} weight="bold" />}
            label="Ventas hoy"
            value={formatPrice(summary.ventas_hoy.total)}
            subtitle={`${summary.ventas_hoy.cantidad} ventas`}
          />
          <StatCard
            icon={<ArchiveBoxIcon size={14} weight="bold" />}
            label="Valor inventario"
            value={formatPrice(summary.valor_inventario?.a_venta ?? 0)}
            subtitle="a precio de venta"
          />
        </div>

        {isAdmin && summary.valor_inventario ? (
          <StatCard
            icon={<CurrencyDollarIcon size={14} weight="bold" />}
            label="Valor inventario a costo"
            value={formatPrice(summary.valor_inventario.a_costo)}
            subtitle="solo administradora"
          />
        ) : null}

        <PaymentBreakdown breakdown={paymentBreakdown} />

        <QuickSearch onNavigate={handleNavigate} />

        <StockAlertList alerts={summary.alertas_stock} onNavigate={handleNavigate} />
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-bg-pantalla">
      <DashboardHeader userName={userName} alertCount={alertCount} />

      <main className="flex-1 overflow-y-auto px-[15px] py-[13px]">{renderContent()}</main>

      <BottomNav active="inicio" onNavigate={handleNavigate} />
    </div>
  )
}
