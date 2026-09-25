import { useState, useEffect } from 'react'
import { MapPin, Trash2, Check } from 'lucide-react'
import { addressService, type AddressRow } from '../../services/address.service'
import Button from '../ui/Button'
import Input from '../ui/Input'

interface AddressesSectionProps {
  userId: string
}

type Feedback = { type: 'success' | 'error'; message: string } | null

const emptyForm = { nombre: '', calle: '', numero: '', piso: '', departamento: '', ciudad: '', provincia: '', codigo_postal: '', pais: 'Argentina', telefono: '' }

export default function AddressesSection({ userId }: AddressesSectionProps) {
  const [addresses, setAddresses] = useState<AddressRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [feedback, setFeedback] = useState<Feedback>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await addressService.getByUserId(userId)
      if (!cancelled) {
        setAddresses(data || [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)
    if (editing) {
      const { data, error } = await addressService.update(editing, form)
      if (error) {
        setFeedback({ type: 'error', message: error.message })
        return
      }
      if (data) setAddresses(prev => prev.map(a => a.id === editing ? data : a))
      setEditing(null)
      setFeedback({ type: 'success', message: 'Dirección actualizada.' })
    } else {
      const { data, error } = await addressService.create({ ...form, user_id: userId, es_default: addresses.length === 0 })
      if (error) {
        setFeedback({ type: 'error', message: error.message })
        return
      }
      if (data) setAddresses(prev => [data, ...prev])
      setShowForm(false)
      setFeedback({ type: 'success', message: 'Dirección creada.' })
    }
    setForm(emptyForm)
  }

  const handleDelete = async (id: number) => {
    const { error } = await addressService.delete(id)
    if (!error) setAddresses(prev => prev.filter(a => a.id !== id))
  }

  const handleSetDefault = async (id: number) => {
    const { data } = await addressService.setDefault(userId, id)
    if (data) setAddresses(prev => prev.map(a => ({ ...a, es_default: a.id === id })))
  }

  const startEdit = (addr: AddressRow) => {
    setForm({ nombre: addr.nombre, calle: addr.calle, numero: addr.numero || '', piso: addr.piso || '', departamento: addr.departamento || '', ciudad: addr.ciudad, provincia: addr.provincia, codigo_postal: addr.codigo_postal, pais: addr.pais, telefono: addr.telefono || '' })
    setEditing(addr.id)
    setShowForm(true)
    setFeedback(null)
  }

  if (loading) return <p className="text-gray-400 animate-pulse py-8">Cargando direcciones...</p>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-primary-dark">Direcciones</h2>
          <p className="text-sm text-gray-500 mt-0.5">Gestioná tus direcciones de envío.</p>
        </div>
        {!showForm && (
          <Button variant="outline" size="sm" onClick={() => { setShowForm(true); setEditing(null); setFeedback(null) }}>
            + Nueva
          </Button>
        )}
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
          feedback.type === 'success'
            ? 'bg-secondary/10 text-secondary'
            : 'bg-red-50 text-red-600'
        }`}>
          {feedback.type === 'success' && <Check className="w-4 h-4 shrink-0" />}
          {feedback.message}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="space-y-4 p-5 bg-gray-50 rounded-2xl border border-gray-100">
          <h3 className="text-sm font-bold text-primary-dark">{editing ? 'Editar dirección' : 'Nueva dirección'}</h3>
          <Input label="Nombre" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required placeholder="Casa, Trabajo..." />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input label="Calle" value={form.calle} onChange={e => setForm(f => ({ ...f, calle: e.target.value }))} required />
            </div>
            <Input label="Número" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Piso" value={form.piso} onChange={e => setForm(f => ({ ...f, piso: e.target.value }))} />
            <Input label="Departamento" value={form.departamento} onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Ciudad" value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} required />
            <Input label="Provincia" value={form.provincia} onChange={e => setForm(f => ({ ...f, provincia: e.target.value }))} required />
            <Input label="Código postal" value={form.codigo_postal} onChange={e => setForm(f => ({ ...f, codigo_postal: e.target.value }))} required />
          </div>
          <Input label="Teléfono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          <div className="flex gap-2">
            <Button type="submit" size="sm">{editing ? 'Guardar' : 'Crear'}</Button>
            <Button variant="ghost" size="sm" type="button" onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm) }}>Cancelar</Button>
          </div>
        </form>
      )}

      {addresses.length === 0 && !showForm ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
          <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No tenés direcciones guardadas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map(addr => (
            <div key={addr.id} className={`p-4 rounded-xl border transition-all ${addr.es_default ? 'border-accent bg-accent/5' : 'border-gray-100 bg-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-primary-dark">{addr.nombre}</span>
                    {addr.es_default && (
                      <span className="text-[10px] font-bold uppercase bg-accent text-white px-2 py-0.5 rounded-full">Predeterminada</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{addr.calle}{addr.numero ? ` ${addr.numero}` : ''}{addr.piso ? `, Piso ${addr.piso}` : ''}{addr.departamento ? ` Depto ${addr.departamento}` : ''}</p>
                  <p className="text-sm text-gray-500">{addr.ciudad}, {addr.provincia} {addr.codigo_postal}</p>
                  {addr.telefono && <p className="text-xs text-gray-400 mt-1">Tel: {addr.telefono}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!addr.es_default && (
                    <button onClick={() => handleSetDefault(addr.id)} className="text-xs text-accent hover:underline cursor-pointer">Predeterminar</button>
                  )}
                  <button onClick={() => startEdit(addr)} className="text-xs text-gray-400 hover:text-gray-700 cursor-pointer px-2 py-1">Editar</button>
                  <button onClick={() => handleDelete(addr.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
