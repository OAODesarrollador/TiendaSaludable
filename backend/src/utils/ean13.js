const JsBarcode = require('jsbarcode');
const fs = require('fs');
const path = require('path');

/**
 * Genera un código EAN-13 válido con dígito de control
 * Formato: 12 dígitos + 1 dígito verificador
 */
const generateEAN13 = () => {
  // Prefijo 200-299 es para uso interno de tiendas
  const prefix = '200';
  
  // Generar 9 dígitos aleatorios
  const randomDigits = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  
  // Combinar prefijo + dígitos aleatorios (12 dígitos)
  const code12 = prefix + randomDigits;
  
  // Calcular dígito verificador
  const checkDigit = calculateEAN13CheckDigit(code12);
  
  return code12 + checkDigit;
};

/**
 * Calcula el dígito verificador según el algoritmo EAN-13
 * @param {string} code12 - Código de 12 dígitos
 * @returns {string} - Dígito verificador (0-9)
 */
const calculateEAN13CheckDigit = (code12) => {
  if (code12.length !== 12) {
    throw new Error('El código debe tener exactamente 12 dígitos');
  }

  let sum = 0;
  
  // Sumar dígitos en posiciones impares (multiplicar por 1)
  for (let i = 0; i < 12; i += 2) {
    sum += parseInt(code12[i]);
  }
  
  // Sumar dígitos en posiciones pares (multiplicar por 3)
  for (let i = 1; i < 12; i += 2) {
    sum += parseInt(code12[i]) * 3;
  }
  
  // Calcular dígito verificador
  const checkDigit = (10 - (sum % 10)) % 10;
  
  return checkDigit.toString();
};

/**
 * Valida un código EAN-13 completo
 * @param {string} ean13 - Código EAN-13 de 13 dígitos
 * @returns {boolean}
 */
const validateEAN13 = (ean13) => {
  if (!ean13 || ean13.length !== 13 || !/^\d+$/.test(ean13)) {
    return false;
  }
  
  const code12 = ean13.substring(0, 12);
  const checkDigit = ean13[12];
  
  return calculateEAN13CheckDigit(code12) === checkDigit;
};

/**
 * Genera imagen del código de barras EAN-13
 * @param {string} ean13 - Código EAN-13
 * @param {string} outputPath - Ruta donde guardar la imagen
 */
const generateBarcodeImage = (ean13, outputPath) => {
  try {
    const { createCanvas } = require('canvas');

    // Crear canvas
    const canvas = createCanvas();
    
    // Generar código de barras
    JsBarcode(canvas, ean13, {
      format: 'EAN13',
      width: 2,
      height: 100,
      displayValue: true,
      fontSize: 14,
      margin: 10
    });
    
    // Crear directorio si no existe
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Guardar imagen
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    
    return true;
  } catch (error) {
    console.error('Error generando código de barras:', error);
    return false;
  }
};

/**
 * Genera SVG del código de barras
 * @param {string} ean13 - Código EAN-13
 * @returns {string} - SVG como string
 */
const generateBarcodeSVG = (ean13) => {
  try {
    const { DOMImplementation, XMLSerializer } = require('xmldom');
    const xmlSerializer = new XMLSerializer();
    const document = new DOMImplementation().createDocument('http://www.w3.org/1999/xhtml', 'html', null);
    const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    JsBarcode(svgNode, ean13, {
      format: 'EAN13',
      width: 2,
      height: 100,
      displayValue: true,
      fontSize: 14,
      margin: 10,
      xmlDocument: document
    });

    return xmlSerializer.serializeToString(svgNode);
  } catch (error) {
    console.error('Error generando SVG:', error);
    return null;
  }
};

module.exports = {
  generateEAN13,
  calculateEAN13CheckDigit,
  validateEAN13,
  generateBarcodeImage,
  generateBarcodeSVG
};
