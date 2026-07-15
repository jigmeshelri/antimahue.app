/**
 * UserSelector — molecule (T-4.6, DD-3 RFC).
 *
 * Avatars/names sourced ENTIRELY from `listRecords()` (local, this device) —
 * there is no anon-readable staff directory to fall back on. `PinScreen`
 * (the container) decides WHEN to show this component: it is skipped
 * entirely when exactly one record exists (auto-select, no picker needed),
 * matching DD-3's "≤2 taps" daily path. With zero records this renders only
 * the "+ vincular" entry point into `PairDeviceScreen` — there is no PIN to
 * type yet.
 *
 * Net-new surface (like the Phase 6 employee-management screen): the hi-fi
 * handoff's PIN screen assumes a single admin and has no multi-user picker
 * to replicate, so this list's visual language is derived from the Terraza
 * palette rather than copied from a specific handoff mock.
 */
import { Link } from 'react-router'
import type { Rol, VaultRecord } from '@/lib/vault'

interface UserSelectorProps {
  records: VaultRecord[]
  onSelect: (userId: string) => void
}

const ROL_LABEL: Record<Rol, string> = {
  admin: 'Administradora',
  empleado: 'Vendedora',
}

function initialOf(displayName: string): string {
  return displayName.trim().charAt(0).toUpperCase() || '?'
}

export default function UserSelector({ records, onSelect }: UserSelectorProps) {
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-[14px]">
      {records.length > 0 && (
        <ul className="flex flex-col gap-[8px]" aria-label="Elegí tu usuario">
          {records.map((record) => (
            <li key={record.userId}>
              <button
                type="button"
                onClick={() => onSelect(record.userId)}
                className="flex w-full items-center gap-[12px] rounded-card border border-border-sand bg-bg-card px-[14px] py-[11px] text-left transition-colors active:bg-border-sand-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-madera"
              >
                <span
                  aria-hidden="true"
                  className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-madera text-[15px] font-semibold text-bg-card"
                >
                  {initialOf(record.displayName)}
                </span>
                <span className="flex flex-col">
                  <span className="text-[14px] font-medium text-text-primary">
                    {record.displayName}
                  </span>
                  <span className="text-[12px] text-text-secondary">{ROL_LABEL[record.rol]}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/pair"
        className="text-center text-[13px] font-semibold text-madera underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-madera"
      >
        + vincular
      </Link>
    </div>
  )
}
