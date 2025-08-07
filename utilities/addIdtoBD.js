import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// 1. Leer el archivo metadata.json
const filePath = path.join(process.env.PATH_ENCRYPTED, 'metadata.json');
const rawData = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(rawData);

// 2. Agregar IDs
function assignIdsToFiles(data) {
  return {
    ...data,
    files: data.files.map((file, index) => ({
      ...file,
      id: index + 1, // Puedes usar solo index si prefieres que empiece desde 0
    })),
  };
}

const updatedData = assignIdsToFiles(data);

// 3. Sobrescribir el archivo con los nuevos datos
fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf8');

console.log('Archivo metadata.json actualizado con IDs.');
