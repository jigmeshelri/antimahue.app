interface StepperProps {
  quantity: number
  max?: number
  onChange: (quantity: number) => void
}

export default function Stepper({ quantity, max, onChange }: StepperProps) {
  const canDecrement = quantity > 1
  const canIncrement = max === undefined || quantity < max

  return (
    <div className="flex items-center border border-border-sand rounded-lg overflow-hidden">
      <button
        type="button"
        aria-label="Disminuir"
        disabled={!canDecrement}
        onClick={() => canDecrement && onChange(quantity - 1)}
        className="w-[30px] h-[28px] bg-bg-pantalla text-text-muted disabled:opacity-40"
      >
        −
      </button>
      <div className="w-[32px] h-[28px] flex items-center justify-center border-x border-border-sand bg-bg-card text-[14px] font-semibold text-text-primary">
        {quantity}
      </div>
      <button
        type="button"
        aria-label="Incrementar"
        disabled={!canIncrement}
        onClick={() => canIncrement && onChange(quantity + 1)}
        className="w-[30px] h-[28px] bg-madera text-bg-pantalla disabled:opacity-40"
      >
        +
      </button>
    </div>
  )
}
