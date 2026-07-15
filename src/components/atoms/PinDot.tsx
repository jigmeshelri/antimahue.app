/**
 * PinDot — atom (T-4.1, DD-10).
 *
 * One dot of the 4-digit PIN indicator (handoff screen 1, "PIN dots (×4)").
 * Purely presentational: filled vs. empty, 150ms transition. The parent
 * molecule (`PinDots`) decides how many of the four are filled.
 */
interface PinDotProps {
  filled: boolean
}

export default function PinDot({ filled }: PinDotProps) {
  return (
    <div
      aria-hidden="true"
      className={`h-[13px] w-[13px] rounded-full transition-all duration-150 ${
        filled
          ? 'scale-[1.2] border-0 bg-madera'
          : 'scale-100 border-2 border-border-sand bg-transparent'
      }`}
    />
  )
}
