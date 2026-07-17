import { ArrowLeftIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

interface ScreenHeaderProps {
  title: string
  onBack?: () => void
  rightAction?: ReactNode
}

export default function ScreenHeader({ title, onBack, rightAction }: ScreenHeaderProps) {
  return (
    <div className="bg-terracota px-[22px] pt-[6px] pb-[16px] flex items-center justify-between">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="flex h-[36px] w-[36px] items-center justify-center rounded-[10px] bg-black/[0.14]"
        >
          <ArrowLeftIcon size={18} weight="bold" color="#FAF0E0" />
        </button>
      ) : (
        <div className="w-[36px]" />
      )}
      <h1 className="text-[17px] font-semibold text-[#FAF0E0]">{title}</h1>
      {rightAction ? <div>{rightAction}</div> : <div className="w-[36px]" />}
    </div>
  )
}
