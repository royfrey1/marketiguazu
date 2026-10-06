// Parser mínimo para los textos legales (src/content/legal/*.md).
// Soporta solo lo que usan esos archivos: #, ##, ###, párrafos, listas con "-"
// y tablas con pipes. El formato inline (negrita, links) lo resuelve LegalPage.
// No genera HTML: devuelve bloques que se renderizan como elementos de React.

export type LegalBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; header: string[]; rows: string[][] }

const HEADING = /^(#{1,3})\s+(.+)$/
const TABLE_SEPARATOR = /^\|?[\s:|-]+\|?$/

function splitRow(line: string): string[] {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
}

export function parseLegalMarkdown(markdown: string): LegalBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n').map(line => line.trim())
  const blocks: LegalBlock[] = []
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
    paragraph = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const heading = HEADING.exec(line)

    if (line === '') {
      flushParagraph()
    } else if (heading) {
      flushParagraph()
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2] })
    } else if (line.startsWith('- ')) {
      flushParagraph()
      const items: string[] = []
      while (i < lines.length && lines[i].startsWith('- ')) items.push(lines[i++].slice(2))
      i--
      blocks.push({ type: 'list', items })
    } else if (line.startsWith('|')) {
      flushParagraph()
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!TABLE_SEPARATOR.test(lines[i])) rows.push(splitRow(lines[i]))
        i++
      }
      i--
      const [header = [], ...body] = rows
      blocks.push({ type: 'table', header, rows: body })
    } else {
      paragraph.push(line)
    }
  }
  flushParagraph()
  return blocks
}
