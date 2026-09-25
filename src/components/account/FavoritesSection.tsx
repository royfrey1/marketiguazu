import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { favoritesService } from '../../services/favorites.service'

interface FavoritoProducto {
  id: number
  titulo: string
  slug: string
  precio: number
  precio_anterior: number | null
  imagen_url: string | null
  categories: { id: number; nombre: string; icono: string | null } | null
}

interface FavoritesSectionProps {
  userId: string
}

export default function FavoritesSection({ userId }: FavoritesSectionProps) {
  const [favorites, setFavorites] = useState<FavoritoProducto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await favoritesService.getByUserId(userId)
      if (!cancelled) {
        const items = (data || []).map(f => f.products).filter(Boolean) as FavoritoProducto[]
        setFavorites(items)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  const removeFavorite = (productId: number) => {
    favoritesService.remove(userId, productId)
    setFavorites(prev => prev.filter(f => f.id !== productId))
  }

  if (loading) return <p className="text-gray-400 animate-pulse py-8">Cargando favoritos...</p>

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-primary-dark">Favoritos</h2>
        <p className="text-sm text-gray-500 mt-0.5">Productos que te interesaron.</p>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
          <Heart className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-3">No tenés productos favoritos.</p>
          <Link to="/busqueda" className="text-accent font-bold text-sm hover:underline">Explorar productos</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map(prod => (
            <div key={prod.id} className="relative bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition-all group">
              <button
                onClick={() => removeFavorite(prod.id)}
                className="absolute top-2 right-2 z-10 bg-white/80 backdrop-blur-sm p-1.5 rounded-full shadow-sm hover:scale-110 transition-transform cursor-pointer"
                aria-label="Eliminar de favoritos"
              >
                <Heart className="w-4 h-4 fill-accent text-accent" />
              </button>
              <Link to={`/producto/${prod.slug}`}>
                <div className="h-32 bg-gray-50 overflow-hidden">
                  {prod.imagen_url && <img src={prod.imagen_url} alt={prod.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />}
                </div>
                <div className="p-3">
                  <h4 className="text-gray-800 font-bold text-xs truncate">{prod.titulo}</h4>
                  <p className="text-accent font-bold text-sm mt-1">${prod.precio?.toLocaleString('es-AR')}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
