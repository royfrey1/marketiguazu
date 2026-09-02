import { Outlet } from 'react-router-dom'

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="hidden lg:flex lg:flex-col w-64 bg-gray-900 text-gray-300">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-white font-black text-lg tracking-tight">IGUAZÚ ADMIN</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider px-3 py-2">Menú</p>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200">
          <p className="text-sm text-gray-500 lg:hidden">☰</p>
          <div className="flex-1" />
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
