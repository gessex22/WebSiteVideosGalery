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


let processingQueue = Promise.resolve(); // Cola secuencial

function enqueueProcess(task) {
  processingQueue = processingQueue.then(() => task()).catch(err => {
    console.error("❌ Error en cola:", err);
  });
}

// Verificar extensión permitida
function isRawVideo(file) {
  return allowedRawExt.includes(path.extname(file).toLowerCase());
}

// Esperar a que el archivo termine de copiarse
function waitForFileComplete(filePath, interval = 2000) {
  return new Promise((resolve, reject) => {
    let lastSize = -1;

    const check = () => {
      if (!fs.existsSync(filePath)) {
        return reject(new Error(`El archivo desapareció: ${filePath}`));
      }

      const { size } = fs.statSync(filePath);

      if (size === lastSize && size > 0) {
        return resolve(); // ✅ El archivo ya no cambia de tamaño
      }

      lastSize = size;
      setTimeout(check, interval); // sigue verificando hasta estabilizar
    };

    check();
  });
}

// Procesamiento al detectar nuevo archivo
async function handleNewRaw(fileName) {
  enqueueProcess(async () => {
    const fullRaw = path.join(incomingDir, fileName);
    if (!fs.existsSync(fullRaw) || !isRawVideo(fileName)) return;

    try {
      console.log(`📥 Detectado: ${fileName}, esperando...`);
      await waitForFileComplete(fullRaw);
      console.log(`✅ Estable: ${fileName}`);

      // Crear miniatura con reintentos
      const thumbnailName = uuidv4();
      const thumbnailPath = path.join(thumbnailsDir, `${thumbnailName}.png`);
      if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });

      let success = false;
      for (let i = 0; i < 3; i++) {
        try {
          await generarMiniatura(fullRaw, thumbnailPath);
          success = true;
          break;
        } catch (err) {
          console.warn(`⚠️ ffmpeg fallo intento ${i + 1} para ${fileName}, reintentando...`);
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      if (!success) {
        console.error(`❌ Miniatura falló definitivamente para ${fileName}`);
        return;
      }

      // Cifrado
      const { cifrarArchivoIndividual } = require("./cypherv2");
      await cifrarArchivoIndividual(fullRaw, publicKeyPem, namePwd, encryptedDir);

      console.log(`🎬 Procesado y cifrado: ${fileName}`);
    } catch (err) {
      console.error("❌ Error procesando:", err);
    }
  });
}

// Watcher
function startWatcher() {
  console.log("👀 Watcher iniciado...");
  fs.watch(incomingDir, { recursive: false }, (event, fileName) => {
    if (event === "rename" && fileName && isRawVideo(fileName)) {
      handleNewRaw(fileName);
    }
  });
}

module.exports = { startWatcher };
