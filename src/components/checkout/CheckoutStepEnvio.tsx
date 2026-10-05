import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MapPin, Plus, Check, Pencil, Trash2, Star, Loader2, Truck, AlertTriangle } from 'lucide-react'
import useAuth from '../../hooks/useAuth'
import { addressService, type AddressRow, type AddressInsert } from '../../services/address.service'
import { addressSchema, type AddressFormData } from '../../lib/validations/address'
import { normalizeArPhone, phoneToInputValue, PHONE_HELP_TEXT, PHONE_PLACEHOLDER } from '../../lib/phone'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion'
import Input from '../ui/Input'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'

interface CheckoutStepEnvioProps {
  onComplete?: (address: AddressRow) => void
}

export default function CheckoutStepEnvio({ onComplete }: CheckoutStepEnvioProps) {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState<AddressRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingAddress, setEditingAddress] = useState<AddressRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const [confirmDefault, setConfirmDefault] = useState<{ addressId: number; addressName: string } | null>(null)
  const [settingDefault, setSettingDefault] = useState(false)

  const fetchAddresses = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await addressService.getByUserId(user.id)
    if (!error && data) {
      setAddresses(data)
      const defaultAddr = data.find(a => a.es_default)
      if (defaultAddr) {
        setSelectedId(defaultAddr.id)
      } else if (data.length > 0) {
        setSelectedId(data[0].id)
      }
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchAddresses()
  }, [fetchAddresses])

  const handleSelect = (addressId: number) => {
    setSelectedId(addressId)
  }

  const handleSetDefault = async (addressId: number) => {
    if (!user) return
    setSettingDefault(true)
    await addressService.setDefault(user.id, addressId)
    setAddresses(prev => prev.map(a => ({ ...a, es_default: a.id === addressId })))
    setSettingDefault(false)
    setConfirmDefault(null)
  }

  const handleEdit = (address: AddressRow) => {
    setEditingAddress(address)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!user) return
    setDeleting(id)
    await addressService.delete(id)
    setAddresses(prev => prev.filter(a => a.id !== id))
    if (selectedId === id) {
      const remaining = addresses.filter(a => a.id !== id)
      if (remaining.length > 0) {
        setSelectedId(remaining[0].id)
      } else {
        setSelectedId(null)
      }
    }
    setDeleting(null)
  }

  const handleFormSubmit = async (data: AddressFormData) => {
    if (!user) return
    setSaving(true)

    if (editingAddress) {
      const updatePayload = {
        nombre: data.nombre,
        calle: data.calle,
        numero: data.numero || null,
        piso: data.piso || null,
        departamento: data.departamento || null,
        ciudad: data.ciudad,
        provincia: data.provincia,
        codigo_postal: data.codigo_postal,
        pais: data.pais || 'Argentina',
        telefono: normalizeArPhone(data.telefono),
      }

      const { data: updated, error } = await addressService.update(editingAddress.id, updatePayload)

      if (error) {
        setSaving(false)
        return
      }

      if (updated) {
        if (data.es_default && !editingAddress.es_default) {
          await addressService.setDefault(user.id, editingAddress.id)
          setAddresses(prev => prev.map(a => ({ ...a, es_default: a.id === editingAddress.id })))
        } else {
          setAddresses(prev => prev.map(a => a.id === updated.id ? updated : a))
        }
      }
    } else {
      const insertPayload: AddressInsert = {
        user_id: user.id,
        nombre: data.nombre,
        calle: data.calle,
        numero: data.numero || null,
        piso: data.piso || null,
        departamento: data.departamento || null,
        ciudad: data.ciudad,
        provincia: data.provincia,
        codigo_postal: data.codigo_postal,
        pais: data.pais || 'Argentina',
        telefono: normalizeArPhone(data.telefono),
        es_default: data.es_default,
      }

      const { data: created, error } = await addressService.create(insertPayload)

      if (error) {
        setSaving(false)
        return
      }

      if (created) {
        if (data.es_default) {
          await addressService.setDefault(user.id, created.id)
          setAddresses(prev => [{ ...created, es_default: true }, ...prev.map(a => ({ ...a, es_default: false }))])
        } else {
          setAddresses(prev => [created, ...prev])
        }
        setSelectedId(created.id)
      }
    }

    setShowForm(false)
    setEditingAddress(null)
    setSaving(false)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingAddress(null)
  }

  const selectedAddress = addresses.find(a => a.id === selectedId) || null

  if (onComplete && selectedAddress) {
    onComplete(selectedAddress)
  }

  // Direcciones viejas sin teléfono válido: el checkout no avanza hasta completarlo.
  // Cuenta como paso incompleto para que el acordeón abra la sección y muestre el aviso.
  const selectedNeedsPhone = !!selectedAddress && !normalizeArPhone(selectedAddress.telefono)
  const addressCompleted = !!selectedAddress && !selectedNeedsPhone
  const shippingCompleted = addressCompleted

  const defaultAccordionValue = !addressCompleted ? ['address'] : ['shipping']

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="rounded-2xl border border-gray-100 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const addressSummary = selectedAddress
    ? `${selectedAddress.nombre} · ${selectedAddress.calle} ${selectedAddress.numero} · ${selectedAddress.ciudad}`
    : null

  return (
    <div className="space-y-0">
      <Accordion type="single" collapsible defaultValue={defaultAccordionValue[0]}>
        <AccordionItem value="address">
          <AccordionTrigger className="py-3 sm:py-4">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 text-left">
              {addressCompleted ? (
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={3} />
                </span>
              ) : (
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent text-white flex items-center justify-center shrink-0 text-xs font-bold">
                  1
                </span>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-xs sm:text-sm font-bold text-primary-dark block">Datos de entrega</span>
                {addressSummary && (
                  <span className="text-[10px] sm:text-xs text-gray-400 truncate block mt-0.5">{addressSummary}</span>
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              {showForm ? (
                <AddressForm
                  key={editingAddress ? `edit-${editingAddress.id}` : 'new'}
                  address={editingAddress}
                  onSubmit={handleFormSubmit}
                  onCancel={handleCancel}
                  saving={saving}
                />
              ) : addresses.length === 0 ? (
                <div className="space-y-4">
                  <div className="text-center py-6 px-4">
                    <div className="w-14 h-14 bg-primary-light/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <MapPin className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-sm font-bold text-primary-dark mb-1">Sin direcciones guardadas</h3>
                    <p className="text-xs text-gray-400 mb-4">Agregá tu primera dirección para continuar.</p>
                  </div>
                  <Button variant="primary" size="lg" className="w-full" onClick={() => setShowForm(true)}>
                    <Plus className="w-4 h-4" />
                    Agregar dirección
                  </Button>
                </div>
              ) : (
                <>
                  {selectedNeedsPhone && selectedAddress && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4" role="alert">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-amber-700 font-medium">
                            Agregá un teléfono de contacto a esta dirección para continuar
                          </p>
                          <button
                            type="button"
                            onClick={() => handleEdit(selectedAddress)}
                            className="inline-block mt-2 text-xs sm:text-sm font-semibold text-amber-700 underline hover:text-amber-800 cursor-pointer"
                          >
                            Agregar teléfono
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {addresses.map(address => (
                      <AddressCard
                        key={address.id}
                        address={address}
                        isSelected={address.id === selectedId}
                        onSelect={() => handleSelect(address.id)}
                        onEdit={() => handleEdit(address)}
                        onDelete={() => handleDelete(address.id)}
                        onSetDefault={() => setConfirmDefault({ addressId: address.id, addressName: address.nombre })}
                        deleting={deleting === address.id}
                      />
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="md"
                    className="w-full"
                    onClick={() => setShowForm(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Agregar otra dirección
                  </Button>
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="shipping">
          <AccordionTrigger className="py-3 sm:py-4">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 text-left">
              {shippingCompleted ? (
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={3} />
                </span>
              ) : (
                <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  addressCompleted ? 'bg-accent text-white' : 'bg-gray-100 text-gray-300'
                }`}>
                  2
                </span>
              )}
              <div className="min-w-0 flex-1">
                <span className={`text-xs sm:text-sm font-bold block ${addressCompleted ? 'text-primary-dark' : 'text-gray-300'}`}>
                  Método de envío
                </span>
                <span className="text-[10px] sm:text-xs text-gray-400 block mt-0.5">Gratis · Correo Argentino</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="rounded-xl border border-primary-light/30 bg-primary-light/10 p-4 flex items-start gap-3">
              <Truck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary-dark">Envío gratis a todo el país</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Entrega con Correo Argentino · 5–8 días hábiles. El costo está incluido en el precio de los productos.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Modal
        open={!!confirmDefault}
        onClose={() => setConfirmDefault(null)}
        title="Cambiar dirección principal"
      >
        <p className="text-sm text-gray-600 mb-1">
          ¿Querés establecer <strong>{confirmDefault?.addressName}</strong> como tu nueva dirección principal?
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Esto cambiará tu dirección predilecta para futuras compras.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="ghost"
            size="md"
            className="w-full sm:w-auto"
            onClick={() => setConfirmDefault(null)}
            disabled={settingDefault}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            className="w-full sm:flex-1"
            loading={settingDefault}
            disabled={settingDefault}
            onClick={() => {
              if (confirmDefault) handleSetDefault(confirmDefault.addressId)
            }}
          >
            Cambiar principal
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function AddressCard({
  address,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  deleting,
}: {
  address: AddressRow
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
  deleting: boolean
}) {
  return (
    <div
      className={`
        relative rounded-xl border p-3.5 sm:p-4 transition-all cursor-pointer
        ${isSelected
          ? 'border-accent bg-accent/5 shadow-sm'
          : 'border-gray-200 hover:border-primary-light bg-white'
        }
      `}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
            isSelected ? 'border-accent' : 'border-gray-300'
          }`}>
            {isSelected && <Check className="w-3 h-3 text-accent" strokeWidth={3} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-bold text-primary-dark truncate">{address.nombre}</span>
              {isSelected && (
                <Badge variant="info">Seleccionada</Badge>
              )}
              {address.es_default && (
                <Badge variant="success">Principal</Badge>
              )}
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {address.calle} {address.numero}
              {address.piso && `, Piso ${address.piso}`}
              {address.departamento && `, Dto ${address.departamento}`}
            </p>
            <p className="text-xs text-gray-600">
              {address.ciudad}, {address.provincia} {address.codigo_postal}
            </p>
            <p className="text-xs text-gray-400 mt-1">{address.pais}</p>
            {address.telefono && (
              <p className="text-xs text-gray-400 mt-0.5">Tel: {address.telefono}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {!address.es_default && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSetDefault() }}
              className="p-1.5 rounded-lg hover:bg-primary-light/20 text-gray-400 hover:text-primary transition-colors"
              aria-label="Establecer como principal"
              title="Establecer como principal"
            >
              <Star className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Editar dirección"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            disabled={deleting}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
            aria-label="Eliminar dirección"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddressForm({
  address,
  onSubmit,
  onCancel,
  saving,
}: {
  address: AddressRow | null
  onSubmit: (data: AddressFormData) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    mode: 'onChange',
    defaultValues: address
      ? {
          nombre: address.nombre,
          calle: address.calle,
          numero: address.numero || '',
          piso: address.piso || '',
          departamento: address.departamento || '',
          ciudad: address.ciudad,
          provincia: address.provincia,
          codigo_postal: address.codigo_postal,
          pais: address.pais || 'Argentina',
          telefono: phoneToInputValue(address.telefono),
          es_default: address.es_default,
        }
      : {
          nombre: '',
          calle: '',
          numero: '',
          piso: '',
          departamento: '',
          ciudad: '',
          provincia: '',
          codigo_postal: '',
          pais: 'Argentina',
          telefono: '',
          es_default: false,
        },
  })

  useEffect(() => {
    if (address) {
      reset({
        nombre: address.nombre,
        calle: address.calle,
        numero: address.numero || '',
        piso: address.piso || '',
        departamento: address.departamento || '',
        ciudad: address.ciudad,
        provincia: address.provincia,
        codigo_postal: address.codigo_postal,
        pais: address.pais || 'Argentina',
        telefono: phoneToInputValue(address.telefono),
        es_default: address.es_default,
      })
    } else {
      reset({
        nombre: '',
        calle: '',
        numero: '',
        piso: '',
        departamento: '',
        ciudad: '',
        provincia: '',
        codigo_postal: '',
        pais: 'Argentina',
        telefono: '',
        es_default: false,
      })
    }
  }, [address, reset])

  return (
    <div className="rounded-2xl border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h3 className="text-sm sm:text-base font-bold text-primary-dark">
          {address ? 'Editar dirección' : 'Nueva dirección'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Nombre del destinatario"
          placeholder="Ej: Juan Pérez"
          error={errors.nombre?.message}
          {...register('nombre')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Calle"
              placeholder="Ej: Av. Corrientes"
              error={errors.calle?.message}
              {...register('calle')}
            />
          </div>
          <Input
            label="Número"
            placeholder="Ej: 1234"
            error={errors.numero?.message}
            {...register('numero')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Piso (opcional)"
            placeholder="Ej: 3"
            error={errors.piso?.message}
            {...register('piso')}
          />
          <Input
            label="Departamento (opcional)"
            placeholder="Ej: B"
            error={errors.departamento?.message}
            {...register('departamento')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Ciudad"
            placeholder="Ej: Buenos Aires"
            error={errors.ciudad?.message}
            {...register('ciudad')}
          />
          <Input
            label="Provincia"
            placeholder="Ej: CABA"
            error={errors.provincia?.message}
            {...register('provincia')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Código Postal"
            placeholder="Ej: 1001"
            error={errors.codigo_postal?.message}
            {...register('codigo_postal')}
          />
          <Input
            label="País"
            placeholder="Argentina"
            error={errors.pais?.message}
            {...register('pais')}
          />
        </div>

        <Input
          label="Teléfono de contacto (WhatsApp)"
          placeholder={PHONE_PLACEHOLDER}
          helperText={PHONE_HELP_TEXT}
          inputMode="tel"
          autoComplete="tel"
          error={errors.telefono?.message}
          {...register('telefono')}
        />

        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer"
            {...register('es_default')}
          />
          <span className="text-xs text-gray-600 group-hover:text-gray-800 transition-colors">
            Establecer como dirección principal
          </span>
        </label>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full sm:flex-1"
            loading={saving || isSubmitting}
            disabled={!isValid || isSubmitting || saving}
          >
            {address ? 'Guardar cambios' : 'Agregar dirección'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            className="w-full sm:w-auto"
            onClick={onCancel}
            disabled={saving || isSubmitting}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
