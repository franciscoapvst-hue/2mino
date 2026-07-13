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

// ── Plantilla visual ──────────────────────────────────────────────────
// Misma identidad que la pantalla de login/registro (src/login.css):
// mesa de fieltro oscuro + acento ámbar. Todo con estilos inline y sin
// gradientes — los clientes de correo (sobre todo Outlook) no los
// soportan de forma confiable; una tabla con colores sólidos es lo único
// que se ve igual en todos lados. El logo SÍ va como SVG inline (no
// imagen externa: nada que bloquear/no cargar) — mismo dibujo que
// <Bone a={6} b={6}/> en src/components/DominoStage.tsx.
const COLOR = {
  bg:      '#050d0a', // fondo exterior — mismo tono base que .lg-scene
  panel:   '#0f1a15', // tarjeta
  border:  'rgba(242, 237, 227, 0.12)',
  ink:     '#f2ede3', // texto principal (--pl-ink)
  muted:   '#b6beb4', // texto secundario (--pl-muted)
  amber:   '#ef9f2e', // acento de marca (--amber)
  amberInk:'#201400', // texto sobre botón ámbar (--amber-ink)
};

// Ficha 6-6 — misma geometría que el componente Bone/Half (viewBox 100×200,
// grilla de pips en [22,50,78]). Se hardcodea acá en vez de importar React:
// este archivo corre en ms-usuarios (backend), no tiene acceso a src/.
const LOGO_SVG = `
  <svg width="26" height="52" viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ficha de dominó 6-6">
    <rect x="3" y="3" width="94" height="194" rx="14" fill="#f1e8d6" stroke="rgba(0,0,0,0.10)" stroke-width="1.5" />
    <line x1="14" y1="100" x2="86" y2="100" stroke="rgba(30,22,12,0.22)" stroke-width="3" stroke-linecap="round" />
    ${[22, 78].flatMap(cx => [22, 50, 78].map(cy => `<circle cx="${cx}" cy="${cy}" r="8.5" fill="#20180f" />`)).join('')}
    ${[22, 78].flatMap(cx => [122, 150, 178].map(cy => `<circle cx="${cx}" cy="${cy}" r="8.5" fill="#20180f" />`)).join('')}
  </svg>`;

function emailLayout(tituloInterno: string, bodyHtml: string): string {
  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <meta name="supported-color-schemes" content="dark light" />
    <title>${tituloInterno}</title>
  </head>
  <body style="margin:0; padding:0; background:${COLOR.bg}; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.bg};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;">
            <!-- Marca -->
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>
                    <td style="padding-right:10px; vertical-align:middle;">${LOGO_SVG}</td>
                    <td style="vertical-align:middle;">
                      <span style="font-size:22px; font-weight:800; letter-spacing:-0.02em; color:${COLOR.ink};">
                        <span style="color:${COLOR.amber};">2</span>mino
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Tarjeta -->
            <tr>
              <td style="background:${COLOR.panel}; border:1px solid ${COLOR.border}; border-radius:16px; padding:36px 32px;">
                ${bodyHtml}
              </td>
            </tr>
            <!-- Pie -->
            <tr>
              <td align="center" style="padding-top:24px;">
                <span style="font-size:12px; color:${COLOR.muted};">
                  2mino · Juega. Compite. Domina.
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

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
  const asunto = 'Confirma tu cuenta de 2mino';
  const html = emailLayout(
    asunto,
    `
      <h1 style="margin:0 0 12px; font-size:20px; font-weight:700; color:${COLOR.ink};">
        ¡Hola, ${username}!
      </h1>
      <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:${COLOR.muted};">
        Gracias por sumarte a 2mino. Confirma tu cuenta para poder sentarte
        a la mesa:
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="border-radius:10px; background:${COLOR.amber};">
            <a href="${link}"
               style="display:inline-block; padding:13px 28px; font-size:15px; font-weight:700;
                      color:${COLOR.amberInk}; text-decoration:none; border-radius:10px;">
              Confirmar mi cuenta
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px; font-size:13px; line-height:1.5; color:${COLOR.muted};">
        Si el botón no funciona, copia este link y pégalo en el navegador:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="background:${COLOR.bg}; border:1px solid ${COLOR.border}; border-radius:8px; padding:12px 14px;">
            <code style="font-family:'Courier New', monospace; font-size:13px; word-break:break-all; color:${COLOR.amber};">${link}</code>
          </td>
        </tr>
      </table>
      <p style="margin:0; font-size:13px; line-height:1.5; color:${COLOR.muted};">
        El link vence en 24 horas. Si no creaste esta cuenta, puedes ignorar
        este correo sin problema.
      </p>
    `,
  );
  await enviar(email, asunto, html, { email, username });
}
