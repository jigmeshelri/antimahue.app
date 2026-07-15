/**
 * PinKey — atom (T-4.2, DD-10).
 *
 * One circular key of the PIN numeric pad (handoff screen 1, "Teclado
 * numérico"). `variant="digit"` renders the filled sand-bordered circle used
 * for 0-9; `variant="ghost"` renders the borderless variant used for the
 * backspace key. A real `<button>` (not a `<div onClick>`) so it is natively
 * keyboard- and screen-reader-operable; 66×66px comfortably clears the
 * accessibility minimum tap-target size.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface PinKeyProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'children' | 'type'
> {
  children: ReactNode
  variant?: 'digit' | 'ghost'
}

export default function PinKey({ children, variant = 'digit', ...buttonProps }: PinKeyProps) {
  const base =
    'flex h-[66px] w-[66px] items-center justify-center rounded-full text-[22px] font-medium ' +
    'transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
    'focus-visible:outline-madera disabled:cursor-not-allowed disabled:opacity-40'
  const variantClass =
    variant === 'digit'
      ? 'border border-border-sand bg-bg-card text-text-primary active:bg-border-sand-light'
      : 'border-0 bg-transparent text-text-secondary'

  return (
    <button type="button" className={`${base} ${variantClass}`} {...buttonProps}>
      {children}
    </button>
  )
}
