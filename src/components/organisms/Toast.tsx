/**
 * Toast organism — renders transient app-wide messages from $ui.
 *
 * Mounted once in AppShell so any screen can trigger it via showToast().
 */
import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { $ui, clearToast } from '@/stores/ui'

const TYPE_STYLES = {
  success: 'bg-success-bg border-success-border text-success',
  error: 'bg-terracota-alert-bg border-terracota-alert-border text-error',
  info: 'bg-bg-card border-border-sand text-text-primary',
} as const

export default function Toast() {
  const { toastMessage, toastType } = useStore($ui)

  useEffect(() => {
    if (!toastMessage) return

    const timer = setTimeout(() => {
      clearToast()
    }, 4000)

    return () => clearTimeout(timer)
  }, [toastMessage])

  if (!toastMessage || !toastType) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-[72px] left-[16px] right-[16px] z-50 px-[16px] py-[12px] rounded-card border text-[14px] font-medium shadow-sm ${TYPE_STYLES[toastType]}`}
    >
      {toastMessage}
    </div>
  )
}
