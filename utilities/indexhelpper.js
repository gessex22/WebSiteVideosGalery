require('dotenv').config()
const fs = require("fs");
const path = require("path");

const incomingDir = path.resolve(process.env.PATH_ENCRYPTED);  //debe ser el directorio a barrer por eso es el cryp
const metadataCrudoPath = path.resolve( "./metadata_crudo.json");
const allowedExt = [".mp4", ".mkv", ".avi", ".mov"]; // ajusta según tus necesidades

function isVideoFile(file) {
  return allowedExt.includes(path.extname(file).toLowerCase());
}

function recorrerRecursivo(dir, lista = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      recorrerRecursivo(fullPath, lista);
    } else if (item.isFile() && isVideoFile(item.name)) {
      lista.push({
        ruta: fullPath,
        cypher: false,
        estatus: false
      });
    }
  }

  return lista;
}

function indexCrudos() {
  console.log("📥 Indexando archivos crudos...");

  if (!fs.existsSync(incomingDir)) {
    console.error("❌ El directorio de entrada no existe:", incomingDir);
    return;
  }

  const archivos = recorrerRecursivo(incomingDir);
  fs.writeFileSync(metadataCrudoPath, JSON.stringify(archivos, null, 2));
  console.log(`✅ Se indexaron ${archivos.length} archivos en ${metadataCrudoPath}`);
}

module.exports = { indexCrudos };