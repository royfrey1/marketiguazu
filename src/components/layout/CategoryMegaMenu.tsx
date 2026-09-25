import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, ArrowRight } from 'lucide-react'
import { useCategoryTree } from '../../hooks/useCategoryTree'
import type { CategoryWithChildren } from '../../services/categories.service'
import { getCategoryIcon } from '../../lib/categoryIcons'

interface CategoryMegaMenuProps {
  mode: 'desktop' | 'mobile'
  isOpen: boolean
  onClose: () => void
}

export default function CategoryMegaMenu({ mode, isOpen, onClose }: CategoryMegaMenuProps) {
  const { roots, loadChildren } = useCategoryTree()
  const [hoveredRoot, setHoveredRoot] = useState<number | null>(null)
  const [childrenCache, setChildrenCache] = useState<Record<number, CategoryWithChildren[]>>({})
  const [loadingChildren, setLoadingChildren] = useState<Record<number, boolean>>({})
  const [mobileExpanded, setMobileExpanded] = useState<number | null>(null)
  const [mobileGrandChildren, setMobileGrandChildren] = useState<Record<number, CategoryWithChildren[]>>({})
  const [flyoutTop, setFlyoutTop] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [rootsWithChildren, setRootsWithChildren] = useState<Set<number>>(new Set())

  const loadChildrenFor = useCallback(async (parentId: number) => {
    if (childrenCache[parentId]) return childrenCache[parentId]
    setLoadingChildren(prev => ({ ...prev, [parentId]: true }))
    const children = await loadChildren(parentId)
    setChildrenCache(prev => ({ ...prev, [parentId]: children }))
    setLoadingChildren(prev => ({ ...prev, [parentId]: false }))
    return children
  }, [childrenCache, loadChildren])

  const loadGrandChildren = useCallback(async (childId: number) => {
    if (mobileGrandChildren[childId]) return
    const gc = await loadChildren(childId)
    setMobileGrandChildren(prev => ({ ...prev, [childId]: gc }))
  }, [mobileGrandChildren, loadChildren])

  useEffect(() => {
    if (mode !== 'desktop' || !isOpen) {
      setRootsWithChildren(new Set())
      return
    }
    let cancelled = false
    const preload = async () => {
      const results = await Promise.all(
        roots.map(async (r) => {
          const children = await loadChildrenFor(r.id)
          return { id: r.id, has: children.length > 0 }
        })
      )
      if (!cancelled) {
        setRootsWithChildren(new Set(results.filter(r => r.has).map(r => r.id)))
      }
    }
    preload()
    return () => { cancelled = true }
  }, [mode, isOpen, roots, loadChildrenFor])

  const handleClose = useCallback(() => {
    setHoveredRoot(null)
    onClose()
  }, [onClose])

  const handleNavigate = useCallback(() => {
    handleClose()
  }, [handleClose])

  const handleRootMouseEnter = useCallback((rootId: number) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    setHoveredRoot(rootId)
    loadChildrenFor(rootId)

    const itemEl = itemRefs.current.get(rootId)
    if (itemEl) {
      const containingBlock = panelRef.current?.parentElement
      if (containingBlock) {
        const itemRect = itemEl.getBoundingClientRect()
        const wrapperRect = containingBlock.getBoundingClientRect()
        let top = itemRect.top - wrapperRect.top
        const maxTop = Math.max(0, window.innerHeight - wrapperRect.top - 280)
        top = Math.min(top, Math.max(0, maxTop))
        setFlyoutTop(top)
      }
    }
  }, [loadChildrenFor])

  const handleRootMouseLeave = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => setHoveredRoot(null), 150)
  }, [])

  const handleFlyoutMouseEnter = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
  }, [])

  const handleFlyoutMouseLeave = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => setHoveredRoot(null), 150)
  }, [])

  const toggleMobileRoot = useCallback((rootId: number) => {
    const isExpanding = mobileExpanded !== rootId
    setMobileExpanded(isExpanding ? rootId : null)
    if (isExpanding) {
      loadChildrenFor(rootId)
    }
  }, [mobileExpanded, loadChildrenFor])

  const toggleMobileChild = useCallback((childId: number) => {
    loadGrandChildren(childId)
  }, [loadGrandChildren])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'desktop' || !isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return
      if (flyoutRef.current?.contains(e.target as Node)) return
      const btn = document.querySelector('[data-category-toggle]')
      if (btn?.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mode, isOpen, onClose])

  if (mode === 'desktop') {
    return (
      <>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="category-dropdown"
              ref={panelRef}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-full left-0 z-50 mt-1.5"
              style={{ width: 'min(280px, calc(100vw - 32px))' }}
            >
              <div className="bg-white rounded-xl border border-gray-100 shadow-xl overflow-hidden">
                <div ref={scrollRef} className="max-h-[60vh] overflow-y-auto overscroll-contain">
                  {roots.map((cat) => {
                    const iconUrl = getCategoryIcon(cat.slug)
                    const hasChildren = rootsWithChildren.has(cat.id)
                    return (
                      <div
                        key={cat.id}
                        ref={(el) => { if (el) itemRefs.current.set(cat.id, el) }}
                        onMouseEnter={() => handleRootMouseEnter(cat.id)}
                        onMouseLeave={handleRootMouseLeave}
                      >
                        <Link
                          to={`/categoria/${cat.slug}`}
                          onClick={handleNavigate}
                          className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-all duration-150 ${
                            hoveredRoot === cat.id
                              ? 'bg-accent/5 text-accent font-semibold'
                              : 'text-primary-dark hover:bg-gray-50/80'
                          }`}
                        >
                          <span className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors duration-150 ${
                            hoveredRoot === cat.id ? 'bg-accent/10' : 'bg-gray-100'
                          }`}>
                            {iconUrl ? (
                              <img src={iconUrl} alt="" className="w-3.5 h-3.5 object-contain" />
                            ) : (
                              <span className="w-3.5 h-3.5 rounded bg-gray-200" />
                            )}
                          </span>
                          <span className="flex-1 truncate">{cat.nombre}</span>
                          {hasChildren && (
                            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                          )}
                        </Link>
                      </div>
                    )
                  })}
                </div>

                <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50/50">
                  <Link
                    to="/categoria"
                    onClick={handleNavigate}
                    className="flex items-center gap-2 py-1 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
                  >
                    Ver todas las categorías
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOpen && hoveredRoot && rootsWithChildren.has(hoveredRoot) && (
            <motion.div
              key={`flyout-${hoveredRoot}`}
              ref={flyoutRef}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.15 }}
              onMouseEnter={handleFlyoutMouseEnter}
              onMouseLeave={handleFlyoutMouseLeave}
              className="absolute z-50"
              style={{
                left: 'calc(min(280px, calc(100vw - 32px)) + 4px)',
                top: flyoutTop,
              }}
            >
              <div className="bg-white rounded-xl border border-gray-100 shadow-xl py-3 px-4 min-w-[200px] max-w-[280px] max-h-[60vh] overflow-y-auto overscroll-contain">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Subcategorías
                </h3>
                {loadingChildren[hoveredRoot] ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                    <span className="w-3.5 h-3.5 border-2 border-gray-200 border-t-accent rounded-full animate-spin" />
                    Cargando...
                  </div>
                ) : childrenCache[hoveredRoot]?.length ? (
                  <div className="space-y-0.5">
                    {childrenCache[hoveredRoot].map((child) => {
                      const childIconUrl = getCategoryIcon(child.slug)
                      return (
                        <Link
                          key={child.id}
                          to={`/categoria/${child.slug}`}
                          onClick={handleNavigate}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-primary-dark hover:bg-accent/5 hover:text-accent transition-all duration-150 group"
                        >
                          <span className="flex items-center justify-center w-5 h-5 rounded bg-gray-50 group-hover:bg-accent/10 transition-colors">
                            {childIconUrl ? (
                              <img src={childIconUrl} alt="" className="w-3 h-3 object-contain" />
                            ) : (
                              <span className="w-3 h-3 rounded bg-gray-200" />
                            )}
                          </span>
                          <span className="truncate">{child.nombre}</span>
                        </Link>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )
  }

  // Mobile mode
  return (
    <div className="space-y-1">
      {roots.map((cat) => {
        const iconUrl = getCategoryIcon(cat.slug)
        const isExpanded = mobileExpanded === cat.id
        return (
          <div key={cat.id}>
            <div className="flex items-center">
              <Link
                to={`/categoria/${cat.slug}`}
                onClick={handleNavigate}
                className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-sm text-primary-dark hover:bg-gray-50 rounded-lg transition-colors"
              >
                {iconUrl ? (
                  <img src={iconUrl} alt="" className="w-4 h-4 object-contain" />
                ) : null}
                {cat.nombre}
              </Link>
              <button
                onClick={() => toggleMobileRoot(cat.id)}
                className="p-2 text-gray-400 hover:text-accent transition-colors"
                aria-expanded={isExpanded}
                aria-label={`Expandir ${cat.nombre}`}
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="ml-6 space-y-0.5 pb-1">
                    {loadingChildren[cat.id] ? (
                      <div className="px-3 py-3 text-sm text-gray-400 flex items-center gap-2">
                        <span className="w-3 h-3 border-2 border-gray-200 border-t-accent rounded-full animate-spin" />
                        Cargando...
                      </div>
                    ) : childrenCache[cat.id]?.length ? (
                      childrenCache[cat.id].map((child) => {
                        const childIconUrl = getCategoryIcon(child.slug)
                        return (
                          <div key={child.id}>
                            <div className="flex items-center">
                              <Link
                                to={`/categoria/${child.slug}`}
                                onClick={handleNavigate}
                                className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                              >
                                {childIconUrl ? (
                                  <img src={childIconUrl} alt="" className="w-3.5 h-3.5 object-contain" />
                                ) : null}
                                {child.nombre}
                              </Link>
                              <button
                                onClick={() => toggleMobileChild(child.id)}
                                className="p-2 text-gray-400 hover:text-accent transition-colors"
                                aria-label={`Expandir ${child.nombre}`}
                              >
                                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${mobileGrandChildren[child.id]?.length ? 'opacity-100' : 'opacity-0'}`} />
                              </button>
                            </div>

                            {mobileGrandChildren[child.id]?.length ? (
                              <div className="ml-5 space-y-0.5">
                                {mobileGrandChildren[child.id].map((gc) => {
                                  const gcIconUrl = getCategoryIcon(gc.slug)
                                  return (
                                    <Link
                                      key={gc.id}
                                      to={`/categoria/${gc.slug}`}
                                      onClick={handleNavigate}
                                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 hover:text-accent hover:bg-gray-50 rounded-lg transition-colors"
                                    >
                                      {gcIconUrl ? (
                                        <img src={gcIconUrl} alt="" className="w-3 h-3 object-contain" />
                                      ) : null}
                                      {gc.nombre}
                                    </Link>
                                  )
                                })}
                              </div>
                            ) : null}
                          </div>
                        )
                      })
                    ) : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      <div className="border-t border-gray-100 mt-2 pt-2">
        <Link
          to="/categoria"
          onClick={handleNavigate}
          className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-accent hover:bg-accent/5 rounded-lg transition-colors"
        >
          Ver todas las categorías
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  )
}
