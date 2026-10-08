import LegalPage from '../../components/legal/LegalPage'
import markdown from '../../content/legal/terminos.md?raw'
import Seo from '../../components/seo/Seo'

export default function TermsPage() {
  return (
    <>
      <Seo
        title="Términos y Condiciones"
        description="Condiciones de compra, precios y stock, formas de pago, envíos, garantías y responsabilidades de la tienda."
        canonicalPath="/terminos"
      />
      <LegalPage markdown={markdown} />
    </>
  )
}
