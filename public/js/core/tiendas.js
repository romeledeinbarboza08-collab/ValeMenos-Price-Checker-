// Tiendas conectadas: plataforma, moneda y reglas de envío.
// Las reglas salen de la política publicada por cada tienda. Cuando la tienda cotiza por
// peso o distancia, el costo es un estimado y el sitio lo marca como "aprox.".

const fijo = (gam, rural, nota) => ({ zona }) => ({ costo: zona === 'gam' ? gam : rural, estimado: true, nota });

export const TIENDAS = {
  walmart: {
    id: 'walmart', nombre: 'Walmart', sitio: 'https://www.walmart.co.cr', plataforma: 'VTEX', moneda: 'CRC', color: '#2f4fd8',
    envioResumen: '₡2.500 artículos regulares y ₡5.000 artículos grandes, a 10 km de una sucursal.',
    envio: ({ voluminoso }) => ({ costo: voluminoso ? 5000 : 2500, estimado: false, nota: voluminoso ? 'Tarifa de artículo grande' : 'Tarifa fija' }),
  },
  maxipali: {
    id: 'maxipali', nombre: 'MaxiPalí', sitio: 'https://www.maxipali.co.cr', plataforma: 'VTEX', moneda: 'CRC', color: '#e0614a',
    envioResumen: 'Misma plataforma de entregas que Walmart; se estima con esa tarifa.',
    envio: ({ voluminoso }) => ({ costo: voluminoso ? 5000 : 2500, estimado: true, nota: 'Estimado con la tarifa de Walmart' }),
  },
  siman: {
    id: 'siman', nombre: 'Simán', sitio: 'https://cr.siman.com', plataforma: 'VTEX', moneda: 'CRC', color: '#161a2b',
    envioResumen: 'Se cotiza al pagar según peso y distancia. Retiro en tienda gratis.',
    envio: ({ zona, voluminoso }) => { const b = zona === 'gam' ? 3000 : 5000; return { costo: voluminoso ? b * 2 : b, estimado: true, nota: 'Simán cotiza por peso y distancia' }; },
  },
  gollo: {
    id: 'gollo', nombre: 'Gollo', sitio: 'https://www.gollo.com', plataforma: 'Magento', moneda: 'CRC', color: '#d33b3b',
    envioResumen: 'Variable según el cantón; GAM de 1 a 3 días. Se estima.',
    envio: fijo(3500, 6000, 'Gollo cobra según el cantón'),
  },
  monge: {
    id: 'monge', nombre: 'Monge', sitio: 'https://www.tiendamonge.com', plataforma: 'Magento', moneda: 'CRC', color: '#1f7a8c',
    envioResumen: 'Se calcula al pagar; entrega a 5 km de una tienda Monge. Se estima.',
    envio: fijo(3500, 6000, 'Monge lo calcula al pagar'),
  },
  intelec: {
    id: 'intelec', nombre: 'Intelec', sitio: 'https://www.intelec.co.cr', plataforma: 'WooCommerce', moneda: 'CRC', color: '#7a5af0',
    envioResumen: 'Envío por mensajería a todo el país; se estima.',
    envio: fijo(3000, 4500, 'Estimado por mensajería'),
  },
  mexpress: {
    id: 'mexpress', nombre: 'MExpress', sitio: 'https://www.tiendamexpress.com', plataforma: 'nopCommerce', moneda: 'CRC', color: '#e8962b',
    envioResumen: 'Gratis desde ₡35.000 dentro de la GAM; si no, ₡3.500 más kilometraje.',
    envio: ({ subtotal, zona }) => (zona === 'gam' && subtotal >= 35000
      ? { costo: 0, estimado: false, nota: 'Gratis desde ₡35.000' }
      : { costo: 3500, estimado: zona !== 'gam', nota: zona === 'gam' ? 'Compra menor a ₡35.000' : 'Más kilometraje fuera de la GAM' }),
  },
  icon: {
    id: 'icon', nombre: 'iCon', sitio: 'https://icon.co.cr', plataforma: 'Shopify', moneda: 'USD', color: '#8a8f9e',
    envioResumen: 'Estándar de $6 a todo el país (3 a 5 días). Retiro en tienda gratis.',
    envio: ({ tasa }) => ({ costo: Math.round(6 * tasa), estimado: false, nota: 'Envío estándar de $6' }),
  },
};

// Tiendas revisadas que NO se consultan, y por qué.
export const TIENDAS_EXCLUIDAS = [
  { nombre: 'PriceSmart', motivo: 'Solo permite el acceso a una lista cerrada de buscadores.' },
  { nombre: 'Extreme Tech', motivo: 'Su servidor rechaza las consultas automáticas (responde 403), así que no la consultamos.' },
];

const PALABRAS_VOLUMINOSO = /refri|refriger|lavadora|secadora|lavaseca|cocina|horno|congelador|aire acondicionado|televisor|pantalla|smart tv|\btv\b|colchon|sofa/;

export function esVoluminoso(titulo, pulgadas) {
  const t = (titulo || '').toLowerCase();
  if (pulgadas && pulgadas >= 50) return true;
  return PALABRAS_VOLUMINOSO.test(t) && !/funda|control|soporte|cable/.test(t);
}

// Precio total de una oferta = producto + envío para la zona elegida.
export function precioTotal(oferta, { zona = 'gam', tasa = 455, voluminoso = false } = {}) {
  const tienda = TIENDAS[oferta.tienda];
  if (!tienda) return { total: oferta.precio, envio: { costo: 0, estimado: true, nota: '' } };
  const envio = tienda.envio({ subtotal: oferta.precio, zona, tasa, voluminoso });
  return { total: oferta.precio + envio.costo, envio };
}
