/**
 * PaymentBreakdown tests.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PaymentBreakdown from './PaymentBreakdown'

describe('PaymentBreakdown', () => {
  it('should_render_four_columns_with_labels_and_values', () => {
    render(
      <PaymentBreakdown
        breakdown={{
          efectivo: 10000,
          transferencia: 5000,
          debito: 0,
          credito: 0,
        }}
      />
    )

    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(screen.getByText('Transfer.')).toBeInTheDocument()
    expect(screen.getByText('Débito')).toBeInTheDocument()
    expect(screen.getByText('Crédito')).toBeInTheDocument()

    expect(screen.getByText('$10.000')).toBeInTheDocument()
    expect(screen.getByText('$5.000')).toBeInTheDocument()
    expect(screen.getAllByText('$0')).toHaveLength(2)
  })
})
