/**
 * QuickSearch — search input that navigates to the catalog on submit.
 */
import { useState } from 'react'
import SearchInput from '@/components/molecules/SearchInput'

interface QuickSearchProps {
  onNavigate: (path: string) => void
}

export default function QuickSearch({ onNavigate }: QuickSearchProps) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    onNavigate(`/catalogo?search=${encodeURIComponent(query.trim())}`)
    setQuery('')
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <SearchInput
        placeholder="Buscar producto…"
        value={query}
        onChange={(value) => setQuery(value)}
      />
    </form>
  )
}
