import { useNavigate } from 'react-router-dom';
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
export default function Footer() {
  const navigate = useNavigate();

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

        <div className="app-footer-col">
          <span className="app-footer-heading">Legal</span>
          <button className="app-footer-link" onClick={() => navigate('/privacidad')}>
            Política de privacidad
          </button>
          <button className="app-footer-link" onClick={() => navigate('/terminos')}>
            Términos y cumplimiento
          </button>
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
