import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

export default function HomePage() {
  const { t } = useTranslation()

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">{t('app.title')}</h1>
      <Button>OK</Button>
    </main>
  )
}
