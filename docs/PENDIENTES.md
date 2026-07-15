# Pendientes

Tareas cortas, puntuales, que no ameritan su propio documento — para no
perderlas entre sesiones. Cuando una se resuelve, se tacha (no se borra,
para tener el historial) o se mueve a "Resueltas" con fecha.

Distinto de `docs/BUGS.md` (bugs reales reportados) y de los `PLAN_*.md`
(trabajo grande con varias etapas) — esto es la lista chica de "no te
olvides de...".

---

## Abiertas

- [ ] **Verificar dominio `2mino.online` en Resend** (DKIM + SPF ya
      cargados en IONOS el 2026-07-14, verificación en curso). Cuando esté
      en verde: actualizar `EMAIL_FROM` a `2mino <no-reply@2mino.online>`
      en `.env` (VPS) + comentario en `.env.example` + `docs/DEPLOY.md`, y
      probar un envío real a un correo que no sea el del dueño del
      proyecto (hoy limitado al sandbox `onboarding@resend.dev`, que solo
      manda a la cuenta propia de Resend).

## Resueltas

*(vacío por ahora)*
