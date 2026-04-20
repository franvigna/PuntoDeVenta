import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  productos: {
    getAll: () => ipcRenderer.invoke('productos:getAll'),
    create: (data) => ipcRenderer.invoke('productos:create', data),
    update: (id, data) => ipcRenderer.invoke('productos:update', id, data),
    delete: (id) => ipcRenderer.invoke('productos:delete', id),
    deleteAll: () => ipcRenderer.invoke('productos:deleteAll'),
    getNextCod: () => ipcRenderer.invoke('productos:getNextCod'),
    importar: (rows) => ipcRenderer.invoke('productos:importar', rows),
    buscar: (query: string) => ipcRenderer.invoke('productos:buscar', query),
  },
  categorias: {
    getAll: () => ipcRenderer.invoke('categorias:getAll'),
    create: (nombre: string) => ipcRenderer.invoke('categorias:create', nombre),
  },
  ventas: {
    crear: (data: unknown) => ipcRenderer.invoke('ventas:crear', data),
    getAll: (filtros: unknown) => ipcRenderer.invoke('ventas:getAll', filtros),
    getDetalle: (id: number) => ipcRenderer.invoke('ventas:getDetalle', id),
    getReportes: (filtros: unknown) => ipcRenderer.invoke('ventas:getReportes', filtros),
  },
})
