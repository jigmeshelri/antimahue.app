/**
 * QuickSearch tests.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import QuickSearch from './QuickSearch'

vi.mock('@/components/molecules/SearchInput', () => ({
  default: vi.fn(({ value, onChange, placeholder }) => (
    <input
      data-testid="search-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )),
}))

describe('QuickSearch', () => {
  it('should_navigate_to_catalog_with_encoded_query_on_submit', () => {
    const onNavigate = vi.fn()
    render(<QuickSearch onNavigate={onNavigate} />)

    const input = screen.getByTestId('search-input')
    fireEvent.change(input, { target: { value: 'lana merino' } })
    fireEvent.submit(input)

    expect(onNavigate).toHaveBeenCalledWith('/catalogo?search=lana%20merino')
  })

  it('should_not_navigate_when_query_is_empty', () => {
    const onNavigate = vi.fn()
    render(<QuickSearch onNavigate={onNavigate} />)

    const input = screen.getByTestId('search-input')
    fireEvent.submit(input)

    expect(onNavigate).not.toHaveBeenCalled()
  })
})
