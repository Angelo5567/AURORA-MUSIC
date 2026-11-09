
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = "https://dwxkyzjdkjwipmglnxtm.supabase.co";
const KEY = "sb_publishable_7DZt-4_0hX9AnMLXytjxXg_dfIHOFpf";
const OWNER = "fortunatoangelo165@gmail.com";
const BUCKET = "aurora-private";

const supabase = createClient(URL, KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const $ = id => document.getElementById(id);

let tracks = [];
let favoritesOnly = false;
let toastTimer;
let busy = false;

let currentTrack = null;
let playlist = [];
let shuffleEnabled = false;
let repeatMode = 0;
let playRequest = 0;

const audio = $("audio");

/* ---------------- MESSAGGI ---------------- */

function message(text, success = false) {
  const el = $("authMessage");
  el.textContent = text;
  el.style.color = success ? "#69dba0" : "#ff8585";
}

function toast(text) {
  $("toast").textContent = text;
  $("toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("toast").style.display = "none";
  }, 4000);
}

function screen(loggedIn) {
  $("auth").classList.toggle("hidden", loggedIn);
  $("library").classList.toggle("hidden", !loggedIn);
  $("logout").classList.toggle("hidden", !loggedIn);
}

function connection() {
  $("status").textContent = navigator.onLine ? "● ONLINE" : "● OFFLINE";
}

window.addEventListener("online", connection);
window.addEventListener("offline", connection);
connection();

/* ---------------- PLAYER ---------------- */

function updateMediaMetadata(track) {
  if (!("mediaSession" in navigator) || !track) return;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || "Senza titolo",
      artist: track.artist || "Artista sconosciuto",
      album: "Aurora Music"
    });
  } catch (error) {
    console.warn("Media metadata non disponibile:", error);
  }
}

function updateMediaPlaybackState() {
  if (!("mediaSession" in navigator)) return;

  navigator.mediaSession.playbackState =
    !currentTrack ? "none" :
    audio.paused ? "paused" : "playing";
}

function setupMediaSession() {
  if (!("mediaSession" in navigator)) {
    console.warn("Media Session API non supportata.");
    return;
  }

  const handlers = {
    play: () => togglePlayback(),
    pause: () => audio.pause(),
    previoustrack: () => previousTrack(),
    nexttrack: () => nextTrack(false),

    seekto: details => {
      if (Number.isFinite(details.seekTime)) {
        audio.currentTime = details.seekTime;
      }
    }
  };

  for (const [action, handler] of Object.entries(handlers)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (error) {
      console.warn("Comando non supportato:", action);
    }
  }

  updateMediaPlaybackState();
}
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function createPlayerControls() {
  const player = $("player");
  const now = player.querySelector(".now");

  audio.controls = false;

  const controls = document.createElement("div");
  controls.id = "playerControls";
  controls.className = "player-controls";

  controls.innerHTML = `
    <div class="player-timeline">
      <span id="currentTime">0:00</span>
      <input
        id="progress"
        type="range"
        min="0"
        max="1000"
        value="0"
        step="1"
        aria-label="Posizione del brano"
      >
      <span id="duration">0:00</span>
    </div>

    <div class="player-buttons">
      <button id="shuffleButton" type="button" title="Casuale">⤨</button>
      <button id="previousButton" type="button" title="Precedente">⏮</button>
      <button id="playPauseButton" type="button" title="Riproduci">▶</button>
      <button id="nextButton" type="button" title="Successivo">⏭</button>
      <button id="repeatButton" type="button" title="Ripetizione">↻</button>
    </div>
  `;

  now.insertAdjacentElement("afterend", controls);

  $("shuffleButton").addEventListener("click", () => {
    shuffleEnabled = !shuffleEnabled;
    updatePlayerButtons();
    toast(shuffleEnabled ? "Modalità casuale attivata" : "Modalità casuale disattivata");
  });

  $("previousButton").addEventListener("click", previousTrack);
  $("nextButton").addEventListener("click", () => nextTrack(false));
  $("playPauseButton").addEventListener("click", togglePlayback);

  $("repeatButton").addEventListener("click", () => {
    repeatMode = (repeatMode + 1) % 3;
    updatePlayerButtons();

    const labels = [
      "Ripetizione disattivata",
      "Ripetizione playlist",
      "Ripetizione singolo brano"
    ];

    toast(labels[repeatMode]);
  });

  $("progress").addEventListener("input", () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;

    audio.currentTime =
      (Number($("progress").value) / 1000) * audio.duration;

    updateTimeline();
  });

  audio.addEventListener("timeupdate", updateTimeline);
  audio.addEventListener("loadedmetadata", updateTimeline);
  audio.addEventListener("durationchange", updateTimeline);
  audio.addEventListener("play", updatePlayerButtons);
  audio.addEventListener("pause", updatePlayerButtons);

  audio.addEventListener("ended", () => {
    if (repeatMode === 2) {
      audio.currentTime = 0;
      audio.play().catch(() => toast("Riproduzione non riuscita."));
      return;
    }

    nextTrack(true);
  });

  audio.addEventListener("error", () => {
    if (currentTrack) toast("Errore durante la riproduzione del brano.");
  });

  updatePlayerButtons();
}

function updateTimeline() {
  if ("mediaSession" in navigator &&
      Number.isFinite(audio.duration) &&
      audio.duration > 0 &&
      Number.isFinite(audio.currentTime)) {
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(audio.currentTime, audio.duration)
      });
    } catch (error) {
      console.warn("Posizione player non disponibile:", error);
    }
  }
  const duration = audio.duration || 0;
  const current = audio.currentTime || 0;

  $("currentTime").textContent = formatTime(current);
  $("duration").textContent = formatTime(duration);

  $("progress").value = duration > 0
    ? Math.round((current / duration) * 1000)
    : 0;
}

function updatePlayerButtons() {
  const playButton = $("playPauseButton");
  if (!playButton) return;

  playButton.textContent = audio.paused ? "▶" : "Ⅱ";
  updateMediaPlaybackState();
  playButton.title = audio.paused ? "Riproduci" : "Pausa";

  $("shuffleButton").classList.toggle("active", shuffleEnabled);

  const repeatButton = $("repeatButton");

  repeatButton.classList.toggle("active", repeatMode !== 0);
  repeatButton.textContent = repeatMode === 2 ? "↻¹" : "↻";

  repeatButton.title = [
    "Ripetizione disattivata",
    "Ripeti playlist",
    "Ripeti brano"
  ][repeatMode];
}

function togglePlayback() {
  if (!currentTrack) {
    if (tracks.length) playTrack(tracks[0]);
    return;
  }

  if (audio.paused) {
    audio.play().catch(() => toast("Impossibile riprendere la riproduzione."));
  } else {
    audio.pause();
  }
}

async function playTrack(track, queue = null) {
  if (!track) return;

  if (queue) {
    playlist = [...queue];
  }

  if (!playlist.some(t => t.id === track.id)) {
    playlist = [...tracks];
  }

  const request = ++playRequest;

  try {
    const path = track.storage_path || track.file_path;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);

    if (error) throw error;
    if (request !== playRequest) return;

    currentTrack = track;

    audio.pause();
    audio.crossOrigin = "anonymous";
    audio.src = data.signedUrl;
    audio.load();

    $("nowTitle").textContent = track.title || "Senza titolo";
    $("nowArtist").textContent = track.artist || "Artista sconosciuto";
    updateMediaMetadata(track);

    $("player").classList.remove("hidden");

    render();
    updatePlayerButtons();

    await audio.play();

  } catch (error) {
    if (request === playRequest) {
      toast("Riproduzione non riuscita: " + error.message);
    }
  }
}

function nextTrack(automatic = false) {
  if (!currentTrack || playlist.length === 0) return;

  const index = playlist.findIndex(t => t.id === currentTrack.id);

  if (shuffleEnabled && playlist.length > 1) {
    const alternatives = playlist.filter(t => t.id !== currentTrack.id);
    const randomTrack = alternatives[
      Math.floor(Math.random() * alternatives.length)
    ];

    playTrack(randomTrack);
    return;
  }

  if (index === playlist.length - 1) {
    if (automatic && repeatMode === 0) {
      audio.pause();
      return;
    }

    if (automatic && repeatMode !== 1) {
      audio.pause();
      return;
    }

    playTrack(playlist[0]);
    return;
  }

  playTrack(playlist[index + 1]);
}

function previousTrack() {
  if (!currentTrack || playlist.length === 0) return;

  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }

  const index = playlist.findIndex(t => t.id === currentTrack.id);

  const previousIndex =
    index <= 0 ? playlist.length - 1 : index - 1;

  playTrack(playlist[previousIndex]);
}

/* ---------------- LIBRERIA ---------------- */

async function refresh(retryAuth = true) {
  $("status").textContent = "● SINCRONIZZAZIONE";

  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .order("added_at", { ascending: false });

  if (error) {
    const expired = /jwt expired|invalid jwt|pgrst301|401/i.test(
      error.message || ""
    );

    if (expired && retryAuth) {
      $("status").textContent = "● RINNOVO SESSIONE";

      const { data: refreshed, error: refreshError } =
        await supabase.auth.refreshSession();

      if (!refreshError && refreshed.session) {
        return await refresh(false);
      }

      toast("Sessione scaduta. Accedi nuovamente per sincronizzare.");
      connection();
      return;
    }

    toast("Errore libreria: " + error.message);
    connection();
    return;
  }

  tracks = data || [];

  if (currentTrack) {
    const updated = tracks.find(t => t.id === currentTrack.id);
    if (updated) currentTrack = updated;
  }

  render();
  connection();
}

function render() {
  const list = $("tracks");
  list.replaceChildren();

  const query = $("search").value.toLowerCase().trim();

  const visible = tracks.filter(t =>
    (!favoritesOnly || t.favorite) &&
    ((t.title || "") + " " + (t.artist || ""))
      .toLowerCase()
      .includes(query)
  );

  $("count").textContent = tracks.length;
  $("favCount").textContent = tracks.filter(t => t.favorite).length;

  $("size").textContent =
    (
      tracks.reduce((n, t) => n + Number(t.file_size || 0), 0) /
      1048576
    ).toFixed(1) + " MB";

  $("empty").classList.toggle("hidden", tracks.length !== 0);
  $("tracks").classList.toggle("hidden", tracks.length === 0);

  for (const t of visible) {
    const row = document.createElement("article");
    row.className = "track";

    if (currentTrack?.id === t.id) {
      row.classList.add("playing");
    }

    const art = document.createElement("div");
    art.className = "art";
    art.textContent =
      currentTrack?.id === t.id && !audio.paused ? "♫" : "♪";

    const info = document.createElement("div");

    const title = document.createElement("div");
    title.className = "track-title";
    title.textContent = t.title || "Senza titolo";

    const artist = document.createElement("div");
    artist.className = "track-artist";
    artist.textContent = t.artist || "Artista sconosciuto";

    info.append(title, artist);

    const actions = document.createElement("div");
    actions.className = "actions";

    const play = document.createElement("button");
    play.textContent =
      currentTrack?.id === t.id && !audio.paused ? "Ⅱ" : "▶";

    play.title = "Riproduci";

    play.onclick = () => {
      if (currentTrack?.id === t.id) {
        togglePlayback();
      } else {
        playTrack(t, visible);
      }
    };

    const fav = document.createElement("button");
    fav.textContent = t.favorite ? "♥" : "♡";
    fav.className = t.favorite ? "favorite" : "";
    fav.onclick = () => favorite(t);

    const download = document.createElement("button");
    download.textContent = "↓";
    download.title = "Scarica MP3";
    download.onclick = () => downloadTrack(t);

    actions.append(play, fav, download);
    row.append(art, info, actions);
    list.append(row);
  }

  if (!visible.length && tracks.length) {
    const msg = document.createElement("p");
    msg.className = "track-artist";
    msg.textContent = "Nessun risultato.";
    list.append(msg);
  }
}

/* ---------------- DOWNLOAD ---------------- */

async function downloadTrack(t) {
  try {
    const path = t.storage_path || t.file_path;
    const filename = t.file_name || (t.title + ".mp3");

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 300, { download: filename });

    if (error) throw error;

    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = filename;

    document.body.append(a);
    a.click();
    a.remove();

  } catch (error) {
    toast("Download non riuscito: " + error.message);
  }
}

/* ---------------- PREFERITI ---------------- */

async function favorite(t) {
  const { error } = await supabase
    .from("tracks")
    .update({ favorite: !t.favorite })
    .eq("id", t.id);

  if (error) return toast(error.message);

  t.favorite = !t.favorite;
  render();
}

/* ---------------- LOGIN ---------------- */

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (busy) return;

  const email = $("email").value.trim().toLowerCase();
  const password = $("password").value;
  const button = $("loginButton");

  if (!email || !password) {
    message("Inserisci email e password.");
    return;
  }

  button.disabled = true;
  button.textContent = "ACCESSO IN CORSO...";
  busy = true;

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    message("Accesso effettuato.", true);

  } catch (error) {
    message("Accesso non riuscito: " + error.message);

  } finally {
    busy = false;
    button.disabled = false;
    button.innerHTML = 'ACCEDI <span>→</span>';
  }
});

/* ---------------- REGISTRAZIONE ---------------- */

$("register").addEventListener("click", async () => {
  if (busy) return;

  const email = $("email").value.trim().toLowerCase();
  const password = $("password").value;
  const button = $("register");

  if (!email || !password) {
    message("Inserisci email e password.");
    return;
  }

  if (email !== OWNER.toLowerCase()) {
    message("Registrazione riservata all'indirizzo autorizzato.");
    return;
  }

  if (password.length < 8) {
    message("La password deve contenere almeno 8 caratteri.");
    return;
  }

  button.disabled = true;
  button.textContent = "CREAZIONE ACCOUNT...";
  busy = true;

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) throw error;

    if (data.session) {
      message("Account creato correttamente. Accesso effettuato.", true);
    } else if (data.user?.identities?.length === 0) {
      message("Questo account esiste già. Usa ACCEDI oppure recupera la password.");
    } else {
      message("Registrazione completata. Ora prova ad accedere.", true);
    }

  } catch (error) {
    message("Registrazione non riuscita: " + error.message);

  } finally {
    busy = false;
    button.disabled = false;
    button.textContent = "CREA IL MIO ACCOUNT";
  }
});

/* ---------------- USCITA ---------------- */

$("logout").onclick = async () => {
  playRequest++;

  audio.pause();
  audio.removeAttribute("src");

  currentTrack = null;
  playlist = [];

  const { error } = await supabase.auth.signOut();

  if (error) {
    toast("Errore durante l'uscita: " + error.message);
    return;
  }

  tracks = [];
  $("password").value = "";
  message("");

  $("player").classList.add("hidden");
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
  }

  screen(false);
};

/* ---------------- EVENTI ---------------- */

$("upload").onclick = () => $("files").click();
$("firstUpload").onclick = () => $("files").click();

$("search").oninput = render;

$("filter").onclick = () => {
  favoritesOnly = !favoritesOnly;
  $("filter").style.borderColor = favoritesOnly ? "#aa72ff" : "";
  render();
};

$("closePlayer").onclick = () => {
  playRequest++;

  audio.pause();
  audio.removeAttribute("src");

  currentTrack = null;
  playlist = [];

  $("player").classList.add("hidden");
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
  }

  render();
};

/* ---------------- CARICAMENTO MP3 ---------------- */

$("files").onchange = async e => {
  const selected = Array.from(e.target.files || []);
  if (!selected.length) return;

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return toast("Accedi nuovamente.");

  let done = 0;
  let failed = 0;

  $("upload").disabled = true;

  for (const file of selected) {
    if (
      !file.name.toLowerCase().endsWith(".mp3") ||
      file.size > 52428800
    ) {
      failed++;
      continue;
    }

    const id = crypto.randomUUID();
    const path = `${user.id}/${id}.mp3`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: "audio/mpeg",
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("tracks")
        .insert({
          id,
          user_id: user.id,
          title: file.name.replace(/\.mp3$/i, ""),
          artist: "Artista sconosciuto",
          file_name: file.name,
          file_size: file.size,
          storage_path: path,
          favorite: false
        });

      if (dbError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw dbError;
      }

      done++;

    } catch (error) {
      console.error(file.name, error);
      failed++;
    }

    $("status").textContent =
      `● CARICAMENTO ${done + failed}/${selected.length}`;
  }

  $("upload").disabled = false;
  e.target.value = "";

  await refresh();

  toast(`${done} MP3 caricati. ${failed} non caricati.`);
};

/* ---------------- AVVIO PLAYER ---------------- */

createPlayerControls();
setupMediaSession();

/* ---------------- SESSIONE SUPABASE ---------------- */

supabase.auth.onAuthStateChange((event, session) => {
  screen(!!session);

  if (
    session &&
    (
      event === "SIGNED_IN" ||
      event === "INITIAL_SESSION" ||
      event === "TOKEN_REFRESHED"
    )
  ) {
    setTimeout(refresh, 0);
  }

  if (!session) {
    tracks = [];
    $("tracks").replaceChildren();
  }
});

/* ---------------- AVVIO APPLICAZIONE ---------------- */

(async () => {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    message("Errore sessione: " + error.message);
    return;
  }

  screen(!!data.session);

  if (data.session) {
    await refresh();
  }
})();

/* ---------------- SERVICE WORKER ---------------- */

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .catch(console.error);
}
