import LegalPage from '../../components/legal/LegalPage'
import markdown from '../../content/info/medios-de-pago.md?raw'
import Seo from '../../components/seo/Seo'

export default function PaymentMethodsPage() {
  return (
    <>
      <Seo title="Medios de pago" description="Pagá con transferencia bancaria, USDT o Mercado Pago. Precio de contado por transferencia y confirmación manual." canonicalPath="/medios-de-pago" />
      <LegalPage markdown={markdown} />
    </>
  )
}
