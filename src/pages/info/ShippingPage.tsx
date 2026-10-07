import LegalPage from '../../components/legal/LegalPage'
import markdown from '../../content/info/envios.md?raw'

export default function ShippingPage() {
  return <LegalPage markdown={markdown} />
}
