/** Parámetros de red compartidos por cliente y servidor. */
export const NETWORK = {
  /** Puerto por defecto del servidor de juego (WebSocket). */
  defaultPort: 2567,
  /** Envíos de estado del servidor a clientes por segundo (patchRate). */
  patchRate: 20,
  /** Frecuencia con la que el cliente envía inputs. */
  inputRate: 60,
  /** Interpolación de entidades remotas: retraso en ms respecto al último snapshot. */
  interpolationDelay: 100,
  /** Compensación de lag máxima (ms) que el servidor rebobina para validar disparos. */
  maxLagCompensation: 200,
  /** Tolerancia antes de expulsar por inactividad (ms). */
  idleTimeout: 120_000,
  /** Tiempo para reconectar tras una desconexión (segundos). */
  reconnectionGrace: 20,
  /** Nombre de la sala de partida. Se usa codename para evitar colisiones con otros juegos. */
  rooms: {
    match: 'match',
    lobby: 'lobby',
  },
  /** Versión del protocolo: si cliente y servidor no coinciden, se rechaza la conexión. */
  protocolVersion: 1,
} as const;
