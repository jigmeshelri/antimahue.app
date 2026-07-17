/**
 * ProductFormScreen — create/edit product (admin only).
 *
 * Real guard is the RPC `crear_producto`/`actualizar_producto` rejecting
 * non-admin callers. The route-level <RequireAdmin> is UX concealment.
 */
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import ScreenHeader from '@/components/organisms/ScreenHeader'
import BottomNav from '@/components/organisms/BottomNav'
import { PRODUCT_TYPE_LABEL, type ProductType } from './catalogoTypes'
import { createProduct, fetchProductById, updateProduct } from './catalogoApi'

interface ProductFormScreenProps {
  mode: 'create' | 'edit'
}

interface FormState {
  nombre: string
  sku: string
  tipo: ProductType | ''
  marca: string
  grosor: string
  peso_metraje: string
  color_nombre: string
  color_hex: string
  precio_venta: string
  stock: string
  stock_minimo: string
  costo: string
}

function emptyForm(): FormState {
  return {
    nombre: '',
    sku: '',
    tipo: '',
    marca: '',
    grosor: '',
    peso_metraje: '',
    color_nombre: '',
    color_hex: '',
    precio_venta: '',
    stock: '0',
    stock_minimo: '',
    costo: '',
  }
}

function formFromProduct(product: Awaited<ReturnType<typeof fetchProductById>>): FormState {
  if (!product) return emptyForm()
  return {
    nombre: product.nombre,
    sku: product.sku ?? '',
    tipo: product.tipo ?? '',
    marca: product.marca ?? '',
    grosor: product.grosor ?? '',
    peso_metraje: product.peso_metraje ?? '',
    color_nombre: product.color_nombre ?? '',
    color_hex: product.color_hex ?? '',
    precio_venta: product.precio_venta.toString(),
    stock: product.stock.toString(),
    stock_minimo: product.stock_minimo?.toString() ?? '',
    costo: product.producto_costos?.costo?.toString() ?? '',
  }
}

export default function ProductFormScreen({ mode }: ProductFormScreenProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(emptyForm())
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'edit' || !id) return
    let cancelled = false

    const load = async () => {
      try {
        const product = await fetchProductById(id)
        if (cancelled) return
        if (product) {
          setForm(formFromProduct(product))
        } else {
          setError('Producto no encontrado')
        }
      } catch {
        if (cancelled) return
        setError('No se pudo cargar el producto')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [mode, id])

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const validate = (): string | null => {
    if (!form.nombre.trim()) return 'El nombre es obligatorio'
    const precio = Number(form.precio_venta)
    if (Number.isNaN(precio) || precio <= 0) return 'El precio de venta debe ser mayor a 0'
    return null
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError(null)

    try {
      const payload = {
        nombre: form.nombre.trim(),
        sku: form.sku.trim() || null,
        tipo: (form.tipo as ProductType) || null,
        marca: form.marca.trim() || null,
        grosor: form.grosor.trim() || null,
        peso_metraje: form.peso_metraje.trim() || null,
        color_nombre: form.color_nombre.trim() || null,
        color_hex: form.color_hex.trim() || null,
        precio_venta: Number(form.precio_venta),
        stock: Number(form.stock || 0),
        stock_minimo: form.stock_minimo ? Number(form.stock_minimo) : null,
        costo: form.costo ? Number(form.costo) : null,
      }

      if (mode === 'edit' && id) {
        const patch: Partial<typeof payload> = {}
        for (const [key, value] of Object.entries(payload)) {
          if (value !== null || key === 'precio_venta' || key === 'nombre') {
            patch[key as keyof typeof payload] = value as never
          }
        }
        await updateProduct(id, patch)
        navigate(`/catalogo/${id}`)
      } else {
        const newId = await createProduct(payload)
        navigate(`/catalogo/${newId}`)
      }
    } catch {
      setError('No se pudo guardar el producto')
      setSaving(false)
    }
  }

  const title = mode === 'create' ? 'Nuevo producto' : 'Editar producto'

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-bg-pantalla">
        <ScreenHeader title={title} onBack={() => navigate('/catalogo')} />
        <div className="flex-1 flex items-center justify-center text-text-secondary text-[14px]">
          Cargando…
        </div>
        <BottomNav active="catalogo" onNavigate={(path) => navigate(path)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-bg-pantalla">
      <ScreenHeader title={title} onBack={() => navigate('/catalogo')} />

      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto px-[16px] py-[14px] space-y-[14px]"
      >
        {error ? (
          <div className="rounded-card bg-stock-out-bg text-stock-out p-[12px] text-[13px]">
            {error}
          </div>
        ) : null}

        <Field label="Nombre" required>
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => updateField('nombre', e.target.value)}
            className="w-full bg-bg-card border border-border-sand rounded-input px-[13px] py-[11px] text-[14px] text-text-primary outline-none"
          />
        </Field>

        <Field label="SKU">
          <input
            type="text"
            inputMode="numeric"
            value={form.sku}
            onChange={(e) => updateField('sku', e.target.value)}
            className="w-full bg-bg-card border border-border-sand rounded-input px-[13px] py-[11px] text-[14px] text-text-primary outline-none"
          />
        </Field>

        <Field label="Tipo">
          <select
            value={form.tipo}
            onChange={(e) => updateField('tipo', e.target.value)}
            className="w-full bg-bg-card border border-border-sand rounded-input px-[13px] py-[11px] text-[14px] text-text-primary outline-none"
          >
            <option value="">Sin tipo</option>
            {Object.entries(PRODUCT_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-[12px]">
          <Field label="Marca">
            <input
              type="text"
              value={form.marca}
              onChange={(e) => updateField('marca', e.target.value)}
              className="w-full bg-bg-card border border-border-sand rounded-input px-[13px] py-[11px] text-[14px] text-text-primary outline-none"
            />
          </Field>
          <Field label="Grosor">
            <input
              type="text"
              value={form.grosor}
              onChange={(e) => updateField('grosor', e.target.value)}
              className="w-full bg-bg-card border border-border-sand rounded-input px-[13px] py-[11px] text-[14px] text-text-primary outline-none"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-[12px]">
          <Field label="Peso/Metraje">
            <input
              type="text"
              value={form.peso_metraje}
              onChange={(e) => updateField('peso_metraje', e.target.value)}
              className="w-full bg-bg-card border border-border-sand rounded-input px-[13px] py-[11px] text-[14px] text-text-primary outline-none"
            />
          </Field>
          <Field label="Color">
            <input
              type="text"
              value={form.color_nombre}
              onChange={(e) => updateField('color_nombre', e.target.value)}
              className="w-full bg-bg-card border border-border-sand rounded-input px-[13px] py-[11px] text-[14px] text-text-primary outline-none"
            />
          </Field>
        </div>

        <Field label="Color HEX">
          <input
            type="color"
            value={form.color_hex || '#C84A3A'}
            onChange={(e) => updateField('color_hex', e.target.value)}
            className="w-full h-[44px] bg-bg-card border border-border-sand rounded-input px-[4px] py-[4px]"
          />
        </Field>

        <div className="grid grid-cols-2 gap-[12px]">
          <Field label="Precio de venta" required>
            <input
              type="number"
              min={0}
              value={form.precio_venta}
              onChange={(e) => updateField('precio_venta', e.target.value)}
              className="w-full bg-bg-card border border-border-sand rounded-input px-[13px] py-[11px] text-[14px] text-text-primary outline-none"
            />
          </Field>
          <Field label="Costo">
            <input
              type="number"
              min={0}
              value={form.costo}
              onChange={(e) => updateField('costo', e.target.value)}
              className="w-full bg-bg-card border border-border-sand rounded-input px-[13px] py-[11px] text-[14px] text-text-primary outline-none"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-[12px]">
          <Field label="Stock inicial">
            <input
              type="number"
              min={0}
              value={form.stock}
              onChange={(e) => updateField('stock', e.target.value)}
              className="w-full bg-bg-card border border-border-sand rounded-input px-[13px] py-[11px] text-[14px] text-text-primary outline-none"
            />
          </Field>
          <Field label="Stock mínimo">
            <input
              type="number"
              min={0}
              value={form.stock_minimo}
              onChange={(e) => updateField('stock_minimo', e.target.value)}
              className="w-full bg-bg-card border border-border-sand rounded-input px-[13px] py-[11px] text-[14px] text-text-primary outline-none"
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-[13px] rounded-card bg-madera text-bg-pantalla font-semibold text-[15px] disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </form>

      <BottomNav active="catalogo" onNavigate={(path) => navigate(path)} />
    </div>
  )
}

interface FieldProps {
  label: string
  required?: boolean
  children: React.ReactNode
}

function Field({ label, required, children }: FieldProps) {
  const id = `field-${label.toLowerCase().replace(/[^a-z]/g, '-')}`
  return (
    <div className="space-y-[5px]">
      <label htmlFor={id} className="block text-[13px] font-medium text-text-secondary">
        {label}
        {required ? <span className="text-stock-out ml-[2px]">*</span> : null}
      </label>
      {React.isValidElement(children)
        ? React.cloneElement(children, { id } as Record<string, unknown>)
        : children}
    </div>
  )
}
