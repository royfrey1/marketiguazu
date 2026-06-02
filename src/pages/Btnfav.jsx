import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeart } from '@fortawesome/free-solid-svg-icons'

export default function BotonFavorito({ publicacionId }) {
  const [esFavorito, setEsFavorito] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Comprueba si el producto ya está en favoritos al cargar la tarjeta
    async function verificarFavorito() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return // Si no está logueado, no hace nada

      const { data, error } = await supabase
        .from('favoritos')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('publicacion_id', publicacionId)
        .maybeSingle() // Trae un resultado o null sin tirar error

      if (data) setEsFavorito(true)
    }

    verificarFavorito()
  }, [publicacionId])

  const toggleFavorito = async (e) => {
    e.preventDefault() // Evita que al hacer clic nos mande al detalle del producto
    if (loading) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      alert("¡Tenés que iniciar sesión para guardar favoritos!")
      return
    }

    try {
      setLoading(true)

      if (esFavorito) {
        // Si ya era favorito, lo borramos
        const { error } = await supabase
          .from('favoritos')
          .delete()
          .eq('user_id', session.user.id)
          .eq('publicacion_id', publicacionId)

        if (error) throw error
        setEsFavorito(false)
      } else {
        // Si no era, lo agregamos
        const { error } = await supabase
          .from('favoritos')
          .insert({ user_id: session.user.id, publicacion_id: publicacionId })

        if (error) throw error
        setEsFavorito(true)
      }
    } catch (error) {
      console.error("Error con el favorito:", error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggleFavorito}
      className="absolute top-3 right-3 z-10 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-md hover:scale-110 transition-transform duration-200 cursor-pointer text-xl"
    >
      {esFavorito ? <FontAwesomeIcon icon={faHeart} style={{color: "#1caaa8",}} /> : <FontAwesomeIcon icon={faHeart} style={{color: "#ccc",}} />}
    </button>
  )
}