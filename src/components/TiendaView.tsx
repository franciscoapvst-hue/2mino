import { useEffect, useState } from 'react';
import { api, ApiError, type TiendaItem, type UserConfig } from '../api';
import PageHeader from './social/PageHeader';
import GameIcon from './GameIcons';
import CosmeticoPreview from './CosmeticoPreview';
import CompraExitosaModal from './CompraExitosaModal';
import { skinFichaDe, skinTableroDe } from '../skins';

type Props = {
  dark:   boolean;
  config: UserConfig;
  onConfigChange: (config: UserConfig) => void;
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

export default function TiendaView({ dark, config, onConfigChange, onBack }: Props) {
  const [items, setItems] = useState<TiendaItem[] | null>(null);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Ítem recién comprado — dispara el modal de "¡ya es tuyo!".
  const [recienComprado, setRecienComprado] = useState<TiendaItem | null>(null);
  const [equipandoModal, setEquipandoModal] = useState(false);

  useEffect(() => {
    Promise.all([api.tienda.items(), api.billetera.saldo()])
      .then(([i, b]) => { setItems(i); setSaldo(b.saldo); })
      .catch(() => setError('No se pudo cargar la tienda'));
  }, []);

  function handleComprado(item: TiendaItem, nuevoSaldo: number) {
    setSaldo(nuevoSaldo);
    setItems(prev => prev?.map(i => i.id === item.id ? { ...i, ya_comprado: true } : i) ?? null);
    setRecienComprado(item);
  }

  // Equipar guarda en `opciones` sin pisar otras claves — mismo merge
  // no-destructivo que ya usa App.tsx: guardarOpcionesTutorial().
  async function handleEquipar(item: TiendaItem) {
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
