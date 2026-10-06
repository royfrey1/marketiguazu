import LegalPage from '../../components/legal/LegalPage'
import markdown from '../../content/legal/devoluciones.md?raw'

export default function ReturnsPage() {
  return <LegalPage markdown={markdown} />
}
