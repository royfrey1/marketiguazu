import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fillLegalPlaceholders } from '../../config/legal'
import { parseLegalMarkdown, type LegalBlock } from '../../lib/legalMarkdown'

// Inline: [texto](url), **negrita** y rutas internas sueltas entre paréntesis, como "(/devoluciones)"
const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\((\/[a-z][a-z0-9-]*)\)/g
const LINK_CLASS = 'font-semibold text-accent hover:underline'

function SmartLink({ href, children }: { href: string; children: ReactNode }) {
  if (href.startsWith('/')) {
    return <Link to={href} className={LINK_CLASS}>{children}</Link>
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      {children}
    </a>
  )
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0
    if (index > last) nodes.push(text.slice(last, index))
    const [, linkText, href, bold, path] = match
    if (linkText !== undefined && href !== undefined) {
      nodes.push(<SmartLink key={index} href={href}>{linkText}</SmartLink>)
    } else if (bold !== undefined) {
      nodes.push(<strong key={index} className="font-bold text-primary-dark">{renderInline(bold)}</strong>)
    } else if (path !== undefined) {
      nodes.push('(', <SmartLink key={index} href={path}>{path}</SmartLink>, ')')
    }
    last = index + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case 'heading':
      return block.level === 3
        ? <h3 className="text-base sm:text-lg font-bold text-primary-dark mt-7 mb-2">{renderInline(block.text)}</h3>
        : <h2 className="text-lg sm:text-xl font-bold text-primary-dark mt-10 mb-3">{renderInline(block.text)}</h2>
    case 'paragraph':
      return <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-4">{renderInline(block.text)}</p>
    case 'list':
      return (
        <ul className="list-disc pl-5 space-y-2.5 mb-5 text-sm sm:text-base text-gray-600 leading-relaxed marker:text-accent">
          {block.items.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
        </ul>
      )
    case 'table':
      return (
        // Scroll horizontal dentro del contenedor: la tabla no rompe el ancho en mobile
        <div className="mb-6 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[640px] text-sm text-left">
            <thead className="bg-gray-50">
              <tr>
                {block.header.map((cell, i) => (
                  <th key={i} scope="col" className="px-4 py-3 font-bold text-primary-dark align-bottom">{renderInline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="border-t border-gray-100">
                  {row.map((cell, c) => (
                    <td key={c} className="px-4 py-3 text-gray-600 align-top leading-relaxed">{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

/** Página legal a partir de un Markdown de src/content/legal (título = primer "#"). */
export default function LegalPage({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => parseLegalMarkdown(fillLegalPlaceholders(markdown)), [markdown])
  const titleBlock = blocks.find(b => b.type === 'heading' && b.level === 1)
  const title = titleBlock?.type === 'heading' ? titleBlock.text : ''
  const body = blocks.filter(b => b !== titleBlock)

  return (
    <div className="min-h-screen bg-white">
      <div className="store-container py-8 sm:py-10">
        <nav className="breadcrumb">
          <Link to="/" className="breadcrumb-link">Inicio</Link>
          <span>/</span>
          <span className="breadcrumb-current">{title}</span>
        </nav>

        <article className="max-w-3xl mx-auto pt-6 sm:pt-8 pb-12">
          <h1 className="text-h2 text-2xl sm:text-3xl text-primary-dark mb-3">{title}</h1>
          {body.map((block, i) => <Block key={i} block={block} />)}
        </article>
      </div>
    </div>
  )
}
