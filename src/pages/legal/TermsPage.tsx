import LegalPage from '../../components/legal/LegalPage'
import markdown from '../../content/legal/terminos.md?raw'

export default function TermsPage() {
  return <LegalPage markdown={markdown} />
}
