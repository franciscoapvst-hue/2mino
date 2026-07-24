import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../icons';

// ── Política de privacidad (docs/PLAN_MONETIZACION.md, punto 9) ────
// Contenido base real (qué datos recolectamos hoy, verificado contra el
// schema de ms-usuarios) — no un texto genérico de plantilla. Pendiente:
// revisión legal profesional antes de publicar en producción (fuera de
// alcance de este plan). Ruta pública, sin guard de sesión — requisito
// de AdSense: debe navegarse sin login.
export default function PrivacidadView() {
  const navigate = useNavigate();
  return (
    <div className="legal-page">
      <div className="legal-inner">
        <button className="legal-back" onClick={() => navigate(-1)}><BackIcon /> Volver</button>
        <h1>Política de privacidad</h1>
        <p className="legal-updated">Última actualización: {new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long' })}</p>

        <p>
          En 2mino nos tomamos en serio la privacidad de quienes juegan. Este documento
          explica qué datos recolectamos, para qué los usamos y qué control tienes sobre
          ellos.
        </p>

        <h2>Qué datos recolectamos</h2>
        <ul>
          <li><strong>Cuenta:</strong> nombre de usuario, correo electrónico y contraseña (guardada de forma cifrada, nunca en texto plano).</li>
          <li><strong>Perfil:</strong> el avatar que eliges y, si juegas como invitado, un usuario y cuenta temporales que se borran al cerrar sesión.</li>
          <li><strong>Actividad de juego:</strong> tus partidas, resultado, ELO, capicúas, trancas e historial — es lo que alimenta el leaderboard y tu perfil.</li>
          <li><strong>Cosméticos:</strong> tu saldo de doblones y qué ítems compraste o equipaste (fichas, tableros). Los doblones no son dinero real y no se pueden retirar.</li>
          <li><strong>Técnicos:</strong> la sesión (token de acceso) y, si tienes anuncios activados, las cookies que use Google AdSense para mostrarlos (ver más abajo).</li>
        </ul>

        <h2>Qué NO recolectamos</h2>
        <ul>
          <li>No pedimos datos de pago en la app — cualquier compra futura de doblones se procesaría por un proveedor externo (ej. PayPal), que maneja esos datos directamente; 2mino nunca ve ni guarda tu número de tarjeta.</li>
          <li>No pedimos tu nombre real, dirección ni teléfono.</li>
        </ul>

        <h2>Para qué usamos tus datos</h2>
        <ul>
          <li>Operar el juego: matchmaking, salas, torneos, chat de partida.</li>
          <li>Mostrar tu progreso: rango, estadísticas, historial y repeticiones.</li>
          <li>Seguridad: evitar trampas, cuentas duplicadas o abuso del sistema.</li>
          <li>Publicidad: si tienes anuncios activados (Google AdSense), Google puede usar cookies para mostrar anuncios relevantes. Puedes gestionar tus preferencias de anuncios desde <a href="https://adssettings.google.com" target="_blank" rel="noreferrer">Google Ads Settings</a>.</li>
        </ul>

        <h2>Con quién compartimos datos</h2>
        <p>
          No vendemos tus datos. Los compartimos únicamente con proveedores que necesitamos
          para operar (hosting, envío de correos transaccionales, Google AdSense para
          publicidad, y en el futuro un procesador de pagos para compras de doblones).
        </p>

        <h2>Tus derechos</h2>
        <p>
          Puedes pedir que eliminemos tu cuenta y tus datos asociados escribiendo a{' '}
          <a href="mailto:soporte@2mino.online">soporte@2mino.online</a>. Las cuentas de
          invitado son efímeras: se eliminan automáticamente al cerrar sesión.
        </p>

        <h2>Cambios a esta política</h2>
        <p>
          Si actualizamos esta política de forma relevante, lo vamos a anunciar dentro de
          la app antes de que entre en vigencia.
        </p>
      </div>
    </div>
  );
}
