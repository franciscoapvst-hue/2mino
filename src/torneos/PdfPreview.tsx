import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Vite resuelve esto a una URL de asset real (no bundlea el worker inline)
// — pdf.js SIEMPRE necesita su worker seteado a mano, si no falla en
// silencio. Import `?url` es el patrón de Vite para "dame la URL final".
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

type Props = {
  url: string;
};

/**
 * Vista previa de PDF renderizada nosotros mismos (canvas vía pdf.js), NO
 * un <iframe src="...pdf">. El iframe nativo depende de que el navegador
 * tenga activado "ver PDF en el navegador" — con esa opción apagada (o en
 * ciertos navegadores/móviles) el iframe queda en blanco y el usuario no
 * puede leer nada antes de aceptar las políticas. Renderizando a canvas
 * funciona siempre, sin importar la configuración del visor del usuario.
 */
export default function PdfPreview({ url }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState<number | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const docRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const taskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);

  useEffect(() => {
    let cancelado = false;
    setEstado('cargando');
    const task = pdfjsLib.getDocument({ url });
    taskRef.current = task;
    task.promise
      .then(doc => {
        if (cancelado) return;
        docRef.current = doc;
        setTotalPaginas(doc.numPages);
        setPagina(1);
      })
      .catch(() => { if (!cancelado) setEstado('error'); });
    return () => { cancelado = true; taskRef.current?.destroy(); };
  }, [url]);

  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || !totalPaginas) return;
    let cancelado = false;

    doc.getPage(pagina).then(async page => {
      if (cancelado) return;
      const viewport = page.getViewport({ scale: 1.4 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      if (!cancelado) setEstado('ok');
    }).catch(() => { if (!cancelado) setEstado('error'); });

    return () => { cancelado = true; };
  }, [pagina, totalPaginas]);

  return (
    <div className="tor-pdf-canvas-wrap">
      {estado === 'cargando' && <p className="tor-pdf-status">Cargando reglamento…</p>}
      {estado === 'error' && <p className="tor-pdf-status tor-pdf-status-error">No se pudo cargar el reglamento. Probá abrirlo en una pestaña nueva.</p>}
      <div className="tor-pdf-canvas-scroll" style={{ display: estado === 'ok' ? 'block' : 'none' }}>
        <canvas ref={canvasRef} />
      </div>
      {estado === 'ok' && totalPaginas && totalPaginas > 1 && (
        <div className="tor-pdf-pager">
          <button type="button" onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina <= 1}>← Anterior</button>
          <span>Página {pagina} de {totalPaginas}</span>
          <button type="button" onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas}>Siguiente →</button>
        </div>
      )}
    </div>
  );
}
