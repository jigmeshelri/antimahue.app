/**
 * DashboardHeader — terracotta header with greeting, app icon and notification bell.
 *
 * Handoff reference: docs/design_handoff_antimahue/README.md §02 · Dashboard.
 */
import { BellIcon } from '@phosphor-icons/react'
import AppIcon from '@/components/atoms/AppIcon'
import { greetingForHour } from '../dashboardUtils'

interface DashboardHeaderProps {
  userName: string
  alertCount: number
}

export default function DashboardHeader({ userName, alertCount }: DashboardHeaderProps) {
  const greeting = greetingForHour()

  return (
    <header className="bg-terracota">
      <div className="flex items-center justify-between px-[22px] pt-[6px] pb-[18px]">
        <div className="flex items-center gap-[12px]">
          <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[11px] bg-black/[0.18]">
            <AppIcon size={36} />
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] font-normal text-[rgba(250,240,224,0.6)]">{greeting}</span>
            <span className="text-[24px] font-bold leading-[1.1] text-[#FAF0E0]">{userName}</span>
          </div>
        </div>

        <button
          type="button"
          aria-label="Notificaciones"
          className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-black/[0.14]"
        >
          <BellIcon size={20} weight="fill" color="#FAF0E0" />
          {alertCount > 0 ? (
            <span
              aria-hidden
              className="absolute right-[6px] top-[6px] h-[8px] w-[8px] rounded-full bg-[#F5D780] ring-2 ring-terracota"
            />
          ) : null}
        </button>
      </div>

      {/* Curved divider between terracotta header and pergament body. */}
      <div className="h-[12px] rounded-t-[12px] bg-bg-pantalla" />
    </header>
  )
}
