import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// Ruta del JSON
const metadataPath = path.join(process.env.PATH_ENCRYPTED, 'metadata.json');

// Leer metadata.json
const rawData = fs.readFileSync(metadataPath, 'utf8');
const data = JSON.parse(rawData);

// Inicializar contadores
let total = data.files.length;
let missing = 0;
let found = 0;

console.log(`🔍 Verificando existencia de archivos...\n`);

data.files.forEach((file, index) => {
  // Obtener ruta absoluta si es relativa
  const fullPath = path.isAbsolute(file.encrypted_path)
    ? file.encrypted_path
    : path.join(process.env.PATH_ENCRYPTED, file.encrypted_path);

  if (!fs.existsSync(fullPath)) {
    missing++;
    console.log(`❌ Archivo faltante [#${index + 1}]: ${file.name || 'sin nombre'} (${file.encrypted_path})`);
  } else {
    found++;
  }
});

console.log(`\n📦 Total de archivos en metadata.json: ${total}`);
console.log(`✅ Archivos encontrados: ${found}`);
console.log(`❌ Archivos faltantes: ${missing}`);
