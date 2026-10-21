import LegalPage from '../../components/legal/LegalPage'
import markdown from '../../content/legal/privacidad.md?raw'
import Seo from '../../components/seo/Seo'

/** Fecha de la última actualización de esta Política (se muestra al principio del texto) */
const PRIVACY_LAST_UPDATED = '21 de octubre de 2026'
const privacyMarkdown = markdown.replace('{{FECHA_ACTUALIZACION}}', PRIVACY_LAST_UPDATED)

export default function PrivacyPage() {
  return (
    <>
      <Seo title="Política de Privacidad y Cookies" description="Cómo recopilamos, usamos y compartimos tus datos personales, qué cookies usamos y cómo ejercer tus derechos." canonicalPath="/privacidad" />
      <LegalPage markdown={privacyMarkdown} />
    </>
  )
}
