/**
 * PinDots — molecule (T-4.4, DD-10).
 *
 * Row of 4 `PinDot`s, filled left-to-right as digits accumulate (handoff
 * screen 1). `role="status"` + `aria-label` give assistive tech a spoken
 * progress readout without duplicating the dots visually.
 */
import PinDot from '@/components/atoms/PinDot'

interface PinDotsProps {
  /** How many of the 4 dots are filled (0-4). */
  filledCount: number
}

const DOT_POSITIONS = [0, 1, 2, 3]

export default function PinDots({ filledCount }: PinDotsProps) {
  return (
    <div
      className="flex gap-[18px]"
      role="status"
      aria-label={`${filledCount} de 4 dígitos ingresados`}
    >
      {DOT_POSITIONS.map((position) => (
        <PinDot key={position} filled={position < filledCount} />
      ))}
    </div>
  )
}
