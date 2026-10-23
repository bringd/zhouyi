import { PageLayout } from '@/components/layout/PageLayout'
import { DivinationForm } from '@/components/sections/DivinationForm'
import { SEO } from '@/lib/seo'
import '@/styles/divination.css'

export default function Divination() {
  return (
    <PageLayout
      rootClassName="studio-page divination-page"
      className="studio-content"
    >
      <SEO
        title="三数起卦"
        description="通过三个数字起卦，结合周易文化与 AI 深度解读。"
      />
      <DivinationForm />
    </PageLayout>
  )
}
