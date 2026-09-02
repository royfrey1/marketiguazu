import { useState, useEffect } from 'react'
import useAuth from '../../hooks/useAuth'
import { favoritesService } from '../../services/favorites.service'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeart } from '@fortawesome/free-solid-svg-icons'

interface BotonFavoritoProps {
  publicacionId: number
}

export default function BotonFavorito({ publicacionId }: BotonFavoritoProps) {
  const { user } = useAuth()
  const [esFavorito, setEsFavorito] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { data } = await favoritesService.check(user.id, publicacionId)
      if (!cancelled && data) setEsFavorito(true)
    })()
    return () => { cancelled = true }
  }, [publicacionId, user])

  const toggleFavorito = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (loading) return

    if (!user) {
      alert("¡Tenés que iniciar sesión para guardar favoritos!")
      return
    }

    try {
      setLoading(true)

      if (esFavorito) {
        const { error } = await favoritesService.remove(user.id, publicacionId)
        if (error) throw error
        setEsFavorito(false)
      } else {
        const { error } = await favoritesService.add(user.id, publicacionId)
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
      className="absolute top-3 right-3 z-10 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-md hover:scale-110 transition-transform duration-200 cursor-pointer text-xl"
    >
      {esFavorito ? <FontAwesomeIcon icon={faHeart} style={{color: "#1caaa8"}} /> : <FontAwesomeIcon icon={faHeart} style={{color: "#ccc"}} />}
    </button>
  )
}
