import {
  BooksIcon,
  DotsThreeCircleIcon,
  HouseIcon,
  ShoppingCartSimpleIcon,
} from '@phosphor-icons/react'

export type BottomNavTab = 'inicio' | 'venta' | 'catalogo' | 'mas'

interface BottomNavProps {
  active: BottomNavTab
  onNavigate: (path: string) => void
}

const TABS: { id: BottomNavTab; label: string; path: string; icon: typeof HouseIcon }[] = [
  { id: 'inicio', label: 'Inicio', path: '/dashboard', icon: HouseIcon },
  { id: 'venta', label: 'Venta', path: '/venta', icon: ShoppingCartSimpleIcon },
  { id: 'catalogo', label: 'Catálogo', path: '/catalogo', icon: BooksIcon },
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
