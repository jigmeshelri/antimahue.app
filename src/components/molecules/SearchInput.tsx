import { MagnifyingGlassIcon } from '@phosphor-icons/react'

interface SearchInputProps {
  placeholder?: string
  value?: string
  onChange: (value: string) => void
}

export default function SearchInput({
  placeholder = 'Buscar…',
  value = '',
  onChange,
}: SearchInputProps) {
  return (
    <div className="flex items-center gap-[9px] bg-bg-card border border-border-sand rounded-input px-[13px] py-[11px]">
      <MagnifyingGlassIcon size={16} weight="fill" className="text-text-secondary shrink-0" />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="flex-1 bg-transparent text-[14px] text-text-primary placeholder:text-text-secondary outline-none"
      />
    </div>
  )
}
