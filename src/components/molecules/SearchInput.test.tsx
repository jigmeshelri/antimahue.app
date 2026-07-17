import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SearchInput from './SearchInput'

describe('SearchInput', () => {
  it('should_render_placeholder', () => {
    render(<SearchInput placeholder="Buscar producto…" onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('Buscar producto…')).toBeInTheDocument()
  })

  it('should_call_onChange_when_typing', () => {
    const onChange = vi.fn()
    render(<SearchInput placeholder="Buscar" onChange={onChange} />)
    const input = screen.getByPlaceholderText('Buscar') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'lana' } })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('lana')
  })

  it('should_render_initial_value', () => {
    render(<SearchInput placeholder="Buscar" value="merino" onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('merino')).toBeInTheDocument()
  })
})
