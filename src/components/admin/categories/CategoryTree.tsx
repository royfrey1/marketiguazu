import type { Category, CategoryWithChildren } from '../../../services/categories.service'
import { Pencil, Trash2, ToggleLeft, ToggleRight, Package } from 'lucide-react'
import { getCategoryIcon } from '../../../lib/categoryIcons'

interface CategoryTreeProps {
  categories: CategoryWithChildren[]
  productCounts: Record<number, number>
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
  onToggleActive: (category: Category) => void
}

function buildTree(categories: Category[]): CategoryWithChildren[] {
  const map = new Map<number, CategoryWithChildren>()
  const roots: CategoryWithChildren[] = []

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] })
  }

  for (const cat of categories) {
    const node = map.get(cat.id)!
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id)!.children!.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

function flattenTree(nodes: CategoryWithChildren[], depth = 0): { category: CategoryWithChildren; depth: number }[] {
  const result: { category: CategoryWithChildren; depth: number }[] = []
  for (const node of nodes) {
    result.push({ category: node, depth })
    if (node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1))
    }
  }
  return result
}

export default function CategoryTree({
  categories,
  productCounts,
  onEdit,
  onDelete,
  onToggleActive,
}: CategoryTreeProps) {
  const tree = buildTree(categories)
  const flat = flattenTree(tree)

  if (flat.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-white/30">
        No hay categorías para mostrar.
      </div>
    )
  }

  return (
    <>
      {/* Desktop table — only at lg (>=1024px) */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 dark:border-white/5 text-left text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3 text-center">Orden</th>
              <th className="px-4 py-3 text-center">Productos</th>
              <th className="px-4 py-3 text-center">Subcats.</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {flat.map(({ category, depth }) => {
              const productCount = productCounts[category.id] ?? 0
              const childCount = category.children?.length ?? 0
              const indent = depth * 24

              return (
                <tr key={category.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div style={{ paddingLeft: indent }} className="flex items-center gap-2">
                      {depth > 0 && (
                        <span className="text-gray-300 dark:text-white/20 text-xs">└─</span>
                      )}
                      {(() => {
                        const iconUrl = getCategoryIcon(category.slug)
                        return iconUrl ? (
                          <img src={iconUrl} alt="" className="w-6 h-6 object-contain shrink-0" />
                        ) : (
                          <Package className="w-5 h-5 text-gray-300 dark:text-white/20 shrink-0" />
                        )
                      })()}
                      <span className="font-medium text-gray-800 dark:text-white/80">{category.nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded text-gray-500 dark:text-white/40">
                      {category.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-white/40 text-center">
                    {category.sort_order}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {productCount > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#185749]/10 text-[#185749] dark:bg-[#1CAAA8]/10 dark:text-[#1CAAA8]">
                        {productCount}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {childCount > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                        {childCount}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onToggleActive(category)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        category.activo
                          ? 'bg-[#389C52]/10 text-[#389C52] hover:bg-[#389C52]/20'
                          : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/30 hover:bg-gray-200 dark:hover:bg-white/10'
                      }`}
                    >
                      {category.activo ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(category)}
                        className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(category)}
                        className="p-1.5 text-gray-400 dark:text-white/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Tablet + mobile cards — below lg (<1024px) */}
      <div className="lg:hidden divide-y divide-gray-100 dark:divide-white/5">
        {flat.map(({ category, depth }) => {
          const productCount = productCounts[category.id] ?? 0
          const childCount = category.children?.length ?? 0
          const indent = depth * 16

          return (
            <div key={category.id} className="p-4">
              <div style={{ paddingLeft: indent }} className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {depth > 0 && (
                      <span className="text-gray-300 dark:text-white/20 text-xs">└─</span>
                    )}
                    {(() => {
                      const iconUrl = getCategoryIcon(category.slug)
                      return iconUrl ? (
                        <img src={iconUrl} alt="" className="w-6 h-6 object-contain shrink-0" />
                      ) : (
                        <Package className="w-5 h-5 text-gray-300 dark:text-white/20 shrink-0" />
                      )
                    })()}
                    <span className="font-medium text-gray-800 dark:text-white/80 truncate">{category.nombre}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <code className="text-xs bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded text-gray-500 dark:text-white/40">
                      {category.slug}
                    </code>
                    <span className="text-xs text-gray-400 dark:text-white/30">Orden: {category.sort_order}</span>
                    {productCount > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#185749]/10 text-[#185749] dark:bg-[#1CAAA8]/10 dark:text-[#1CAAA8]">
                        {productCount} {productCount === 1 ? 'producto' : 'productos'}
                      </span>
                    )}
                    {childCount > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                        {childCount} subcats.
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onToggleActive(category)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      category.activo
                        ? 'text-[#389C52] hover:bg-[#389C52]/10'
                        : 'text-gray-400 dark:text-white/30 hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                    title={category.activo ? 'Desactivar' : 'Activar'}
                  >
                    {category.activo ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => onEdit(category)}
                    className="p-1.5 text-gray-400 dark:text-white/30 hover:text-[#185749] dark:hover:text-[#1CAAA8] hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(category)}
                    className="p-1.5 text-gray-400 dark:text-white/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
