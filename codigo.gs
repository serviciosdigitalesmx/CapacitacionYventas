// Configuración
const SPREADSHEET_ID = 'TU_ID_DE_HOJA'; // Reemplaza con el ID de tu hoja
const SHEET_NAME = 'Prospectos';
const TOKEN = 'MI_TOKEN_SECRETO'; // Cámbialo por una clave secreta

// Función principal para GET (consultas)
function doGet(e) {
  return handleRequest(e);
}

// Función principal para POST (crear, actualizar, eliminar)
function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  // Verificar token simple (opcional pero recomendado)
  const params = e.parameter;
  if (params.token !== TOKEN) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Token inválido' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const action = params.action || '';
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);

  try {
    switch (action) {
      case 'getAll':
        return getAll(sheet);
      case 'add':
        return add(sheet, params);
      case 'update':
        return update(sheet, params);
      case 'delete':
        return deleteProspect(sheet, params);
      case 'getOne':
        return getOne(sheet, params);
      default:
        return ContentService.createTextOutput(JSON.stringify({ error: 'Acción no válida' }))
          .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Obtener todos los prospectos (ordenados por ultimoContacto descendente)
function getAll(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return jsonResponse([]);
  
  const headers = data[0];
  const rows = data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
  
  // Ordenar por ultimoContacto (si existe) descendente
  rows.sort((a, b) => (b.ultimoContacto || 0) - (a.ultimoContacto || 0));
  return jsonResponse(rows);
}

// Obtener un prospecto por índice de fila (fila en la hoja)
function getOne(sheet, params) {
  const row = parseInt(params.row);
  if (isNaN(row) || row < 2) return jsonResponse({ error: 'Fila inválida' });
  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let obj = {};
  headers.forEach((h, i) => { obj[h] = data[i]; });
  return jsonResponse(obj);
}

// Agregar nuevo prospecto
function add(sheet, params) {
  const now = new Date();
  const timestamp = now.toLocaleString();
  const ultimoContacto = now.getTime();
  
  const newRow = [
    timestamp,                           // A: timestamp
    params.nombre || '',                 // B: nombre
    params.giro || '',                    // C: giro
    params.contacto || '',                 // D: contacto
    params.responsable || '',               // E: responsable
    params.semaforo || 'Verde',             // F: semaforo
    params.etapa || 'Nuevo',                // G: etapa
    params.canal || '',                      // H: canal
    params.proximoSeguimiento || '',          // I: proximoSeguimiento
    params.notas || '',                       // J: notas
    params.problema || '',                     // K: problema
    params.objecion || '',                      // L: objecion
    params.nivelInteres || 'Medio',              // M: nivelInteres
    params.horario || '',                         // N: horario
    params.mensajeEnviado === 'true' ? true : false, // O: mensajeEnviado
    params.respondio === 'true' ? true : false,       // P: respondio
    params.demoAgendada === 'true' ? true : false,     // Q: demoAgendada
    params.cerrado === 'true' ? true : false,           // R: cerrado
    params.evidencia || '',                              // S: evidencia
    timestamp,                                            // T: fechaAlta (igual a timestamp)
    timestamp,                                            // U: fechaActualizacion
    ultimoContacto                                         // V: ultimoContacto
  ];
  
  sheet.appendRow(newRow);
  return jsonResponse({ success: true, message: 'Prospecto agregado', row: sheet.getLastRow() });
}

// Actualizar prospecto existente (por número de fila)
function update(sheet, params) {
  const row = parseInt(params.row);
  if (isNaN(row) || row < 2) return jsonResponse({ error: 'Fila inválida' });
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const now = new Date();
  const fechaActualizacion = now.toLocaleString();
  const ultimoContacto = now.getTime();
  
  // Mapeo de campos a columnas (índice 0 = A)
  const colMap = {
    timestamp: 0,
    nombre: 1,
    giro: 2,
    contacto: 3,
    responsable: 4,
    semaforo: 5,
    etapa: 6,
    canal: 7,
    proximoSeguimiento: 8,
    notas: 9,
    problema: 10,
    objecion: 11,
    nivelInteres: 12,
    horario: 13,
    mensajeEnviado: 14,
    respondio: 15,
    demoAgendada: 16,
    cerrado: 17,
    evidencia: 18,
    fechaAlta: 19,
    fechaActualizacion: 20,
    ultimoContacto: 21
  };
  
  // Leer fila actual para preservar campos no enviados
  const currentData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Crear array con los nuevos valores
  let updatedRow = [];
  for (let i = 0; i < headers.length; i++) {
    let field = headers[i];
    if (field === 'fechaActualizacion') {
      updatedRow.push(fechaActualizacion);
    } else if (field === 'ultimoContacto') {
      updatedRow.push(ultimoContacto);
    } else if (params[field] !== undefined) {
      // Convertir booleanos si es necesario
      if (field === 'mensajeEnviado' || field === 'respondio' || field === 'demoAgendada' || field === 'cerrado') {
        updatedRow.push(params[field] === 'true' ? true : false);
      } else {
        updatedRow.push(params[field]);
      }
    } else {
      updatedRow.push(currentData[i]); // mantener valor existente
    }
  }
  
  sheet.getRange(row, 1, 1, updatedRow.length).setValues([updatedRow]);
  return jsonResponse({ success: true, message: 'Prospecto actualizado' });
}

// Eliminar prospecto (borra la fila)
function deleteProspect(sheet, params) {
  const row = parseInt(params.row);
  if (isNaN(row) || row < 2) return jsonResponse({ error: 'Fila inválida' });
  sheet.deleteRow(row);
  return jsonResponse({ success: true, message: 'Prospecto eliminado' });
}

// Helper para respuesta JSON
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
