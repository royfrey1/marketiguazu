import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../../components/ui/accordion'
import { LEGAL } from '../../config/legal'

interface FaqItem {
  id: string
  pregunta: string
  respuesta: ReactNode
}

const LINK = 'font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded'

// Respuestas basadas solo en los Términos (1.3, 1.6, 1.8) y en Cambios, devoluciones y garantía
const FAQ: FaqItem[] = [
  {
    id: 'como-compro',
    pregunta: '¿Cómo compro?',
    respuesta: 'Elegí los productos y agregalos al carrito. Después iniciá sesión o creá tu cuenta, cargá tu dirección de envío y elegí el medio de pago.',
  },
  {
    id: 'medios-de-pago',
    pregunta: '¿Qué medios de pago aceptan?',
    respuesta: (
      <>
        Transferencia bancaria, USDT (red TRC20) y Mercado Pago (hasta 3 cuotas con recargo financiero). Tenés el detalle en{' '}
        <Link to="/medios-de-pago" className={LINK}>Medios de pago</Link>.
      </>
    ),
  },
  {
    id: 'costo-envio',
    pregunta: '¿El envío tiene costo?',
    respuesta: (
      <>
        No: el envío es gratis a todo el país en todos los productos. Enviamos a domicilio con Correo Argentino. Más información en{' '}
        <Link to="/envios" className={LINK}>Envíos</Link>.
      </>
    ),
  },
  {
    id: 'cuanto-tarda',
    pregunta: '¿Cuánto tarda en llegar?',
    respuesta: `El plazo estimado es de ${LEGAL.PLAZO_ENTREGA} desde la confirmación del pago. Es un estimado: el tiempo de traslado depende del operador logístico.`,
  },
  {
    id: 'pago-confirmado',
    pregunta: '¿Cómo sé si mi pago fue confirmado?',
    respuesta: (
      <>
        Con Mercado Pago, el pago se acredita automáticamente. La transferencia bancaria y USDT los confirmamos manualmente, y puede
        demorar algunas horas. Podés ver el estado de tu pedido en <Link to="/pedidos" className={LINK}>Mis pedidos</Link>.
      </>
    ),
  },
  {
    id: 'plazo-pago',
    pregunta: '¿Cuánto tiempo tengo para pagar por transferencia o USDT?',
    respuesta: 'Tenés 24 horas desde que se crea el pedido. Pasado ese plazo, el pedido se cancela y se libera el stock.',
  },
  {
    id: 'estado-productos',
    pregunta: '¿En qué estado son los productos?',
    respuesta: 'Son de fábrica, los probamos nosotros antes de venderlos y los ofrecemos en excelente estado. La ficha de cada producto describe su estado y los accesorios incluidos.',
  },
  {
    id: 'garantia',
    pregunta: '¿Tienen garantía?',
    respuesta: (
      <>
        Sí. Los productos tienen una garantía legal de 6 meses desde la entrega ante defectos o fallas que afecten su funcionamiento y
        no se deban a un uso indebido. Los gastos de envío para cumplir la garantía son a cargo de la Tienda. Más información en{' '}
        <Link to="/devoluciones" className={LINK}>Cambios, devoluciones y garantía</Link>.
      </>
    ),
  },
  {
    id: 'arrepentimiento',
    pregunta: '¿Puedo arrepentirme de la compra?',
    respuesta: (
      <>
        Sí. Tenés 10 días corridos desde la entrega del producto o desde la compra, lo que ocurra último, para arrepentirte sin dar
        motivos y sin costo. Podés hacerlo desde el <Link to="/arrepentimiento" className={LINK}>Botón de arrepentimiento</Link>.
      </>
    ),
  },
  {
    id: 'contacto',
    pregunta: '¿Cómo los contacto?',
    respuesta: (
      <>
        Escribinos desde la página de <Link to="/contacto" className={LINK}>Contacto</Link>.
      </>
    ),
  },
]

export default function FaqPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <div className="store-container py-8 sm:py-10">
        <nav className="breadcrumb">
          <Link to="/" className="breadcrumb-link">Inicio</Link>
          <span>/</span>
          <span className="breadcrumb-current">Preguntas frecuentes</span>
        </nav>

        <div className="max-w-3xl mx-auto pt-6 sm:pt-8 pb-12">
          <h1 className="text-h2 text-2xl sm:text-3xl text-primary-dark mb-6">Preguntas frecuentes</h1>

          <Accordion type="single" collapsible className="border-t border-gray-100">
            {FAQ.map(item => (
              <AccordionItem key={item.id} value={item.id}>
                <AccordionTrigger className="min-h-11 gap-3 text-left text-sm sm:text-base font-semibold text-primary-dark hover:no-underline hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded">
                  {item.pregunta}
                </AccordionTrigger>
                <AccordionContent className="text-sm sm:text-base text-gray-600 leading-relaxed pr-6">
                  {item.respuesta}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  )
}
