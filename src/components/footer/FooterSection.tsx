import { useTranslation } from 'react-i18next'
import { SiteFooter } from '../../ui/SiteShell'
export function FooterSection() {
  const { i18n } = useTranslation()
  return <SiteFooter game="AtlasMaster" language={i18n.language} />
}
