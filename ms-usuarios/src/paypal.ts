// ── Integración PayPal (Orders API v2) ────────────────────────────
// Flujo técnico y decisiones ya fijadas en docs/PLAN_TORNEOS.md §5 (mismo
// proveedor, mismo criterio) — acá aplicado a comprar doblones
// (docs/PLAN_COSMETICOS.md Etapa F), sin la coordinación de "equipo" que sí
// necesita el pago de torneos. Todo el código de integración vive en este
// único módulo (mismo criterio que ya se fijó para `azul.ts`/`paypal.ts` de
// torneos): access token, crear orden, capturar orden, verificar firma de
// webhook.
//
// ENABLE_PAGOS=false (default, dev-safe) → simula aprobado sin llamar a
// PayPal — mismo criterio que ENABLE_EMAIL. Con ENABLE_PAGOS=true y
// PAYPAL_ENV=sandbox, contra el Sandbox real de PayPal.

import crypto from 'crypto';

const ENABLE_PAGOS = process.env.ENABLE_PAGOS === 'true';
const PAYPAL_ENV = process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox';
const BASE_URL = PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new Error('PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET no configurados (requeridos con ENABLE_PAGOS=true)');
  }
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal: fallo al obtener access token (${res.status})`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

// Crea una orden (intent CAPTURE) por `precioUsd`, con `referenceId` (el id
// de la fila `doblon_compras`) para poder cruzarla después en el webhook.
export async function crearOrden(precioUsd: number, referenceId: string): Promise<{ orderId: string }> {
  if (!ENABLE_PAGOS) {
    // Modo simulado — orderId falso y corto (los reales de PayPal caben en
    // VARCHAR(30); referenceId es un UUID de 36 caracteres, no entra
    // completo). capturarOrden() lo "aprueba" sin llamar a PayPal — la
    // trazabilidad real va por la fila de `doblon_compras`, no por el
    // contenido de este string.
    return { orderId: `SIM-${crypto.randomBytes(8).toString('hex')}` };
  }
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: referenceId,
        amount: { currency_code: 'USD', value: precioUsd.toFixed(2) },
      }],
    }),
  });
  if (!res.ok) throw new Error(`PayPal: fallo al crear la orden (${res.status})`);
  const data = await res.json() as { id: string };
  return { orderId: data.id };
}

// Captura server-to-server contra la API de PayPal — nunca se confía en el
// evento onApprove del SDK del navegador solo (es manipulable).
export async function capturarOrden(orderId: string): Promise<{ capturaId: string; respuesta: unknown }> {
  if (!ENABLE_PAGOS) {
    return { capturaId: `SIM-CAP-${crypto.randomBytes(6).toString('hex')}`, respuesta: { simulado: true, orderId } };
  }
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json() as {
    purchase_units?: { payments?: { captures?: { id: string }[] } }[];
  };
  if (!res.ok) throw new Error(`PayPal: fallo al capturar la orden (${res.status})`);
  const capturaId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  if (!capturaId) throw new Error('PayPal: respuesta de captura sin capture id');
  return { capturaId, respuesta: data };
}

// Verificación de firma del webhook (server-to-server, más simple que la
// verificación criptográfica local — suficiente para el volumen de este
// proyecto, mismo criterio que PLAN_TORNEOS §5.3). En modo simulado no hay
// webhooks reales de PayPal, así que no hay nada que verificar.
export async function verificarWebhookSignature(
  headers: Record<string, string | undefined>,
  body: unknown,
): Promise<boolean> {
  if (!ENABLE_PAGOS) return true;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: body,
    }),
  });
  if (!res.ok) return false;
  const data = await res.json() as { verification_status: string };
  return data.verification_status === 'SUCCESS';
}
