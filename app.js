const express = require("express");
const https = require("https");
const http = require("http");
const compress = require("compression");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const { getStatus } = require("./controllers/admin");
// Asumo que updateGalery y cerializacionFile no usas por ahora o están bien

const app = express();

// Directorio donde están los videos y metadata (según .env)
const videoDir = process.env.PATH_ENCRYPTED || path.join(__dirname, "videos");
const metadataPath = path.join(videoDir, "metadata.json");

// Ruta clave privada (archivo en raíz del proyecto)
const privateKeyPath = path.join(__dirname, "g22private_key8.pem");

// Configuración del motor de plantillas EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(compress());

// Servir videos estáticos
app.use("/videos", express.static(videoDir));

// Endpoint para servir la clave privada (solo para test)
app.get("/key/private", (req, res) => {
  fs.readFile(privateKeyPath, "utf8", (err, data) => {
    if (err) {
      console.error("Error leyendo clave privada:", err);
      return res.status(500).send("Error interno del servidor");
    }
    res.type("text/plain").send(data);
  });
});

// Endpoint para servir metadata.json
app.get("/metadata", (req, res) => {
  fs.readFile(metadataPath, "utf8", (err, data) => {
    if (err) {
      console.error("Error leyendo metadata:", err);
      return res.status(500).send("Error interno del servidor");
    }
    res.type("application/json").send(data);
  });
});

// Endpoint para miniaturas
app.get("/thumbnail/:uuid", (req, res) => {
  const uuid = req.params.uuid;

  // Leer metadata
  fs.readFile(metadataPath, "utf8", (err, data) => {
    if (err) {
      console.error("Error leyendo metadata:", err);
      return res.status(500).send("Error interno del servidor");
    }

    let metadata;
    try {
      metadata = JSON.parse(data);
    } catch (parseErr) {
      console.error("Error parseando metadata:", parseErr);
      return res.status(500).send("Error interno del servidor");
    }

    const fileEntry = Array.isArray(metadata.files)
      ? metadata.files.find(f => f.uuid === uuid)
      : null;

    if (!fileEntry || !fileEntry.thumbnailPath) {
      return res.status(404).send("Miniatura no encontrada");
    }

    const thumbnailPath = fileEntry.thumbnailPath;

    // Enviar el archivo
    res.sendFile(path.resolve(thumbnailPath), err => {
      if (err) {
        console.error("Error enviando thumbnail:", err);
        res.status(500).send("Error al enviar la miniatura");
      }
    });
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



// Endpoint para estado (asumiendo que tienes implementado getStatus)
app.get("/status", getStatus);

// Función para obtener video aleatorio
function getRandomVideoId(videos) {
  const randomIndex = Math.floor(Math.random() * videos.files.length);
  console.log(videos.files[randomIndex]);
  return videos.files[randomIndex].uuid;
}

// Ruta para video aleatorio
app.get("/random", (req, res) => {
  fs.readFile(metadataPath, "utf8", (err, data) => {
    if (err) {
      console.error("Error al leer el archivo JSON", err);
      return res.status(500).send("Error interno del servidor");
    }
    const videos = JSON.parse(data);
    const randomVideoId = getRandomVideoId(videos);
    res.redirect(`/video/${randomVideoId}`);
  });
});

app.get("/video/:uuid", (req, res) => {
  const videoUuid = req.params.uuid;

  fs.readFile(metadataPath, "utf8", (err, data) => {
    if (err) {
      console.error("Error al leer el archivo JSON", err);
      return res.status(500).send("Error interno del servidor");
    }

    let dataObj;
    try {
      dataObj = JSON.parse(data);
    } catch (parseErr) {
      console.error("Error al parsear JSON", parseErr);
      return res.status(500).send("Error interno del servidor");
    }

    const videos = Array.isArray(dataObj.files) ? dataObj.files : [];

    // Buscar el video actual por UUID
    const currentVideo = videos.find((v) => v.uuid === videoUuid);

    if (!currentVideo) {
      return res.status(404).send("Video no encontrado");
    }

    // Usamos el id numérico para navegar
    const prevVideo = videos.find((v) => v.id === currentVideo.id - 1);
    const nextVideo = videos.find((v) => v.id === currentVideo.id + 1);

    res.render("video", {
      videoName: currentVideo.uuid || "Sin nombre",
      videoPath: `/videos/${encodeURIComponent(currentVideo.uuid)}.enc`,
      iv: currentVideo.iv || "",
      videoKeyBase64: currentVideo.rsa_encrypted_key || "",
      auth_tag: currentVideo.auth_tag,
      prevVideo: prevVideo ? prevVideo.uuid : null,
      nextVideo: nextVideo ? nextVideo.uuid : null,
    });
  });
});


// Ruta principal - lista videos con paginación (del más reciente al más viejo)
app.get("/", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = 12;

  fs.readFile(metadataPath, "utf8", (err, data) => {
    if (err) {
      console.error("Error al leer el archivo JSON", err);
      return res.status(500).send("Error interno del servidor");
    }

    const dataObj = JSON.parse(data);
    const videos = Array.isArray(dataObj.files) ? dataObj.files : [];

    // Ordenar del más reciente al más viejo
    const videosOrdenados = videos.slice().reverse();

    const { paginatedVideos2, totalVideos } = obtenerVideosPaginados(
      videosOrdenados,
      page,
      pageSize
    );

    res.render("index", {
      videos: paginatedVideos2,
      videoslength: totalVideos,
      page,
      pageSize,
    });
  });
});

// API de videos paginados (del más reciente al más viejo)
app.get("/api/videos", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = 12;

  fs.readFile(metadataPath, "utf8", (err, data) => {
    if (err) {
      console.error("Error al leer el archivo JSON", err);
      return res.status(500).send("Error interno del servidor");
    }

    const dataObj = JSON.parse(data);
    const videos = Array.isArray(dataObj.files) ? dataObj.files : [];

    // Ordenar del más reciente al más viejo
    const videosOrdenados = videos.slice().reverse();

    const { paginatedVideos2, totalVideos } = obtenerVideosPaginados(
      videosOrdenados,
      page,
      pageSize
    );

    res.json({
      page,
      pageSize,
      total: totalVideos,
      videos: paginatedVideos2,
    });
  });
});


const options = {
  key: fs.readFileSync(path.join(__dirname, "key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "cert.pem")),
};

// Configuración del puerto
const PORT = process.env.PORT || 3000;
https.createServer(options, app).listen(81, () => {
  console.log("Servidor HTTPS corriendo en el puerto 81");
});

http
  .createServer((req, res) => {
    res.writeHead(PORT, {
      Location: "https://" + req.headers["host"] + req.url,
    });
    res.end();
  })
  .listen(3200);
