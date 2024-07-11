const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const videoDataFile = path.join(__dirname, 'videos.json');

function getRandomVideoId(videos) {
    const randomIndex = Math.floor(Math.random() * videos.length);
    return videos[randomIndex].id;
}

// Configuración del motor de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

const videoDir = 'E:/MultimediaPC-videos/plantillas';
app.use('/videos', express.static(videoDir));

// Ruta principal - Renderizar index.ejs con la lista de videos y miniaturas
app.get('/', (req, res) => {
    fs.readFile(videoDataFile, (err, data) => {
        if (err) {
            console.error('Error al leer el archivo JSON', err);
            return res.status(500).send('Error interno del servidor');
        }
        const videos = JSON.parse(data);
        res.render('index', { videos });
    });
});


// Ruta para reproducir un video aleatorio
app.get('/random', (req, res) => {
    fs.readFile(videoDataFile, (err, data) => {
        if (err) {
            console.error('Error al leer el archivo JSON', err);
            return res.status(500).send('Error interno del servidor');
        }
        const videos = JSON.parse(data);
        const randomVideoId = getRandomVideoId(videos);
        res.redirect(`/video/${randomVideoId}`);
    });
});

// Ruta para mostrar un video individual
// Ruta para mostrar un video individual
// Ruta para mostrar un video individual
app.get('/video/:id', (req, res) => {
    const videoId = parseInt(req.params.id);
    fs.readFile(videoDataFile, (err, data) => {
        if (err) {
            console.error('Error al leer el archivo JSON', err);
            return res.status(500).send('Error interno del servidor');
        }
        const videos = JSON.parse(data);
        const currentIndex = videos.findIndex(v => v.id === videoId);

        if (currentIndex === -1) {
            return res.status(404).send('Video no encontrado');
        }

        const video = videos[currentIndex];
        let prevVideo = null;
        let nextVideo = null;

        // Encontrar video anterior
        if (currentIndex > 0) {
            prevVideo = videos[currentIndex - 1].id;
        }

        // Encontrar video siguiente
        if (currentIndex < videos.length - 1) {
            nextVideo = videos[currentIndex + 1].id;
        }

        res.render('video', { 
            videoName: video.name,
            videoPath: video.videoPath,
            videoId: video.id,
            prevVideo,
            nextVideo
        });
    });
});

// Configuración del puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
