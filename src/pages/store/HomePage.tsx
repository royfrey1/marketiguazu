import { useState, useEffect } from 'react'
import { productsService, type ProductWithPrimaryImage } from '../../services/products.service'
import { categoriesService, type Category } from '../../services/categories.service'
import HeroSection from '../../components/home/HeroSection'
import TrustBar from '../../components/home/TrustBar'
import CategoriesSection from '../../components/home/CategoriesSection'
import FeaturedProducts from '../../components/home/FeaturedProducts'
import ProblemSolutionSection from '../../components/home/ProblemSolutionSection'
import PromoBlock from '../../components/home/PromoBlock'
import TrendingSection from '../../components/home/TrendingSection'
import BenefitsSection from '../../components/home/BenefitsSection'
import IdentityCTA from '../../components/home/IdentityCTA'

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
        const { data, error } = await productsService.getRecent(4)
        if (error) throw error
        if (!cancelled && data) setDestacados(data as ProductWithPrimaryImage[])
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
        const { data: featured, error } = await productsService.getFeatured(8)
        if (error) throw error
        let list = (featured || []) as ProductWithPrimaryImage[]
        if (list.length === 0) {
          const { data: recent } = await productsService.getRecent(8)
          list = (recent || []) as ProductWithPrimaryImage[]
        }
        if (!cancelled) setOffers(list)
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
      <main>
        <HeroSection />
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
