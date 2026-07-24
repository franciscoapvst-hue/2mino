import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../icons';

// ── Términos y cumplimiento (docs/PLAN_MONETIZACION.md, punto 9) ───
// Igual que PrivacidadView: contenido base real, pendiente de revisión
// legal profesional. Ruta pública, sin guard de sesión.
export default function TerminosView() {
  const navigate = useNavigate();
  return (
    <div className="legal-page">
      <div className="legal-inner">
        <button className="legal-back" onClick={() => navigate(-1)}><BackIcon /> Volver</button>
        <h1>Términos de uso y cumplimiento</h1>
        <p className="legal-updated">Última actualización: {new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long' })}</p>

        <h2>Qué es 2mino</h2>
        <p>
          2mino es un juego de dominó en línea, estilo dominicano. Se puede jugar de forma
          gratuita — con cuenta o como invitado — en partidas casuales, ranked, salas
          privadas y torneos.
        </p>

        <h2>Cuentas</h2>
        <ul>
          <li>Eres responsable de mantener segura tu contraseña.</li>
          <li>Las cuentas de invitado son temporales: se eliminan al cerrar sesión, junto con su progreso.</li>
          <li>Nos reservamos el derecho de suspender cuentas que hagan trampa, abusen del chat o exploten fallas del sistema.</li>
        </ul>

        <h2>Doblones y cosméticos — nada de apuestas</h2>
        <p>
          Los <strong>doblones</strong> son una moneda cosmética interna, sin valor
          monetario real y sin posibilidad de canje o retiro. Se usan únicamente para
          comprar cosméticos (fichas, tableros) que no afectan las reglas ni el resultado
          de ninguna partida.
        </p>
        <p>
          <strong>2mino no ofrece apuestas.</strong> Nadie pierde doblones por perder una
          partida — se ganan jugando, nunca se arriesgan. Los torneos con premios (cuando
          aplique cuota de inscripción) se rigen por reglas propias, publicadas en cada
          torneo antes de inscribirte.
        </p>

        <h2>Torneos</h2>
        <p>
          Cada torneo publica sus propias reglas, fechas y — si aplica — cuota de
          inscripción y política de reembolso antes de que puedas anotarte. Inscribirte
          implica aceptar esas reglas específicas además de estos términos generales.
        </p>

        <h2>Conducta esperada</h2>
        <p>
          Pedimos respeto en el chat y en la mesa. Contenido ofensivo, acoso o trampa
          pueden derivar en advertencias o suspensión de la cuenta.
        </p>

        <h2>Publicidad</h2>
        <p>
          2mino puede mostrar anuncios (Google AdSense) para sostener el desarrollo del
          juego gratuito. Nunca durante una partida activa. Ver la{' '}
          <button type="button" className="legal-inline-link" onClick={() => navigate('/privacidad')}>
            política de privacidad
          </button>{' '}
          para más detalle sobre cookies publicitarias.
        </p>

        <h2>Contacto</h2>
        <p>
          Dudas o reportes: <a href="mailto:soporte@2mino.online">soporte@2mino.online</a>.
        </p>
      </div>
    </div>
  );
}
