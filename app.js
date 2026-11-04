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

function message(text, success = false) {
  const el = $("authMessage");
  el.textContent = text;
  el.style.color = success ? "#69dba0" : "#ff8585";
}

function toast(text) {
  $("toast").textContent = text;
  $("toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").style.display = "none", 4000);
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

function setBusy(value, button, label) {
  busy = value;
  if (button) {
    button.disabled = value;
    button.textContent = value ? label : button.dataset.original;
  }
}

async function refresh() {
  $("tracks").replaceChildren();
  $("empty").classList.add("hidden");
  $("status").textContent = "● SINCRONIZZAZIONE";

  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .order("added_at", { ascending: false });

  if (error) {
    toast("Errore libreria: " + error.message);
    connection();
    return;
  }

  tracks = data || [];
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
      .toLowerCase().includes(query)
  );

  $("count").textContent = tracks.length;
  $("favCount").textContent = tracks.filter(t => t.favorite).length;
  $("size").textContent =
    (tracks.reduce((n, t) => n + Number(t.file_size || 0), 0) / 1048576).toFixed(1) + " MB";

  $("empty").classList.toggle("hidden", tracks.length !== 0);
  $("tracks").classList.toggle("hidden", tracks.length === 0);

  for (const t of visible) {
    const row = document.createElement("article");
    row.className = "track";

    const art = document.createElement("div");
    art.className = "art";
    art.textContent = "♫";

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
    play.textContent = "▶";
    play.title = "Riproduci";
    play.onclick = () => playTrack(t);

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

async function playTrack(t) {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(t.storage_path || t.file_path, 3600);

    if (error) throw error;

    $("audio").crossOrigin = "anonymous";
    $("audio").src = data.signedUrl;
    $("nowTitle").textContent = t.title;
    $("player").classList.remove("hidden");
    await $("audio").play();
  } catch (e) {
    toast("Riproduzione non riuscita: " + e.message);
  }
}

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
  } catch (e) {
    toast("Download non riuscito: " + e.message);
  }
}

async function favorite(t) {
  const { error } = await supabase
    .from("tracks")
    .update({ favorite: !t.favorite })
    .eq("id", t.id);

  if (error) return toast(error.message);

  t.favorite = !t.favorite;
  render();
}

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

  button.dataset.original = "ACCEDI →";
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
  } catch (e) {
    message("Accesso non riuscito: " + e.message);
  } finally {
    busy = false;
    button.disabled = false;
    button.innerHTML = 'ACCEDI <span>→</span>';
  }
});

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

  button.dataset.original = "CREA IL MIO ACCOUNT";
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
  } catch (e) {
    message("Registrazione non riuscita: " + e.message);
  } finally {
    busy = false;
    button.disabled = false;
    button.textContent = "CREA IL MIO ACCOUNT";
  }
});

$("logout").onclick = async () => {
  $("audio").pause();
  $("audio").removeAttribute("src");

  const { error } = await supabase.auth.signOut();

  if (error) {
    toast("Errore durante l'uscita: " + error.message);
    return;
  }

  tracks = [];
  $("password").value = "";
  message("");
  screen(false);
};

$("upload").onclick = () => $("files").click();
$("firstUpload").onclick = () => $("files").click();
$("search").oninput = render;

$("filter").onclick = () => {
  favoritesOnly = !favoritesOnly;
  $("filter").style.borderColor = favoritesOnly ? "#aa72ff" : "";
  render();
};

$("closePlayer").onclick = () => {
  $("audio").pause();
  $("audio").removeAttribute("src");
  $("player").classList.add("hidden");
};

$("files").onchange = async e => {
  const selected = Array.from(e.target.files || []);
  if (!selected.length) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return toast("Accedi nuovamente.");

  let done = 0;
  let failed = 0;

  $("upload").disabled = true;

  for (const file of selected) {
    if (!file.name.toLowerCase().endsWith(".mp3") || file.size > 52428800) {
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

      const { error: dbError } = await supabase.from("tracks").insert({
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
    } catch (err) {
      console.error(file.name, err);
      failed++;
    }

    $("status").textContent = `● CARICAMENTO ${done + failed}/${selected.length}`;
  }

  $("upload").disabled = false;
  e.target.value = "";

  await refresh();
  toast(`${done} MP3 caricati. ${failed} non caricati.`);
};

supabase.auth.onAuthStateChange((event, session) => {
  screen(!!session);

  if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
    setTimeout(refresh, 0);
  }

  if (!session) {
    tracks = [];
    $("tracks").replaceChildren();
  }
});

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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(console.error);
}

