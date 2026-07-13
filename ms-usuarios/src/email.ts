// ── Envío de emails transaccionales (Resend) ──────────────────────────
// Mismo criterio que ya usaba el flujo de reset-password: si ENABLE_EMAIL
// no está en 'true', no se manda nada de verdad — solo se loguea. Así el
// dev local sigue andando sin API key real.
//
// Se eligió la API HTTP de Resend en vez de SMTP (lo que se probó primero,
// contra IONOS) porque evita toda la categoría de problemas de puerto/
// TLS/STARTTLS/auth que da SMTP — es un POST con la API key en el header,
// sin handshake de protocolo de por medio.
import { Resend } from 'resend';

const habilitado = () => process.env.ENABLE_EMAIL === 'true';

let resend: Resend | null = null;

function getClient(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = () => process.env.EMAIL_FROM ?? '2mino <onboarding@resend.dev>';
const APP_URL = () => (process.env.APP_URL ?? 'https://2mino.online').replace(/\/$/, '');

async function enviar(to: string, subject: string, html: string, logCtx: Record<string, unknown>) {
  if (!habilitado()) {
    console.log('[email] ENABLE_EMAIL=false, no se envía nada. Contexto:', logCtx);
    return;
  }
  try {
    const { error } = await getClient().emails.send({ from: FROM(), to, subject, html });
    if (error) console.error('[email] Resend devolvió un error:', error);
  } catch (err) {
    // No tumbar el registro/login por un problema del proveedor — el
    // usuario puede pedir que se lo reenvíen. Se loguea para diagnosticar.
    console.error('[email] Error enviando:', err);
  }
}

export async function enviarEmailVerificacion(email: string, username: string, token: string) {
  const link = `${APP_URL()}/verificar-email/${token}`;
  await enviar(
    email,
    'Confirmá tu cuenta de 2mino',
    `
      <p>¡Hola ${username}!</p>
      <p>Gracias por registrarte en 2mino. Confirmá tu cuenta haciendo click acá:</p>
      <p><a href="${link}">${link}</a></p>
      <p>El link vence en 24 horas. Si no creaste esta cuenta, podés ignorar este correo.</p>
    `,
    { email, username },
  );
}
