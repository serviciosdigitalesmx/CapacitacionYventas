# Proceso de Alta SDMX v1 (Replicable)

Objetivo: activar un negocio nuevo usando la base SrFix sin decisiones raras.

## 1. Datos mínimos de entrada
- Nombre comercial
- Ciudad/estado para pie de página
- WhatsApp de atención (formato internacional, ejemplo: `528112345678`)
- URL de Google Maps
- URL de Apps Script (`.../exec`)
- Contraseña operativo
- Contraseña técnico
- Logo (PNG/WebP)

## 2. Flujo de activación
1. Crear copia del proyecto base con script `scripts/create-client-copy.sh`.
2. Reemplazar logo del cliente en la carpeta nueva (`logo.png`/`logo.webp`).
3. Confirmar URLs en front:
   - Página principal
   - Portal cliente
   - Panel operativo
   - Panel técnico
   - Panel solicitudes
   - Panel archivo
4. Publicar Apps Script para el cliente y copiar URL `exec`.
5. Configurar Script Properties (passwords y secuencias).
6. Publicar front (GitHub Pages o hosting).
7. Conectar subdominio.
8. Pruebas de humo (ver sección 3).
9. Entrega con demo de 20 minutos.

## 3. Pruebas de humo obligatorias
- Cotizador crea folio `COT-*`.
- Solicitud aparece en módulo `Solicitudes`.
- Operativo registra orden y genera `SRF-*`.
- Operativo genera PDF y link de WhatsApp.
- Portal cliente consulta folio y muestra estado.
- Técnico actualiza estado y el cambio se refleja en portal cliente.
- Archivo lista elementos archivados.

## 4. Criterio de listo para vender
Se considera listo cuando el cliente nuevo puede completar su primer flujo real en menos de 10 minutos:
- alta de servicio,
- folio generado,
- consulta en portal.

## 5. Tiempo meta por alta
- Meta inicial: 60-90 min por cliente.
- Meta después de 5 altas: 30-45 min por cliente.
