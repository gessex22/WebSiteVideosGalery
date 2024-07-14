const express = require('express');
const compress = require('compression')
const path = require('path');
const fs = require('fs');
require('dotenv').config()
const { updateGalery } = require('./cerializacionFile');

const app = express();
const videoDataFile = path.join(__dirname, 'videos.json');


const videoDir = process.env.PATHFILE ||'E:/MultimediaPC-videos/plantillas';

function getRandomVideoId(videos) {
    const randomIndex = Math.floor(Math.random() * videos.length);
    return videos[randomIndex].id;
}

// Configuración del motor de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(compress())


app.use('/videos', express.static(videoDir));

// Ruta principal - Renderizar index.ejs con la lista de videos y miniaturas
app.get('/', (req, res) => {

    const page = parseInt(req.query.page) || 1; // Página actual (por defecto 1)
    const pageSize = 12; // Tamaño de la página (cantidad de videos por página)

    fs.readFile(videoDataFile, (err, data) => {
        if (err) {
            console.error('Error al leer el archivo JSON', err);
            return res.status(500).send('Error interno del servidor');
        }

        
        let videos = JSON.parse(data);
       const {paginatedVideos2, totalVideos} = obtenerVideosPaginados(videos, page, pageSize) 
          
        res.render('index',
             { 
            videos: paginatedVideos2,
            videoslength: totalVideos.length,
                page, 
                pageSize
            
            
        });
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


function obtenerVideosPaginados(videos,page, pageSize ) {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedVideos2 = videos.slice(startIndex,endIndex)
    return  { paginatedVideos2, totalVideos: videos.length }
  }

  app.get('/api/videos', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = 12;

    fs.readFile(videoDataFile, (err, data) => {
        if (err) {
            console.error('Error al leer el archivo JSON', err);
            return res.status(500).send('Error interno del servidor');
        }

        const videos = JSON.parse(data);
        const { paginatedVideos2, totalVideos } = obtenerVideosPaginados(videos, page, pageSize);

        res.json({
            page,
            pageSize,
            total: totalVideos,
            videos: paginatedVideos2
        });
    });
});


// Configuración del puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    updateGalery()
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});


