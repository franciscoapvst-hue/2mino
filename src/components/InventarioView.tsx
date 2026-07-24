import { useEffect, useState } from 'react';
import { api, type AuthUser, type UserConfig, type InventarioItem } from '../api';
import PageHeader from './social/PageHeader';
import CosmeticoPreview from './CosmeticoPreview';
import GameIcon from './GameIcons';
import { skinFichaDe, skinTableroDe } from '../skins';

const ICONO_SECCION = {
  ficha:   <GameIcon name="ficha"   size={30} />,
  tablero: <GameIcon name="tablero" size={30} />,
  avatar:  <GameIcon name="avatar"  size={30} />,
} as const;

type Props = {
  dark:   boolean;
  user:   AuthUser;
  config: UserConfig;
  onConfigChange: (config: UserConfig) => void;
  onAvatarChange: (avatar: string) => void;
  onBack: () => void;
};

// Una fila del inventario — ficha/tablero/avatar son todos ítems reales de
// tienda_items desde la Etapa E (avatares incluidos: los 8 originales son
// gratis, avatares nuevos entran pagos).
type Fila = { clave: string; nombre: string; categoria: 'ficha' | 'tablero' | 'avatar' };

function InventarioCard({ fila, equipada, equipando, onEquipar }: {
  fila: Fila; equipada: boolean; equipando: boolean; onEquipar: () => void;
}) {
  return (
    <div className="inv-item">
      <CosmeticoPreview categoria={fila.categoria} clave={fila.clave} />
      {fila.nombre && <span className="inv-item-nombre">{fila.nombre}</span>}
      {equipada ? (
        <span className="tienda-item-equipada">Equipada</span>
      ) : (
        <button className="tienda-item-btn" onClick={onEquipar} disabled={equipando}>
          {equipando ? 'Equipando…' : 'Equipar'}
        </button>
      )}
    </div>
  );
}

function InventarioSeccion({ tipo, titulo, filas, equipadaClave, equipandoClave, onEquipar }: {
  tipo: 'ficha' | 'tablero' | 'avatar';
  titulo: string;
  filas: Fila[];
  equipadaClave: string | null | undefined;
  equipandoClave: string | null;
  onEquipar: (fila: Fila) => void;
}) {
  return (
    <section className="inv-section">
      <div className="inv-section-head">
        <span className="inv-section-icon">{ICONO_SECCION[tipo]}</span>
        <h2>{titulo}</h2>
        <span className="inv-section-count">{filas.length}</span>
      </div>
      {filas.length === 0 ? (
        <p className="inv-section-empty">Todavía no tienes ninguno.</p>
      ) : (
        <div className="inv-grid">
          {filas.map(f => (
            <InventarioCard
              key={f.clave}
              fila={f}
              equipada={f.clave === equipadaClave}
              equipando={equipandoClave === f.clave}
              onEquipar={() => onEquipar(f)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Inventario ("Mis cosméticos") — docs/PLAN_COSMETICOS.md, Etapa D ──
// Separa "lo que tengo" (acá) de "lo que puedo comprar" (Tienda). Tres
// secciones por tipo de cosmético — cada una se distingue por su encabezado
// (ícono de categoría + título + conteo + regla), no por contenedores de
// colores: un solo acento ámbar mantiene la pantalla cohesionada con la
// Tienda, con teal reservado para el estado "Equipada".
export default function InventarioView({ dark, user, config, onConfigChange, onAvatarChange, onBack }: Props) {
  const [items, setItems] = useState<InventarioItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [equipandoClave, setEquipandoClave] = useState<string | null>(null);

  useEffect(() => {
    api.tienda.inventario()
      .then(setItems)
      .catch(() => setError('No se pudo cargar tu inventario'));
  }, []);

  const equipadaFicha   = skinFichaDe(config.opciones);
  const equipadaTablero = skinTableroDe(config.opciones);

  async function equiparCosmetico(fila: Fila) {
    setEquipandoClave(fila.clave);
    try {
      const campo = fila.categoria === 'ficha' ? 'skin_ficha' : 'skin_tablero';
      const opciones = { ...(config.opciones ?? {}), [campo]: fila.clave };
      const nuevo = await api.putPreferencias({ opciones });
      onConfigChange(nuevo);
    } catch {
      /* best-effort; el botón vuelve a "Equipar" y se puede reintentar */
    } finally {
      setEquipandoClave(null);
    }
  }

  async function equiparAvatar(fila: Fila) {
    setEquipandoClave(fila.clave);
    try {
      await api.setAvatar(fila.clave);
      onAvatarChange(fila.clave);
    } catch {
      /* idem */
    } finally {
      setEquipandoClave(null);
    }
  }

  function onEquipar(fila: Fila) {
    if (fila.categoria === 'avatar') return equiparAvatar(fila);
    return equiparCosmetico(fila);
  }

  const fichas: Fila[]   = items?.filter(i => i.categoria === 'ficha')
    .map(i => ({ clave: i.clave, nombre: i.nombre, categoria: 'ficha' as const })) ?? [];
  const tableros: Fila[] = items?.filter(i => i.categoria === 'tablero')
    .map(i => ({ clave: i.clave, nombre: i.nombre, categoria: 'tablero' as const })) ?? [];
  const avatares: Fila[] = items?.filter(i => i.categoria === 'avatar')
    .map(i => ({ clave: i.clave, nombre: i.nombre, categoria: 'avatar' as const })) ?? [];

  return (
    <div className={`dash social-page${dark ? '' : ' is-light'}`}>
      <PageHeader
        title="Mis cosméticos"
        subtitle="Lo que ya tienes, agrupado por tipo"
        onBack={onBack}
      />

      <main className="social-body">
        {error && <div className="social-error">⚠ {error}</div>}

        {items === null && !error ? (
          <div className="social-loading"><div className="boot-spinner" /><p>Cargando tu inventario…</p></div>
        ) : (
          <>
            <InventarioSeccion
              tipo="ficha" titulo="Fichas" filas={fichas}
              equipadaClave={equipadaFicha} equipandoClave={equipandoClave} onEquipar={onEquipar}
            />
            <InventarioSeccion
              tipo="tablero" titulo="Tableros" filas={tableros}
              equipadaClave={equipadaTablero} equipandoClave={equipandoClave} onEquipar={onEquipar}
            />
            <InventarioSeccion
              tipo="avatar" titulo="Avatares" filas={avatares}
              equipadaClave={user.avatar} equipandoClave={equipandoClave} onEquipar={onEquipar}
            />
          </>
        )}
      </main>
    </div>
  );
}
