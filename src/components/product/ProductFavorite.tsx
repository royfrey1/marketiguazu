import { useState, useEffect } from 'react'
import { sileo } from 'sileo'
import useAuth from '../../hooks/useAuth'
import { favoritesService } from '../../services/favorites.service'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeart } from '@fortawesome/free-solid-svg-icons'

interface BotonFavoritoProps {
  productId: number
}

export default function BotonFavorito({ productId }: BotonFavoritoProps) {
  const { user } = useAuth()
  const [esFavorito, setEsFavorito] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { data } = await favoritesService.check(user.id, productId)
      if (!cancelled && data) setEsFavorito(true)
    })()
    return () => { cancelled = true }
  }, [productId, user])

  const toggleFavorito = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (loading) return

    if (!user) {
      sileo.info({ title: "Iniciá sesión", description: "Necesitás iniciar sesión para guardar favoritos." })
      return
    }

    try {
      setLoading(true)

      if (esFavorito) {
        const { error } = await favoritesService.remove(user.id, productId)
        if (error) throw error
        setEsFavorito(false)
      } else {
        const { error } = await favoritesService.add(user.id, productId)
        if (error) throw error
        setEsFavorito(true)
      }
    } catch (error) {
      console.error("Error con el favorito:", (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggleFavorito}
      className="absolute top-2 right-2 z-10 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-md hover:scale-110 transition-transform duration-200 cursor-pointer text-xl"
    >
      {esFavorito ? <FontAwesomeIcon icon={faHeart} style={{color: "#1caaa8"}} /> : <FontAwesomeIcon icon={faHeart} style={{color: "#9c9c9c"}} />}
    </button>
  )
}
