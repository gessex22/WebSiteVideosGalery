// pipeline.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { cifrarArchivoIndividual } = require("./cypherv2");
const generarMiniatura = require("./genMinis");
const { indexCrudos } = require("./utilities/indexhelpper");
const { startWatcher } = require("./cerializacionFile");
const publicKeyPem = fs.readFileSync("g22public_key.pem", "utf-8");
const namePwd = process.env.NAME_PWD; // Reemplaza con tu contraseña real

const metadataPath = './metadata_crudo.json'
const encryptedDir =  process.env.PATH_ENCRYPTED;




async function generarThumbnails() {
  console.log("🖼️ Generando thumbnails...");

  if (!fs.existsSync(metadataPath)) {
    console.error("No se encontró metadata_crudo.json");
    return;
  }

  if (!fs.existsSync(process.env.PATH_THUMBNAILS)) {
    fs.mkdirSync(process.env.PATH_THUMBNAILS, { recursive: true });
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  let cambios = false;

  for (const archivo of metadata) {
    if (archivo.estatus === "pending") {
      try {
        const baseName = path.basename(
          archivo.ruta,
          path.extname(archivo.ruta)
        );
        const nombreThumbnail = `${baseName}_${uuidv4()}.png`;
        const rutaThumbnail = path.join(
          process.env.PATH_THUMBNAILS,
          nombreThumbnail
        );

        await generarMiniatura(archivo.ruta, rutaThumbnail);
        archivo.estatus = "thumbnail-generated";
        archivo.thumbnailPath = rutaThumbnail;

        console.log(`Miniatura generada para: ${archivo.ruta}`);
        cambios = true;
      } catch (error) {
        console.error(`Error generando miniatura para ${archivo.ruta}:`, error);
      }
    }
  }

  if (cambios) {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log("Metadata actualizado con thumbnails.");
  } else {
    console.log("No se generaron miniaturas nuevas.");
  }
}

async function cifrarArchivos() {
  if (!fs.existsSync(metadataPath)) {
    console.error("❌ metadata_crudo.json no encontrado");
    return;
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  let procesados = 0;

  for (const file of metadata) {
  console.log(file)
    if (file.estatus == "thumbnail-generated" )  {
      try {
         await cifrarArchivoIndividual(
          file.ruta,
          publicKeyPem,
          namePwd,
          encryptedDir
        );

        file.cypher = true;
        procesados++;
        console.log(`🔐 Cifrado: ${file.ruta}`);
      } catch (err) {
        console.error(`❌ Error cifrando ${file.ruta}`, err);
      }
    }
  }

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`✅ Archivos cifrados: ${procesados}`);
}


(async () => {
  try {
    // Paso 1: indexar crudos
    await indexCrudos();

    // Paso 2: generar thumbnails
    await generarThumbnails();

    // Paso 3: cifrar archivos
    await cifrarArchivos();

    // Paso 4: arrancar watcher
    startWatcher();

    console.log("🚀 Pipeline inicial completado.");
  } catch (err) {
    console.error("❌ Error en pipeline:", err.message || err);
  }
})();