// BarcodeScanner.jsx
import { useState, useEffect, useRef } from 'react';
import { Camera, X, Scan } from 'lucide-react';
import { toast } from 'react-toastify';
import Quagga from '@ericblade/quagga2';
import AppModal from './AppModal';

const normalizeDetectedCode = (code) => String(code || '').replace(/\D/g, '');

const calculateEAN13CheckDigit = (code12) => {
  if (!/^\d{12}$/.test(code12)) return null;

  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(code12[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  return String((10 - (sum % 10)) % 10);
};

const validateEAN13 = (code) => {
  const normalized = normalizeDetectedCode(code);
  if (!/^\d{13}$/.test(normalized)) return false;

  return calculateEAN13CheckDigit(normalized.slice(0, 12)) === normalized.slice(12);
};

const SCANNER_READERS = ['ean_reader'];

const CAMERA_CONSTRAINTS = [
  {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: { ideal: 'environment' }
  },
  {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: 'user'
  },
  {
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }
];

const MIN_CONFIRMATIONS = 3;
const QUAGGA_NOISE_PATTERNS = [
  'InputStreamBrowser createLiveStream',
  'InputStreamBrowser createVideoStream',
  'initCanvas getCanvasAndContext',
  'frame_grabber_browser: willReadFrequently',
  'initCanvas willReadFrequently'
];

const BarcodeScanner = ({ isOpen, onClose, onDetected }) => {
  const [scanning, setScanning] = useState(false);
  const [detectedCode, setDetectedCode] = useState('');
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef(null);
  const initializedRef = useRef(false);
  const listenerAttachedRef = useRef(false);
  const lastCandidateRef = useRef('');
  const candidateCountRef = useRef(0);
  const originalConsoleLogRef = useRef(null);
  const originalConsoleWarnRef = useRef(null);

  const shouldIgnoreQuaggaNoise = (args) => {
    const message = args
      .map((value) => (typeof value === 'string' ? value : ''))
      .join(' ');

    return QUAGGA_NOISE_PATTERNS.some((pattern) => message.includes(pattern));
  };

  const muteQuaggaNoise = () => {
    if (!originalConsoleLogRef.current) {
      originalConsoleLogRef.current = console.log;
      console.log = (...args) => {
        if (shouldIgnoreQuaggaNoise(args)) return;
        originalConsoleLogRef.current(...args);
      };
    }

    if (!originalConsoleWarnRef.current) {
      originalConsoleWarnRef.current = console.warn;
      console.warn = (...args) => {
        if (shouldIgnoreQuaggaNoise(args)) return;
        originalConsoleWarnRef.current(...args);
      };
    }
  };

  const restoreConsole = () => {
    if (originalConsoleLogRef.current) {
      console.log = originalConsoleLogRef.current;
      originalConsoleLogRef.current = null;
    }

    if (originalConsoleWarnRef.current) {
      console.warn = originalConsoleWarnRef.current;
      originalConsoleWarnRef.current = null;
    }
  };

  const normalizePreviewOrientation = () => {
    if (!scannerRef.current) return;

    const previewNodes = scannerRef.current.querySelectorAll('video, canvas');
    previewNodes.forEach((node) => {
      node.style.transform = 'none';
      node.style.webkitTransform = 'none';
      node.style.scale = '1 1';
    });
  };

  // Efecto controla inicio / parada, sin dependencias problemáticas
  useEffect(() => {
    // Si el modal se cerró y Quagga estaba inicializado, lo paramos
    if (!isOpen) {
      internalStopQuagga();
      setDetectedCode('');
      setCameraError('');
      setScanning(false);
      lastCandidateRef.current = '';
      candidateCountRef.current = 0;
      return;
    }

    if (isOpen && !scanning) {
      setCameraError('');
      setDetectedCode('');
      setScanning(true);
      toast.info('Activando cámara...');
    }

    // Si el modal está abierto y el usuario ya pulsó "activar"
    if (isOpen && scanning && !initializedRef.current) {
      // Esperamos a que el ref del DOM exista sin usar ref.current en deps
      const tryStart = () => {
        if (scannerRef.current) {
          initializedRef.current = true;
          startScanner();
        } else {
          // reintentar en el siguiente frame
          requestAnimationFrame(tryStart);
        }
      };
      tryStart();
    }

    // Solo limpiamos a la salida del modal (no en cada render)
    return () => {
      // No ejecutamos internalStopQuagga aquí para evitar "parpadeo" en re-renders
      // La parada completa se hace cuando isOpen cambia a false o cuando el usuario cierra.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, scanning]);

  const initQuagga = (constraints) =>
    new Promise((resolve, reject) => {
      Quagga.init(
        {
          inputStream: {
            name: 'Live',
            type: 'LiveStream',
            target: scannerRef.current,
            constraints,
          },
          locator: { patchSize: 'medium', halfSample: true },
          decoder: {
            readers: SCANNER_READERS,
          },
          locate: true,
        },
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });

  const startScanner = async () => {
    if (!scannerRef.current) {
      setCameraError('Contenedor del scanner no disponible');
      return;
    }

    setCameraError('');
    muteQuaggaNoise();
    try {
      let lastError = null;

      for (const constraints of CAMERA_CONSTRAINTS) {
        try {
          await initQuagga(constraints);
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          try {
            Quagga.stop();
          } catch {
            // ignore
          }
        }
      }

      if (lastError) {
        console.error('Quagga init error:', lastError);
        setCameraError('No se pudo iniciar la webcam. Revisá permisos del navegador o probá con otra cámara.');
        toast.error('No se pudo iniciar la cámara');
        initializedRef.current = false;
        return;
      }

      try {
        Quagga.start();
        requestAnimationFrame(normalizePreviewOrientation);
        setTimeout(normalizePreviewOrientation, 150);
        toast.success('Escáner iniciado');
      } catch (startErr) {
        console.error('Quagga start error:', startErr);
        setCameraError('No se pudo iniciar el stream de la webcam.');
        initializedRef.current = false;
        return;
      }

      if (!listenerAttachedRef.current) {
        Quagga.onDetected(handleDetected);
        listenerAttachedRef.current = true;
      }
    } catch (e) {
      console.error('startScanner exception:', e);
      setCameraError('Error inesperado al iniciar la webcam');
      initializedRef.current = false;
      restoreConsole();
    }
  };

  const handleDetected = (result) => {
    const code = normalizeDetectedCode(result?.codeResult?.code);
    if (!code) return;
    if (!validateEAN13(code)) {
      return;
    }

    if (lastCandidateRef.current !== code) {
      lastCandidateRef.current = code;
      candidateCountRef.current = 1;
      return;
    }

    candidateCountRef.current += 1;
    if (candidateCountRef.current < MIN_CONFIRMATIONS) {
      return;
    }

    if (detectedCode === code) return;
    setDetectedCode(code);
    if (navigator.vibrate) navigator.vibrate(150);
    toast.success(`Código detectado: ${code}`);
    // Llamamos al callback y cerramos modal/escáner de forma controlada
    try {
      onDetected(code);
    } catch (err) {
      console.warn('onDetected callback error:', err);
    }
    // Detenemos Quagga y cerramos modal
    internalStopQuagga();
    setScanning(false);
    lastCandidateRef.current = '';
    candidateCountRef.current = 0;
    onClose();
  };

  // Parada interna que solo limpia Quagga y listeners (no altera scanning UI salvo en handleClose)
  const internalStopQuagga = () => {
    try {
      if (listenerAttachedRef.current) {
        try {
          // Quagga no expone offDetected en todas las builds; safe guard: stop detaches listeners internamente
          Quagga.offDetected && Quagga.offDetected(handleDetected);
        } catch (e) {
          // ignore
        }
        listenerAttachedRef.current = false;
      }
      Quagga.stop();
    } catch (err) {
      // Quagga.stop puede tirar si no estaba iniciado; ignoramos
      // console.warn('Quagga stop warning:', err);
    } finally {
      initializedRef.current = false;
      lastCandidateRef.current = '';
      candidateCountRef.current = 0;
      restoreConsole();
    }
  };

  // Usuario cierra manualmente: hacemos parada completa y reseteamos UI
  const handleClose = () => {
    internalStopQuagga();
    setScanning(false);
    setDetectedCode('');
    setCameraError('');
    lastCandidateRef.current = '';
    candidateCountRef.current = 0;
    onClose();
  };

  const handleStartScan = () => {
    setCameraError('');
    setDetectedCode('');
    setScanning(true);
    lastCandidateRef.current = '';
    candidateCountRef.current = 0;
    toast.info('Activando cámara...');
  };

  if (!isOpen) return null;

  return (
    <AppModal
      open={isOpen}
      onClose={handleClose}
      title="Escanear Código de Barras"
      icon={<Camera size={22} className="text-green-600" />}
      size="lg"
    >
        {/* Scanner area */}
        <div className="mb-4">
          {!scanning ? (
            <div className="flex flex-col items-center justify-center py-12 bg-gray-100 rounded-lg">
              <Scan size={64} className="text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4 text-center">Iniciando cámara...</p>
              <button onClick={handleStartScan} className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Camera size={20} /> Reintentar Cámara
              </button>
              {cameraError && <p className="text-red-600 text-sm mt-3">{cameraError}</p>}
            </div>
          ) : (
            <div className="relative">
              <div
                ref={scannerRef}
                className="w-full aspect-video bg-black rounded-lg overflow-hidden min-h-[300px] [&_video]:!transform-none [&_canvas]:!transform-none"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-4 border-green-500 w-3/4 h-1/2 rounded-lg relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white" />
                </div>
              </div>
              {detectedCode && <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full font-bold shadow-lg">{detectedCode}</div>}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-semibold mb-2">📱 Instrucciones:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Coloca el código dentro del marco verde</li>
            <li>Mantén el código estable y con buena luz</li>
            <li>Permite el acceso a la cámara si el navegador lo solicita</li>
            <li>Funciona mejor con cámara trasera (modo “environment”)</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4">
          {scanning && <button onClick={() => { internalStopQuagga(); setScanning(false); }} className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700">Detener Escáner</button>}
          <button onClick={handleClose} className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cerrar</button>
        </div>
    </AppModal>
  );
};

export default BarcodeScanner;

