import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// Ruta del archivo JSON
const metadataPath = path.join(process.env.PATH_ENCRYPTED, 'metadata.json');

// Leer metadata.json
const rawData = fs.readFileSync(metadataPath, 'utf8');
const data = JSON.parse(rawData);

// Separar archivos válidos
const validFiles = data.files.filter(file => {
  const fullPath = path.isAbsolute(file.encrypted_path)
    ? file.encrypted_path
    : path.join(process.env.PATH_ENCRYPTED, file.encrypted_path);
  return fs.existsSync(fullPath);
});

// Reasignar IDs
const cleanedData = {
  ...data,
  files: validFiles.map((file, index) => ({
    ...file,
    id: index + 1,
  })),
};

// Sobrescribir metadata.json
fs.writeFileSync(metadataPath, JSON.stringify(cleanedData, null, 2), 'utf8');

// Mostrar resumen
console.log(`✅ Archivos originales: ${data.files.length}`);
console.log(`✅ Archivos válidos guardados: ${cleanedData.files.length}`);
console.log(`🗑️ Archivos eliminados: ${data.files.length - cleanedData.files.length}`);
