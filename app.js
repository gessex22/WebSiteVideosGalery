const express = require('express');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const app = express();

// Ruta a la carpeta de videos y miniaturas
//
const videosDir =  'E:/videosCopiados'
const thumbnailsDir = path.join(__dirname, 'public/images/thumbnails');

// Configuración del motor de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/videos', express.static(videosDir));

// Función para generar miniatura de video
function generateThumbnail(videoPath, thumbnailPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .screenshots({
                count: 1,
                folder: thumbnailsDir,
                size: '320x240',
                filename: path.basename(videoPath, path.extname(videoPath)) + '.png',
            })
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
    });
}

// Ruta principal - Renderizar index.ejs con la lista de videos y miniaturas
app.get('/', (req, res) => {
    fs.readdir(videosDir, async (err, files) => {
        if (err) {
            return res.status(500).send('Error al leer el directorio de videos');
        }

        // Filtrar archivos para obtener solo los archivos de video
        const videoFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ext === '.mp4' || ext === '.avi' || ext === '.mkv';
        });

        // Crear una lista de objetos de videos con miniaturas
        const videos = [];
        for (let file of videoFiles) {
            const videoPath = path.join(videosDir, file);
            const thumbnailPath = path.join(thumbnailsDir, path.basename(file, path.extname(file)) + '.png');

            // Generar miniatura si no existe
            if (!fs.existsSync(thumbnailPath)) {
                try {
                    await generateThumbnail(videoPath, thumbnailPath);
                } catch (err) {
                    console.error('Error al generar miniatura para', file, err);
                    continue; // Continuar con el siguiente archivo
                }
            }

            // Agregar video a la lista
            videos.push({
                name: path.basename(file, path.extname(file)),
                videoPath: `/videos/${file}`, // Ruta relativa del video
                thumbnailPath: `/images/thumbnails/${path.basename(file, path.extname(file))}.png` // Ruta relativa de la miniatura
            });
        }

        // Renderizar la vista index.ejs con la lista de videos y miniaturas
        res.render('index', { videos });
    });
});

// Configuración del puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});