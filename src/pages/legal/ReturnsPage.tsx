import LegalPage from '../../components/legal/LegalPage'
import markdown from '../../content/legal/devoluciones.md?raw'
import Seo from '../../components/seo/Seo'

export default function ReturnsPage() {
  return (
    <>
      <Seo title="Cambios y devoluciones" description="Derecho de arrepentimiento, garantía legal, cambios, daños en el envío y cancelación antes del despacho." canonicalPath="/devoluciones" />
      <LegalPage markdown={markdown} />
    </>
  )
}
