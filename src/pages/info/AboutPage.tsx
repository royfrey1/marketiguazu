import LegalPage from '../../components/legal/LegalPage'
import markdown from '../../content/info/nosotros.md?raw'
import Seo from '../../components/seo/Seo'

export default function AboutPage() {
  return (
    <>
      <Seo title="Nosotros" description="Iguazú Marketplace: tienda online de tecnología de Puerto Iguazú, Misiones. Productos de fábrica, probados antes de venderlos." canonicalPath="/nosotros" />
      <LegalPage markdown={markdown} />
    </>
  )
}
