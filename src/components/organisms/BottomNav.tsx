import {
  BooksIcon,
  DotsThreeCircleIcon,
  HouseIcon,
  PaletteIcon,
  ShoppingCartSimpleIcon,
} from '@phosphor-icons/react'

// NOTE (deviation, task 3.7): the design_handoff hi-fi prototype fixes 4 tabs
// (Inicio/Venta/Catálogo/Más — README.md "Tabs:" line). This change's own
// design.md explicitly lists "Add paleta tab" as a BottomNav.tsx file
// change, and "Más" has no built destination yet to route a 5th entry
// through (its path is still the placeholder `#`), so a genuine 5th tab is
// the faithful choice here rather than inventing a "Más" menu screen out of
// scope for this slice. The bar height (and therefore each tab's tap target
// height) is unchanged — only per-tab width shrinks, which stays well above
// the 44px minimum on any phone-sized viewport.
export type BottomNavTab = 'inicio' | 'venta' | 'catalogo' | 'paleta' | 'mas'

interface BottomNavProps {
  active: BottomNavTab
  onNavigate: (path: string) => void
}

const TABS: { id: BottomNavTab; label: string; path: string; icon: typeof HouseIcon }[] = [
  { id: 'inicio', label: 'Inicio', path: '/dashboard', icon: HouseIcon },
  { id: 'venta', label: 'Venta', path: '/venta', icon: ShoppingCartSimpleIcon },
  { id: 'catalogo', label: 'Catálogo', path: '/catalogo', icon: BooksIcon },
  { id: 'paleta', label: 'Paleta', path: '/paleta', icon: PaletteIcon },
  { id: 'mas', label: 'Más', path: '#', icon: DotsThreeCircleIcon },
]

export default function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <nav className="bg-nav-bg h-[58px] flex items-center px-[6px]">
      {TABS.map((tab) => {
        const isActive = tab.id === active
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onNavigate(tab.path)}
            className={`flex-1 flex flex-col items-center gap-[3px] py-[6px] ${
              isActive ? 'text-nav-active' : 'text-nav-inactive'
            }`}
          >
            <Icon weight="fill" size={21} />
            <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-normal'}`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
