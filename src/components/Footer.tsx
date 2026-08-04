import { Link } from 'react-router-dom';
import { Bone } from './DominoStage';

// ── Footer (docs/PLAN_MONETIZACION.md, punto 9) ────────────────────
// Vive al pie del Dashboard y del Landing — soporte, legal y links a las
// tiendas. Requisito de AdSense/tiendas tanto como de producto: sin una
// política de privacidad enlazada y navegable sin sesión, ni AdSense ni
// Google Play/App Store aprueban la app.
//
// Paleta propia (--ftr-*) en vez de heredar --d-*/--l-* del contenedor:
// así funciona igual dentro de `.dash` o de `.landing` sin depender de
// qué prefijo de variables use la pantalla que lo monta.
// Los enlaces son <Link> (que renderiza <a href>), NO botones con navigate().
// Antes eran botones: funcionaban para una persona, pero un crawler no hace
// clic — así el landing quedaba con CERO enlaces internos rastreables y todas
// las páginas huérfanas, descubribles solo por el sitemap. Además "navegación
// del sitio" es uno de los tres criterios de política de AdSense.
export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer-top">
        <div className="app-footer-brand">
          <Bone a={3} b={3} className="app-footer-bone" />
          <span className="app-footer-word"><span>2</span>mino</span>
        </div>

        <div className="app-footer-col">
          <span className="app-footer-heading">Soporte</span>
          <a className="app-footer-link" href="mailto:soporte@2mino.online">soporte@2mino.online</a>
        </div>

        {/* Guías: las páginas de contenido no se alcanzaban desde ningún lado
            sin sesión — ni para un visitante ni para un crawler. Acá es donde
            el sitio deja de ser solo la app y muestra que tiene contenido. */}
        <div className="app-footer-col">
          <span className="app-footer-heading">Guías</span>
          <Link className="app-footer-link" to="/reglas-domino-dominicano">
            Reglas del dominó dominicano
          </Link>
          <Link className="app-footer-link" to="/domino-en-parejas">
            Cómo jugar en parejas
          </Link>
          <Link className="app-footer-link" to="/capicua-domino">
            Qué es la capicúa
          </Link>
          <Link className="app-footer-link" to="/tranca-domino">
            La tranca
          </Link>
          <Link className="app-footer-link" to="/estrategia-domino">
            Estrategia para principiantes
          </Link>
          <Link className="app-footer-link" to="/glosario-domino">
            Glosario
          </Link>
        </div>

        <div className="app-footer-col">
          <span className="app-footer-heading">Legal</span>
          <Link className="app-footer-link" to="/privacidad">
            Política de privacidad
          </Link>
          <Link className="app-footer-link" to="/terminos">
            Términos y cumplimiento
          </Link>
        </div>

        <div className="app-footer-col">
          <span className="app-footer-heading">Descarga la app</span>
          <div className="app-footer-stores">
            <span className="app-footer-store" title="Próximamente en Google Play">Google Play</span>
            <span className="app-footer-store" title="Próximamente en App Store">App Store</span>
          </div>
        </div>
      </div>

      <div className="app-footer-bottom">
        <span>© {new Date().getFullYear()} 2mino</span>
      </div>
    </footer>
  );
}
