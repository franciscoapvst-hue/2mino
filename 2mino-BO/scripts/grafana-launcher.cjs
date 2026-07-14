// Lanzador del dashboard de Grafana, sin pasos manuales: expone un
// endpoint HTTP local que el botón "Grafana ↗" del panel llama al
// clickear. Al pedirlo, abre (si hace falta) el túnel SSH de métricas
// hacia el VPS y levanta monitoring/docker-compose.yml (Prometheus +
// Grafana) en esta PC — mismo espíritu que tunnel-prod.cjs: lee la
// contraseña root de CREDENCIALES.md, nunca hardcodeada ni en git.
const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const { execFile } = require('child_process');
const { Client } = require('ssh2');

const HOST = '74.208.119.150';
const USER = 'root';
const HTTP_PORT = 4590; // el botón del BO le pega acá

// Forwards de métricas (distintos del túnel de tunnel-prod.cjs, que solo
// cubre api-integracion:3000 -> 3001). 18080, no 8080: ese lo usa
// Jenkins local (ci/), que corre siempre en esta PC.
const FORWARDS = [
  { local: 18080, remote: 8080 },  // cadvisor
  { local: 9100,  remote: 9100 },  // node-exporter
];

const MONITORING_DIR = path.join(__dirname, '..', '..', 'monitoring');

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

// ¿Hay algo ya escuchando en ese puerto? Si sí, asumimos que el túnel de
// una corrida anterior de este mismo script sigue en pie — no abrir uno
// nuevo encima (el forward viejo sigue sirviendo igual).
function puertoOcupado(port) {
  return new Promise((resolve) => {
    const tester = net.createConnection({ port, host: '127.0.0.1' }, () => {
      tester.end();
      resolve(true);
    });
    tester.on('error', () => resolve(false));
  });
}

let conn = null;

function abrirTunel() {
  return new Promise((resolve, reject) => {
    let password;
    try {
      password = leerPasswordDesdeCredenciales();
    } catch (err) {
      reject(err);
      return;
    }
    conn = new Client();
    conn.on('ready', () => {
      for (const { local, remote } of FORWARDS) {
        const server = net.createServer((socket) => {
          // Mismo motivo que en tunnel-prod.cjs: un ECONNRESET del lado
          // del navegador no debe tirar todo el túnel abajo.
          socket.on('error', () => {});
          conn.forwardOut(
            socket.remoteAddress || '127.0.0.1', socket.remotePort || 0,
            '127.0.0.1', remote,
            (err, stream) => {
              if (err) { socket.end(); return; }
              stream.on('error', () => {});
              socket.pipe(stream).pipe(socket);
            },
          );
        });
        server.on('error', (err) => console.error(`Forward ${local}->${remote}:`, err.message));
        server.listen(local, '127.0.0.1');
      }
      console.log('Túnel de métricas listo (cadvisor:18080, node-exporter:9100).');
      resolve();
    }).on('error', reject).connect({
      host: HOST, port: 22, username: USER, password,
      readyTimeout: 20000, keepaliveInterval: 15000,
    });
  });
}

function levantarMonitoring() {
  return new Promise((resolve, reject) => {
    execFile('docker', ['compose', 'up', '-d'], { cwd: MONITORING_DIR }, (err, _stdout, stderr) => {
      if (err) { reject(new Error(stderr || err.message)); return; }
      resolve();
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url !== '/start') { res.writeHead(404).end(); return; }
  try {
    if (!(await puertoOcupado(FORWARDS[0].local))) await abrirTunel();
    await levantarMonitoring();
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('Error iniciando Grafana:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: err.message }));
  }
});

server.listen(HTTP_PORT, '127.0.0.1', () => {
  console.log(`Lanzador de Grafana escuchando en http://localhost:${HTTP_PORT} (lo usa el botón "Grafana ↗" del panel).`);
  console.log('Dejá esta ventana abierta. Ctrl+C para cortar (baja el túnel; el stack de monitoring queda corriendo).');
});

process.on('SIGINT', () => {
  if (conn) conn.end();
  process.exit(0);
});
