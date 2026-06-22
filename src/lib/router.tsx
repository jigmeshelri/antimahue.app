/**
 * App router — D1.
 *
 * React Router v7, createBrowserRouter (SPA library mode, no SSR — REQ-SETUP-11).
 * All feature screens are lazy-loaded to keep the initial bundle minimal (PWA goal).
 *
 * Route map (9 handoff screens, design.md component architecture):
 *   /           → PinScreen      (auth gate — always first)
 *   /dashboard  → DashboardScreen
 *   /venta      → SaleScreen
 *   /venta/:id/ticket → TicketView
 *   /escaner    → ScannerScreen
 *   /catalogo   → CatalogScreen
 *   /catalogo/:id → ProductDetailScreen
 *   /proveedor  → SupplierScreen
 *   /dte        → DteImportScreen
 */
import { createBrowserRouter } from 'react-router'
import { lazy } from 'react'

// Lazy imports — each feature slice is a separate chunk in the build.
const PinScreen = lazy(() => import('@/features/auth/PinScreen'))
const DashboardScreen = lazy(() => import('@/features/dashboard/DashboardScreen'))
const SaleScreen = lazy(() => import('@/features/venta/SaleScreen'))
const TicketView = lazy(() => import('@/features/venta/TicketView'))
const ScannerScreen = lazy(() => import('@/features/escaner/ScannerScreen'))
const CatalogScreen = lazy(() => import('@/features/catalogo/CatalogScreen'))
const ProductDetailScreen = lazy(() => import('@/features/catalogo/ProductDetailScreen'))
const SupplierScreen = lazy(() => import('@/features/proveedor/SupplierScreen'))
const DteImportScreen = lazy(() => import('@/features/dte/DteImportScreen'))

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PinScreen />,
  },
  {
    path: '/dashboard',
    element: <DashboardScreen />,
  },
  {
    path: '/venta',
    element: <SaleScreen />,
  },
  {
    path: '/venta/:id/ticket',
    element: <TicketView />,
  },
  {
    path: '/escaner',
    element: <ScannerScreen />,
  },
  {
    path: '/catalogo',
    element: <CatalogScreen />,
  },
  {
    path: '/catalogo/:id',
    element: <ProductDetailScreen />,
  },
  {
    path: '/proveedor',
    element: <SupplierScreen />,
  },
  {
    path: '/dte',
    element: <DteImportScreen />,
  },
])
