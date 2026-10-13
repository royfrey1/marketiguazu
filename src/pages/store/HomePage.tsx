import { useState, useEffect } from 'react'
import { productsService, type ProductWithPrimaryImage } from '../../services/products.service'
import { categoriesService, type Category } from '../../services/categories.service'
import Seo from '../../components/seo/Seo'
import { SITE_NAME, SITE_URL } from '../../config/site'
import HeroSection from '../../components/home/HeroSection'
import TrustBar from '../../components/home/TrustBar'
import PaymentMethodsTicker from '../../components/store/PaymentMethodsTicker'
import CategoriesSection from '../../components/home/CategoriesSection'
import FeaturedProducts from '../../components/home/FeaturedProducts'
import ProblemSolutionSection from '../../components/home/ProblemSolutionSection'
import PromoBlock from '../../components/home/PromoBlock'
import TrendingSection from '../../components/home/TrendingSection'
import BenefitsSection from '../../components/home/BenefitsSection'
import IdentityCTA from '../../components/home/IdentityCTA'

const FEATURED_COUNT = 4

export default function Home() {
  const [categorias, setCategorias] = useState<Category[]>([])
  const [destacados, setDestacados] = useState<ProductWithPrimaryImage[]>([])
  const [loadingDestacados, setLoadingDestacados] = useState(true)
  const [trending, setTrending] = useState<ProductWithPrimaryImage[]>([])
  const [loadingTrending, setLoadingTrending] = useState(true)
  const [offers, setOffers] = useState<ProductWithPrimaryImage[]>([])
  const [loadingOffers, setLoadingOffers] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: cats } = await categoriesService.getActive()
      if (!cancelled) setCategorias((cats || []) as Category[])
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoadingDestacados(true)
        // Los marcados como destacados; si son menos de 4, se completa con los más recientes (sin repetir)
        const { data: featured, error } = await productsService.getFeatured(FEATURED_COUNT)
        if (error) throw error
        let list = (featured || []) as ProductWithPrimaryImage[]
        if (list.length < FEATURED_COUNT) {
          const { data: recent } = await productsService.getRecent(FEATURED_COUNT + list.length)
          const ids = new Set(list.map(p => p.id))
          const extra = ((recent || []) as ProductWithPrimaryImage[]).filter(p => !ids.has(p.id))
          list = [...list, ...extra].slice(0, FEATURED_COUNT)
        }
        if (!cancelled) setDestacados(list)
      } catch (err) {
        console.error('Error cargando destacados:', (err as Error).message)
      } finally {
        if (!cancelled) setLoadingDestacados(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoadingTrending(true)
        const { data, error } = await productsService.getCheapest(4)
        if (error) throw error
        if (!cancelled && data) setTrending(data as ProductWithPrimaryImage[])
      } catch (err) {
        console.error('Error cargando trending:', (err as Error).message)
      } finally {
        if (!cancelled) setLoadingTrending(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoadingOffers(true)
        // Solo productos con oferta efectiva; sin ofertas, el bloque no se muestra
        const { data, error } = await productsService.getOffers(8)
        if (error) throw error
        if (!cancelled) setOffers((data || []) as ProductWithPrimaryImage[])
      } catch (err) {
        console.error('Error cargando ofertas:', (err as Error).message)
      } finally {
        if (!cancelled) setLoadingOffers(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <Seo
        canonicalPath="/"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
            logo: `${SITE_URL}/apple-touch-icon.png`,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            url: SITE_URL,
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: `${SITE_URL}/busqueda?q={search_term_string}`,
              },
              'query-input': 'required name=search_term_string',
            },
          },
        ]}
      />
      <main>
        <HeroSection />
        <PaymentMethodsTicker />
        <TrustBar />
        <CategoriesSection categories={categorias} />
        <FeaturedProducts products={destacados} loading={loadingDestacados} />
        <ProblemSolutionSection />
        <PromoBlock products={offers} loading={loadingOffers} />
        <TrendingSection products={trending} loading={loadingTrending} />
        <BenefitsSection />
        <IdentityCTA />
      </main>
    </div>
  )
}
