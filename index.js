require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.static("public"));

let storedToken = null; // se guarda temporalmente

//-------------------------------------------------
// 1) RUTA LOGIN → REDIRIGE A SPOTIFY
//-------------------------------------------------
app.get("/login", (req, res) => {
  const scope = "user-read-recently-played user-top-read user-read-playback-state";

  const authUrl =
    "https://accounts.spotify.com/authorize?" +
    new URLSearchParams({
      response_type: "code",
      client_id: process.env.CLIENT_ID,
      scope: scope,
      redirect_uri: process.env.REDIRECT_URI,
    }).toString();

  console.log("🔗 Auth URL generada:", authUrl);
  res.redirect(authUrl);
});

//-------------------------------------------------
// 2) CALLBACK DE SPOTIFY → RECIBE EL "code"
//-------------------------------------------------
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.REDIRECT_URI,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      }
    );

    storedToken = tokenResponse.data.access_token;
    console.log("🔐 Token recibido correctamente");

    res.redirect("/stats.html");

  } catch (err) {
    console.error("❌ Error al obtener token:", err.response?.data || err);
    res.send("Error al autenticar con Spotify");
  }
});

//-------------------------------------------------
// 3) RUTA PRINCIPAL /me/stats
//-------------------------------------------------
app.get("/me/stats", async (req, res) => {
  if (!storedToken) return res.status(401).json({ error: "Not authenticated" });

  try {
    //-------------------------------------------------
    // 🟦 Canción más escuchada (top track)
    //-------------------------------------------------
    const topTrackRes = await axios.get(
      "https://api.spotify.com/v1/me/top/tracks?limit=1&time_range=short_term",
      { headers: { Authorization: `Bearer ${storedToken}` } }
    );

    const topTrack = topTrackRes.data.items[0];

    //-------------------------------------------------
    // 🟩 Artista más escuchado (top artist)
    //-------------------------------------------------
    const topArtistRes = await axios.get(
      "https://api.spotify.com/v1/me/top/artists?limit=1&time_range=short_term",
      { headers: { Authorization: `Bearer ${storedToken}` } }
    );

    const topArtist = topArtistRes.data.items[0];

    //-------------------------------------------------
    // 🟧 Canción que está sonando ahora
    //-------------------------------------------------
    let nowPlaying = null;

    try {
      const nowRes = await axios.get(
        "https://api.spotify.com/v1/me/player/currently-playing",
        { headers: { Authorization: `Bearer ${storedToken}` } }
      );

      nowPlaying = nowRes.data; // puede ser null si no hay música

    } catch (e) {
      nowPlaying = null; // no rompe el endpoint si no hay nada sonando
    }

    //-------------------------------------------------
    // 🟥 JSON completo para debug / mostrar
    //-------------------------------------------------
    const fullStats = {
      topTrack,
      topArtist,
      nowPlaying
    };

    //-------------------------------------------------
    // RESPUESTA FINAL PARA EL FRONT
    //-------------------------------------------------
    res.json({
      topTrack,
      topArtist,
      nowPlaying,
      fullStats
    });

  } catch (err) {
    console.error("❌ Error en /me/stats:", err.response?.data || err);
    res.status(500).json({ error: "Error al obtener estadísticas de Spotify" });
  }
});

//-------------------------------------------------
console.log("CLIENT ID:", process.env.CLIENT_ID);
app.listen(3001, "0.0.0.0", () => {
  console.log("🚀 Servidor corriendo en puerto 3001");
});
