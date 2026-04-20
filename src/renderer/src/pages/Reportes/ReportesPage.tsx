import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { ReportesData } from '../../types'
import styles from './ReportesPage.module.scss'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const CHART_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316']
const METODO_LABELS: Record<string, string> = { efectivo:'Efectivo', transferencia:'Transferencia', tarjeta:'Tarjeta' }
const METODO_COLORS: Record<string, string> = { efectivo:'#22c55e', transferencia:'#3b82f6', tarjeta:'#f59e0b' }

function fmtMonto(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function formatPeriodo(periodo: string, granularidad: 'diaria' | 'mensual'): string {
  if (granularidad === 'diaria') {
    const parts = periodo.split('-')
    return `${parseInt(parts[2])}/${parseInt(parts[1])}`
  }
  const parts = periodo.split('-')
  return `${MESES[parseInt(parts[1]) - 1]} '${parts[0].slice(2)}`
}

function capitalize(s: string): string {
  if (!s || s === '_manual') return 'Manual'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const tooltipStyle = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  fontSize: '0.8125rem',
  color: 'var(--text-primary)',
}

export default function ReportesPage(): JSX.Element {
  const [año, setAño] = useState<number | undefined>(new Date().getFullYear())
  const [mes, setMes] = useState<number | undefined>(undefined)
  const [data, setData] = useState<ReportesData | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    window.electronAPI.ventas.getReportes({ año, mes })
      .then(d => setData(d))
      .finally(() => setCargando(false))
  }, [año, mes])

  const años = data?.años.length ? data.años : [new Date().getFullYear()]

  if (!data && cargando) {
    return <div className={styles.loading}>Cargando reportes...</div>
  }

  const kpis          = data?.kpis          ?? { totalVentas:0, montoTotal:0, ticketPromedio:0, ganancia:0 }
  const evolucion     = data?.evolucion      ?? []
  const granularidad  = data?.granularidad   ?? 'mensual'
  const porCategoria  = data?.porCategoria   ?? []
  const porMetodo     = data?.porMetodo      ?? []
  const topProductos  = data?.topProductos   ?? []

  const evolucionFmt = evolucion.map(e => ({
    ...e,
    label: formatPeriodo(e.periodo, granularidad),
  }))

  const catFmt = porCategoria.map(c => ({ ...c, label: capitalize(c.categoria) }))

  const montoTotalMetodos = porMetodo.reduce((s, m) => s + m.monto, 0)

  const margenPct = kpis.montoTotal > 0
    ? ((kpis.ganancia / kpis.montoTotal) * 100).toFixed(1)
    : '0.0'

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.titulo}>Reportes</h1>
        <div className={styles.filtros}>
          <div className={styles.filtroGrupo}>
            <label>Año</label>
            <select
              value={año ?? ''}
              onChange={e => { setAño(e.target.value ? Number(e.target.value) : undefined); setMes(undefined) }}
            >
              <option value="">Todo el período</option>
              {años.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {año !== undefined && (
            <div className={styles.filtroGrupo}>
              <label>Mes</label>
              <select
                value={mes ?? ''}
                onChange={e => setMes(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">Todo el año</option>
                {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
          )}
          {(año !== undefined || mes !== undefined) && (
            <button
              className={styles.btnReset}
              onClick={() => { setAño(undefined); setMes(undefined) }}
              type="button"
            >
              Todo el período
            </button>
          )}
        </div>
      </div>

      {cargando && <div className={styles.loadingBar} />}

      {/* KPI cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Ventas</div>
          <div className={styles.kpiValor}>{kpis.totalVentas.toLocaleString()}</div>
          <div className={styles.kpiSub}>transacciones</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Ingresos totales</div>
          <div className={`${styles.kpiValor} ${styles.kpiBlue}`}>{fmtMonto(kpis.montoTotal)}</div>
          <div className={styles.kpiSub}>facturado en el período</div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardGreen}`}>
          <div className={styles.kpiLabel}>Ganancia aprox.</div>
          <div className={`${styles.kpiValor} ${styles.kpiGreen}`}>{fmtMonto(kpis.ganancia)}</div>
          <div className={styles.kpiSub}>{margenPct}% de margen</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Ticket promedio</div>
          <div className={styles.kpiValor}>{fmtMonto(kpis.ticketPromedio)}</div>
          <div className={styles.kpiSub}>por venta</div>
        </div>
      </div>

      {/* Charts row */}
      <div className={styles.chartsRow}>
        {/* Evolución */}
        <div className={`${styles.chartCard} ${styles.chartWide}`}>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitle}>
              Evolución {granularidad === 'diaria' ? 'diaria' : 'mensual'}
            </span>
            <div className={styles.chartLegend}>
              <span className={styles.legendDot} style={{ background:'#3b82f6' }} /> Ingresos
              <span className={styles.legendDot} style={{ background:'#22c55e', marginLeft:'1rem' }} /> Ganancia
            </div>
          </div>
          {evolucion.length === 0 ? (
            <div className={styles.noData}>Sin ventas en este período</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={evolucionFmt} margin={{ top:4, right:8, bottom:0, left:0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.18)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => fmtMonto(Number(v))} width={68} />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={(value: unknown, name: unknown) => [
                    `$${Number(value).toFixed(2)}`,
                    name === 'monto' ? 'Ingresos' : 'Ganancia',
                  ]}
                  labelFormatter={label => `Período: ${label}`}
                />
                <Bar dataKey="monto"    fill="#3b82f6" radius={[3,3,0,0]} maxBarSize={36} name="monto" />
                <Bar dataKey="ganancia" fill="#22c55e" radius={[3,3,0,0]} maxBarSize={36} name="ganancia" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Por categoría */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitle}>Por categoría</span>
          </div>
          {catFmt.length === 0 ? (
            <div className={styles.noData}>Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={catFmt} layout="vertical" margin={{ top:4, right:16, bottom:0, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.18)" horizontal={false} />
                <XAxis type="number" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => fmtMonto(Number(v))} />
                <YAxis dataKey="label" type="category" tick={{ fill:'var(--text-primary)', fontSize:12 }}
                  axisLine={false} tickLine={false} width={82} />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={(value: unknown) => [`$${Number(value).toFixed(2)}`, 'Ingresos']} />
                <Bar dataKey="monto" radius={[0,3,3,0]} maxBarSize={28}>
                  {catFmt.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className={styles.bottomRow}>
        {/* Método de pago */}
        <div className={styles.metodoCard}>
          <div className={styles.chartTitle}>Medio de pago</div>
          <div className={styles.metodoList}>
            {(['efectivo','transferencia','tarjeta'] as const).map(m => {
              const d = porMetodo.find(x => x.metodo_pago === m)
              const pct = montoTotalMetodos > 0 && d
                ? ((d.monto / montoTotalMetodos) * 100).toFixed(1)
                : '0.0'
              return (
                <div key={m} className={styles.metodoItem}>
                  <div className={styles.metodoTop}>
                    <span className={styles.metodoNombre} style={{ color: METODO_COLORS[m] }}>
                      {METODO_LABELS[m]}
                    </span>
                    <span className={styles.metodoPct}>{pct}%</span>
                  </div>
                  <div className={styles.metodoBar}>
                    <div className={styles.metodoBarFill}
                      style={{ width:`${pct}%`, background: METODO_COLORS[m] }} />
                  </div>
                  <div className={styles.metodoDetalle}>
                    <span>{d?.count ?? 0} ventas</span>
                    <span>{fmtMonto(d?.monto ?? 0)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top productos */}
        <div className={styles.topCard}>
          <div className={styles.chartTitle}>Top 10 productos</div>
          {topProductos.length === 0 ? (
            <div className={styles.noData}>Sin datos para este período</div>
          ) : (
            <table className={styles.topTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Producto</th>
                  <th className={styles.rCol}>Ingresos</th>
                  <th className={styles.rCol}>Ganancia</th>
                  <th className={styles.rCol}>Margen</th>
                </tr>
              </thead>
              <tbody>
                {topProductos.map((p, i) => {
                  const margen = p.monto > 0 ? ((p.ganancia / p.monto) * 100).toFixed(0) : '—'
                  return (
                    <tr key={i}>
                      <td className={styles.topRank}>{i + 1}</td>
                      <td>
                        <div className={styles.topNombre}>{p.descripcion}</div>
                        {p.cod && <div className={styles.topCod}>{p.cod}</div>}
                      </td>
                      <td className={`${styles.rCol} ${styles.topMonto}`}>{fmtMonto(p.monto)}</td>
                      <td className={`${styles.rCol} ${styles.topGanancia}`}>{fmtMonto(p.ganancia)}</td>
                      <td className={`${styles.rCol} ${styles.topMargen}`}>{margen}{typeof margen === 'string' && margen !== '—' ? '%' : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
