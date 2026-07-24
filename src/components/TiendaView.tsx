import { useEffect, useState } from 'react';
import { api, ApiError, type TiendaItem, type DoblonPaquete, type UserConfig } from '../api';
import PageHeader from './social/PageHeader';
import GameIcon from './GameIcons';
import CosmeticoPreview from './CosmeticoPreview';
import CompraExitosaModal from './CompraExitosaModal';
import { skinFichaDe, skinTableroDe } from '../skins';

type Props = {
  dark:   boolean;
  config: UserConfig;
  avatarActual: string | null | undefined;
  /** Feature flag comprar_doblones_habilitado (BO): oculta la sección de paquetes. */
  comprarDoblonesHabilitado: boolean;
  onConfigChange: (config: UserConfig) => void;
  onAvatarChange: (avatar: string) => void;
  onBack: () => void;
};

function ItemCard({ item, saldo, equipada, onComprado, onEquipar }: {
  item: TiendaItem;
  saldo: number | null;
  equipada: boolean;
  onComprado: (item: TiendaItem, nuevoSaldo: number) => void;
  onEquipar: (item: TiendaItem) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [comprando, setComprando] = useState(false);
  const [equipando, setEquipando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmando) return;
    const t = setTimeout(() => setConfirmando(false), 4000);
    return () => clearTimeout(t);
  }, [confirmando]);

  const sinSaldo = saldo !== null && saldo < item.precio;

  async function confirmarCompra() {
    setComprando(true);
    setError(null);
    try {
      const r = await api.tienda.comprar(item.id);
      onComprado(item, r.saldo);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'No se pudo comprar');
      setConfirmando(false);
    } finally {
      setComprando(false);
    }
  }

  async function equipar() {
    setEquipando(true);
    setError(null);
    try {
      await onEquipar(item);
    } catch {
      setError('No se pudo equipar');
    } finally {
      setEquipando(false);
    }
  }

  return (
    <div className="tienda-item">
      <CosmeticoPreview categoria={item.categoria} clave={item.clave} />
      <div className="tienda-item-body">
        <span className="tienda-item-nombre">{item.nombre}</span>
        {item.precio === 0 ? (
          <span className="tienda-item-gratis">Gratis</span>
        ) : (
          <span className="tienda-item-precio"><GameIcon name="doblon" size={18} /> {item.precio}</span>
        )}
      </div>

      {item.ya_comprado ? (
        equipada ? (
          <span className="tienda-item-equipada">Equipada</span>
        ) : (
          <button className="tienda-item-btn" onClick={equipar} disabled={equipando}>
            {equipando ? 'Equipando…' : 'Equipar'}
          </button>
        )
      ) : confirmando ? (
        <button className="tienda-item-btn tienda-item-btn-confirmar" onClick={confirmarCompra} disabled={comprando}>
          {comprando ? 'Comprando…' : `¿Comprar por ${item.precio}?`}
        </button>
      ) : (
        <button
          className="tienda-item-btn"
          onClick={() => setConfirmando(true)}
          disabled={sinSaldo}
          title={sinSaldo ? 'No te alcanza el saldo' : undefined}
        >
          {sinSaldo ? 'Sin saldo' : 'Comprar'}
        </button>
      )}

      {error && <p className="tienda-item-error">⚠ {error}</p>}
    </div>
  );
}

// Comprar doblones con dinero real (docs/PLAN_COSMETICOS.md Etapa F). El
// flujo real es PayPal Orders API v2 (crear orden → aprobar en PayPal →
// capturar) vía el SDK de botones de PayPal — pero mientras no haya
// credenciales Sandbox configuradas (ENABLE_PAGOS=false en el backend), no
// tiene sentido cargar ese SDK acá: crearOrden()/capturar() ya devuelven un
// resultado simulado end-to-end (mismo criterio que ENABLE_EMAIL). Por eso
// el botón dice "(modo simulado)" en vez de fingir un pago real.
//
// TODO cuando haya credenciales reales: reemplazar este botón por el SDK de
// PayPal (`<script src="https://www.paypal.com/sdk/js?client-id=...">` +
// `PayPal.Buttons({...}).render(...)`), disparando capturar() recién en su
// callback `onApprove` en vez de inmediatamente después de crearOrden().
function PaqueteCard({ paquete, onComprado }: {
  paquete: DoblonPaquete;
  onComprado: (saldo: number, doblones: number) => void;
}) {
  const [comprando, setComprando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function comprar() {
    setComprando(true);
    setError(null);
    try {
      const { orderId } = await api.billetera.doblones.crearOrden(paquete.id);
      const { saldo, doblones } = await api.billetera.doblones.capturar(orderId);
      onComprado(saldo, doblones);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'No se pudo completar la compra');
    } finally {
      setComprando(false);
    }
  }

  return (
    <div className="tienda-item">
      <div className="cosmetico-preview doblon-paquete-preview">
        <GameIcon name="doblon" size={44} />
      </div>
      <div className="tienda-item-body">
        <span className="tienda-item-nombre">{paquete.nombre}</span>
        <span className="tienda-item-precio"><GameIcon name="doblon" size={18} /> {paquete.doblones}</span>
      </div>
      <button className="tienda-item-btn" onClick={comprar} disabled={comprando}>
        {comprando ? 'Procesando…' : `US$${paquete.precio_usd} (modo simulado)`}
      </button>
      {error && <p className="tienda-item-error">⚠ {error}</p>}
    </div>
  );
}

export default function TiendaView({ dark, config, avatarActual, comprarDoblonesHabilitado, onConfigChange, onAvatarChange, onBack }: Props) {
  const [items, setItems] = useState<TiendaItem[] | null>(null);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [paquetes, setPaquetes] = useState<DoblonPaquete[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Ítem recién comprado — dispara el modal de "¡ya es tuyo!".
  const [recienComprado, setRecienComprado] = useState<TiendaItem | null>(null);
  const [equipandoModal, setEquipandoModal] = useState(false);

  useEffect(() => {
    Promise.all([api.tienda.items(), api.billetera.saldo(), api.billetera.doblones.paquetes()])
      .then(([i, b, p]) => { setItems(i); setSaldo(b.saldo); setPaquetes(p); })
      .catch(() => setError('No se pudo cargar la tienda'));
  }, []);

  function handleDoblonesComprados(nuevoSaldo: number) {
    setSaldo(nuevoSaldo);
  }

  function handleComprado(item: TiendaItem, nuevoSaldo: number) {
    setSaldo(nuevoSaldo);
    setItems(prev => prev?.map(i => i.id === item.id ? { ...i, ya_comprado: true } : i) ?? null);
    setRecienComprado(item);
  }

  // Equipar guarda en `opciones` sin pisar otras claves — mismo merge
  // no-destructivo que ya usa App.tsx: guardarOpcionesTutorial(). Avatar es
  // la excepción: no vive en `opciones`, tiene su propio endpoint
  // (api.setAvatar → columna usuarios.avatar, gated por posesión desde la
  // Etapa E) — mismo criterio que InventarioView.
  async function handleEquipar(item: TiendaItem) {
    if (item.categoria === 'avatar') {
      await api.setAvatar(item.clave);
      onAvatarChange(item.clave);
      return;
    }
    const campo = item.categoria === 'ficha' ? 'skin_ficha' : 'skin_tablero';
    const opciones = { ...(config.opciones ?? {}), [campo]: item.clave };
    const nuevo = await api.putPreferencias({ opciones });
    onConfigChange(nuevo);
  }

  async function handleEquiparDesdeModal() {
    if (!recienComprado) return;
    setEquipandoModal(true);
    try {
      await handleEquipar(recienComprado);
      setRecienComprado(null);
    } catch {
      /* el modal se queda abierto; el usuario puede reintentar o cerrar */
    } finally {
      setEquipandoModal(false);
    }
  }

  const equipadaFicha   = skinFichaDe(config.opciones);
  const equipadaTablero = skinTableroDe(config.opciones);

  return (
    <div className={`dash social-page${dark ? '' : ' is-light'}`}>
      <PageHeader
        title="Tienda"
        subtitle="Cosméticos 100% visuales — no afectan tu partida"
        onBack={onBack}
        right={saldo !== null && (
          <span className="tienda-saldo"><GameIcon name="doblon" size={20} /> {saldo}</span>
        )}
      />

      <main className="social-body">
        {error && <div className="social-error">⚠ {error}</div>}

        {items === null && !error ? (
          <div className="social-loading"><div className="boot-spinner" /><p>Cargando catálogo…</p></div>
        ) : (
          <>
            <h2 className="tienda-section-title">Fichas</h2>
            <div className="tienda-grid">
              {items?.filter(i => i.categoria === 'ficha').map(i => (
                <ItemCard
                  key={i.id}
                  item={i}
                  saldo={saldo}
                  equipada={i.clave === equipadaFicha}
                  onComprado={handleComprado}
                  onEquipar={handleEquipar}
                />
              ))}
            </div>

            <h2 className="tienda-section-title">Tableros</h2>
            <div className="tienda-grid">
              {items?.filter(i => i.categoria === 'tablero').map(i => (
                <ItemCard
                  key={i.id}
                  item={i}
                  saldo={saldo}
                  equipada={i.clave === equipadaTablero}
                  onComprado={handleComprado}
                  onEquipar={handleEquipar}
                />
              ))}
            </div>

            <h2 className="tienda-section-title">Avatares</h2>
            <div className="tienda-grid">
              {items?.filter(i => i.categoria === 'avatar').map(i => (
                <ItemCard
                  key={i.id}
                  item={i}
                  saldo={saldo}
                  equipada={i.clave === avatarActual}
                  onComprado={handleComprado}
                  onEquipar={handleEquipar}
                />
              ))}
            </div>

            {comprarDoblonesHabilitado && paquetes && paquetes.length > 0 && (
              <>
                <h2 className="tienda-section-title">Comprar doblones</h2>
                <div className="tienda-grid">
                  {paquetes.map(p => (
                    <PaqueteCard key={p.id} paquete={p} onComprado={handleDoblonesComprados} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {recienComprado && (
        <CompraExitosaModal
          item={recienComprado}
          equipando={equipandoModal}
          onEquipar={handleEquiparDesdeModal}
          onClose={() => setRecienComprado(null)}
        />
      )}
    </div>
  );
}
