// import { useState, useEffect } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { supabase } from '../supabaseClient'

// export default function EditarPerfil() {
//   const navigate = useNavigate()
//   const [loading, setLoading] = useState(true)
//   const [subiendo, setSubiendo] = useState(false)
  
//   // Estados del Formulario
//   const [nombre, setNombre] = useState('')
//   const [whatsapp, setWhatsapp] = useState('')
//   const [ciudad, setCiudad] = useState('Puerto Iguazú')
//   const [avatarUrl, setAvatarUrl] = useState('')

//   useEffect(() => {
//     obtenerPerfil()
//   }, [])

//   const obtenerPerfil = async () => {
//     try {
//       setLoading(true)
//       // Obtenemos el usuario autenticado actual
//       const { data: { user } } = await supabase.auth.getUser()

//       if (user) {
//         const { data, error } = await supabase
//           .from('profiles')
//           .select('nombre, whatsapp, ciudad, avatar_url')
//           .eq('id', user.id)
//           .single()

//         if (error && error.code !== 'PGRST116') throw error

//         if (data) {
//           setNombre(data.nombre || '')
//           setWhatsapp(data.whatsapp || '')
//           setCiudad(data.ciudad || 'Puerto Iguazú')
//           setAvatarUrl(data.avatar_url || '')
//         }
//       }
//     } catch (error) {
//       alert('Error al cargar datos del perfil')
//     } finally {
//       setLoading(false)
//     }
//   }

//   const subirAvatar = async (event) => {
//   try {
//     setSubiendo(true)
//     if (!event.target.files || event.target.files.length === 0) {
//       throw new Error('Debes seleccionar una imagen.')
//     }

//     const file = event.target.files[0]
//     const fileExt = file.name.split('.').pop()
//     const { data: { user } } = await supabase.auth.getUser()
    
//     if (!user) throw new Error('¡No hay un usuario logueado!')

//     const fileName = `${user.id}-${Math.random()}.${fileExt}`
//     const filePath = `${fileName}`

//     // Intentamos la subida
//     const { error: uploadError, data: uploadData } = await supabase.storage
//       .from('avatar')
//       .upload(filePath, file, { upsert: true })

//     if (uploadError) {
//       // nos ayuda a identificar problemas en la consola
//       console.error("Error detallado de Supabase Storage:", uploadError)
//       throw uploadError
//     }

//     const { data: { publicUrl } } = supabase.storage
//       .from('avatar')
//       .getPublicUrl(filePath)

//     console.log("URL pública generada con éxito:", publicUrl)
//     setAvatarUrl(publicUrl)

//   } catch (error) {
//     alert('Error subiendo el avatar: ' + error.message)
//   } finally {
//     setSubiendo(false)
//   }
// }

//   const actualizarPerfil = async (e) => {
//     e.preventDefault()
//     try {
//       setLoading(true)
//       const { data: { user } } = await supabase.auth.getUser()

//       const actualizaciones = {
//         id: user.id,
//         nombre,
//         whatsapp,
//         ciudad,
//         avatar_url: avatarUrl,
//         updated_at: new Date(),
//       }

//       const { error } = await supabase.from('profiles').upsert(actualizaciones)

//       if (error) throw error
      
//       // Si todo sale bien, vuelve al dashboard, sino tira error 
//       navigate('/dashboard') 
//     } catch (error) {
//       alert('Error al actualizar el perfil: ' + error.message)
//     } finally {
//       setLoading(false)
//     }
//   }

//   if (loading && !subiendo) {
//     return (
//       <div className="min-h-screen bg-[#1b382f] flex items-center justify-center">
//         <p className="text-[#B5E3D4] animate-pulse font-black uppercase tracking-widest">Cargando perfil...</p>
//       </div>
//     )
//   }

//   return (
//     <div className="min-h-screen bg-[#1b382f] px-4 pt-32 pb-10 flex items-center justify-center text-white">
//       <div className="w-full max-w-4xl bg-white/5 backdrop-blur-xl border-2 border-[#B5E3D4]/20 p-8 md:p-12 rounded-[3rem] shadow-2xl text-white">
        
//         <h2 className="text-2xl font-black uppercase tracking-tighter text-center mb-6">
//           Editar mi Perfil
//         </h2>

//         <form onSubmit={actualizarPerfil} className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
          

//           <div className="md:col-span-7 space-y-6 order-2 md:order-1">
            
//             <div>
//               <label className="block text-[10px] font-black uppercase tracking-widest text-[#B5E3D4] mb-2">Nombre del Vendedor / Tienda</label>
//               <input
//                 type="text"
//                 required
//                 value={nombre}
//                 onChange={(e) => setNombre(e.target.value)}
//                 className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-[#1CAAA8] transition-all"
//               />
//             </div>

//             <div>
//               <label className="block text-[10px] font-black uppercase tracking-widest text-[#B5E3D4] mb-2">WhatsApp Directo</label>
//               <input
//                 type="text"
//                 required
//                 value={whatsapp}
//                 onChange={(e) => setWhatsapp(e.target.value)}
//                 className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-[#1CAAA8] transition-all"
//               />
//             </div>

//             <div>
//               <label className="block text-[10px] font-black uppercase tracking-widest text-[#B5E3D4] mb-2">Ubicación</label>
//               <select
//                 value={ciudad}
//                 onChange={(e) => setCiudad(e.target.value)}
//                 className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-[#1CAAA8] transition-all appearance-none"
//               >
//                 <option value="Puerto Iguazú" className="bg-[#1b382f]">Puerto Iguazú</option>
//                 <option value="Posadas" className="bg-[#1b382f]">Posadas</option>
//                 <option value="Andresito" className="bg-[#1b382f]">Andresito</option>
//                 <option value="Eldorado" className="bg-[#1b382f]">Eldorado</option>
//                 <option value="Wanda" className="bg-[#1b382f]">Wanda</option>
//                 <option value="Esperanza" className="bg-[#1b382f]">Esperanza</option>
//                 <option value="Libertad" className="bg-[#1b382f]">Libertad</option>
//               </select>
//             </div>

//             {/* BOTONES DE ACCIÓN (Ahora en la base de la columna izquierda) */}
//             <div className="flex gap-4 pt-6">
//               <button
//                 type="button"
//                 onClick={() => navigate('/panel')}
//                 className="flex-1 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-xs py-5 rounded-2xl hover:bg-white/10 transition-all"
//               >
//                 Cancelar
//               </button>
//               <button
//                 type="submit"
//                 disabled={loading || subiendo}
//                 className="flex-1 bg-[#1CAAA8] hover:bg-[#B5E3D4] text-white hover:text-[#050810] font-black uppercase tracking-widest text-xs py-5 rounded-2xl transition-all shadow-lg active:scale-95"
//               >
//                 {loading ? 'Guardando...' : 'Guardar Cambios'}
//               </button>
//             </div>
//           </div>

//           {/* COLUMNA DERECHA: IMAGEN (Ocupa 5 de 12 columnas) */}
//           <div className="md:col-span-5 flex flex-col items-center justify-center space-y-6 order-1 md:order-2 bg-white/5 p-8 rounded-[2rem] border border-white/5">
//             <div className="relative group">
//               <div className="w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden bg-[#1b382f] border-4 border-[#1CAAA8] shadow-2xl flex items-center justify-center">
//                 {avatarUrl ? (
//                   <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
//                 ) : (
//                   <span className="text-6xl font-black text-[#1CAAA8]">
//                     {nombre ? nombre.charAt(0).toUpperCase() : '👤'}
//                   </span>
//                 )}
//               </div>
              
//               {/* Overlay de carga */}
//               {subiendo && (
//                 <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm">
//                   <div className="w-8 h-8 border-4 border-[#1CAAA8] border-t-transparent rounded-full animate-spin"></div>
//                 </div>
//               )}
//             </div>

//             <div className="text-center">
//               <label className="cursor-pointer inline-flex flex-col items-center gap-2">
//                 <span className="bg-[#1CAAA8] hover:bg-[#B5E3D4] text-white hover:text-[#050810] text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-full transition-all shadow-md">
//                   {subiendo ? 'PROCESANDO...' : 'REEMPLAZAR FOTO'}
//                 </span>
//                 <p className="text-white/30 text-[9px] font-bold uppercase tracking-widest mt-2">Formatos: JPG, PNG o WEBP</p>
//                 <input
//                   type="file"
//                   accept="image/*"
//                   onChange={subirAvatar}
//                   disabled={subiendo}
//                   className="hidden"
//                 />
//               </label>
//             </div>
//           </div>

//         </form>
//       </div>
//     </div>
//   )
// }