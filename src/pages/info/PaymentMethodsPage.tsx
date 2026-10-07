import LegalPage from '../../components/legal/LegalPage'
import markdown from '../../content/info/medios-de-pago.md?raw'

export default function PaymentMethodsPage() {
  return <LegalPage markdown={markdown} />
}
