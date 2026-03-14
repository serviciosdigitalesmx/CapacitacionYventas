function doGet(e){
  const action = (e && e.parameter && e.parameter.action) || 'status';
  return ContentService.createTextOutput(JSON.stringify({ok:true, action:action})).setMimeType(ContentService.MimeType.JSON);
}
