// ── Envío de emails transaccionales (SMTP de IONOS) ──────────────────
// Mismo criterio que ya usaba el flujo de reset-password: si ENABLE_EMAIL
// no está en 'true', no se manda nada de verdad — solo se loguea. Así el
// dev local sigue andando sin credenciales SMTP reales.
import nodemailer from 'nodemailer';

const habilitado = () => process.env.ENABLE_EMAIL === 'true';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST ?? 'smtp.ionos.com',
      port:   Number(process.env.SMTP_PORT ?? 465),
      secure: true, // puerto 465 = SSL/TLS directo
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

const FROM = () => process.env.SMTP_FROM ?? '2mino <administration@2mino.online>';
const APP_URL = () => (process.env.APP_URL ?? 'https://2mino.online').replace(/\/$/, '');

async function enviar(to: string, subject: string, html: string, logCtx: Record<string, unknown>) {
  if (!habilitado()) {
    console.log('[email] ENABLE_EMAIL=false, no se envía nada. Contexto:', logCtx);
    return;
  }
  try {
    await getTransporter().sendMail({ from: FROM(), to, subject, html });
  } catch (err) {
    // No tumbar el registro/login por un problema de SMTP — el usuario
    // puede pedir que se lo reenvíen. Se loguea para poder diagnosticarlo.
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
