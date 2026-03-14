function doGet(){return HtmlService.createTemplateFromFile('index').evaluate();}
function getConfig(){return JSON.parse(DriveApp.getFilesByName('config.json').next().getBlob().getDataAsString());}