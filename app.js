const express = require('express');
const https = require('https')
const http = require('http')
const compress = require('compression');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { getStatus } = require('./controllers/admin');
// Asumo que updateGalery y cerializacionFile no usas por ahora o están bien

const app = express();

// Directorio donde están los videos y metadata (según .env)
const videoDir = process.env.PATH_ENCRYPTED || path.join(__dirname, 'videos');
const metadataPath = path.join(videoDir, 'metadata.json');

// Ruta clave privada (archivo en raíz del proyecto)
const privateKeyPath = path.join(__dirname, "g22private_key8.pem");

// Configuración del motor de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(compress());

// Servir videos estáticos
app.use('/videos', express.static(videoDir));

// Endpoint para servir la clave privada (solo para test)
app.get('/key/private', (req, res) => {
  fs.readFile(privateKeyPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error leyendo clave privada:', err);
      return res.status(500).send('Error interno del servidor');
    }
    res.type('text/plain').send(data);
  });
});

// Endpoint para servir metadata.json
app.get('/metadata', (req, res) => {
  fs.readFile(metadataPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error leyendo metadata:', err);
      return res.status(500).send('Error interno del servidor');
    }
    res.type('application/json').send(data);
  });
});

// Función para paginar videos
function obtenerVideosPaginados(videos, page, pageSize) {
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const videosArray = Array.isArray(videos) ? videos : videos.files;
  const paginatedVideos2 = videosArray.slice(startIndex, endIndex);
  return { paginatedVideos2, totalVideos: videosArray.length };
}

// Ruta principal - lista videos con paginación
app.get('/', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = 12;

  fs.readFile(metadataPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo JSON', err);
      return res.status(500).send('Error interno del servidor');
    }

 const dataObj = JSON.parse(data);
const videos = Array.isArray(dataObj) ? dataObj : dataObj.files;
    const { paginatedVideos2, totalVideos } = obtenerVideosPaginados(videos, page, pageSize);

    res.render('index', {
      videos: paginatedVideos2,
      videoslength: totalVideos,
      page,
      pageSize
    });
  });
});

// Endpoint para estado (asumiendo que tienes implementado getStatus)
app.get('/status', getStatus);

// Función para obtener video aleatorio
function getRandomVideoId(videos) {
  const randomIndex = Math.floor(Math.random() * videos.length);
  return videos[randomIndex].id;
}

// Ruta para video aleatorio
app.get('/random', (req, res) => {
  fs.readFile(metadataPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo JSON', err);
      return res.status(500).send('Error interno del servidor');
    }
    const videos = JSON.parse(data);
    const randomVideoId = getRandomVideoId(videos);
    res.redirect(`/video/${randomVideoId}`);
  });
});


// Ruta para mostrar video individual
app.get('/video/:name', (req, res) => {
  const videoName = req.params.name;

  fs.readFile(metadataPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo JSON', err);
      return res.status(500).send('Error interno del servidor');
    }

    let dataObj;
    try {
      dataObj = JSON.parse(data);
    } catch (parseErr) {
      console.error('Error al parsear JSON', parseErr);
      return res.status(500).send('Error interno del servidor');
    }

    const videos = Array.isArray(dataObj.files) ? dataObj.files : [];

    const currentIndex = videos.findIndex(v => v.name === videoName);

    if (currentIndex === -1) {
      return res.status(404).send('Video no encontrado');
    }

    const video = videos[currentIndex];

    const prevVideo = currentIndex > 0 ? videos[currentIndex - 1].name : null;
    const nextVideo = currentIndex < videos.length - 1 ? videos[currentIndex + 1].name : null;

    res.render('video', {
      videoName: video.name || 'Sin nombre',
      videoPath: `/videos/${encodeURIComponent(video.name)}.enc`,  // Asegúrate que el servidor sirva esa ruta
      iv: video.iv || '',
      videoKeyBase64: video.rsa_encrypted_key || '',
      auth_tag : video.auth_tag,
      prevVideo,
      nextVideo
    });
  });
});

app.get('/api/videos', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = 12;

  fs.readFile(metadataPath, 'utf8', (err, data) => {
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

const options = {
  key:  fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};


// Configuración del puerto
const PORT = process.env.PORT || 3000;
https.createServer(options, app).listen(81, () => {
  console.log('Servidor HTTPS corriendo en el puerto 81');
});

http.createServer((req, res) => {
  res.writeHead(PORT, { "Location": "https://" + req.headers['host'] + req.url });
  res.end();
}).listen(3200);