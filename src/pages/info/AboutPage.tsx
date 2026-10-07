import LegalPage from '../../components/legal/LegalPage'
import markdown from '../../content/info/nosotros.md?raw'

export default function AboutPage() {
  return <LegalPage markdown={markdown} />
}
