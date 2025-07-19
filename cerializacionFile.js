require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { cifrarDirectorio } = require("./cypherv2");
const generarMiniatura = require("./genMinis");

// Configuración
const incomingDir = path.resolve(process.env.PATH_INCOMING);
const encryptedDir = path.resolve(process.env.PATH_ENCRYPTED);
const thumbnailsDir = path.resolve(process.env.PATH_THUMBNAILS || "public/images/thumbnails");
const allowedRawExt = [".mp4", ".avi", ".mkv"];
const namePwd = process.env.NAME_PWD;
const publicKeyPem = fs.readFileSync(process.env.PUBLIC_KEY_PEM, "utf8");

// Verificar extensión permitida
function isRawVideo(file) {
  return allowedRawExt.includes(path.extname(file).toLowerCase());
}

// Procesamiento al detectar nuevo archivo
async function handleNewRaw(fileName) {
  const fullRaw = path.join(incomingDir, fileName);
  if (!fs.existsSync(fullRaw) || !isRawVideo(fileName)) return;

  try {
    // Verificar que metadata.json exista
    const metadataPath = path.join(encryptedDir, "metadata.json");
    if (!fs.existsSync(encryptedDir)) fs.mkdirSync(encryptedDir, { recursive: true });

    let metadata = { salt: null, files: [] };
    if (fs.existsSync(metadataPath)) {
      try {
        metadata = JSON.parse(fs.readFileSync(metadataPath));
      } catch (err) {
        console.warn("⚠️ Error leyendo metadata.json, se inicializa vacío.");
      }
    }

    // Verificar si ya fue cifrado antes
    const yaExiste = metadata.files.some(m => m.original_name === fileName);
    if (yaExiste) {
      console.log(`⚠️ Archivo ya registrado en metadata: ${fileName}`);
      return;
    }

    // Crear miniatura
    const thumbnailName = uuidv4();
    const thumbnailPath = path.join(thumbnailsDir, `${thumbnailName}.png`);
    if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });
    await generarMiniatura(fullRaw, thumbnailPath);

    // Cifrar individualmente
    const { cifrarArchivoIndividual } = require("./cypherv2");
    await cifrarArchivoIndividual(fullRaw, publicKeyPem, namePwd, encryptedDir);

    console.log(`✅ Video procesado: ${fileName}`);
  } catch (err) {
    console.error("❌ Error al procesar nuevo archivo:", err);
  }
}


// Watcher simple
function startWatcher() {
  console.log("Watcher iniciado...");
  fs.watch(incomingDir, { recursive: false }, (event, fileName) => {
    if (event === "rename" && fileName && isRawVideo(fileName)) {
      handleNewRaw(fileName);
    }
  });
}


module.exports = { startWatcher };
