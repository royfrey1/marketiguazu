import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import AdminBreadcrumb from './AdminBreadcrumb'

interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: () => void
}

interface AdminSubpageHeaderProps {
  title: string
  description?: string
  backHref: string
  backLabel: string
  breadcrumbItems: BreadcrumbItem[]
  children?: React.ReactNode
  onBack?: () => void
}

export default function AdminSubpageHeader({
  title,
  description,
  backHref,
  backLabel,
  breadcrumbItems,
  children,
  onBack,
}: AdminSubpageHeaderProps) {
  return (
    <>
      <AdminBreadcrumb items={breadcrumbItems} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              onClick={onBack}
              className="p-2 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              aria-label={backLabel}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <Link
              to={backHref}
              className="p-2 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
              aria-label={backLabel}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">{title}</h1>
            {description && (
              <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {children}
      </div>
    </>
  )
}
