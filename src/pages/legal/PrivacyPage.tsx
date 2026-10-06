import LegalPage from '../../components/legal/LegalPage'
import markdown from '../../content/legal/privacidad.md?raw'

export default function PrivacyPage() {
  return <LegalPage markdown={markdown} />
}
