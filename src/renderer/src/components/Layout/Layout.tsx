import React, { useState, useEffect } from 'react'
import styles from './Layout.module.scss'
import { PageName } from '../../types'

type Theme = 'dark' | 'light'

interface NavItem {
  page: PageName
  label: string
}

const navItems: NavItem[] = [
  { page: 'ventas',       label: 'Punto de Venta' },
  { page: 'historial',   label: 'Historial' },
  { page: 'productos',   label: 'Productos' },
  { page: 'reportes',    label: 'Reportes' },
  { page: 'configuracion', label: 'Configuración' },
]

interface Props {
  children: React.ReactNode
  activePage: PageName
  onNavigate: (page: PageName) => void
}

export default function Layout({ children, activePage, onNavigate }: Props): JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('pos-theme') as Theme) ?? 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('pos-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        {/* Logo / marca */}
        <div className={styles.logo}>
          <div className={styles.logoEmblem}>LN</div>
          <div className={styles.logoTitle}>LA NEGRA</div>
          <div className={styles.logoSub}>Carnicería &amp; Fiambrería</div>
        </div>

        {/* Navegación */}
        <nav className={styles.nav}>
          {navItems.map(item => (
            <button
              key={item.page}
              className={`${styles.navItem} ${activePage === item.page ? styles.active : ''}`}
              onClick={() => onNavigate(item.page)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer: toggle + versión */}
        <div className={styles.sidebarFooter}>
          <button className={styles.themeToggle} onClick={toggleTheme} type="button" title="Cambiar modo">
            <span className={styles.themeIcon}>
              {theme === 'dark' ? (
                /* sol — cambiar a claro */
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                /* luna — cambiar a oscuro */
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </span>
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
          <div className={styles.version}>v0.1.0</div>
        </div>
      </aside>

      <main className={styles.content}>{children}</main>
    </div>
  )
}
