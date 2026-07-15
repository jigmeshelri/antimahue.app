/**
 * PinPad — molecule (T-4.5, DD-10).
 *
 * 3×4 numeric grid (handoff screen 1, "Teclado numérico"): 1-9, then an
 * empty cell, 0, and backspace — in that exact grid order. `BackspaceIcon`
 * (Phosphor, `fill` weight, per the project's icon convention) inherits its
 * color from the ghost `PinKey`'s `currentColor` rather than a hardcoded
 * fill, so it always matches the key's text color.
 */
import { BackspaceIcon } from '@phosphor-icons/react'
import PinKey from '@/components/atoms/PinKey'

interface PinPadProps {
  onDigit: (digit: string) => void
  onBackspace: () => void
  disabled?: boolean
}

const DIGITS_1_TO_9 = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export default function PinPad({ onDigit, onBackspace, disabled = false }: PinPadProps) {
  return (
    <div className="grid grid-cols-3 gap-[12px]" role="group" aria-label="Teclado numérico">
      {DIGITS_1_TO_9.map((digit) => (
        <PinKey
          key={digit}
          onClick={() => onDigit(digit)}
          disabled={disabled}
          aria-label={`Dígito ${digit}`}
        >
          {digit}
        </PinKey>
      ))}
      <div aria-hidden="true" />
      <PinKey onClick={() => onDigit('0')} disabled={disabled} aria-label="Dígito 0">
        0
      </PinKey>
      <PinKey
        variant="ghost"
        onClick={onBackspace}
        disabled={disabled}
        aria-label="Borrar último dígito"
      >
        <BackspaceIcon weight="fill" size={22} />
      </PinKey>
    </div>
  )
}
