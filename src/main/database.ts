import initSqlJs from 'sql.js'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any

let db: DB = null
let dbFilePath = ''

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs()
  dbFilePath = path.join(app.getPath('userData'), 'pos.db')

  if (fs.existsSync(dbFilePath)) {
    const data = new Uint8Array(fs.readFileSync(dbFilePath))
    db = new SQL.Database(data)
  } else {
    db = new SQL.Database()
  }

  runSchema()
  persist()
}

export function persist(): void {
  if (!db || !dbFilePath) return
  const data: Uint8Array = db.export()
  fs.writeFileSync(dbFilePath, Buffer.from(data))
}

function getDb(): DB {
  if (!db) throw new Error('Base de datos no inicializada')
  return db
}

export function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const stmt = getDb().prepare(sql)
  stmt.bind(params)
  const results: T[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return results
}

export function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
  const results = queryAll<T>(sql, params)
  return results.length > 0 ? results[0] : null
}

export function execute(sql: string, params: unknown[] = []): void {
  const stmt = getDb().prepare(sql)
  stmt.run(params)
  stmt.free()
  persist()
}

export function executeRaw(sql: string, params: unknown[] = []): void {
  const stmt = getDb().prepare(sql)
  stmt.run(params)
  stmt.free()
}

export function runInTransaction(fn: () => void): void {
  const d = getDb()
  d.run('BEGIN')
  try {
    fn()
    d.run('COMMIT')
  } catch (e) {
    d.run('ROLLBACK')
    throw e
  }
  persist()
}

export function lastInsertId(): number {
  const row = queryOne<{ id: number }>('SELECT last_insert_rowid() as id')
  return row?.id ?? 0
}
function runSchema(): void {
  const d = getDb()

  d.run(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      activo INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cod TEXT NOT NULL UNIQUE,
      codigo_barras TEXT,
      descripcion TEXT NOT NULL,
      tipo_costo TEXT NOT NULL CHECK(tipo_costo IN ('unidad', 'peso')),
      costo REAL NOT NULL,
      unidad_peso TEXT CHECK(unidad_peso IN ('kg', '100g')),
      renta REAL NOT NULL DEFAULT 0,
      grupo TEXT NOT NULL,
      categoria_id INTEGER REFERENCES categorias(id),
      marca TEXT,
      vencimiento TEXT,
      activo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      total REAL NOT NULL,
      metodo_pago TEXT CHECK(metodo_pago IN ('efectivo', 'transferencia', 'tarjeta')),
      descuento REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS venta_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER REFERENCES ventas(id),
      producto_id INTEGER REFERENCES productos(id),
      cantidad REAL NOT NULL,
      precio_unitario REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT
    );
  `)

  // Migración suave: agregar categoria_id si no existe
  try {
    d.run(`ALTER TABLE productos ADD COLUMN categoria_id INTEGER REFERENCES categorias(id)`)
  } catch {
    // ya existe
  }

  // Migración: quitar CHECK constraint de grupo si existe (esquema viejo)
  try {
    const meta = queryOne<{ sql: string }>(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='productos'`
    )
    if (meta?.sql && meta.sql.includes("grupo IN (")) {
      d.run(`
        CREATE TABLE productos_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cod TEXT NOT NULL UNIQUE,
          codigo_barras TEXT,
          descripcion TEXT NOT NULL,
          tipo_costo TEXT NOT NULL CHECK(tipo_costo IN ('unidad', 'peso')),
          costo REAL NOT NULL,
          unidad_peso TEXT CHECK(unidad_peso IN ('kg', '100g')),
          renta REAL NOT NULL DEFAULT 0,
          grupo TEXT NOT NULL,
          categoria_id INTEGER REFERENCES categorias(id),
          marca TEXT,
          vencimiento TEXT,
          activo INTEGER DEFAULT 1
        )
      `)
      d.run(`INSERT INTO productos_new SELECT id, cod, codigo_barras, descripcion, tipo_costo, costo, unidad_peso, renta, grupo, categoria_id, marca, vencimiento, activo FROM productos`)
      d.run(`DROP TABLE productos`)
      d.run(`ALTER TABLE productos_new RENAME TO productos`)
    }
  } catch {
    // tabla nueva, no hay nada que migrar
  }

  // Semillas iniciales
  d.run(`
    INSERT OR IGNORE INTO categorias (nombre) VALUES
    ('carniceria'),
    ('fiambreria'),
    ('granja');
  `)

  // Vincular productos viejos por nombre de grupo
  d.run(`
    UPDATE productos
    SET categoria_id = (
      SELECT c.id
      FROM categorias c
      WHERE LOWER(TRIM(c.nombre)) = LOWER(TRIM(productos.grupo))
      LIMIT 1
    )
    WHERE categoria_id IS NULL AND grupo IS NOT NULL AND TRIM(grupo) <> '';
  `)

  // Migraciones ventas: columnas monto_recibido y vuelto
  try { d.run(`ALTER TABLE ventas ADD COLUMN monto_recibido REAL DEFAULT 0`) } catch { /* ya existe */ }
  try { d.run(`ALTER TABLE ventas ADD COLUMN vuelto REAL DEFAULT 0`) } catch { /* ya existe */ }

  // Migraciones venta_items: snapshot cod y descripcion
  try { d.run(`ALTER TABLE venta_items ADD COLUMN cod TEXT`) } catch { /* ya existe */ }
  try { d.run(`ALTER TABLE venta_items ADD COLUMN descripcion TEXT`) } catch { /* ya existe */ }
}