// Túnel SSH hacia el VPS de producción, sin pasos manuales: lee la
// contraseña root de ../../CREDENCIALES.md (nunca hardcodeada acá ni en
// git) y expone localhost:3001 -> 127.0.0.1:3000 en el VPS (mismo
// patrón que `ssh -N -L 3001:127.0.0.1:3000 root@vps`, pero sin tener
// que ejecutarlo a mano ni pegar la contraseña).
const fs = require('fs');
const path = require('path');
const net = require('net');
const { Client } = require('ssh2');

const HOST = '74.208.119.150';
const USER = 'root';
const LOCAL_PORT = 3001;
const REMOTE_HOST = '127.0.0.1';
const REMOTE_PORT = 3000;

function leerPasswordDesdeCredenciales() {
  const credPath = path.join(__dirname, '..', '..', 'CREDENCIALES.md');
  if (!fs.existsSync(credPath)) {
    throw new Error(`No se encontró ${credPath}. Ver docs/CONTEXTO.md.`);
  }
  const contenido = fs.readFileSync(credPath, 'utf8');
  const match = contenido.match(/SSH root:\*\*\s*`([^`]+)`/);
  if (!match) {
    throw new Error('No se encontró la clave SSH root dentro de CREDENCIALES.md (¿cambió el formato?).');
  }
  return match[1];
}

let password;
try {
  password = leerPasswordDesdeCredenciales();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const conn = new Client();

conn.on('ready', () => {
  console.log(`Conectado a ${USER}@${HOST}.`);

  const server = net.createServer((socket) => {
    // Sin este handler, un ECONNRESET del lado del navegador (pestaña
    // cerrada, request cancelado, etc. — algo normal y frecuente) tira
    // una excepción no capturada y mata TODO el túnel, no solo esa
    // conexión puntual.
    socket.on('error', () => { /* conexión individual cortada, no pasa nada */ });

    conn.forwardOut(
      socket.remoteAddress || '127.0.0.1',
      socket.remotePort || 0,
      REMOTE_HOST,
      REMOTE_PORT,
      (err, stream) => {
        if (err) {
          console.error('No se pudo abrir el canal hacia el VPS:', err.message);
          socket.end();
          return;
        }
        // Mismo motivo: el canal SSH también puede cortarse solo (VPN
        // inestable, VPS reinicia, etc.) — no debe tirar todo el túnel.
        stream.on('error', () => { /* canal cortado, no pasa nada */ });
        socket.pipe(stream).pipe(socket);
      },
    );
  });

  server.on('error', (err) => {
    console.error('Error en el servidor local:', err.message);
    process.exit(1);
  });

  server.listen(LOCAL_PORT, '127.0.0.1', () => {
    console.log(`Túnel listo: http://localhost:${LOCAL_PORT} -> api-integracion en el VPS.`);
    console.log('Dejá esta ventana abierta mientras uses "Prod" en el Back Office. Ctrl+C para cortar.');
  });
}).on('error', (err) => {
  console.error('No se pudo conectar al VPS:', err.message);
  process.exit(1);
}).connect({
  host: HOST,
  port: 22,
  username: USER,
  password,
  readyTimeout: 20000,
  keepaliveInterval: 15000,
});

process.on('SIGINT', () => {
  conn.end();
  process.exit(0);
});
