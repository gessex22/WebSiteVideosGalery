const fs = require('fs');
const path = require('path');
const {v4 : uuidv4} = require('uuid')
require('dotenv').config()


const logsFile = path.join(__dirname, "logs/rename.json");

// Función para renombrar archivos de video a números
function renameVideosToNumbers(dirPath) {
    let counter = 1;
    const renameArr = []

    // Recorre el directorio y sus subdirectorios de manera recursiva
    function traverseDirectory(currentDirPath) {
        const files = fs.readdirSync(currentDirPath);

        files.forEach(file => {
            const filePath = path.join(currentDirPath, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                traverseDirectory(filePath); // Si es directorio, recursivamente busca archivos
            } else {
                if (isVideoFile(file)) {
                    const ext = path.extname(file);
                    const newName = `${uuidv4()}${ext}`;
                    const newPath = path.join(currentDirPath, newName);
                    fs.renameSync(filePath, newPath);
                    renameArr.push({
                    nID: counter,
                    name: newName,
                    oldPath : `${filePath}`,
                    newPath: `${newPath}`
                    })
                    
                    fs.writeFileSync(logsFile, JSON.stringify(renameArr, null, 2));
                    counter++;
                }
            }
        });
    }

    // Función para verificar si es archivo de video (puedes ajustar según las extensiones de video que necesites)
    function isVideoFile(file) {
        const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov']; // Agrega más extensiones si es necesario
        const ext = path.extname(file).toLowerCase();
        return videoExtensions.includes(ext);
    }

    // Inicia el proceso
    traverseDirectory(dirPath);
}
// Uso de la función: reemplaza '/ruta/al/directorio' con la ruta de tu directorio raíz
renameVideosToNumbers(process.env.PATHFILE);
