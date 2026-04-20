import React, { useState } from 'react'
import Layout from './components/Layout/Layout'
import ProductosPage from './pages/Productos/ProductosPage'
import VentasPage from './pages/Ventas/VentasPage'
import HistorialPage from './pages/Historial/HistorialPage'
import ReportesPage from './pages/Reportes/ReportesPage'
import { PageName } from './types'
import styles from './styles/App.module.scss'

function ComingSoon({ title }: { title: string }): JSX.Element {
  return (
    <div className={styles.comingSoon}>
      <div className={styles.comingSoonTitle}>{title}</div>
      <div className={styles.comingSoonSub}>Próximamente</div>
    </div>
  )
}

export default function App(): JSX.Element {
  const [page, setPage] = useState<PageName>('ventas')

  const renderPage = () => {
    switch (page) {
      case 'ventas':
        return <VentasPage />
      case 'productos':
        return <ProductosPage />
      case 'historial':
        return <HistorialPage />
      case 'reportes':
        return <ReportesPage />
      case 'configuracion':
        return <ComingSoon title="Configuración" />
    }
  }

  return (
    <Layout activePage={page} onNavigate={setPage}>
      {renderPage()}
    </Layout>
  )
}
