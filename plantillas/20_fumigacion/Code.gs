/**
 * Archivo legacy conservado para compatibilidad.
 * La logica principal vive en codigo.gs.
 */
function legacyRenderIndex_() {
  return HtmlService.createTemplateFromFile('index').evaluate();
}
