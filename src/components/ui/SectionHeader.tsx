import type { ReactNode } from 'react'

interface SectionHeaderProps {
  meta?: string
  title: string
  /** Optional right-side element (e.g., "Ver todos" link) */
  right?: ReactNode
  /** Extra class on the wrapper div */
  className?: string
}

export default function SectionHeader({ meta, title, right, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-end justify-between mb-10 ${className}`.trim()}>
      <div>
        {meta && <span className="text-meta">{meta}</span>}
        <h2 className="text-h2 text-2xl sm:text-3xl mt-2">{title}</h2>
      </div>
      {right}
    </div>
  )
}
