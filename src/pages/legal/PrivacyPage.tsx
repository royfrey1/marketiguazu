import LegalPage from '../../components/legal/LegalPage'
import markdown from '../../content/legal/privacidad.md?raw'
import Seo from '../../components/seo/Seo'

export default function PrivacyPage() {
  return (
    <>
      <Seo title="Política de Privacidad" description="Cómo recopilamos, usamos y compartimos tus datos personales y cómo ejercer tus derechos." canonicalPath="/privacidad" />
      <LegalPage markdown={markdown} />
    </>
  )
}
