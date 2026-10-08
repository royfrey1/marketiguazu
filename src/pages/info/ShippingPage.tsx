import LegalPage from '../../components/legal/LegalPage'
import markdown from '../../content/info/envios.md?raw'
import Seo from '../../components/seo/Seo'

export default function ShippingPage() {
  return (
    <>
      <Seo title="Envíos" description="Envío gratis a todo el país por Correo Argentino a domicilio: plazo estimado de entrega y qué revisar al recibir tu pedido." canonicalPath="/envios" />
      <LegalPage markdown={markdown} />
    </>
  )
}
