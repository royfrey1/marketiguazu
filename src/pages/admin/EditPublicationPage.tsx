import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import { categoriesService } from '../../services/categories.service'
import { uploadService } from '../../services/upload.service'
import { productsService } from '../../services/products.service'

interface Categoria {
  id: number | string
  nombre: string
  icono: string
}

interface FormState {
  titulo: string
  descripcion: string
  precio: string
  categoria_id: string | number
}

interface EditFields {
  titulo: boolean
  descripcion: boolean
  precio: boolean
  categoria: boolean
}

export default function EditarPublicacion() {
  const { user } = useAuth()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])

  // Estados para manejo de MULTIPLES IMÁGENES
  const [imagenesExistentes, setImagenesExistentes] = useState<string[]>([])
  const [nuevasFotos, setNuevasFotos] = useState<File[]>([])
  const [previewsNuevas, setPreviewsNuevas] = useState<string[]>([])

  // Estados para BLOQUEO/EDICIÓN de campos individuales
  const [editFields, setEditFields] = useState<EditFields>({
    titulo: false,
    descripcion: false,
    precio: false,
    categoria: false
  })

  const [form, setForm] = useState<FormState>({
    titulo: '',
    descripcion: '',
    precio: '',
    categoria_id: '',
  })

  useEffect(() => {
    const closeMenu = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [])

  useEffect(() => {
    let cancelled = false
    const cargarDatos = async () => {
      const { data: cats } = await categoriesService.getAll()
      if (!cancelled) setCategorias(cats || [])

      const { data, error } = await productsService.getById(Number(id))
      if (cancelled) return

      if (error || !data) {
        navigate('/dashboard')
        return
      }

      if (data.user_id !== user?.id) {
        navigate('/dashboard')
        return
      }

      setForm({
        titulo: data.titulo,
        descripcion: data.descripcion || '',
        precio: data.precio,
        categoria_id: data.categoria_id,
      })

      const imgs = Array.isArray(data.imagenes) 
        ? data.imagenes 
        : [data.imagen_url].filter(Boolean)
      setImagenesExistentes(imgs)

      setLoading(false)
    }

    cargarDatos()
    return () => { cancelled = true }
  }, [id, navigate, user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  // Manejo de carga local de múltiples imágenes
  const handleImagenesMultiples = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files || [])
    setNuevasFotos((prev) => [...prev, ...archivos])

    const nuevasPreviews = archivos.map((file) => URL.createObjectURL(file))
    setPreviewsNuevas((prev) => [...prev, ...nuevasPreviews])
  }

  const eliminarExistente = (urlEliminar: string) => {
    setImagenesExistentes(imagenesExistentes.filter((url) => url !== urlEliminar))
  }

  const eliminarNueva = (indexEliminar: number) => {
    setNuevasFotos(nuevasFotos.filter((_, i) => i !== indexEliminar))
    setPreviewsNuevas(previewsNuevas.filter((_, i) => i !== indexEliminar))
  }

  // Activar/desactivar inputs individualmente
  const toggleEditField = (field: keyof EditFields) => {
    setEditFields({ ...editFields, [field]: !editFields[field] })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (!user) return
      const urlsNuevasSubidas: string[] = []

      // Subir las fotos nuevas una por una al Storage
      for (const foto of nuevasFotos) {
        const { data: uploadData, error: uploadError } = await uploadService.uploadPublicationImage(user.id, foto)
        if (uploadError) throw uploadError
        urlsNuevasSubidas.push(uploadData!.url)
      }

      const todasLasImagenes = [...imagenesExistentes, ...urlsNuevasSubidas]

      if (todasLasImagenes.length === 0) {
        throw new Error("Tenés que incluir al menos una foto de tu producto.")
      }

      const { error: updateError } = await productsService.update(Number(id), {
        titulo: form.titulo,
        descripcion: form.descripcion,
        precio: parseFloat(form.precio),
        categoria_id: parseInt(String(form.categoria_id)),
        imagenes: todasLasImagenes,
        imagen_url: todasLasImagenes[0],
      })

      if (updateError) throw updateError

      navigate('/dashboard')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancelar = () => {
    const confirmar = window.confirm("¿Seguro que querés salir? Los cambios no guardados se perderán.");
    if (confirmar) navigate('/dashboard');
  }; 

  if (loading) {
    return (
      <div className="min-h-screen bg-[#185749] flex items-center justify-center">
        <p className="text-[#B5E3D4] animate-pulse font-black uppercase tracking-[0.3em]">Cargando Edición...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1b382f] text-white">
      
      <div className="pt-22 md:pt-28 lg:pt-32 pb-2 px-4 md:px-6 max-w-7xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="cursor-pointer inline-flex items-center text-white border-2 border-white/20 hover:border-[#1CAAA8] rounded-xl p-2 text-md m-2 transition-colors"
      >
        ← Volver
      </button> 
      <h1 className="inline-flex items-center text-2xl font-bold text-white tracking-tighter p-2 m-2">Editar publicación</h1>
      
    </div>
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
          {error}
        </div>
      )}

      {/* DISEÑO SPLIT: Grilla de 1 col en celular, 2 col en escritorios */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white/5 backdrop-blur-xl border-2 border-[#B5E3D4]/20 rounded-[2.5rem] p-4 md:p-8 shadow-2xl">
        
        {/* COLUMNA IZQUIERDA: GESTIÓN DE FOTOS (Ocupa 5 de 12 columnas) */}
        <div className="lg:col-span-5 space-y-4 border-b lg:border-b-0 lg:border-r border-white/10 pb-6 lg:pb-0 lg:pr-6">
          <label className="text-sm font-semibold text-[#B5E3D4] block mb-2">Fotos del producto</label>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Fotos guardadas en Supabase */}
            {imagenesExistentes.map((url, index) => (
              <div key={`existente-${index}`} className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 group bg-black/20">
                <img src={url} alt="Producto" className="w-full h-full object-cover" />
                <button type="button" onClick={() => eliminarExistente(url)} className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors shadow-md">✕</button>
                <span className="absolute bottom-1 left-1 bg-emerald-950/80 text-[#B5E3D4] text-[10px] px-2 py-0.5 rounded-md font-medium">Guardada</span>
              </div>
            ))}

            {/* Fotos nuevas listas para subir */}
            {previewsNuevas.map((url, index) => (
              <div key={`nueva-${index}`} className="relative aspect-square rounded-2xl overflow-hidden border border-dashed border-[#1CAAA8] bg-[#1CAAA8]/10">
                <img src={url} alt="Nueva" className="w-full h-full object-cover" />
                <button type="button" onClick={() => eliminarNueva(index)} className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors shadow-md">✕</button>
                <span className="absolute bottom-1 left-1 bg-sky-600/90 text-white text-[10px] px-2 py-0.5 rounded-md font-medium">Nueva</span>
              </div>
            ))}

            {/* Botón dinámico para añadir más fotos */}
            <label className="cursor-pointer aspect-square rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 hover:border-[#B5E3D4] transition-all text-white/60 hover:text-white">
              <span className="text-2xl">➕</span>
              <span className="text-xs font-bold mt-1">Añadir foto</span>
              <input type="file" accept="image/*" multiple onChange={handleImagenesMultiples} className="hidden" />
            </label>
          </div>
        </div>

        {/* COLUMNA DERECHA: FORMULARIO CON INPUTS BLOQUEABLES (Ocupa 7 de 12 columnas) */}
        <div className="lg:col-span-7 space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            
            {/* INPUT TÍTULO */}
            <div>
              <label className="text-sm text-white/60 mb-1 flex justify-between items-center">
                <span>Título</span>
                <button type="button" onClick={() => toggleEditField('titulo')} className={`text-xs px-2 py-1 rounded-md transition-colors ${editFields.titulo ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/80'}`}>
                  {editFields.titulo ? '🔒 Bloquear' : '✏️ Editar'}
                </button>
              </label>
              <input
                type="text"
                name="titulo"
                value={form.titulo}
                onChange={handleChange}
                disabled={!editFields.titulo}
                required
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all ${
                  editFields.titulo 
                    ? 'bg-white/10 border-[#1CAAA8] text-white' 
                    : 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                }`}
              />
            </div>

            {/* INPUT DESCRIPCIÓN */}
            <div>
              <label className="text-sm text-white/60 mb-1 flex justify-between items-center">
                <span>Descripción</span>
                <button type="button" onClick={() => toggleEditField('descripcion')} className={`text-xs px-2 py-1 rounded-md transition-colors ${editFields.descripcion ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/80'}`}>
                  {editFields.descripcion ? '🔒 Bloquear' : '✏️ Editar'}
                </button>
              </label>
              <textarea
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                disabled={!editFields.descripcion}
                rows={3}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all resize-none ${
                  editFields.descripcion 
                    ? 'bg-white/10 border-[#1CAAA8] text-white' 
                    : 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                }`}
              />
            </div>

            {/* INPUT PRECIO */}
            <div>
              <label className="text-sm text-white/60 mb-1 flex justify-between items-center">
                <span>Precio</span>
                <button type="button" onClick={() => toggleEditField('precio')} className={`text-xs px-2 py-1 rounded-md transition-colors ${editFields.precio ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/80'}`}>
                  {editFields.precio ? '🔒 Bloquear' : '✏️ Editar'}
                </button>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                <input
                  type="number"
                  name="precio"
                  value={form.precio}
                  onChange={handleChange}
                  disabled={!editFields.precio}
                  required
                  min="0"
                  className={`w-full border rounded-xl pl-8 pr-4 py-3 text-sm focus:outline-none transition-all ${
                    editFields.precio 
                      ? 'bg-white/10 border-[#1CAAA8] text-white' 
                      : 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                  }`}
                />
              </div>
            </div>

            {/* DROPDOWN CATEGORÍA BLOQUEABLE */}
            <div className="relative" ref={dropdownRef}>
              <label className="text-sm text-white/60 mb-1 flex justify-between items-center">
                <span>Categoría</span>
                <button type="button" onClick={() => toggleEditField('categoria')} className={`text-xs px-2 py-1 rounded-md transition-colors ${editFields.categoria ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/80'}`}>
                  {editFields.categoria ? '🔒 Bloquear' : '✏️ Editar'}
                </button>
              </label>
              
              <div
                onClick={() => editFields.categoria && setMenuOpen(!menuOpen)}
                className={`w-full border rounded-xl px-4 py-3 text-sm flex justify-between items-center transition-all ${
                  editFields.categoria 
                    ? 'bg-white/10 border-white/30 cursor-pointer text-white hover:border-[#B5E3D4]' 
                    : 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                <span>
                  {form.categoria_id 
                    ? categorias.find(c => String(c.id) === String(form.categoria_id))?.nombre 
                    : "Seleccioná una categoría"}
                </span>
                {editFields.categoria && (
                  <span className={`transition-transform duration-300 ${menuOpen ? 'rotate-180' : ''}`}>▼</span>
                )}
              </div>

              {menuOpen && editFields.categoria && (
                <ul className="absolute bottom-[calc(100%+5px)] left-0 z-[100] w-full bg-[#1b382f] border border-white/20 rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                  {categorias.map((cat) => (
                    <li
                      key={cat.id}
                      onClick={() => {
                        setForm({ ...form, categoria_id: cat.id });
                        setMenuOpen(false);
                      }}
                      className="px-4 py-3 text-sm text-white hover:bg-[#B5E3D4] hover:text-[#050810] cursor-pointer transition-colors flex items-center gap-3"
                    >
                      <span>{cat.icono}</span>
                      <span className="font-medium">{cat.nombre}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>

          {/* BOTONERA DE ACCIÓN */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 mt-6 border-t border-white/10">
            <button
              type="button"
              onClick={handleCancelar}
              className="flex-1 bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-red-500/10 hover:border-red-500/40 py-3 rounded-xl font-bold transition-all order-2 sm:order-1 cursor-pointer"
            >
              Descartar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex-[2] bg-[#B5E3D4] hover:bg-[#1CAAA8] disabled:opacity-50 text-slate-900 font-bold py-3 rounded-xl order-1 sm:order-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando cambios...' : 'Guardar Cambios'}
            </button>
          </div>

        </div>
      </form>
    </div>
  )
}
