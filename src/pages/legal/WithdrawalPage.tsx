import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RotateCcw, Copy, Check, MessageCircle, Mail, AlertTriangle, Info } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import useAuth from '../../hooks/useAuth'
import { useOrders } from '../../hooks/useOrders'
import { useOrder } from '../../hooks/useOrder'
import { withdrawalService } from '../../services/withdrawal.service'
import type { WithdrawalError, WithdrawalReceipt, WithdrawalRequestPayload } from '../../types/withdrawal'
import { whatsappUrl } from '../../lib/whatsapp'
import { LEGAL } from '../../config/legal'

const MOTIVO_MAX = 500
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INPUT_CLASS = 'w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all bg-white'
const fieldBorder = (error?: string) => (error ? 'border-red-400 focus:border-red-500 bg-red-50/30' : 'border-gray-200 focus:border-accent')

/** Link de WhatsApp de la tienda con un texto precargado (o el link tal cual si no se puede armar). */
function whatsappWithText(text: string): string {
  try {
    const url = new URL(whatsappUrl)
    url.searchParams.set('text', text)
    return url.toString()
  } catch {
    return whatsappUrl
  }
}

function formatArDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    dateStyle: 'long',
    timeStyle: 'short',
  })
}

function validateNombre(nombre: string): string | undefined {
  const len = nombre.trim().length
  return len < 2 || len > 120 ? 'Ingresá tu nombre (entre 2 y 120 caracteres).' : undefined
}

// ---------------------------------------------------------------------------
// Envío compartido (con y sin sesión): estado de carga, anti doble envío y error del server
// ---------------------------------------------------------------------------

function useWithdrawalSubmit(onSuccess: (receipt: WithdrawalReceipt) => void) {
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<WithdrawalError | null>(null)
  const inFlight = useRef(false)

  const submit = async (payload: WithdrawalRequestPayload) => {
    if (inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    setServerError(null)
    const { data, error } = await withdrawalService.requestWithdrawal(payload)
    inFlight.current = false
    setSubmitting(false)
    if (data) onSuccess(data)
    else setServerError(error)
  }

  return { submit, submitting, serverError }
}

function ServerError({ error }: { error: WithdrawalError }) {
  const showContact = error.code === 'ORDER_NOT_ELIGIBLE' || error.code === 'RATE_LIMITED'
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-red-700">{error.message}</p>
          {showContact && (
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline">
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  Escribinos por WhatsApp
                </a>
              )}
              <a href={`mailto:${LEGAL.EMAIL_CONTACTO}`} className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline">
                <Mail className="w-4 h-4" aria-hidden="true" />
                {LEGAL.EMAIL_CONTACTO}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MotivoField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="withdrawal-motivo" className="text-xs font-bold text-gray-800 uppercase">Motivo (opcional)</label>
      <textarea
        id="withdrawal-motivo"
        value={value}
        onChange={e => onChange(e.target.value.slice(0, MOTIVO_MAX))}
        maxLength={MOTIVO_MAX}
        rows={4}
        disabled={disabled}
        aria-describedby="withdrawal-motivo-help"
        className={`${INPUT_CLASS} ${fieldBorder()} resize-none disabled:bg-gray-50`}
      />
      <div id="withdrawal-motivo-help" className="flex justify-between gap-3 text-xs text-gray-400">
        <span>No es obligatorio: no necesitás explicar tus motivos</span>
        <span className="shrink-0">{value.length}/{MOTIVO_MAX}</span>
      </div>
    </div>
  )
}

function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null
  return <p id={id} className="text-red-600 text-xs font-medium" role="alert">{children}</p>
}

// ---------------------------------------------------------------------------
// Formulario con sesión: elige entre sus pedidos elegibles; el email no se pide
// ---------------------------------------------------------------------------

function SessionForm({ onSuccess }: { onSuccess: (receipt: WithdrawalReceipt) => void }) {
  const [searchParams] = useSearchParams()
  const pedidoParam = searchParams.get('pedido')?.trim().toUpperCase() ?? ''
  const { profile } = useAuth()
  const { data: orders, loading: ordersLoading } = useOrders()
  const eligible = (orders ?? []).filter(o => o.payment_status === 'approved' && o.status !== 'cancelled')

  // Valores "derivados hasta que el usuario los toca": pedido de ?pedido= y nombre del perfil
  const [selectedInput, setSelectedInput] = useState<string | null>(null)
  const [nombreInput, setNombreInput] = useState<string | null>(null)
  const selectedNumero = selectedInput ?? (eligible.some(o => o.numero_pedido === pedidoParam) ? pedidoParam : '')
  const selectedOrder = eligible.find(o => o.numero_pedido === selectedNumero) ?? null
  const nombre = nombreInput ?? profile?.nombre ?? ''

  const { data: detail } = useOrder(selectedOrder?.id ?? null)
  const items = detail && detail.id === selectedOrder?.id ? detail.order_items : []

  const [scope, setScope] = useState<'all' | 'some'>('all')
  const [picked, setPicked] = useState<{ orderId: number | null; ids: number[] }>({ orderId: null, ids: [] })
  const pickedIds = picked.orderId === selectedOrder?.id ? picked.ids : []
  const [motivo, setMotivo] = useState('')
  const [attempted, setAttempted] = useState(false)
  const { submit, submitting, serverError } = useWithdrawalSubmit(onSuccess)

  const errors = {
    order: !selectedOrder ? 'Elegí el pedido.' : undefined,
    nombre: validateNombre(nombre),
    items: scope === 'some' && pickedIds.length === 0 ? 'Elegí al menos un producto o marcá "Todo el pedido".' : undefined,
  }
  const visible: Partial<typeof errors> = attempted ? errors : {}

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    if (errors.order || errors.nombre || errors.items || !selectedOrder) return
    void submit({
      order_numero: selectedOrder.numero_pedido,
      nombre: nombre.trim(),
      order_item_ids: scope === 'some' ? pickedIds : null,
      motivo: motivo.trim() || undefined,
    })
  }

  const togglePicked = (id: number) => {
    const ids = pickedIds.includes(id) ? pickedIds.filter(x => x !== id) : [...pickedIds, id]
    setPicked({ orderId: selectedOrder?.id ?? null, ids })
  }

  if (ordersLoading) {
    return <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" aria-label="Cargando tus pedidos" />
  }

  if (eligible.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 text-sm text-gray-600 space-y-2">
        <p>No tenés pedidos con el pago confirmado para arrepentirte.</p>
        <p>
          Si creés que es un error, escribinos a{' '}
          <a href={`mailto:${LEGAL.EMAIL_CONTACTO}`} className="font-semibold text-accent hover:underline">{LEGAL.EMAIL_CONTACTO}</a>
          {whatsappUrl && (<> o <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">por WhatsApp</a></>)}.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {pedidoParam && !eligible.some(o => o.numero_pedido === pedidoParam) && (
        <p className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          El pedido {pedidoParam} no figura entre tus pedidos con pago confirmado. Elegí uno de la lista.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="withdrawal-order" className="text-xs font-bold text-gray-800 uppercase">Pedido</label>
        <select
          id="withdrawal-order"
          value={selectedNumero}
          onChange={e => { setSelectedInput(e.target.value); setScope('all') }}
          disabled={submitting}
          aria-invalid={!!visible.order}
          aria-describedby={visible.order ? 'withdrawal-order-error' : undefined}
          className={`${INPUT_CLASS} ${fieldBorder(visible.order)} cursor-pointer`}
        >
          <option value="">Elegí un pedido…</option>
          {eligible.map(o => (
            <option key={o.id} value={o.numero_pedido}>
              {o.numero_pedido} · {new Date(o.created_at).toLocaleDateString('es-AR')}
            </option>
          ))}
        </select>
        <FieldError id="withdrawal-order-error">{visible.order}</FieldError>
      </div>

      {selectedOrder && (
        <fieldset className="space-y-2" aria-describedby={visible.items ? 'withdrawal-items-error' : undefined}>
          <legend className="text-xs font-bold text-gray-800 uppercase mb-1.5">Producto(s)</legend>
          <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
            <input type="radio" name="withdrawal-scope" checked={scope === 'all'} onChange={() => setScope('all')} className="accent-accent w-4 h-4" />
            Todo el pedido
          </label>
          {items.length > 1 && (
            <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
              <input type="radio" name="withdrawal-scope" checked={scope === 'some'} onChange={() => setScope('some')} className="accent-accent w-4 h-4" />
              Solo algunos productos
            </label>
          )}
          {scope === 'some' && (
            <ul className="ml-6.5 space-y-1.5">
              {items.map(item => (
                <li key={item.id}>
                  <label className="flex items-start gap-2.5 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pickedIds.includes(item.id)}
                      onChange={() => togglePicked(item.id)}
                      aria-invalid={!!visible.items}
                      className="accent-accent w-4 h-4 mt-0.5 shrink-0"
                    />
                    <span className="break-words">
                      {item.nombre_producto}{item.variante_nombre ? ` (${item.variante_nombre})` : ''} ×{item.cantidad}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <FieldError id="withdrawal-items-error">{visible.items}</FieldError>
        </fieldset>
      )}

      <Input
        id="withdrawal-nombre"
        label="Nombre y apellido"
        value={nombre}
        onChange={e => setNombreInput(e.target.value)}
        autoComplete="name"
        disabled={submitting}
        error={visible.nombre}
      />

      <MotivoField value={motivo} onChange={setMotivo} disabled={submitting} />

      {serverError && <ServerError error={serverError} />}

      <Button type="submit" variant="primary" size="lg" className="w-full" loading={submitting} disabled={submitting}>
        {submitting ? 'Enviando…' : 'Enviar solicitud de arrepentimiento'}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Formulario sin sesión: número de pedido + email de la cuenta; siempre todo el pedido
// ---------------------------------------------------------------------------

function GuestForm({ onSuccess }: { onSuccess: (receipt: WithdrawalReceipt) => void }) {
  const [searchParams] = useSearchParams()
  const [numero, setNumero] = useState(() => searchParams.get('pedido')?.trim().toUpperCase() ?? '')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [motivo, setMotivo] = useState('')
  const [attempted, setAttempted] = useState(false)
  const { submit, submitting, serverError } = useWithdrawalSubmit(onSuccess)

  const numeroTrim = numero.trim().toUpperCase()
  const errors = {
    numero: !numeroTrim ? 'Ingresá el número de pedido.' : numeroTrim.length > 60 ? 'El número de pedido es demasiado largo.' : undefined,
    nombre: validateNombre(nombre),
    email: !EMAIL_RE.test(email.trim()) ? 'Ingresá un email válido.' : undefined,
  }
  const visible: Partial<typeof errors> = attempted ? errors : {}

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    if (errors.numero || errors.nombre || errors.email) return
    void submit({
      order_numero: numeroTrim,
      nombre: nombre.trim(),
      email: email.trim(),
      motivo: motivo.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <p className="text-sm text-gray-500">
        ¿Tenés cuenta?{' '}
        <Link to="/login" className="font-semibold text-accent hover:underline">Iniciá sesión</Link>{' '}
        y elegí el pedido de tu lista.
      </p>

      <Input
        id="withdrawal-numero"
        label="Número de pedido"
        placeholder="Ej: PED-00023"
        value={numero}
        onChange={e => setNumero(e.target.value)}
        disabled={submitting}
        error={visible.numero}
      />
      <Input
        id="withdrawal-nombre"
        label="Nombre y apellido"
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        autoComplete="name"
        disabled={submitting}
        error={visible.nombre}
      />
      <Input
        id="withdrawal-email"
        label="Email de tu cuenta"
        type="email"
        inputMode="email"
        autoComplete="email"
        helperText="El mismo con el que te registraste."
        value={email}
        onChange={e => setEmail(e.target.value)}
        disabled={submitting}
        error={visible.email}
      />
      <p className="text-xs text-gray-400">La solicitud se hace por todo el pedido. Si es solo por algunos productos, aclaralo en el motivo o iniciá sesión.</p>

      <MotivoField value={motivo} onChange={setMotivo} disabled={submitting} />

      {serverError && <ServerError error={serverError} />}

      <Button type="submit" variant="primary" size="lg" className="w-full" loading={submitting} disabled={submitting}>
        {submitting ? 'Enviando…' : 'Enviar solicitud de arrepentimiento'}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Constancia
// ---------------------------------------------------------------------------

function ReceiptView({ receipt, hasSession }: { receipt: WithdrawalReceipt; hasSession: boolean }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(receipt.numero)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Portapapeles no disponible: el número sigue visible para copiarlo a mano
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary-light bg-primary-light/30 p-5 sm:p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Tu constancia</p>
        <p className="text-3xl sm:text-4xl font-black text-primary-dark tracking-tight break-all">{receipt.numero}</p>
        <p className="mt-2 text-sm text-gray-600">
          Pedido <strong className="text-primary-dark">{receipt.numero_pedido}</strong> · {formatArDateTime(receipt.created_at)}
        </p>
      </div>

      <div className="space-y-3 text-sm sm:text-base text-gray-600 leading-relaxed">
        {receipt.already_requested ? (
          <p className="font-semibold text-primary-dark">Ya tenías una solicitud abierta para este pedido.</p>
        ) : (
          <p>
            Recibimos tu solicitud. Te vamos a contactar para coordinar la devolución, que es sin costo para vos.
            Guardá este número: es tu constancia. También intentamos enviarte la constancia por email.
          </p>
        )}
        {receipt.already_requested && (
          <p>Guardá este número: es tu constancia. Te vamos a contactar para coordinar la devolución, que es sin costo para vos.</p>
        )}
        {!receipt.within_deadline && (
          <p className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
            <Info className="w-4 h-4 text-accent mt-0.5 shrink-0" aria-hidden="true" />
            Pasaron más de 10 días desde tu compra o entrega, por eso la vamos a revisar y te contactamos.
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto" onClick={copy}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copiado' : 'Copiar número'}
        </Button>
        {whatsappUrl && (
          <a
            href={whatsappWithText(`Hola, hice una solicitud de arrepentimiento: constancia ${receipt.numero} del pedido ${receipt.numero_pedido}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto"
          >
            <Button type="button" variant="primary" size="lg" className="w-full">
              <MessageCircle className="w-4 h-4" />
              Escribir por WhatsApp
            </Button>
          </a>
        )}
      </div>

      <p className="text-sm">
        <Link to={hasSession ? '/pedidos' : '/'} className="font-semibold text-accent hover:underline">
          {hasSession ? 'Ver mis pedidos' : 'Volver al inicio'}
        </Link>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function WithdrawalPage() {
  const { user, loading: authLoading } = useAuth()
  const [receipt, setReceipt] = useState<WithdrawalReceipt | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [receipt])

  return (
    <div className="min-h-screen bg-white">
      <div className="store-container py-8 sm:py-10">
        <nav className="breadcrumb">
          <Link to="/" className="breadcrumb-link">Inicio</Link>
          <span>/</span>
          <span className="breadcrumb-current">Botón de arrepentimiento</span>
        </nav>

        <div className="max-w-xl mx-auto pt-6 sm:pt-8 pb-12">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5 text-accent" aria-hidden="true" />
            </span>
            <h1 className="text-h2 text-2xl sm:text-3xl text-primary-dark">Botón de arrepentimiento</h1>
          </div>

          {receipt ? (
            <ReceiptView receipt={receipt} hasSession={!!user} />
          ) : (
            <>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-6">
                Tenés 10 días corridos desde que recibís el producto para arrepentirte de la compra, sin dar motivos
                y sin costo: el envío de la devolución lo paga la Tienda. Más información en{' '}
                <Link to="/devoluciones" className="font-semibold text-accent hover:underline">Cambios, devoluciones y garantía</Link>.
              </p>
              {authLoading ? (
                <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" aria-label="Cargando" />
              ) : user ? (
                <SessionForm onSuccess={setReceipt} />
              ) : (
                <GuestForm onSuccess={setReceipt} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
