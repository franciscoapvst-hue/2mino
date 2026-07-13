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
// mesa de fieltro oscuro verde + acento ámbar + toque teal. Todo con
// estilos y colores sólidos inline — los clientes de correo (sobre todo
// Outlook) no soportan gradientes de forma confiable, y GMAIL ELIMINA los
// <svg> inline: por eso la ficha (el motivo de marca, "la ficha es el
// héroe") se construye con TABLAS + celdas de color, no SVG — así se ve
// igual en Gmail, Outlook y Apple Mail, sin depender de imágenes externas
// que el cliente pueda bloquear.
const COLOR = {
  bg:        '#050d0a', // fondo exterior — tono base de .lg-scene
  felt:      '#0f221c', // verde fieltro cálido — centro de .lg-scene (cabecera)
  panel:     '#101a15', // tarjeta del cuerpo
  panelSoft: '#0b1511', // bloque interior (meta de expiración)
  border:    'rgba(242, 237, 227, 0.12)',
  hair:      'rgba(242, 237, 227, 0.08)',
  ink:       '#f2ede3', // texto principal (--pl-ink)
  muted:     '#b6beb4', // texto secundario (--pl-muted)
  amber:     '#ef9f2e', // acento de marca (--amber)
  amberInk:  '#201400', // texto sobre botón ámbar (--amber-ink)
  teal:      '#34d3b4', // acento frío (--pl-link)
  bone:      '#f1e8d6', // hueso de la ficha
  pip:       '#20180f', // pintas
};

// ── La ficha 6-6, en tablas (bulletproof, visible en Gmail) ────────────
// Una pinta: círculo oscuro. Outlook ignora border-radius → cuadradito,
// pero a ese tamaño sigue leyéndose como pinta. font-size/line-height 0
// evitan que el &nbsp; agregue alto fantasma.
function pip(size: number): string {
  return `<div style="width:${size}px; height:${size}px; background:${COLOR.pip}; border-radius:50%; font-size:0; line-height:0; margin:0 auto;">&nbsp;</div>`;
}
// Cara de un 6: dos columnas × tres filas de pintas.
function cara6(pipSize: number, padY: number): string {
  const celda = `<td align="center" width="50%" style="padding:${padY}px 0;">${pip(pipSize)}</td>`;
  const fila  = `<tr>${celda}${celda}</tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${fila}${fila}${fila}</table>`;
}
// Ficha vertical 6-6 completa (hueso + divisor + dos caras).
function ficha66(tileW: number): string {
  const padX    = Math.round(tileW * 0.16);
  const pipSize = Math.round(tileW * 0.15);
  const padY    = Math.round(tileW * 0.055);
  const radio   = Math.round(tileW * 0.17);
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:${tileW}px; background:${COLOR.bone}; border-radius:${radio}px; box-shadow:0 8px 22px rgba(0,0,0,0.4);">
    <tr><td style="padding:${padY + 5}px ${padX}px ${padY}px;">${cara6(pipSize, padY)}</td></tr>
    <tr><td style="padding:0 ${padX}px;"><div style="height:2px; background:rgba(30,22,12,0.22); font-size:0; line-height:0;">&nbsp;</div></td></tr>
    <tr><td style="padding:${padY}px ${padX}px ${padY + 5}px;">${cara6(pipSize, padY)}</td></tr>
  </table>`;
}

// Separador con motivo de ficha: tres pintas ámbar centradas — usa el
// material de marca como divisor, en vez de una línea genérica.
function separadorPintas(): string {
  const dot = `<td style="padding:0 5px;"><div style="width:5px; height:5px; border-radius:50%; background:${COLOR.amber}; opacity:0.85; font-size:0; line-height:0;">&nbsp;</div></td>`;
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>${dot}${dot}${dot}</tr>
  </table>`;
}

function emailLayout(tituloInterno: string, preheader: string, bodyHtml: string): string {
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
    <!-- Preheader: texto de vista previa en la bandeja, oculto en el cuerpo -->
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:${COLOR.bg}; font-size:1px; line-height:1px;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.bg};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:472px; border-radius:20px; overflow:hidden; border:1px solid ${COLOR.border};">
            <!-- Cabecera: mesa de fieltro con la ficha como héroe -->
            <tr>
              <td align="center" bgcolor="${COLOR.felt}" style="background:${COLOR.felt}; padding:40px 32px 32px;">
                ${ficha66(72)}
                <div style="height:18px; line-height:18px; font-size:0;">&nbsp;</div>
                <div style="font-size:26px; font-weight:800; letter-spacing:-0.02em; color:${COLOR.ink};">
                  <span style="color:${COLOR.amber};">2</span>mino
                </div>
                <div style="height:8px; line-height:8px; font-size:0;">&nbsp;</div>
                <div style="font-size:12px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:${COLOR.teal};">
                  Juega · Compite · Domina
                </div>
              </td>
            </tr>
            <!-- Borde de la mesa: hairline ámbar -->
            <tr><td style="height:3px; background:${COLOR.amber}; font-size:0; line-height:0;">&nbsp;</td></tr>
            <!-- Cuerpo -->
            <tr>
              <td bgcolor="${COLOR.panel}" style="background:${COLOR.panel}; padding:36px 32px 32px;">
                ${bodyHtml}
              </td>
            </tr>
          </table>
          <!-- Pie -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:472px;">
            <tr>
              <td align="center" style="padding:22px 16px 0;">
                <span style="font-size:12px; line-height:1.6; color:${COLOR.muted};">
                  Recibiste este correo porque alguien usó tu dirección para registrarse en 2mino.<br />
                  Si no fuiste tú, podés ignorarlo sin problema.
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

// Builder puro (sin envío) — exportado para poder previsualizar/testear el
// HTML sin credenciales ni proveedor.
export function construirEmailVerificacion(username: string, link: string): { asunto: string; html: string } {
  const asunto = 'Confirma tu cuenta de 2mino';
  const html = emailLayout(
    asunto,
    `Estás a un clic de sentarte a la mesa, ${username}. Confirma tu cuenta para empezar a jugar.`,
    `
      <h1 style="margin:0 0 14px; font-size:22px; font-weight:800; letter-spacing:-0.01em; line-height:1.25; color:${COLOR.ink};">
        ¡Bienvenido a la mesa, ${username}!
      </h1>
      <p style="margin:0 0 28px; font-size:15px; line-height:1.65; color:${COLOR.muted};">
        Ya casi estás dentro. Confirma tu cuenta con el botón de abajo y
        empezá a competir: matchmaking por ELO, partidas en pareja y tu
        rango subiendo del bronce al diamante.
      </p>

      <!-- CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px;">
        <tr>
          <td align="center" bgcolor="${COLOR.amber}" style="border-radius:12px; background:${COLOR.amber};">
            <a href="${link}"
               style="display:inline-block; padding:15px 34px; font-size:15px; font-weight:800;
                      letter-spacing:0.01em; color:${COLOR.amberInk}; text-decoration:none; border-radius:12px;">
              Confirmar mi cuenta &rarr;
            </a>
          </td>
        </tr>
      </table>

      <!-- Separador con motivo de ficha -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;">
        <tr>
          <td style="border-top:1px solid ${COLOR.hair};"></td>
          <td width="1" style="padding:0 14px;">${separadorPintas()}</td>
          <td style="border-top:1px solid ${COLOR.hair};"></td>
        </tr>
      </table>

      <!-- Meta: expiración -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td bgcolor="${COLOR.panelSoft}" style="background:${COLOR.panelSoft}; border-radius:10px; padding:14px 16px;">
            <span style="font-size:13px; line-height:1.55; color:${COLOR.muted};">
              El enlace vence en <strong style="color:${COLOR.ink};">24&nbsp;horas</strong>.
              Si expira, pedí uno nuevo desde la pantalla de inicio de sesión.
            </span>
          </td>
        </tr>
      </table>
    `,
  );
  return { asunto, html };
}

export async function enviarEmailVerificacion(email: string, username: string, token: string) {
  const link = `${APP_URL()}/verificar-email/${token}`;
  const { asunto, html } = construirEmailVerificacion(username, link);
  await enviar(email, asunto, html, { email, username });
}
