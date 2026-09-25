import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: () => void
}

export default function AdminBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="hidden md:flex items-center gap-2 text-sm text-gray-400 dark:text-white/30 mb-6">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5" />}
            {isLast || (!item.href && !item.onClick) ? (
              <span className="text-gray-600 dark:text-white/60">{item.label}</span>
            ) : item.onClick ? (
              <button
                onClick={item.onClick}
                className="hover:text-[#185749] dark:hover:text-[#1CAAA8] transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ) : (
              <Link
                to={item.href!}
                className="hover:text-[#185749] dark:hover:text-[#1CAAA8] transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
