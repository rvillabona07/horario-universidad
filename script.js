import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getMessaging,
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyBg5MQc-Kn64dALtGG6PyHNh0gZ02y0OOY",
  authDomain: "horario-universidad-9eafa.firebaseapp.com",
  projectId: "horario-universidad-9eafa",
  storageBucket: "horario-universidad-9eafa.firebasestorage.app",
  messagingSenderId: "21064593434",
  appId: "1:21064593434:web:27abcd2b12f9a72aa561a3",
};

const VAPID_KEY =
  "BAA29H6pTN4RL5r7qzrWCTrrOugBTh8Hph9YeHcPL76eDhLe_wXeZ9CUKQFJ8ivMDbeBuLVqWDM43M_5rQDAkuk";

// ---------- Actualización automática ----------
// La versión es el "?v=" con que index.html carga este archivo. Cuando la
// app se abre o vuelve a primer plano, revisa si index.html publicado trae
// otra versión y, si es así, recarga para que nadie se quede con la vieja.

const VERSION_ACTUAL = new URL(import.meta.url).searchParams.get("v");
const CLAVE_RECARGA = "horarioRecargadoParaVersion";

async function revisarActualizacion() {
  try {
    const respuesta = await fetch(`index.html?t=${Date.now()}`, { cache: "no-store" });
    if (!respuesta.ok) return;
    const coincidencia = (await respuesta.text()).match(/script\.js\?v=([\w.-]+)/);
    const versionPublicada = coincidencia && coincidencia[1];
    if (!versionPublicada || versionPublicada === VERSION_ACTUAL) return;

    // Evita recargar en bucle si el navegador insiste en la copia vieja.
    if (sessionStorage.getItem(CLAVE_RECARGA) === versionPublicada) return;
    sessionStorage.setItem(CLAVE_RECARGA, versionPublicada);
    location.reload();
  } catch {
    // Sin internet o sin sessionStorage: se revisa la próxima vez.
  }
}

revisarActualizacion();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") revisarActualizacion();
});

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
auth.languageCode = "es"; // correos de Firebase (p. ej. recuperar contraseña) en español
const db = getFirestore(firebaseApp);

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const HORA_INICIO_GRID = 7; // 07:00 (se amplía a 06:00 si hay clases tempranas)
const HORA_MINIMA_CLASE = 6; // 06:00, lo más temprano que deja el formulario
const HORA_FIN_GRID = 22; // 22:00

const TEMAS_COLOR = [
  {
    nombre: "Morado",
    principal: "#7c5cff",
    secundario: "#6a47f5",
    acento1: "#ff5ca8",
    acento2: "#3aa0ff",
    paleta: ["#7c5cff", "#ff5ca8", "#3a8bff", "#b65cf5", "#5b6cff", "#f0648c", "#8f6bff", "#14a8d6"],
  },
  {
    nombre: "Azul",
    principal: "#2f7bff",
    secundario: "#1f63f0",
    acento1: "#00b4d8",
    acento2: "#7c5cff",
    paleta: ["#2f7bff", "#1f63f0", "#0a9fcf", "#12a8a3", "#5b6cff", "#3b8ef5", "#0c7fd1", "#6c63ff"],
  },
  {
    nombre: "Verde",
    principal: "#12b886",
    secundario: "#0ca678",
    acento1: "#40c057",
    acento2: "#15aabf",
    paleta: ["#12b886", "#0ca678", "#37a24d", "#1098ad", "#5c940d", "#2b9348", "#0b7285", "#20a67a"],
  },
  {
    nombre: "Naranja",
    principal: "#ff7a1a",
    secundario: "#f76707",
    acento1: "#fcc419",
    acento2: "#fa5252",
    paleta: ["#ff7a1a", "#f76707", "#e8a200", "#fa5252", "#ff922b", "#e03131", "#d9480f", "#f06595"],
  },
  {
    nombre: "Rosado",
    principal: "#f0508c",
    secundario: "#e03b7a",
    acento1: "#ff8fab",
    acento2: "#9775fa",
    paleta: ["#f0508c", "#e03b7a", "#ef6f9c", "#9775fa", "#fa5252", "#c152e0", "#d164f0", "#c2255c"],
  },
  {
    nombre: "Gris",
    principal: "#3d3b50",
    secundario: "#2a2839",
    acento1: "#6c6a85",
    acento2: "#3aa0ff",
    paleta: ["#3d3b50", "#5c5a76", "#2f7bff", "#12b886", "#7c5cff", "#ff7a1a", "#f0508c", "#0b7285"],
  },
];

let PALETA_COLORES = [...TEMAS_COLOR[0].paleta];

const CLAVE_STORAGE = "horarioClases";
const CLAVE_TEMA = "horarioTemaColor";

function aplicarTema(tema) {
  const raiz = document.documentElement.style;
  raiz.setProperty("--color-primario", tema.principal);
  raiz.setProperty("--color-primario-hover", tema.secundario);
  raiz.setProperty(
    "--gradiente-llamativo",
    `linear-gradient(135deg, ${tema.secundario} 0%, ${tema.acento1} 50%, ${tema.acento2} 100%)`
  );
  PALETA_COLORES = [...tema.paleta];
}

function cargarTemaGuardado() {
  try {
    const nombre = localStorage.getItem(CLAVE_TEMA);
    return TEMAS_COLOR.find((t) => t.nombre === nombre) || TEMAS_COLOR[0];
  } catch {
    return TEMAS_COLOR[0];
  }
}

function guardarTema(tema) {
  localStorage.setItem(CLAVE_TEMA, tema.nombre);
}

const btnColores = document.getElementById("btn-colores");
const modalColores = document.getElementById("modal-colores");
const btnCerrarColores = document.getElementById("btn-cerrar-colores");
const swatchesContenedor = document.getElementById("swatches-colores");

function pintarSwatches(temaActivo) {
  swatchesContenedor.innerHTML = "";
  TEMAS_COLOR.forEach((tema) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "swatch-color";
    swatch.title = tema.nombre;
    swatch.style.background = `linear-gradient(135deg, ${tema.principal}, ${tema.acento1})`;
    if (tema.nombre === temaActivo.nombre) swatch.classList.add("swatch-activo");
    swatch.addEventListener("click", () => {
      aplicarTema(tema);
      guardarTema(tema);
      render();
      pintarSwatches(tema);
    });
    swatchesContenedor.appendChild(swatch);
  });
}

btnColores.addEventListener("click", () => {
  pintarSwatches(cargarTemaGuardado());
  modalColores.hidden = false;
});

btnCerrarColores.addEventListener("click", () => {
  modalColores.hidden = true;
});

modalColores.addEventListener("click", (evento) => {
  if (evento.target === modalColores) modalColores.hidden = true;
});

aplicarTema(cargarTemaGuardado());

const btnNotificaciones = document.getElementById("btn-notificaciones");

let messaging = null;
if ("Notification" in window && "serviceWorker" in navigator) {
  messaging = getMessaging(firebaseApp);

  // Con la app en segundo plano o cerrada, el aviso lo muestra el service
  // worker (firebase-messaging-sw.js). Con la app abierta en pantalla,
  // Firebase entrega el mensaje aquí en vez de al service worker, así que
  // lo mostramos nosotros; nunca llegan a los dos, no se duplica.
  onMessage(messaging, async (payload) => {
    if (!payload.data || !payload.data.title) return;
    // Con la app abierta, los avisos de fotos actúan directamente.
    if (payload.data.url) manejarAccionDeNotificacion(payload.data.url);
    try {
      const registro = await navigator.serviceWorker.getRegistration("firebase-messaging-sw.js");
      const opciones = { body: payload.data.body || "", data: { url: payload.data.url || "./" } };
      if (registro) {
        registro.showNotification(payload.data.title, opciones);
      } else {
        new Notification(payload.data.title, opciones);
      }
    } catch (error) {
      console.error("No se pudo mostrar el aviso:", error);
    }
  });

  if (Notification.permission === "granted") {
    btnNotificaciones.title = "Notificaciones activadas";
    btnNotificaciones.classList.add("btn-icono-activo");
  }
}

// Guarda en la cuenta el token de este dispositivo para poder mandarle avisos.
async function registrarDispositivo() {
  const registro = await navigator.serviceWorker.register("firebase-messaging-sw.js");
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registro,
  });
  await setDoc(doc(db, "horarios", usuarioActual.uid), { fcmToken: token }, { merge: true });
  btnNotificaciones.title = "Notificaciones activadas";
  btnNotificaciones.classList.add("btn-icono-activo");
}

// Pide el permiso y registra el dispositivo. Devuelve "ok", "negado" o "error".
async function activarNotificaciones() {
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return "negado";
    await registrarDispositivo();
    return "ok";
  } catch (error) {
    console.error(error);
    return "error";
  }
}

const MENSAJE_ACTIVADAS = "¡Listo! Te avisaremos antes de cada clase, cuando tus amigos salgan y cuando te dividan una cuenta.";

// ---------- Ajustes de notificaciones (🔔) ----------
// Cada quien elige qué avisos recibe. Se guarda en horarios/{uid}.preferencias
// y lo respetan check-clases.js y el servidor de avisos.

const modalAjustesNotif = document.getElementById("modal-ajustes-notif");
const estadoNotif = document.getElementById("estado-notif");
const btnActivarDesdeAjustes = document.getElementById("btn-activar-desde-ajustes");
const listaAjustesNotif = document.getElementById("lista-ajustes-notif");

const TIPOS_AVISO = [
  { id: "clases", icono: "⏰", titulo: "Clases por empezar", detalle: "5 minutos antes de cada clase" },
  { id: "amigos", icono: "🎉", titulo: "Amigos que salen de clase", detalle: "Solo cuando los dos tienen un hueco" },
  { id: "fotos", icono: "📸", titulo: "Fotos", detalle: "Invitación a subir foto al salir y fotos de tus amigos" },
  { id: "cuentas", icono: "💸", titulo: "Cuentas y pagos", detalle: "Cuando te dividen una cuenta o te confirman un pago" },
];

function pintarEstadoNotificaciones() {
  const activas = messaging && Notification.permission === "granted";
  btnActivarDesdeAjustes.hidden = true;
  if (activas) {
    estadoNotif.textContent = "Activadas en este celular";
  } else if (!messaging) {
    estadoNotif.textContent = esIphoneSinInstalar()
      ? "En iPhone primero instala ParchApp (botón «Instalar» de arriba)."
      : "Este navegador no permite notificaciones. Prueba en Chrome.";
  } else if (Notification.permission === "denied") {
    estadoNotif.textContent = "Bloqueadas. Permítelas desde el candado del navegador.";
  } else {
    estadoNotif.textContent = "Todavía no están activadas en este celular.";
    btnActivarDesdeAjustes.hidden = false;
  }
}

async function abrirAjustesNotificaciones() {
  pintarEstadoNotificaciones();
  listaAjustesNotif.innerHTML = "";
  modalAjustesNotif.hidden = false;

  let preferencias = {};
  try {
    const snapshot = await getDoc(doc(db, "horarios", usuarioActual.uid));
    preferencias = (snapshot.exists() && snapshot.data().preferencias) || {};
  } catch (error) {
    console.error(error);
  }

  TIPOS_AVISO.forEach((tipo) => {
    const fila = document.createElement("label");
    fila.className = "ajuste-notif";
    const texto = document.createElement("span");
    texto.className = "ajuste-notif-texto";
    const titulo = document.createElement("strong");
    titulo.textContent = tipo.titulo;
    const detalle = document.createElement("small");
    detalle.textContent = tipo.detalle;
    texto.append(titulo, detalle);

    const interruptor = document.createElement("input");
    interruptor.type = "checkbox";
    interruptor.className = "interruptor";
    interruptor.checked = preferencias[tipo.id] !== false;
    interruptor.addEventListener("change", async () => {
      try {
        await setDoc(
          doc(db, "horarios", usuarioActual.uid),
          { preferencias: { [tipo.id]: interruptor.checked } },
          { merge: true }
        );
      } catch (error) {
        console.error(error);
        interruptor.checked = !interruptor.checked;
        alert("No se pudo guardar. Intenta de nuevo.");
      }
    });

    fila.append(texto, interruptor);
    listaAjustesNotif.appendChild(fila);
  });
}

btnNotificaciones.addEventListener("click", () => {
  if (!usuarioActual) {
    alert("Inicia sesión primero para configurar las notificaciones.");
    return;
  }
  abrirAjustesNotificaciones();
});

btnActivarDesdeAjustes.addEventListener("click", async () => {
  const resultado = await activarNotificaciones();
  if (resultado === "error") alert("No se pudo activar la notificación. Intenta de nuevo.");
  pintarEstadoNotificaciones();
});

document.getElementById("btn-cerrar-ajustes-notif").addEventListener("click", () => {
  modalAjustesNotif.hidden = true;
});

modalAjustesNotif.addEventListener("click", (evento) => {
  if (evento.target === modalAjustesNotif) modalAjustesNotif.hidden = true;
});

// ---------- Aviso para activar notificaciones al entrar ----------

const modalNotificaciones = document.getElementById("modal-notificaciones");
const notifTitulo = document.getElementById("notif-titulo");
const notifTexto = document.getElementById("notif-texto");
const btnNotifActivar = document.getElementById("btn-notif-activar");
const btnNotifLuego = document.getElementById("btn-notif-luego");
const CLAVE_NOTIF_LUEGO = "horarioNotifLuegoHasta";
const UN_DIA = 24 * 60 * 60 * 1000;

function esIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function estaInstalada() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function esIphoneSinInstalar() {
  return esIos() && !estaInstalada();
}

const TEXTOS_NOTIFICACIONES = {
  pedir: {
    titulo: "Activa las notificaciones",
    texto:
      "Así te avisamos 5 minutos antes de cada clase, cuando tus amigos salen de clase y cuando alguien divide una cuenta contigo.",
    activar: true,
  },
  bloqueadas: {
    titulo: "Las notificaciones están bloqueadas",
    texto:
      "Para recibir los avisos, permite las notificaciones de esta página en la configuración del navegador (el candado 🔒 junto a la dirección → Notificaciones → Permitir) y vuelve a entrar.",
    activar: false,
  },
  iphone: {
    titulo: "Instala la app para recibir avisos",
    texto:
      "En iPhone los avisos solo funcionan si agregas ParchApp a tu pantalla de inicio y la abres desde ese ícono. Toca «Instalar» en la barra morada de arriba para ver los pasos.",
    activar: false,
  },
  "sin-soporte": {
    titulo: "Tu navegador no tiene notificaciones",
    texto: "Prueba abriendo la app en Chrome para poder recibir los avisos.",
    activar: false,
  },
};

function mostrarAvisoNotificaciones(tipo) {
  const contenido = TEXTOS_NOTIFICACIONES[tipo];
  notifTitulo.textContent = contenido.titulo;
  notifTexto.textContent = contenido.texto;
  btnNotifActivar.hidden = !contenido.activar;
  btnNotifLuego.textContent = contenido.activar ? "Ahora no" : "Entendido";
  modalNotificaciones.hidden = false;
}

function cerrarAvisoNotificaciones() {
  modalNotificaciones.hidden = true;
  // No volver a insistir hasta mañana.
  try {
    localStorage.setItem(CLAVE_NOTIF_LUEGO, String(Date.now() + UN_DIA));
  } catch {}
}

btnNotifLuego.addEventListener("click", cerrarAvisoNotificaciones);

btnNotifActivar.addEventListener("click", async () => {
  btnNotifActivar.disabled = true;
  const resultado = await activarNotificaciones();
  btnNotifActivar.disabled = false;
  if (resultado === "ok") {
    modalNotificaciones.hidden = true;
    alert(MENSAJE_ACTIVADAS);
  } else if (resultado === "negado") {
    mostrarAvisoNotificaciones("bloqueadas");
  } else {
    alert("No se pudo activar la notificación. Intenta de nuevo.");
  }
});

// Al entrar: si ya dio permiso, registra este dispositivo sin preguntar;
// si no, muestra el aviso (máximo una vez al día si dijo "Ahora no").
async function revisarNotificacionesAlEntrar() {
  if (messaging && Notification.permission === "granted") {
    try {
      await registrarDispositivo();
    } catch (error) {
      console.error("No se pudo registrar el dispositivo:", error);
    }
    return;
  }

  try {
    if (Date.now() < Number(localStorage.getItem(CLAVE_NOTIF_LUEGO) || 0)) return;
  } catch {}

  if (!messaging) {
    if (esIphoneSinInstalar()) mostrarAvisoNotificaciones("iphone");
    return;
  }
  mostrarAvisoNotificaciones(Notification.permission === "denied" ? "bloqueadas" : "pedir");
}

// ---------- Compartir la app (botón junto al nombre) ----------

const URL_APP_PUBLICA = "https://rvillabona07.github.io/horario-universidad/";
const btnCompartirApp = document.getElementById("btn-compartir-app");

btnCompartirApp.addEventListener("click", async () => {
  const texto = "¡Descarga ParchApp! 🗓️ Tu horario, tus amigos y el parche en una sola app:";
  if (navigator.share) {
    try {
      await navigator.share({ title: "ParchApp", text: texto, url: URL_APP_PUBLICA });
    } catch {
      // Canceló el menú de compartir: no pasa nada.
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${texto} ${URL_APP_PUBLICA}`);
    alert("¡Enlace copiado! Pégalo en WhatsApp o donde quieras.");
  } catch {
    prompt("Copia este enlace para compartir ParchApp:", URL_APP_PUBLICA);
  }
});

// ---------- Instalar como app (PWA) ----------
// En Android/Chrome el navegador nos da el evento "beforeinstallprompt" y
// con un toque se instala. En iPhone no existe: mostramos los pasos.

const bannerInstalar = document.getElementById("banner-instalar");
const modalInstalar = document.getElementById("modal-instalar");
const pasosInstalar = document.getElementById("pasos-instalar");
const CLAVE_BANNER_OCULTO = "horarioBannerInstalarHasta";
let eventoInstalar = null;

function mostrarBannerInstalar() {
  if (estaInstalada()) return;
  try {
    if (Date.now() < Number(localStorage.getItem(CLAVE_BANNER_OCULTO) || 0)) return;
  } catch {}
  bannerInstalar.hidden = false;
}

// Ícono de Compartir de iPhone (cuadrado con flecha hacia arriba).
const ICONO_COMPARTIR = `<svg class="icono-paso" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

// Navegadores dentro de otras apps (Instagram, Facebook, etc.): desde ahí
// el iPhone no deja agregar a inicio, hay que pasar a Safari primero.
function esNavegadorDentroDeApp() {
  return /Instagram|FBAN|FBAV|FB_IAB|Line\/|Snapchat|TikTok|musical_ly/i.test(navigator.userAgent);
}

// Textos fijos escritos por nosotros (no vienen del usuario), por eso
// se pueden poner con innerHTML para tener negritas e íconos.
function pasosIphone() {
  const pasos = [];
  pasos.push(
    esNavegadorDentroDeApp()
      ? "Toca <b>•••</b> y elige <b>«Abrir en Safari»</b>."
      : "Ábrela en <b>Safari</b> 🧭."
  );
  pasos.push(
    `Toca <b>Compartir</b> ${ICONO_COMPARTIR} (si no lo ves, toca <b>•••</b> primero).`,
    "Baja y toca <b>«Agregar a inicio»</b>.",
    "Toca <b>«Agregar»</b>.",
    "Abre <b>ParchApp</b> desde el ícono de tu pantalla."
  );
  return pasos;
}

function pasosAndroid() {
  return [
    "Ábrela en <b>Chrome</b>.",
    "Toca el menú <b>⋮</b> (arriba a la derecha).",
    "Toca <b>«Instalar app»</b> y confirma.",
    "Abre <b>ParchApp</b> desde el ícono de tu pantalla.",
  ];
}

function mostrarPasosInstalar() {
  const pasos = esIos() ? pasosIphone() : pasosAndroid();
  pasosInstalar.innerHTML = "";
  pasos.forEach((paso) => {
    const li = document.createElement("li");
    li.innerHTML = paso;
    pasosInstalar.appendChild(li);
  });
  modalInstalar.hidden = false;
}

window.addEventListener("beforeinstallprompt", (evento) => {
  evento.preventDefault();
  eventoInstalar = evento;
  mostrarBannerInstalar();
});

window.addEventListener("appinstalled", () => {
  eventoInstalar = null;
  bannerInstalar.hidden = true;
});

document.getElementById("btn-instalar").addEventListener("click", async () => {
  if (eventoInstalar) {
    eventoInstalar.prompt();
    const { outcome } = await eventoInstalar.userChoice;
    eventoInstalar = null;
    if (outcome === "accepted") bannerInstalar.hidden = true;
  } else {
    mostrarPasosInstalar();
  }
});

document.getElementById("btn-cerrar-banner").addEventListener("click", () => {
  bannerInstalar.hidden = true;
  try {
    localStorage.setItem(CLAVE_BANNER_OCULTO, String(Date.now() + 3 * UN_DIA));
  } catch {}
});

document.getElementById("btn-cerrar-instalar").addEventListener("click", () => {
  modalInstalar.hidden = true;
});

modalInstalar.addEventListener("click", (evento) => {
  if (evento.target === modalInstalar) modalInstalar.hidden = true;
});

// El banner sale siempre que la app no esté instalada: si el navegador
// no da "beforeinstallprompt" (iPhone, Samsung Internet, Firefox...), el
// botón muestra los pasos para instalarla a mano.
mostrarBannerInstalar();

// El service worker (el mismo de las notificaciones) ayuda a que el
// navegador ofrezca instalar la app.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("firebase-messaging-sw.js").catch(() => {});
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const DIAS_COMPLETOS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function parsearFechaLocal(fechaStr) {
  const [anio, mes, dia] = fechaStr.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

function obtenerLunesDeEstaSemana(fecha) {
  const copia = new Date(fecha);
  const diaSemana = copia.getDay(); // 0 = domingo
  const diferencia = diaSemana === 0 ? -6 : 1 - diaSemana;
  copia.setDate(copia.getDate() + diferencia);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function formatearRangoSemana() {
  const lunes = obtenerLunesDeEstaSemana(new Date());
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const mismoMes = lunes.getMonth() === domingo.getMonth();
  const mismoAnio = lunes.getFullYear() === domingo.getFullYear();

  if (mismoMes) {
    return `${lunes.getDate()} - ${domingo.getDate()} de ${MESES[lunes.getMonth()]} ${lunes.getFullYear()}`;
  }
  if (mismoAnio) {
    return `${lunes.getDate()} de ${MESES[lunes.getMonth()]} - ${domingo.getDate()} de ${MESES[domingo.getMonth()]} ${lunes.getFullYear()}`;
  }
  return `${lunes.getDate()} de ${MESES[lunes.getMonth()]} ${lunes.getFullYear()} - ${domingo.getDate()} de ${MESES[domingo.getMonth()]} ${domingo.getFullYear()}`;
}

document.getElementById("rango-semana").textContent = `Semana del ${formatearRangoSemana()}`;

const grid = document.getElementById("grid-horario");
const form = document.getElementById("form-clase");
const btnCancelar = document.getElementById("btn-cancelar");
const btnGuardar = document.getElementById("btn-guardar");
const formTitulo = document.getElementById("form-titulo");

const appMain = document.getElementById("app-main");
const authPanel = document.getElementById("auth-panel");
const authCard = document.getElementById("auth-card");
const authTitulo = document.getElementById("auth-titulo");
const authSubtexto = document.getElementById("auth-subtexto");
const formAuth = document.getElementById("form-auth");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authError = document.getElementById("auth-error");
const btnAuthPrincipal = document.getElementById("btn-auth-principal");
const authToggleTexto = document.getElementById("auth-toggle-texto");
const btnCambiarModo = document.getElementById("btn-cambiar-modo");
const usuarioInfo = document.getElementById("usuario-info");
const usuarioEmailEl = document.getElementById("usuario-email");
const btnLogout = document.getElementById("btn-logout");

let clases = [];
let pendientes = [];
let editandoId = null;
let usuarioActual = null;
let modoAuth = "login";

function migrarClasesLocales() {
  try {
    const datos = localStorage.getItem(CLAVE_STORAGE);
    const guardadas = datos ? JSON.parse(datos) : [];
    // Compatibilidad con el formato anterior (un solo día por clase)
    return guardadas.map((c) => (c.dias ? c : { ...c, dias: c.dia ? [c.dia] : [] }));
  } catch {
    return [];
  }
}

async function cargarDatosDesdeFirestore(uid) {
  const referencia = doc(db, "horarios", uid);
  const snapshot = await getDoc(referencia);

  if (snapshot.exists()) {
    const datos = snapshot.data();
    return { clases: datos.clases || [], pendientes: datos.pendientes || [] };
  }

  // Primera vez que esta cuenta inicia sesión: importa lo que ya
  // estaba guardado en este navegador (si había algo).
  const clasesLocales = migrarClasesLocales();
  if (clasesLocales.length > 0) {
    await setDoc(referencia, { clases: clasesLocales, pendientes: [] });
  }
  return { clases: clasesLocales, pendientes: [] };
}

async function guardarDatos() {
  if (!usuarioActual) return;
  publicarHorarioCompartido();
  await setDoc(doc(db, "horarios", usuarioActual.uid), { clases, pendientes }, { merge: true });
}

// Copia de solo las clases que pueden leer los amigos que elegiste
// (campo "permitidos"). Las actividades y el token de notificaciones
// se quedan en "horarios", que es privado.
function publicarHorarioCompartido() {
  if (!usuarioActual) return;
  setDoc(doc(db, "horariosCompartidos", usuarioActual.uid), { clases }, { merge: true }).catch(
    (error) => console.error("No se pudo publicar el horario compartido:", error)
  );
}

function mostrarErrorAuth(mensaje) {
  authError.textContent = mensaje;
  authError.hidden = false;
}

function limpiarErrorAuth() {
  authError.hidden = true;
  authError.textContent = "";
  authMensaje.hidden = true;
}

// ---------- Recuperar contraseña ----------

const btnOlvideContrasena = document.getElementById("btn-olvide-contrasena");
const authMensaje = document.getElementById("auth-mensaje");

btnOlvideContrasena.addEventListener("click", async () => {
  limpiarErrorAuth();
  const correo = authEmail.value.trim();
  if (!correo) {
    mostrarErrorAuth("Escribe tu correo arriba y vuelve a tocar «¿Olvidaste tu contraseña?».");
    authEmail.focus();
    return;
  }

  btnOlvideContrasena.disabled = true;
  try {
    await sendPasswordResetEmail(auth, correo);
    // Firebase no dice si el correo existe (por seguridad), así que el
    // mensaje es el mismo en ambos casos.
    authMensaje.textContent = `📧 Si hay una cuenta con ${correo}, te llegó un correo para crear una contraseña nueva. Revisa también la carpeta de spam.`;
    authMensaje.hidden = false;
  } catch (error) {
    mostrarErrorAuth(
      error.code === "auth/too-many-requests"
        ? "Pediste demasiados correos seguidos. Espera unos minutos e intenta de nuevo."
        : traducirErrorAuth(error.code)
    );
  } finally {
    btnOlvideContrasena.disabled = false;
  }
});

const MENSAJES_ERROR_AUTH = {
  "auth/invalid-email": "El correo no es válido.",
  "auth/missing-password": "Escribe una contraseña.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Inicia sesión.",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/user-not-found": "No existe una cuenta con ese correo.",
};

function traducirErrorAuth(codigo) {
  return MENSAJES_ERROR_AUTH[codigo] || "Ocurrió un error, intenta de nuevo.";
}

function actualizarModoAuth() {
  limpiarErrorAuth();
  if (modoAuth === "login") {
    authCard.classList.remove("auth-card-registro");
    btnOlvideContrasena.hidden = false;
    authTitulo.textContent = "Inicia sesión";
    authSubtexto.textContent = "Para guardar tu horario y verlo en todos tus dispositivos";
    btnAuthPrincipal.textContent = "Iniciar sesión";
    authToggleTexto.textContent = "¿No tienes cuenta?";
    btnCambiarModo.textContent = "Crea una aquí";
  } else {
    authCard.classList.add("auth-card-registro");
    btnOlvideContrasena.hidden = true;
    authTitulo.textContent = "Crea tu cuenta";
    authSubtexto.textContent = "Regístrate para guardar tu horario y verlo en todos tus dispositivos";
    btnAuthPrincipal.textContent = "Crear cuenta";
    authToggleTexto.textContent = "¿Ya tienes cuenta?";
    btnCambiarModo.textContent = "Inicia sesión aquí";
  }
}

btnCambiarModo.addEventListener("click", () => {
  modoAuth = modoAuth === "login" ? "registro" : "login";
  actualizarModoAuth();
});

formAuth.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limpiarErrorAuth();
  try {
    if (modoAuth === "login") {
      await signInWithEmailAndPassword(auth, authEmail.value.trim(), authPassword.value);
    } else {
      await createUserWithEmailAndPassword(auth, authEmail.value.trim(), authPassword.value);
    }
  } catch (error) {
    mostrarErrorAuth(traducirErrorAuth(error.code));
  }
});

btnLogout.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  usuarioActual = user;

  if (user) {
    authPanel.hidden = true;
    appMain.hidden = false;
    usuarioInfo.hidden = false;
    const miPerfil = await obtenerPerfil(user.uid);
    usuarioEmailEl.textContent = miPerfil.apodo || "Sin apodo";
    miAvatar = miPerfil.avatar || null;
    actualizarAvatarUsuario();
    formAuth.reset();
    limpiarErrorAuth();
    const datos = await cargarDatosDesdeFirestore(user.uid);
    clases = datos.clases;
    pendientes = datos.pendientes;
    render();
    publicarHorarioCompartido();
    document.getElementById("auth-invitacion").hidden = true;
    await procesarInvitacionPendiente();
    sincronizarPermitidosAlEntrar();
    revisarNotificacionesAlEntrar();
    iniciarFotos();
    if (accionPendiente) {
      manejarAccionDeNotificacion(accionPendiente);
      accionPendiente = null;
    }
  } else {
    detenerFotos();
    miEnlace = "";
    miEnlaceEl.textContent = "Cargando tu enlace…";
    appMain.hidden = true;
    authPanel.hidden = false;
    usuarioInfo.hidden = true;
    clases = [];
    pendientes = [];
    modoAuth = "login";
    actualizarModoAuth();
  }
});

// ---------- Amigos ----------

const PESTANAS = [
  { tab: "tab-horario", vista: "vista-horario" },
  { tab: "tab-amigos", vista: "vista-amigos", alAbrir: () => renderAmigos() },
  { tab: "tab-cuentas", vista: "vista-cuentas", alAbrir: () => renderCuentas() },
  {
    tab: "tab-chat",
    vista: "vista-chat",
    alAbrir: () => {
      conversacionAbierta = null; // siempre abre en la bandeja
      refrescarChat();
    },
  },
];

PESTANAS.forEach((pestana) => {
  document.getElementById(pestana.tab).addEventListener("click", () => {
    PESTANAS.forEach((otra) => {
      document.getElementById(otra.tab).classList.toggle("tab-activo", otra === pestana);
      document.getElementById(otra.vista).hidden = otra !== pestana;
    });
    if (pestana.alAbrir) pestana.alAbrir();
  });
});

// ---------- Enlace de invitación ----------
// Cada usuario tiene un enlace ?amigo=<token>. Quien lo toca queda como su
// amigo al instante (las reglas de Firestore comprueban que el token sea
// de verdad de esa persona). El token es largo y aleatorio: no se adivina.

function generarToken() {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return [...bytes].map((b) => caracteres[b % caracteres.length]).join("");
}

async function asegurarEnlacePropio() {
  const referenciaPropia = doc(db, "horarios", usuarioActual.uid);
  const snapshotPropio = await getDoc(referenciaPropia);
  const existente = snapshotPropio.exists() ? snapshotPropio.data().miEnlace : null;
  if (existente) return existente;

  const token = generarToken();
  await setDoc(doc(db, "invitaciones", token), { uid: usuarioActual.uid });
  await setDoc(referenciaPropia, { miEnlace: token }, { merge: true });
  return token;
}

function enlaceDeInvitacion(token) {
  const url = new URL("./", location.href);
  url.searchParams.set("amigo", token);
  return url.toString();
}

// Si la app se abrió con ?amigo=..., se guarda la invitación (por si hay
// que iniciar sesión primero) y se limpia la dirección.
const CLAVE_INVITACION = "horarioInvitacionPendiente";
let invitacionPendiente = null;

(function leerInvitacionDeLaUrl() {
  const parametros = new URLSearchParams(location.search);
  const token = parametros.get("amigo");
  if (!token) return;
  invitacionPendiente = token;
  try {
    localStorage.setItem(CLAVE_INVITACION, token);
  } catch {}
  parametros.delete("amigo");
  const resto = parametros.toString();
  history.replaceState(null, "", location.pathname + (resto ? `?${resto}` : "") + location.hash);
})();

function tokenDeInvitacionPendiente() {
  if (invitacionPendiente) return invitacionPendiente;
  try {
    return localStorage.getItem(CLAVE_INVITACION);
  } catch {
    return null;
  }
}

function olvidarInvitacion() {
  invitacionPendiente = null;
  try {
    localStorage.removeItem(CLAVE_INVITACION);
  } catch {}
}

document.getElementById("auth-invitacion").hidden = !tokenDeInvitacionPendiente();

// Después de iniciar sesión: si llegó por un enlace, los vuelve amigos.
async function procesarInvitacionPendiente() {
  const token = tokenDeInvitacionPendiente();
  if (!token) return;

  try {
    const invitacion = await getDoc(doc(db, "invitaciones", token));
    if (!invitacion.exists()) {
      olvidarInvitacion();
      alert("Ese enlace de invitación no es válido.");
      return;
    }

    const miUid = usuarioActual.uid;
    const uidAmigo = invitacion.data().uid;
    if (uidAmigo === miUid) {
      olvidarInvitacion();
      return; // abrió su propio enlace
    }

    const [deMi, deEl] = await Promise.all([
      getDocs(query(collection(db, "solicitudesAmistad"), where("de", "==", miUid), where("para", "==", uidAmigo))),
      getDocs(query(collection(db, "solicitudesAmistad"), where("de", "==", uidAmigo), where("para", "==", miUid))),
    ]);
    const todas = [...deMi.docs, ...deEl.docs];
    const apodo = (await obtenerApodo(uidAmigo)) || "tu amigo";

    if (todas.some((d) => d.data().estado === "aceptada")) {
      olvidarInvitacion();
      alert(`Ya eres amigo de ${apodo} 🙌`);
      return;
    }

    const solicitudDeEl = deEl.docs.find((d) => d.data().estado === "pendiente");
    if (solicitudDeEl) {
      await updateDoc(solicitudDeEl.ref, { estado: "aceptada" });
    } else {
      await addDoc(collection(db, "solicitudesAmistad"), {
        de: miUid,
        para: uidAmigo,
        estado: "aceptada",
        invitacion: token,
        creada: Date.now(),
      });
    }

    olvidarInvitacion();
    alert(`🎉 ¡Listo! Ahora tú y ${apodo} son amigos en ParchApp.`);
    if (!document.getElementById("vista-amigos").hidden) renderAmigos();
  } catch (error) {
    console.error(error);
    alert("No se pudo aceptar la invitación. Vuelve a tocar el enlace para intentarlo otra vez.");
    olvidarInvitacion();
  }
}

// perfiles/{uid}: { apodo, avatar }
async function obtenerPerfil(uid) {
  try {
    const snapshot = await getDoc(doc(db, "perfiles", uid));
    return snapshot.exists() ? snapshot.data() : {};
  } catch {
    return {};
  }
}

async function obtenerApodo(uid) {
  try {
    const snapshot = await getDoc(doc(db, "perfiles", uid));
    return snapshot.exists() ? snapshot.data().apodo : null;
  } catch {
    return null;
  }
}

const formApodo = document.getElementById("form-apodo");
const apodoInput = document.getElementById("apodo-input");
const modalApodo = document.getElementById("modal-apodo");
const btnCerrarApodo = document.getElementById("btn-cerrar-apodo");

usuarioEmailEl.addEventListener("click", () => {
  apodoInput.value = usuarioEmailEl.textContent === "Sin apodo" ? "" : usuarioEmailEl.textContent;
  modalApodo.hidden = false;
});

btnCerrarApodo.addEventListener("click", () => {
  modalApodo.hidden = true;
});

modalApodo.addEventListener("click", (evento) => {
  if (evento.target === modalApodo) modalApodo.hidden = true;
});

formApodo.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const apodo = apodoInput.value.trim();
  if (!apodo) return;

  // merge: para no borrar el avatar al cambiar el apodo.
  await setDoc(doc(db, "perfiles", usuarioActual.uid), { apodo }, { merge: true });
  usuarioEmailEl.textContent = apodo;
  actualizarAvatarUsuario();
  modalApodo.hidden = true;
});

const miEnlaceEl = document.getElementById("mi-enlace");
const btnCompartirEnlace = document.getElementById("btn-compartir-enlace");
const btnCopiarEnlace = document.getElementById("btn-copiar-enlace");
const seccionSolicitudes = document.getElementById("seccion-solicitudes");
const listaSolicitudes = document.getElementById("lista-solicitudes");
const listaAmigos = document.getElementById("lista-amigos");
const listaBloqueados = document.getElementById("lista-bloqueados");
const subpestanaAmigos = document.getElementById("subpestana-amigos");
const subpestanaBloqueados = document.getElementById("subpestana-bloqueados");
const contadorAmigos = document.getElementById("contador-amigos");
const contadorBloqueados = document.getElementById("contador-bloqueados");
const amigosSubtexto = document.getElementById("amigos-subtexto");
let miEnlace = "";
let ultimoRenderAmigos = 0;
let datosAmigos = [];
let misBloqueados = new Set();
let viendoBloqueados = false;

// Modo "Seleccionar": se tocan varias tarjetas y se bloquean (o
// desbloquean) de una vez, sin un botón en cada tarjeta.
const btnSeleccionarAmigos = document.getElementById("btn-seleccionar-amigos");
const accionesSeleccion = document.getElementById("acciones-seleccion");
const textoSeleccion = document.getElementById("texto-seleccion");
const btnAccionSeleccion = document.getElementById("btn-accion-seleccion");
let modoSeleccion = false;
let seleccionados = new Set();

function cambiarModoSeleccion(activo) {
  modoSeleccion = activo;
  seleccionados = new Set();
  btnSeleccionarAmigos.textContent = activo ? "Cancelar" : "Seleccionar";
  accionesSeleccion.hidden = !activo;
  actualizarAccionesSeleccion();
  pintarListasAmigos();
}

function actualizarAccionesSeleccion() {
  const n = seleccionados.size;
  textoSeleccion.textContent =
    n === 0 ? "Toca a los amigos" : `${n} ${n === 1 ? "seleccionado" : "seleccionados"}`;
  btnAccionSeleccion.textContent = viendoBloqueados ? "Desbloquear" : "Bloquear";
  btnAccionSeleccion.classList.toggle("btn-accion-desbloquear", viendoBloqueados);
  btnAccionSeleccion.disabled = n === 0;
}

// Buscador de amigos: filtra las dos pestañas (también mientras seleccionas).
const buscarAmigos = document.getElementById("buscar-amigos");
buscarAmigos.addEventListener("input", pintarListasAmigos);

btnSeleccionarAmigos.addEventListener("click", () => cambiarModoSeleccion(!modoSeleccion));
btnAccionSeleccion.addEventListener("click", () => cambiarBloqueo([...seleccionados], !viendoBloqueados));

// Pestañas "Amigos" / "Bloqueados" dentro de Mis amigos.
function mostrarSubpestana(bloqueados) {
  viendoBloqueados = bloqueados;
  subpestanaAmigos.classList.toggle("subpestana-activa", !bloqueados);
  subpestanaBloqueados.classList.toggle("subpestana-activa", bloqueados);
  listaAmigos.hidden = bloqueados;
  listaBloqueados.hidden = !bloqueados;
  amigosSubtexto.textContent = bloqueados
    ? "Estos amigos no pueden ver tu horario"
    : "Todos tus amigos pueden ver tu horario, menos los que bloquees";
  if (modoSeleccion) cambiarModoSeleccion(false);
}

subpestanaAmigos.addEventListener("click", () => mostrarSubpestana(false));
subpestanaBloqueados.addEventListener("click", () => mostrarSubpestana(true));

async function copiarEnlace() {
  try {
    await navigator.clipboard.writeText(miEnlace);
    btnCopiarEnlace.textContent = "¡Copiado!";
    setTimeout(() => (btnCopiarEnlace.textContent = "Copiar"), 1500);
  } catch {
    alert("No se pudo copiar. Mantén presionado el enlace para copiarlo.");
  }
}

btnCopiarEnlace.addEventListener("click", () => {
  if (miEnlace) copiarEnlace();
});

btnCompartirEnlace.addEventListener("click", async () => {
  if (!miEnlace) return;
  if (!navigator.share) {
    copiarEnlace();
    return;
  }
  try {
    await navigator.share({
      title: "ParchApp",
      text: "¡Agrégame en ParchApp! 🗓️ Toca el enlace y quedamos como amigos al instante:",
      url: miEnlace,
    });
  } catch {
    // Canceló el menú de compartir: no pasa nada.
  }
});

async function responderSolicitud(id, estado) {
  await updateDoc(doc(db, "solicitudesAmistad", id), { estado });
  renderAmigos();
}

async function obtenerEstadoAmigo(uid) {
  try {
    const snapshot = await getDoc(doc(db, "estados", uid));
    return snapshot.exists() ? snapshot.data().estado : "Sin datos";
  } catch {
    return "Sin datos";
  }
}

function amigosDesdeSolicitudes(snapshotDestino, snapshotOrigen) {
  const uids = new Set([
    ...snapshotDestino.docs.filter((d) => d.data().estado === "aceptada").map((d) => d.data().de),
    ...snapshotOrigen.docs.filter((d) => d.data().estado === "aceptada").map((d) => d.data().para),
  ]);
  // Set: si por algún motivo hay dos solicitudes aceptadas, sale una vez.
  return [...uids].map((uid) => ({ uid }));
}

async function obtenerAmigos() {
  const [snapshotDestino, snapshotOrigen] = await Promise.all([
    getDocs(query(collection(db, "solicitudesAmistad"), where("para", "==", usuarioActual.uid))),
    getDocs(query(collection(db, "solicitudesAmistad"), where("de", "==", usuarioActual.uid))),
  ]);
  const amigos = amigosDesdeSolicitudes(snapshotDestino, snapshotOrigen);
  await Promise.all(
    amigos.map(async (amigo) => {
      amigo.apodo = (await obtenerApodo(amigo.uid)) || "Amigo sin apodo";
    })
  );
  return amigos;
}

async function renderAmigos() {
  const idRender = ++ultimoRenderAmigos;
  if (!miEnlace) {
    try {
      miEnlace = enlaceDeInvitacion(await asegurarEnlacePropio());
      miEnlaceEl.textContent = miEnlace;
    } catch (error) {
      console.error(error);
      miEnlaceEl.textContent = "No se pudo crear tu enlace. Recarga la app.";
    }
  }

  const consultaComoDestino = query(
    collection(db, "solicitudesAmistad"),
    where("para", "==", usuarioActual.uid)
  );
  const consultaComoOrigen = query(
    collection(db, "solicitudesAmistad"),
    where("de", "==", usuarioActual.uid)
  );

  const [snapshotDestino, snapshotOrigen] = await Promise.all([
    getDocs(consultaComoDestino),
    getDocs(consultaComoOrigen),
  ]);

  listaSolicitudes.innerHTML = "";
  const pendientesRecibidas = snapshotDestino.docs.filter(
    (d) => d.data().estado === "pendiente"
  );

  // Solo quedan solicitudes del sistema anterior de códigos; si no hay, no
  // se muestra la sección.
  seccionSolicitudes.hidden = pendientesRecibidas.length === 0;
  if (pendientesRecibidas.length > 0) {
    for (const docSnap of pendientesRecibidas) {
      const solicitud = docSnap.data();
      const apodo = await obtenerApodo(solicitud.de);
      if (idRender !== ultimoRenderAmigos) return;
      const li = document.createElement("li");

      const info = document.createElement("span");
      info.className = "info-clase";
      info.textContent = apodo || "Alguien";

      const acciones = document.createElement("span");
      acciones.className = "acciones-clase";

      const btnAceptar = document.createElement("button");
      btnAceptar.className = "btn-aceptar";
      btnAceptar.textContent = "Aceptar";
      btnAceptar.addEventListener("click", () => responderSolicitud(docSnap.id, "aceptada"));

      const btnRechazar = document.createElement("button");
      btnRechazar.className = "btn-rechazar";
      btnRechazar.textContent = "Rechazar";
      btnRechazar.addEventListener("click", () => responderSolicitud(docSnap.id, "rechazada"));

      acciones.appendChild(btnAceptar);
      acciones.appendChild(btnRechazar);
      li.appendChild(info);
      li.appendChild(acciones);
      listaSolicitudes.appendChild(li);
    }
  }

  const amigosAceptados = amigosDesdeSolicitudes(snapshotDestino, snapshotOrigen);
  const [datos, bloqueados] = await Promise.all([
    Promise.all(
      amigosAceptados.map(async (amigo) => {
        const [estado, perfil, clasesAmigo] = await Promise.all([
          obtenerEstadoAmigo(amigo.uid),
          obtenerPerfil(amigo.uid),
          obtenerHorarioDeAmigo(amigo.uid),
        ]);
        return { uid: amigo.uid, nombre: perfil.apodo || "Amigo sin apodo", estado, clasesAmigo, avatar: perfil.avatar };
      })
    ),
    sincronizarPermitidos(amigosAceptados.map((a) => a.uid)),
  ]);

  // Si mientras cargábamos arrancó otro renderAmigos (ej. tocaste la pestaña
  // dos veces), este se descarta: antes ambos pintaban y salían repetidos.
  if (idRender !== ultimoRenderAmigos) return;
  datosAmigos = datos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  misBloqueados = bloqueados;
  pintarListasAmigos();
}

function pintarListasAmigos() {
  const visibles = datosAmigos.filter((a) => !misBloqueados.has(a.uid));
  const ocultos = datosAmigos.filter((a) => misBloqueados.has(a.uid));
  const busqueda = textoBusqueda(buscarAmigos.value);
  const coincide = (a) => !busqueda || textoBusqueda(a.nombre).includes(busqueda);
  const visiblesFiltrados = visibles.filter(coincide);
  const ocultosFiltrados = ocultos.filter(coincide);

  listaAmigos.replaceChildren(...visiblesFiltrados.map((a) => tarjetaAmigo(a)));
  listaBloqueados.replaceChildren(...ocultosFiltrados.map((a) => tarjetaAmigo(a)));
  // Sin nadie a quién seleccionar en esta pestaña, el botón no aplica.
  btnSeleccionarAmigos.hidden = !modoSeleccion && !(viendoBloqueados ? ocultos : visibles).length;
  buscarAmigos.hidden = datosAmigos.length === 0;

  if (!visibles.length) {
    mensajeVacio(
      listaAmigos,
      datosAmigos.length ? "Tienes a todos tus amigos bloqueados." : "Todavía no tienes amigos agregados."
    );
  } else if (!visiblesFiltrados.length) {
    mensajeVacio(listaAmigos, "Ningún amigo con ese apodo.");
  }
  if (!ocultos.length) {
    mensajeVacio(listaBloqueados, "No has bloqueado a nadie: todos tus amigos ven tu horario.");
  } else if (!ocultosFiltrados.length) {
    mensajeVacio(listaBloqueados, "Ningún bloqueado con ese apodo.");
  }

  contadorAmigos.textContent = visibles.length ? `(${visibles.length})` : "";
  contadorBloqueados.textContent = ocultos.length ? `(${ocultos.length})` : "";
}

const COLORES_AVATAR = ["#7c5cff", "#ff5ca8", "#2f7bff", "#12b886", "#ff7a1a", "#14a8d6", "#b65cf5", "#e8a200"];

// Tarjeta de un amigo: quién es, cómo está y "Ver horario". En modo
// Seleccionar, tocar la tarjeta la marca (y se oculta "Ver horario").
function tarjetaAmigo({ uid, nombre, estado, clasesAmigo, avatar: avatarId }) {
  const li = document.createElement("li");
  li.className = "tarjeta-amigo";
  if (modoSeleccion) {
    li.classList.add("tarjeta-seleccionable");
    li.classList.toggle("tarjeta-seleccionada", seleccionados.has(uid));
    li.addEventListener("click", () => {
      if (seleccionados.has(uid)) seleccionados.delete(uid);
      else seleccionados.add(uid);
      li.classList.toggle("tarjeta-seleccionada", seleccionados.has(uid));
      actualizarAccionesSeleccion();
    });
  }

  const cabecera = document.createElement("div");
  cabecera.className = "amigo-cabecera";

  const avatar = document.createElement("span");
  avatar.className = "amigo-avatar";
  const sumaLetras = [...uid].reduce((total, letra) => total + letra.charCodeAt(0), 0);
  avatar.style.background = COLORES_AVATAR[sumaLetras % COLORES_AVATAR.length];
  avatar.textContent = [...nombre.trim()][0]?.toUpperCase() || "?";
  if (avatarId) pintarAvatarEn(avatar, avatarId, nombre);

  const datos = document.createElement("span");
  datos.className = "amigo-datos";
  const nombreEl = document.createElement("strong");
  nombreEl.textContent = nombre;
  const estadoEl = document.createElement("small");
  estadoEl.className =
    estado === "Libre" ? "amigo-estado libre" : estado === "En clase" ? "amigo-estado en-clase" : "amigo-estado";
  estadoEl.textContent = estado === "Libre" || estado === "En clase" ? estado : "Sin datos";
  datos.append(nombreEl, estadoEl);

  cabecera.append(avatar, datos);

  if (modoSeleccion) {
    const marca = document.createElement("span");
    marca.className = "marca-seleccion";
    marca.setAttribute("aria-hidden", "true");
    cabecera.appendChild(marca);
  } else if (clasesAmigo) {
    const btnVer = document.createElement("button");
    btnVer.type = "button";
    btnVer.className = "btn-ver-horario";
    btnVer.textContent = "Ver horario";
    btnVer.addEventListener("click", () => abrirHorarioAmigo(nombre, clasesAmigo));
    cabecera.appendChild(btnVer);
  }

  li.appendChild(cabecera);
  return li;
}

// ---------- Compartir horario con los amigos ----------
// Por defecto todos tus amigos ven tu horario, menos los "bloqueados".
// Las reglas de Firestore leen "permitidos", así que la app lo mantiene
// al día: permitidos = amigos − bloqueados.

async function sincronizarPermitidos(uidsAmigos) {
  const referencia = doc(db, "horariosCompartidos", usuarioActual.uid);
  let bloqueados = new Set();
  let permitidosGuardados = [];
  try {
    const snapshot = await getDoc(referencia);
    if (snapshot.exists()) {
      bloqueados = new Set(snapshot.data().bloqueados || []);
      permitidosGuardados = snapshot.data().permitidos || [];
    }
  } catch (error) {
    console.error(error);
    return bloqueados;
  }

  const permitidos = uidsAmigos.filter((uid) => !bloqueados.has(uid)).sort();
  if (permitidos.join(",") !== [...permitidosGuardados].sort().join(",")) {
    try {
      await setDoc(referencia, { clases, permitidos }, { merge: true });
    } catch (error) {
      console.error("No se pudo actualizar quién ve tu horario:", error);
    }
  }
  return bloqueados;
}

// Al entrar: así un amigo nuevo puede ver tu horario sin que tengas
// que abrir la pestaña Amigos.
async function sincronizarPermitidosAlEntrar() {
  try {
    const amigos = await obtenerAmigos();
    await sincronizarPermitidos(amigos.map((a) => a.uid));
  } catch (error) {
    console.error(error);
  }
}

// Devuelve las clases del amigo solo si él te dio permiso;
// si no, Firestore niega la lectura y devolvemos null.
async function obtenerHorarioDeAmigo(uid) {
  try {
    const snapshot = await getDoc(doc(db, "horariosCompartidos", uid));
    return snapshot.exists() ? snapshot.data().clases || [] : null;
  } catch {
    return null;
  }
}

async function cambiarBloqueo(uids, bloquear) {
  if (!uids.length) return;
  const cuantos = uids.length === 1 ? "a este amigo" : `a estos ${uids.length} amigos`;
  if (bloquear && !confirm(`¿Bloquear ${cuantos}? Ya no podrán ver tu horario.`)) return;
  btnAccionSeleccion.disabled = true;
  try {
    await setDoc(
      doc(db, "horariosCompartidos", usuarioActual.uid),
      bloquear
        ? { clases, bloqueados: arrayUnion(...uids), permitidos: arrayRemove(...uids) }
        : { clases, bloqueados: arrayRemove(...uids), permitidos: arrayUnion(...uids) },
      { merge: true }
    );
    uids.forEach((uid) => (bloquear ? misBloqueados.add(uid) : misBloqueados.delete(uid)));
    cambiarModoSeleccion(false);
  } catch (error) {
    console.error(error);
    btnAccionSeleccion.disabled = false;
    alert(
      error.code === "permission-denied"
        ? "Firebase no dio permiso para guardar esto. Revisa que las reglas de 'horariosCompartidos' estén publicadas."
        : `No se pudo cambiar (${error.code || error.message}). Intenta de nuevo.`
    );
  }
}

const modalHorarioAmigo = document.getElementById("modal-horario-amigo");
const tituloHorarioAmigo = document.getElementById("titulo-horario-amigo");
const gridAmigo = document.getElementById("grid-amigo");
const agendaAmigo = document.getElementById("agenda-amigo");

function abrirHorarioAmigo(nombre, clasesAmigo) {
  tituloHorarioAmigo.textContent = `Horario de ${nombre}`;
  construirEsqueletoGrid(gridAmigo, clasesAmigo);
  pintarClasesEnGrid(gridAmigo, clasesAmigo, false);
  pintarAgendaMovil(agendaAmigo, clasesAmigo, false);
  modalHorarioAmigo.hidden = false;
}

document.getElementById("btn-cerrar-horario-amigo").addEventListener("click", () => {
  modalHorarioAmigo.hidden = true;
});

modalHorarioAmigo.addEventListener("click", (evento) => {
  if (evento.target === modalHorarioAmigo) modalHorarioAmigo.hidden = true;
});

// ---------- Cuentas (dividir gastos entre amigos) ----------
// Cada cuenta la crea quien pagó. El total se divide en partes iguales entre
// los amigos marcados (y quien pagó, si se incluye). El aviso a cada amigo
// lo manda el script de recordatorios (check-clases.js) en su siguiente
// revisión, porque las notificaciones solo se pueden enviar desde el servidor.

const formCuenta = document.getElementById("form-cuenta");
const cuentaDescripcion = document.getElementById("cuenta-descripcion");
const cuentaTotal = document.getElementById("cuenta-total");
const cuentaAmigosEl = document.getElementById("cuenta-amigos");
const cuentaIncluirme = document.getElementById("cuenta-incluirme");
const cuentaResumen = document.getElementById("cuenta-resumen");
const cuentaError = document.getElementById("cuenta-error");
const btnCrearCuenta = document.getElementById("btn-crear-cuenta");
const listaDebo = document.getElementById("lista-debo");
const listaMeDeben = document.getElementById("lista-me-deben");
const formatoPesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function pesos(valor) {
  return formatoPesos.format(valor);
}

function fechaCorta(milisegundos) {
  const fecha = new Date(milisegundos);
  return `${fecha.getDate()} ${MESES[fecha.getMonth()].slice(0, 3)}`;
}

function calcularDivision() {
  const total = totalCuenta();
  const participantes = [...cuentaAmigosEl.querySelectorAll("input:checked")].map((c) => c.value);
  const personas = participantes.length + (cuentaIncluirme.checked ? 1 : 0);
  if (!(total > 0) || participantes.length === 0) return null;
  return { total, participantes, personas, porPersona: Math.round(total / personas) };
}

function actualizarResumenCuenta() {
  const division = calcularDivision();
  cuentaResumen.hidden = !division;
  if (division) {
    cuentaResumen.textContent = `${pesos(division.total)} ÷ ${division.personas} ${
      division.personas === 1 ? "persona" : "personas"
    } = ${pesos(division.porPersona)} cada uno`;
  }
}

// El total se escribe en pesos colombianos: "$ 200.000" (sin centavos).
function totalCuenta() {
  return Number(cuentaTotal.value.replace(/\D/g, ""));
}

cuentaTotal.addEventListener("input", () => {
  const valor = totalCuenta();
  cuentaTotal.value = valor > 0 ? pesos(valor) : "";
  actualizarResumenCuenta();
});
cuentaIncluirme.addEventListener("change", actualizarResumenCuenta);
cuentaAmigosEl.addEventListener("change", actualizarResumenCuenta);

function mensajeVacio(lista, texto) {
  const vacio = document.createElement("li");
  vacio.className = "mensaje-vacio";
  vacio.textContent = texto;
  lista.appendChild(vacio);
}

// ¿Quiénes estaban?: lista desplegable con casillas y un buscador por apodo.
const selectorAmigos = document.getElementById("selector-amigos");
const cuentaAmigosBoton = document.getElementById("cuenta-amigos-boton");
const cuentaAmigosTexto = document.getElementById("cuenta-amigos-texto");
const cuentaAmigosPanel = document.getElementById("cuenta-amigos-panel");
const cuentaAmigosBuscar = document.getElementById("cuenta-amigos-buscar");
const cuentaAmigosSinResultados = document.getElementById("cuenta-amigos-sin-resultados");

// Sin tildes ni mayúsculas, para que "jose" encuentre a "José".
function textoBusqueda(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function abrirSelectorAmigos(abrir) {
  cuentaAmigosPanel.hidden = !abrir;
  cuentaAmigosBoton.setAttribute("aria-expanded", String(abrir));
  if (abrir) {
    cuentaAmigosBuscar.value = "";
    filtrarAmigosCuenta();
    cuentaAmigosBuscar.focus();
  }
}

function filtrarAmigosCuenta() {
  const busqueda = textoBusqueda(cuentaAmigosBuscar.value);
  let visibles = 0;
  cuentaAmigosEl.querySelectorAll("label").forEach((etiqueta) => {
    const coincide = etiqueta.dataset.apodo.includes(busqueda);
    etiqueta.hidden = !coincide;
    if (coincide) visibles++;
  });
  cuentaAmigosSinResultados.hidden = visibles > 0;
}

function actualizarTextoSelectorAmigos() {
  const nombres = [...cuentaAmigosEl.querySelectorAll("input:checked")].map(
    (c) => c.closest("label").textContent.trim()
  );
  if (nombres.length === 0) cuentaAmigosTexto.textContent = "Selecciona a tus amigos";
  else if (nombres.length <= 2) cuentaAmigosTexto.textContent = nombres.join(", ");
  else cuentaAmigosTexto.textContent = `${nombres.slice(0, 2).join(", ")} y ${nombres.length - 2} más`;
}

cuentaAmigosBoton.addEventListener("click", () => abrirSelectorAmigos(cuentaAmigosPanel.hidden));
cuentaAmigosBuscar.addEventListener("input", filtrarAmigosCuenta);
cuentaAmigosBuscar.addEventListener("keydown", (evento) => {
  // Enter marca al primero que aparece en vez de enviar el formulario.
  if (evento.key === "Enter") {
    evento.preventDefault();
    const primera = cuentaAmigosEl.querySelector("label:not([hidden]) input");
    if (primera && cuentaAmigosBuscar.value.trim()) {
      primera.checked = !primera.checked;
      primera.dispatchEvent(new Event("change", { bubbles: true }));
      cuentaAmigosBuscar.value = "";
      filtrarAmigosCuenta();
    }
  } else if (evento.key === "Escape") {
    abrirSelectorAmigos(false);
    cuentaAmigosBoton.focus();
  }
});
cuentaAmigosEl.addEventListener("change", actualizarTextoSelectorAmigos);
document.addEventListener("click", (evento) => {
  if (!cuentaAmigosPanel.hidden && !selectorAmigos.contains(evento.target)) abrirSelectorAmigos(false);
});

function pintarAmigosCuenta(amigos) {
  const marcadosAntes = new Set(
    [...cuentaAmigosEl.querySelectorAll("input:checked")].map((c) => c.value)
  );
  cuentaAmigosEl.innerHTML = "";

  if (amigos.length === 0) {
    abrirSelectorAmigos(false);
    cuentaAmigosBoton.disabled = true;
    cuentaAmigosTexto.textContent = "Agrega amigos en la pestaña Amigos para poder dividir cuentas.";
    return;
  }
  cuentaAmigosBoton.disabled = false;

  [...amigos]
    .sort((a, b) => a.apodo.localeCompare(b.apodo, "es"))
    .forEach((amigo) => {
      const etiqueta = document.createElement("label");
      etiqueta.className = "amigo-opcion";
      etiqueta.dataset.apodo = textoBusqueda(amigo.apodo);
      const casilla = document.createElement("input");
      casilla.type = "checkbox";
      casilla.value = amigo.uid;
      casilla.checked = marcadosAntes.has(amigo.uid);
      etiqueta.appendChild(casilla);
      etiqueta.appendChild(document.createTextNode(` ${amigo.apodo}`));
      cuentaAmigosEl.appendChild(etiqueta);
    });
  filtrarAmigosCuenta();
  actualizarTextoSelectorAmigos();
}

async function eliminarCuenta(idCuenta) {
  if (!confirm("¿Eliminar esta cuenta? Tus amigos dejarán de verla.")) return;
  try {
    await deleteDoc(doc(db, "cuentas", idCuenta));
  } catch (error) {
    console.error(error);
    alert("No se pudo eliminar. Intenta de nuevo.");
  }
  renderCuentas();
}

function botonAccion(texto, clase, alHacerClic) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = clase;
  boton.textContent = texto;
  boton.addEventListener("click", alHacerClic);
  return boton;
}

// Agrupa lo pendiente por amigo y lo cruza: lo que me debe por mis cuentas
// menos lo que yo le debo por las suyas. Solo queda la diferencia, y cada
// pareja va por separado, así que los demás siguen debiendo lo mismo.
function calcularPares(docsCreadas, docsDebo) {
  const miUid = usuarioActual.uid;
  const pares = {};
  const parDe = (uid) => (pares[uid] ||= { meDebe: [], leDebo: [] });
  const item = (docCuenta, uid) => {
    const cuenta = docCuenta.data();
    return {
      id: docCuenta.id,
      uid,
      monto: cuenta.porPersona,
      total: cuenta.total,
      personas: cuenta.personas,
      creada: cuenta.creada,
      descripcion: cuenta.descripcion,
      estado: cuenta.pagos?.[uid],
    };
  };

  // pagos[uid]: false = pendiente, "reportado" = quien debe dice que ya
  // pagó (falta que quien cobra lo confirme), true = pagado y confirmado.
  docsCreadas.forEach((docCuenta) => {
    const cuenta = docCuenta.data();
    (cuenta.participantes || []).forEach((uid) => {
      if (cuenta.pagos?.[uid] !== true) parDe(uid).meDebe.push(item(docCuenta, uid));
    });
  });

  docsDebo.forEach((docCuenta) => {
    const cuenta = docCuenta.data();
    if (cuenta.pagos?.[miUid] !== true) parDe(cuenta.creador).leDebo.push(item(docCuenta, miUid));
  });

  const suma = (lista) => lista.reduce((total, i) => total + i.monto, 0);
  Object.values(pares).forEach((par) => {
    par.neto = suma(par.meDebe) - suma(par.leDebo); // > 0: el amigo me debe
    const todos = [...par.meDebe, ...par.leDebo];
    par.reportado = todos.length > 0 && todos.every((i) => i.estado === "reportado");
  });
  return pares;
}

async function cambiarEstadoPar(par, estado) {
  await Promise.all(
    [...par.meDebe, ...par.leDebo].map(({ id, uid }) =>
      updateDoc(doc(db, "cuentas", id), { [`pagos.${uid}`]: estado })
    )
  );
}

// Lo usa quien cobra: da por pagadas todas las cuentas entre los dos.
async function saldarPar(apodo, par) {
  const pregunta =
    par.neto > 0
      ? `¿Confirmas que ${apodo} ya te pagó ${pesos(par.neto)}?`
      : `¿Dejar a paz y salvo las cuentas con ${apodo}?`;
  if (!confirm(`${pregunta}\n\nSe marcarán como pagadas todas las cuentas pendientes entre ustedes dos.`)) return;

  try {
    await cambiarEstadoPar(par, true);
  } catch (error) {
    console.error(error);
    alert("No se pudo marcar como pagado. Intenta de nuevo.");
  }
  renderCuentas();
}

// Lo usa quien debe: avisa que ya pagó y queda esperando la confirmación.
async function reportarPago(apodo, uidAmigo, par) {
  if (!confirm(`¿Ya le pagaste ${pesos(-par.neto)} a ${apodo}?\n\n${apodo} tendrá que confirmarlo en su app.`)) return;

  try {
    await cambiarEstadoPar(par, "reportado");
    avisarAlInstante("avisar-pago", { amigo: uidAmigo });
  } catch (error) {
    console.error(error);
    alert("No se pudo avisar el pago. Intenta de nuevo.");
  }
  renderCuentas();
}

async function rechazarPago(apodo, par) {
  if (!confirm(`¿${apodo} todavía no te ha pagado?\n\nLa deuda vuelve a quedar pendiente.`)) return;

  try {
    await cambiarEstadoPar(par, false);
  } catch (error) {
    console.error(error);
    alert("No se pudo cambiar. Intenta de nuevo.");
  }
  renderCuentas();
}

// Una línea con el monto final y, al tocar "Más info", el cálculo completo.
function pintarPersona(lista, uidAmigo, apodo, par) {
  const meDeben = par.neto >= 0;
  const li = document.createElement("li");
  li.className = "cuenta-item";

  const cabecera = document.createElement("div");
  cabecera.className = "cuenta-cabecera";
  const principal = document.createElement("strong");
  principal.className = "info-clase";
  const acciones = document.createElement("span");
  acciones.className = "acciones-clase";

  if (par.neto > 0 && par.reportado) {
    principal.textContent = `${apodo} dice que ya te pagó ${pesos(par.neto)}`;
    acciones.append(
      botonAccion("Confirmar", "btn-aceptar", () => saldarPar(apodo, par)),
      botonAccion("No me ha pagado", "btn-rechazar", () => rechazarPago(apodo, par))
    );
  } else if (par.neto > 0) {
    principal.textContent = `${apodo} te debe ${pesos(par.neto)}`;
    acciones.appendChild(botonAccion("Ya me pagó", "btn-aceptar", () => saldarPar(apodo, par)));
  } else if (par.neto < 0 && par.reportado) {
    principal.textContent = `Le debes ${pesos(-par.neto)} a ${apodo}`;
    const espera = document.createElement("span");
    espera.className = "estado-badge estado-desconocido";
    espera.textContent = "Esperando confirmación";
    acciones.appendChild(espera);
  } else if (par.neto < 0) {
    principal.textContent = `Le debes ${pesos(-par.neto)} a ${apodo}`;
    acciones.appendChild(
      botonAccion("Ya pagué", "btn-aceptar", () => reportarPago(apodo, uidAmigo, par))
    );
  } else {
    principal.textContent = `Con ${apodo} quedan a mano`;
    acciones.appendChild(botonAccion("Listo", "btn-aceptar", () => saldarPar(apodo, par)));
  }

  cabecera.append(principal, acciones);
  li.appendChild(cabecera);

  const masInfo = document.createElement("details");
  masInfo.className = "cuenta-mas-info";
  const resumen = document.createElement("summary");
  resumen.textContent = "Más info";
  masInfo.appendChild(resumen);

  const filaCalculo = (itemCuenta, esMia) => {
    const suma = esMia === meDeben; // lo que va a favor de quien cobra
    const fila = document.createElement("div");
    fila.className = "calculo-fila";

    const texto = document.createElement("span");
    const nombre = document.createElement("strong");
    nombre.textContent = `${itemCuenta.descripcion} · ${fechaCorta(itemCuenta.creada)}`;
    const explicacion = document.createElement("small");
    explicacion.className = "cuenta-detalle";
    explicacion.textContent = `${esMia ? "Pagaste" : `${apodo} pagó`} ${pesos(itemCuenta.total)} ÷ ${
      itemCuenta.personas
    } = ${pesos(itemCuenta.monto)} c/u`;
    texto.append(nombre, explicacion);
    if (esMia) {
      texto.appendChild(
        botonAccion("Eliminar cuenta", "btn-eliminar-mini", () => eliminarCuenta(itemCuenta.id))
      );
    }

    const monto = document.createElement("span");
    monto.className = suma ? "calculo-monto monto-mas" : "calculo-monto monto-menos";
    monto.textContent = `${suma ? "+" : "−"} ${pesos(itemCuenta.monto)}`;

    fila.append(texto, monto);
    masInfo.appendChild(fila);
  };

  // Primero lo que suma a favor de quien cobra, luego lo que se descuenta.
  const mias = [...par.meDebe].sort((a, b) => a.creada - b.creada);
  const suyas = [...par.leDebo].sort((a, b) => a.creada - b.creada);
  if (meDeben) {
    mias.forEach((i) => filaCalculo(i, true));
    suyas.forEach((i) => filaCalculo(i, false));
  } else {
    suyas.forEach((i) => filaCalculo(i, false));
    mias.forEach((i) => filaCalculo(i, true));
  }

  const total = document.createElement("div");
  total.className = "calculo-fila calculo-total";
  const etiquetaTotal = document.createElement("span");
  etiquetaTotal.textContent =
    par.neto > 0 ? `${apodo} te debe` : par.neto < 0 ? `Le debes a ${apodo}` : "Quedan a mano";
  const montoTotal = document.createElement("span");
  montoTotal.textContent = `= ${pesos(Math.abs(par.neto))}`;
  total.append(etiquetaTotal, montoTotal);
  masInfo.appendChild(total);

  li.appendChild(masInfo);
  lista.appendChild(li);
}

let ultimoRenderCuentas = 0;

async function renderCuentas() {
  // Igual que en Amigos: si arranca otro render mientras cargamos, este se
  // descarta para que no salgan personas repetidas.
  const idRender = ++ultimoRenderCuentas;
  const amigos = await obtenerAmigos();
  if (idRender !== ultimoRenderCuentas) return;
  pintarAmigosCuenta(amigos);
  actualizarResumenCuenta();

  const [snapshotCreadas, snapshotDebo] = await Promise.all([
    getDocs(query(collection(db, "cuentas"), where("creador", "==", usuarioActual.uid))),
    getDocs(query(collection(db, "cuentas"), where("participantes", "array-contains", usuarioActual.uid))),
  ]);

  const apodos = Object.fromEntries(amigos.map((a) => [a.uid, a.apodo]));
  const nombreDe = async (uid) => {
    if (!apodos[uid]) apodos[uid] = (await obtenerApodo(uid)) || "Alguien";
    return apodos[uid];
  };

  const pares = Object.entries(calcularPares(snapshotCreadas.docs, snapshotDebo.docs)).sort(
    ([, a], [, b]) => Math.abs(b.neto) - Math.abs(a.neto)
  );

  const nombres = await Promise.all(pares.map(([uid]) => nombreDe(uid)));
  if (idRender !== ultimoRenderCuentas) return;

  listaDebo.innerHTML = "";
  listaMeDeben.innerHTML = "";
  pares.forEach(([uid, par], i) => {
    pintarPersona(par.neto < 0 ? listaDebo : listaMeDeben, uid, nombres[i], par);
  });

  if (!listaDebo.children.length) mensajeVacio(listaDebo, "No le debes nada a nadie 🎉");
  if (!listaMeDeben.children.length) mensajeVacio(listaMeDeben, "Nadie te debe nada por ahora.");
}

// Servidor de avisos instantáneos (carpeta horario-avisos, en Cloudflare).
// Si falla, el script de GitHub manda el aviso en su siguiente revisión.
const URL_AVISOS = "https://horario-avisos.horario-avisos.workers.dev";

// ---------- Importar el horario desde el PDF de la universidad ----------
// Todo gratis:
// 1. Primero se lee en el celular (importar-local.js): PDF.js para los PDF
//    y OCR (Tesseract) para las capturas.
// 2. Si ahí no sale nada, o la persona toca "Leer con IA", se manda una
//    imagen del horario al servidor de avisos, que usa la IA gratis de
//    Cloudflare (tiene un cupo diario; si se acaba, no cobra, solo falla).
// La app muestra lo que encontró para revisarlo y solo agrega lo marcado.

const modalImportar = document.getElementById("modal-importar");
const inputHorario = document.getElementById("input-horario");
const importarError = document.getElementById("importar-error");
const importarResumen = document.getElementById("importar-resumen");
const importarAviso = document.getElementById("importar-aviso");
const listaImportar = document.getElementById("lista-importar");
const btnAgregarImportadas = document.getElementById("btn-agregar-importadas");
const importarReemplazarCaja = document.getElementById("importar-reemplazar-caja");
const importarReemplazar = document.getElementById("importar-reemplazar");
const btnLeerConIA = document.getElementById("btn-leer-con-ia");
const importarCargandoTitulo = document.getElementById("importar-cargando-titulo");
const importarCargandoDetalle = document.getElementById("importar-cargando-detalle");
const MAX_MB_IMPORTAR = 15;
const DIAS_CORTOS = { Lunes: "Lun", Martes: "Mar", Miércoles: "Mié", Jueves: "Jue", Viernes: "Vie", Sábado: "Sáb", Domingo: "Dom" };
let clasesImportadas = [];
let imagenParaIA = null; // función que saca la imagen del horario (solo si hace falta la IA)

function mostrarPasoImportar(paso) {
  ["inicio", "cargando", "revision"].forEach((nombre) => {
    document.getElementById(`importar-${nombre}`).hidden = nombre !== paso;
  });
}

function abrirImportar(error = "") {
  importarError.textContent = error;
  importarError.hidden = !error;
  mostrarPasoImportar("inicio");
  modalImportar.hidden = false;
}

function cerrarImportar() {
  if (!document.getElementById("importar-cargando").hidden) return; // no cortar a mitad de la lectura
  modalImportar.hidden = true;
  clasesImportadas = [];
}

document.getElementById("btn-abrir-importar").addEventListener("click", () => abrirImportar());
document.getElementById("btn-cerrar-importar").addEventListener("click", cerrarImportar);
modalImportar.addEventListener("click", (evento) => {
  if (evento.target === modalImportar) cerrarImportar();
});
document.getElementById("btn-otro-horario").addEventListener("click", () => abrirImportar());
document.getElementById("btn-elegir-horario").addEventListener("click", () => {
  inputHorario.value = "";
  inputHorario.click();
});

function mostrarCargandoImportar(titulo, detalle) {
  importarCargandoTitulo.textContent = titulo;
  importarCargandoDetalle.textContent = detalle;
  mostrarPasoImportar("cargando");
}

// Paso 2 (respaldo): la IA gratis de Cloudflare lee la imagen del horario.
async function leerConIA() {
  if (!imagenParaIA) return;
  mostrarCargandoImportar("Leyendo con IA…", "Puede tardar hasta un minuto. No cierres la app.");
  try {
    const datos = await imagenParaIA();
    const token = await usuarioActual.getIdToken();
    const respuesta = await fetch(`${URL_AVISOS}/importar-horario`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain", "X-Tipo-Archivo": "image/jpeg" },
      body: datos,
    });
    const resultado = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      abrirImportar(resultado.error || "No se pudo leer el horario. Intenta de nuevo.");
      return;
    }
    if (!resultado.clases?.length) {
      abrirImportar(resultado.aviso || "No encontramos clases. Prueba con otro PDF o una captura más clara.");
      return;
    }
    clasesImportadas = resultado.clases;
    pintarRevisionImportar(resultado.aviso, false);
  } catch (error) {
    console.error(error);
    abrirImportar("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
  }
}

btnLeerConIA.addEventListener("click", leerConIA);

inputHorario.addEventListener("change", async () => {
  const archivo = inputHorario.files[0];
  if (!archivo) return;
  if (archivo.type !== "application/pdf" && !archivo.type.startsWith("image/")) {
    abrirImportar("Ese archivo no es un PDF ni una imagen.");
    return;
  }
  if (archivo.size > MAX_MB_IMPORTAR * 1024 * 1024) {
    abrirImportar(`El archivo pesa más de ${MAX_MB_IMPORTAR} MB. Prueba con una captura del horario.`);
    return;
  }

  // Paso 1: leerlo en el celular.
  const esPdf = archivo.type === "application/pdf";
  mostrarCargandoImportar(
    "Leyendo tu horario…",
    esPdf ? "Un momento…" : "La primera vez descarga el lector de imágenes (~10 MB)."
  );
  imagenParaIA = null;
  try {
    const { leerHorarioLocal } = await import("./importar-local.js?v=46");
    const resultado = await leerHorarioLocal(archivo, (porcentaje) => {
      importarCargandoDetalle.textContent = `Reconociendo el texto… ${porcentaje} %`;
    });
    imagenParaIA = resultado.imagenParaIA;
    if (resultado.clases.length) {
      clasesImportadas = resultado.clases;
      pintarRevisionImportar("", true);
      return;
    }
  } catch (error) {
    console.error("Lector local:", error);
    if (!imagenParaIA) {
      abrirImportar("No se pudo abrir ese archivo. Revisa tu internet (la primera vez descarga el lector) e intenta de nuevo.");
      return;
    }
  }
  // No salió nada en el celular: se intenta con la IA gratis.
  await leerConIA();
});

function claseYaExiste(nueva) {
  const clave = (c) => `${c.materia.trim().toLowerCase()}|${c.horaInicio}|${c.horaFin}|${[...c.dias].sort().join(",")}`;
  return clases.some((c) => clave(c) === clave(nueva));
}

function actualizarBotonImportar() {
  const marcadas = listaImportar.querySelectorAll("input:checked").length;
  const verbo = importarReemplazar.checked ? "Reemplazar con" : "Agregar";
  btnAgregarImportadas.textContent = `${verbo} ${marcadas} ${marcadas === 1 ? "clase" : "clases"}`;
  btnAgregarImportadas.disabled = marcadas === 0;
}

// Al reemplazar, las "repetidas" también cuentan (el horario viejo se borra).
importarReemplazar.addEventListener("change", () => {
  if (importarReemplazar.checked) {
    listaImportar.querySelectorAll("input").forEach((casilla) => (casilla.checked = true));
  }
  actualizarBotonImportar();
});

// leidoEnCelular: si vino del lector del celular, se ofrece "Leer con IA"
// por si algo salió mal.
function pintarRevisionImportar(aviso, leidoEnCelular) {
  btnLeerConIA.hidden = !leidoEnCelular || !imagenParaIA;
  listaImportar.innerHTML = "";
  clasesImportadas.forEach((clase, i) => {
    const repetida = claseYaExiste(clase);
    const fila = document.createElement("li");
    const etiqueta = document.createElement("label");
    etiqueta.className = "importar-clase";

    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.value = String(i);
    casilla.checked = !repetida;
    casilla.addEventListener("change", actualizarBotonImportar);

    const datos = document.createElement("span");
    datos.className = "importar-clase-datos";
    const materia = document.createElement("strong");
    materia.textContent = clase.materia;
    const cuando = document.createElement("small");
    cuando.textContent = `${clase.dias.map((d) => DIAS_CORTOS[d] || d).join(", ")} · ${clase.horaInicio}–${clase.horaFin}`;
    datos.append(materia, cuando);
    const extra = [clase.aula, clase.profesor].filter(Boolean).join(" · ");
    if (extra || repetida) {
      const detalle = document.createElement("small");
      detalle.textContent = repetida ? "Ya está en tu horario" : extra;
      datos.appendChild(detalle);
    }

    etiqueta.append(casilla, datos);
    fila.appendChild(etiqueta);
    listaImportar.appendChild(fila);
  });

  const n = clasesImportadas.length;
  importarResumen.textContent = `Encontramos ${n} ${n === 1 ? "clase" : "clases"}. Desmarca las que no quieras; después puedes editar cualquiera tocándola.`;
  importarAviso.textContent = aviso || "";
  importarAviso.hidden = !aviso;
  // Solo tiene sentido reemplazar si ya hay un horario.
  importarReemplazar.checked = false;
  importarReemplazarCaja.hidden = clases.length === 0;
  actualizarBotonImportar();
  mostrarPasoImportar("revision");
}

btnAgregarImportadas.addEventListener("click", () => {
  const elegidas = [...listaImportar.querySelectorAll("input:checked")].map((c) => clasesImportadas[Number(c.value)]);
  if (!elegidas.length) return;
  const reemplazar = importarReemplazar.checked && clases.length > 0;
  if (reemplazar && !confirm(`¿Borrar tus ${clases.length} clases actuales y dejar solo las ${elegidas.length} importadas?`)) {
    return;
  }
  if (reemplazar) {
    cancelarEdicion();
    clases.length = 0; // mismo arreglo: el resto de la app lo sigue usando
  }
  const base = Date.now();
  elegidas.forEach((clase, i) => {
    clases.push({
      id: String(base + i),
      materia: clase.materia,
      dias: clase.dias,
      horaInicio: clase.horaInicio,
      horaFin: clase.horaFin,
      aula: clase.aula || "",
      profesor: clase.profesor || "",
    });
  });
  guardarDatos();
  render();
  modalImportar.hidden = true;
  clasesImportadas = [];
  alert(
    reemplazar
      ? `¡Listo! Tu horario ahora tiene ${elegidas.length} ${elegidas.length === 1 ? "clase" : "clases"}.`
      : `¡Listo! Agregamos ${elegidas.length} ${elegidas.length === 1 ? "clase" : "clases"} a tu horario.`
  );
});

// ruta: "avisar-cuenta" ({ idCuenta }) o "avisar-pago" ({ amigo }).
async function avisarAlInstante(ruta, datos) {
  try {
    const token = await usuarioActual.getIdToken();
    await fetch(`${URL_AVISOS}/${ruta}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
  } catch (error) {
    console.error("Aviso instantáneo falló (llegará en la próxima revisión):", error);
  }
}

formCuenta.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  cuentaError.hidden = true;

  const division = calcularDivision();
  if (!division) {
    cuentaError.textContent = "Escribe cuánto pagaste y marca al menos un amigo.";
    cuentaError.hidden = false;
    return;
  }

  btnCrearCuenta.disabled = true;
  try {
    const nuevaCuenta = await addDoc(collection(db, "cuentas"), {
      creador: usuarioActual.uid,
      descripcion: cuentaDescripcion.value.trim(),
      total: division.total,
      personas: division.personas,
      porPersona: division.porPersona,
      participantes: division.participantes,
      pagos: Object.fromEntries(division.participantes.map((uid) => [uid, false])),
      notificado: false,
      creada: Date.now(),
    });
    avisarAlInstante("avisar-cuenta", { idCuenta: nuevaCuenta.id });
    formCuenta.reset();
    cuentaAmigosEl.querySelectorAll("input").forEach((c) => (c.checked = false));
    actualizarTextoSelectorAmigos();
    abrirSelectorAmigos(false);
    cuentaResumen.hidden = true;
    alert(`¡Listo! Cada uno te debe ${pesos(division.porPersona)}. Ya les llega el aviso.`);
    renderCuentas();
  } catch (error) {
    console.error(error);
    cuentaError.textContent =
      error.code === "permission-denied"
        ? "Firebase no dio permiso. Revisa que las reglas de 'cuentas' estén publicadas."
        : "Ocurrió un error, intenta de nuevo.";
    cuentaError.hidden = false;
  } finally {
    btnCrearCuenta.disabled = false;
  }
});

// ---------- Fotos instantáneas (duran 10 minutos) ----------
// Se guardan comprimidas dentro de Firestore (colección "fotos"), visibles
// solo para los amigos del autor. La app oculta las vencidas y
// check-clases.js las borra en su siguiente revisión.

const DURACION_FOTO = 10 * 60 * 1000;
const barraFotos = document.getElementById("barra-fotos");
const inputFoto = document.getElementById("input-foto");
const modalFotoSalida = document.getElementById("modal-foto-salida");
const modalFotoPreview = document.getElementById("modal-foto-preview");
const imgFotoPreview = document.getElementById("img-foto-preview");
const textoFoto = document.getElementById("texto-foto");
const btnPublicarFoto = document.getElementById("btn-publicar-foto");
const visorFoto = document.getElementById("visor-foto");
const visorImagen = document.getElementById("visor-imagen");
const visorNombre = document.getElementById("visor-nombre");
const visorTiempo = document.getElementById("visor-tiempo");
const visorTexto = document.getElementById("visor-texto");
const visorBorrar = document.getElementById("visor-borrar");
const visorBarra = document.getElementById("visor-barra");
const visorReaccion = document.getElementById("visor-reaccion");
const visorLike = document.getElementById("visor-like");
const visorComentario = document.getElementById("visor-comentario");
const visorEnviar = document.getElementById("visor-enviar");
const visorYaComentaste = document.getElementById("visor-ya-comentaste");
const visorVistas = document.getElementById("visor-vistas");
const visorPanelVistas = document.getElementById("visor-panel-vistas");
const visorListaVistas = document.getElementById("visor-lista-vistas");

let fotoLista = null; // foto comprimida esperando a publicarse
let temporizadorFotos = null;

function abrirCamara() {
  inputFoto.value = "";
  inputFoto.click();
}

function cargarImagen(archivo) {
  return new Promise((listo, fallo) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      URL.revokeObjectURL(url);
      listo(imagen);
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      fallo(new Error("No se pudo leer la foto"));
    };
    imagen.src = url;
  });
}

// Reduce la foto a 1080 px y la comprime hasta que quepa en un documento
// de Firestore (límite 1 MB; dejamos margen).
async function comprimirFoto(archivo) {
  const imagen = await cargarImagen(archivo);
  const escala = Math.min(1, 1080 / Math.max(imagen.width, imagen.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(imagen.width * escala);
  canvas.height = Math.round(imagen.height * escala);
  canvas.getContext("2d").drawImage(imagen, 0, 0, canvas.width, canvas.height);

  for (const calidad of [0.75, 0.6, 0.45, 0.3]) {
    const datos = canvas.toDataURL("image/jpeg", calidad);
    if (datos.length < 800000) return datos;
  }
  throw new Error("La foto es demasiado pesada");
}

inputFoto.addEventListener("change", async () => {
  const archivo = inputFoto.files[0];
  if (!archivo) return;
  try {
    fotoLista = await comprimirFoto(archivo);
    imgFotoPreview.src = fotoLista;
    textoFoto.value = "";
    modalFotoSalida.hidden = true;
    modalFotoPreview.hidden = false;
  } catch (error) {
    console.error(error);
    alert("No se pudo procesar la foto. Intenta con otra.");
  }
});

document.getElementById("btn-otra-foto").addEventListener("click", abrirCamara);
document.getElementById("btn-cerrar-foto-preview").addEventListener("click", () => {
  modalFotoPreview.hidden = true;
  fotoLista = null;
});
document.getElementById("btn-foto-salida").addEventListener("click", abrirCamara);
document.getElementById("btn-foto-salida-luego").addEventListener("click", () => {
  modalFotoSalida.hidden = true;
});

btnPublicarFoto.addEventListener("click", async () => {
  if (!fotoLista) return;
  btnPublicarFoto.disabled = true;
  btnPublicarFoto.textContent = "Compartiendo…";
  try {
    const amigos = await obtenerAmigos();
    if (amigos.length === 0) {
      alert("Primero agrega amigos (pestaña Amigos) para que puedan ver tus fotos.");
      return;
    }
    const ahora = Date.now();
    const nuevaFoto = await addDoc(collection(db, "fotos"), {
      autor: usuarioActual.uid,
      imagen: fotoLista,
      texto: textoFoto.value.trim(),
      creada: ahora,
      expira: ahora + DURACION_FOTO,
      visibles: amigos.map((a) => a.uid),
      notificado: false,
    });
    avisarAlInstante("avisar-foto", { idFoto: nuevaFoto.id });
    modalFotoPreview.hidden = true;
    fotoLista = null;
    cargarFotos();
  } catch (error) {
    console.error(error);
    alert(
      error.code === "permission-denied"
        ? "Firebase no dio permiso. Revisa que las reglas de 'fotos' estén publicadas."
        : "No se pudo compartir la foto. Intenta de nuevo."
    );
  } finally {
    btnPublicarFoto.disabled = false;
    btnPublicarFoto.textContent = "Compartir";
  }
});

function minutosRestantes(foto) {
  return Math.max(1, Math.ceil((foto.expira - Date.now()) / 60000));
}

function burbujaFoto({ nombre, miniatura, alTocar, esBoton = false }) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = esBoton ? "foto-burbuja foto-burbuja-subir" : "foto-burbuja";
  const anillo = document.createElement("span");
  anillo.className = "foto-anillo";
  const mini = document.createElement("span");
  mini.className = "foto-mini";
  if (miniatura) mini.style.backgroundImage = `url("${miniatura}")`;
  // Botón "Subir foto": un + de línea en vez del emoji de cámara.
  else mini.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  anillo.appendChild(mini);
  const etiqueta = document.createElement("span");
  etiqueta.className = "foto-nombre";
  etiqueta.textContent = nombre;
  boton.append(anillo, etiqueta);
  boton.addEventListener("click", alTocar);
  return boton;
}

let ultimaCargaFotos = 0;

async function cargarFotos() {
  if (!usuarioActual) return;
  const idCarga = ++ultimaCargaFotos;
  const miUid = usuarioActual.uid;
  let documentos = [];
  try {
    const [mias, deAmigos] = await Promise.all([
      getDocs(query(collection(db, "fotos"), where("autor", "==", miUid))),
      getDocs(query(collection(db, "fotos"), where("visibles", "array-contains", miUid))),
    ]);
    documentos = [...mias.docs, ...deAmigos.docs];
  } catch (error) {
    console.error("No se pudieron cargar las fotos:", error);
  }

  const ahora = Date.now();
  const porAutor = new Map();
  documentos.forEach((d) => {
    const foto = { id: d.id, ...d.data() };
    if (foto.expira <= ahora) return;
    if (!porAutor.has(foto.autor)) porAutor.set(foto.autor, []);
    porAutor.get(foto.autor).push(foto);
  });
  porAutor.forEach((fotos) => fotos.sort((a, b) => a.creada - b.creada));

  const autores = [...porAutor.keys()].sort((a, b) => (a === miUid ? -1 : b === miUid ? 1 : 0));
  const nombresAutores = await Promise.all(
    autores.map(async (autor) => (autor === miUid ? "Tú" : (await obtenerApodo(autor)) || "Amigo"))
  );
  // Si arrancó otra carga mientras tanto, esa pinta (así no se duplican).
  if (idCarga !== ultimaCargaFotos) return;

  barraFotos.innerHTML = "";
  barraFotos.appendChild(burbujaFoto({ nombre: "Subir foto", alTocar: abrirCamara, esBoton: true }));

  autores.forEach((autor, i) => {
    const fotos = porAutor.get(autor);
    barraFotos.appendChild(
      burbujaFoto({
        nombre: nombresAutores[i],
        miniatura: fotos[fotos.length - 1].imagen,
        alTocar: () => abrirVisor(fotos, nombresAutores[i], autor === miUid),
      })
    );
  });
}

// ---------- Visor en pantalla completa ----------

let visorFotos = [];
let visorIndice = 0;
let visorTemporizador = null;
let visorEsMia = false;
let visorNombreAutor = "";
const SEGUNDOS_POR_FOTO = 6;

function mostrarFotoVisor() {
  const foto = visorFotos[visorIndice];
  if (!foto || foto.expira <= Date.now()) {
    cerrarVisor();
    return;
  }
  visorImagen.src = foto.imagen;
  visorTexto.textContent = foto.texto || "";
  visorTexto.hidden = !foto.texto;
  const hace = Math.max(0, Math.floor((Date.now() - foto.creada) / 60000));
  visorTiempo.textContent = `${hace === 0 ? "ahora" : `hace ${hace} min`} · se borra en ${minutosRestantes(foto)} min`;

  // Reinicia la barrita de progreso.
  visorBarra.style.transition = "none";
  visorBarra.style.width = "0%";
  requestAnimationFrame(() => {
    visorBarra.style.transition = `width ${SEGUNDOS_POR_FOTO}s linear`;
    visorBarra.style.width = "100%";
  });
  clearTimeout(visorTemporizador);
  visorTemporizador = setTimeout(siguienteFoto, SEGUNDOS_POR_FOTO * 1000);

  visorPanelVistas.hidden = true;
  if (visorEsMia) {
    visorReaccion.hidden = true;
    visorYaComentaste.hidden = true;
    visorVistas.hidden = false;
    pintarResumenVistas(foto);
  } else {
    visorVistas.hidden = true;
    registrarVista(foto);
    cargarMiReaccion(foto);
  }
}

function abrirVisor(fotos, nombre, esMia) {
  visorFotos = fotos;
  visorIndice = 0;
  visorEsMia = esMia;
  visorNombreAutor = nombre;
  visorNombre.textContent = nombre;
  visorBorrar.hidden = !esMia;
  visorFoto.hidden = false;
  chatsDeMisFotos = [];
  if (esMia) {
    obtenerMisChats().then((chats) => {
      chatsDeMisFotos = chats;
      if (!visorFoto.hidden && visorFotos[visorIndice]) pintarResumenVistas(visorFotos[visorIndice]);
    });
  }
  mostrarFotoVisor();
}

// Congela la barrita y el paso automático (mientras escribes o miras
// quién vio la foto). Tocar la foto sigue pasando a la siguiente.
function pausarVisor() {
  clearTimeout(visorTemporizador);
  visorBarra.style.width = getComputedStyle(visorBarra).width;
  visorBarra.style.transition = "none";
}

function siguienteFoto() {
  visorIndice++;
  if (visorIndice >= visorFotos.length) cerrarVisor();
  else mostrarFotoVisor();
}

function cerrarVisor() {
  clearTimeout(visorTemporizador);
  visorFoto.hidden = true;
  visorPanelVistas.hidden = true;
  visorComentario.blur();
  visorImagen.removeAttribute("src");
}

visorImagen.addEventListener("click", siguienteFoto);
document.getElementById("visor-cerrar").addEventListener("click", cerrarVisor);
visorBorrar.addEventListener("click", async () => {
  const foto = visorFotos[visorIndice];
  if (!foto || !confirm("¿Borrar esta foto? Tus amigos dejarán de verla.")) return;
  try {
    await deleteDoc(doc(db, "fotos", foto.id));
  } catch (error) {
    console.error(error);
    alert("No se pudo borrar. Intenta de nuevo.");
  }
  cerrarVisor();
  cargarFotos();
});

// ---------- Reacciones a las fotos: vistas, likes y un comentario ----------
// Cada amigo tiene un documento chats/<foto>_<amigo> con su like, su
// comentario (uno solo) y la respuesta del autor (una sola). Guarda una
// miniatura para que el Chat conserve la foto cuando esta ya se borró.

let chatActual = null; // mi reacción a la foto que se ve en el visor
let guardandoReaccion = false;
let chatsDeMisFotos = [];

function idChat(idFoto, uidAmigo) {
  return `${idFoto}_${uidAmigo}`;
}

async function obtenerMisChats() {
  try {
    const snapshot = await getDocs(
      query(collection(db, "chats"), where("participantes", "array-contains", usuarioActual.uid))
    );
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("No se pudieron cargar los chats:", error);
    return [];
  }
}

function registrarVista(foto) {
  const miUid = usuarioActual.uid;
  if ((foto.vistas || []).includes(miUid)) return;
  foto.vistas = [...(foto.vistas || []), miUid];
  updateDoc(doc(db, "fotos", foto.id), { vistas: arrayUnion(miUid) }).catch((error) =>
    console.error("No se pudo marcar la foto como vista:", error)
  );
}

// Versión pequeñita de la foto para el Chat (unos pocos KB).
async function miniaturaDe(imagenDatos) {
  const imagen = new Image();
  imagen.src = imagenDatos;
  await imagen.decode();
  const escala = Math.min(1, 200 / Math.max(imagen.width, imagen.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(imagen.width * escala);
  canvas.height = Math.round(imagen.height * escala);
  canvas.getContext("2d").drawImage(imagen, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.6);
}

async function cargarMiReaccion(foto) {
  chatActual = null;
  visorComentario.value = "";
  pintarMiReaccion();
  try {
    const snapshot = await getDoc(doc(db, "chats", idChat(foto.id, usuarioActual.uid)));
    if (visorFotos[visorIndice]?.id !== foto.id) return; // ya pasó a otra foto
    chatActual = snapshot.exists() ? snapshot.data() : null;
    pintarMiReaccion();
  } catch (error) {
    console.error(error);
  }
}

function pintarMiReaccion() {
  const yaComento = Boolean(chatActual?.comentario);
  visorReaccion.hidden = false;
  visorLike.textContent = chatActual?.like ? "❤️" : "🤍";
  visorLike.classList.toggle("visor-like-activo", Boolean(chatActual?.like));
  visorComentario.hidden = yaComento;
  visorEnviar.hidden = yaComento;
  visorComentario.placeholder = `Responder a ${visorNombreAutor}…`;
  visorYaComentaste.hidden = !yaComento;
  if (yaComento) {
    visorYaComentaste.textContent = chatActual.respuesta
      ? `Tú: ${chatActual.comentario}\n${visorNombreAutor}: ${chatActual.respuesta}`
      : `Tú: ${chatActual.comentario}`;
  }
}

async function guardarReaccion(cambios) {
  const foto = visorFotos[visorIndice];
  if (!foto || guardandoReaccion) return false;
  guardandoReaccion = true;
  const miUid = usuarioActual.uid;
  const referencia = doc(db, "chats", idChat(foto.id, miUid));
  const ahora = Date.now();
  try {
    if (!chatActual) {
      const nuevo = {
        foto: foto.id,
        autor: foto.autor,
        amigo: miUid,
        participantes: [foto.autor, miUid],
        miniatura: await miniaturaDe(foto.imagen),
        textoFoto: foto.texto || "",
        like: false,
        comentario: null,
        respuesta: null,
        creada: ahora,
        actualizada: ahora,
        ultimoDe: miUid,
        ...cambios,
      };
      await setDoc(referencia, nuevo);
      chatActual = nuevo;
    } else {
      await updateDoc(referencia, { ...cambios, actualizada: ahora, ultimoDe: miUid });
      Object.assign(chatActual, cambios);
    }
    return true;
  } catch (error) {
    console.error(error);
    alert(
      error.code === "permission-denied"
        ? "Firebase no dio permiso. Revisa que las reglas de 'chats' estén publicadas."
        : "No se pudo guardar. Intenta de nuevo."
    );
    return false;
  } finally {
    guardandoReaccion = false;
  }
}

visorLike.addEventListener("click", async () => {
  const antes = chatActual?.like || false;
  visorLike.textContent = antes ? "🤍" : "❤️";
  const foto = visorFotos[visorIndice];
  if (!(await guardarReaccion({ like: !antes }))) visorLike.textContent = antes ? "❤️" : "🤍";
  else if (!antes && foto) avisarAlInstante("avisar-chat", { idChat: idChat(foto.id, usuarioActual.uid), accion: "like" });
  pintarMiReaccion();
});

visorComentario.addEventListener("focus", pausarVisor);

visorReaccion.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const texto = visorComentario.value.trim();
  if (!texto || chatActual?.comentario) return;
  visorEnviar.disabled = true;
  const foto = visorFotos[visorIndice];
  if (await guardarReaccion({ comentario: texto })) {
    visorComentario.blur();
    avisarAlInstante("avisar-chat", { idChat: idChat(foto.id, usuarioActual.uid) });
    refrescarChat(); // aparece en la pestaña Chat
  }
  visorEnviar.disabled = false;
  pintarMiReaccion();
});

function pintarResumenVistas(foto) {
  const likes = chatsDeMisFotos.filter((c) => c.foto === foto.id && c.like).length;
  const vistas = (foto.vistas || []).length;
  visorVistas.textContent = `${vistas} ${vistas === 1 ? "vista" : "vistas"} · ${likes} me gusta`;
}

visorVistas.addEventListener("click", async () => {
  const foto = visorFotos[visorIndice];
  if (!foto) return;
  pausarVisor();
  visorListaVistas.innerHTML = "";
  mensajeVacio(visorListaVistas, "Cargando…");
  visorPanelVistas.hidden = false;

  // Datos frescos: quizá alguien la vio después de que cargó la barra.
  const [snapshot, chats] = await Promise.all([
    getDoc(doc(db, "fotos", foto.id)).catch(() => null),
    obtenerMisChats(),
  ]);
  chatsDeMisFotos = chats;
  if (snapshot?.exists()) foto.vistas = snapshot.data().vistas || [];
  pintarResumenVistas(foto);

  const reaccionDe = Object.fromEntries(chats.filter((c) => c.foto === foto.id).map((c) => [c.amigo, c]));
  const uids = [...new Set([...(foto.vistas || []), ...Object.keys(reaccionDe)])];
  const nombres = await Promise.all(uids.map(async (uid) => (await obtenerApodo(uid)) || "Amigo"));

  visorListaVistas.innerHTML = "";
  if (!uids.length) mensajeVacio(visorListaVistas, "Nadie la ha visto todavía");
  uids.forEach((uid, i) => {
    const reaccion = reaccionDe[uid];
    const li = document.createElement("li");
    const nombre = document.createElement("strong");
    nombre.textContent = `${nombres[i]}${reaccion?.like ? " ❤️" : ""}`;
    li.appendChild(nombre);
    if (reaccion?.comentario) {
      const comentario = document.createElement("span");
      comentario.textContent = `“${reaccion.comentario}”`;
      li.appendChild(comentario);
    }
    visorListaVistas.appendChild(li);
  });
});

document.getElementById("visor-panel-cerrar").addEventListener("click", () => {
  visorPanelVistas.hidden = true;
});

// ---------- Pestaña Chat (los mensajes duran 30 min) ----------
// Los me gusta, comentarios y respuestas de las fotos llegan a la pestaña
// Chat de la barra de abajo, agrupados por persona como una bandeja de
// entrada: se ve solo el apodo y al tocarlo se abre la conversación con
// todo lo de esa persona (de tus fotos y de las suyas). Cada cosa dura
// 30 minutos desde el último movimiento (check-clases.js la borra).
// El número rojo en el ícono cuenta las personas con algo sin leer.

const DURACION_CHAT = 30 * 60 * 1000;
const vistaChat = document.getElementById("vista-chat");
const chatBandeja = document.getElementById("chat-bandeja");
const listaChats = document.getElementById("lista-chats");
const chatConversacion = document.getElementById("chat-conversacion");
const chatConversacionAvatar = document.getElementById("chat-conversacion-avatar");
const chatConversacionNombre = document.getElementById("chat-conversacion-nombre");
const listaConversacion = document.getElementById("lista-conversacion");
const chatSinLeer = document.getElementById("chat-sin-leer");
let ultimoRenderChat = 0;
let conversacionAbierta = null; // uid de la persona, o null = bandeja

document.getElementById("btn-volver-chat").addEventListener("click", () => {
  conversacionAbierta = null;
  refrescarChat();
});

function chatTieneAlgo(chat) {
  return chat.like || chat.comentario;
}

function chatVigente(chat) {
  return chatTieneAlgo(chat) && chat.actualizada + DURACION_CHAT > Date.now();
}

// Si la foto es mía: cualquier me gusta o comentario. Si no: solo cuando
// comenté (mi propio me gusta no necesita conversación).
function chatsParaMi(chats) {
  const miUid = usuarioActual.uid;
  return chats
    .filter((c) => chatVigente(c) && (c.autor === miUid || c.comentario))
    .sort((a, b) => b.actualizada - a.actualizada);
}

function otroDelChat(chat) {
  return chat.autor === usuarioActual.uid ? chat.amigo : chat.autor;
}

// Junta los chats por persona: [{ uid, chats (más reciente primero), actualizada }]
function agruparPorPersona(chats) {
  const grupos = new Map();
  chats.forEach((c) => {
    const uid = otroDelChat(c);
    if (!grupos.has(uid)) grupos.set(uid, { uid, chats: [], actualizada: 0 });
    const grupo = grupos.get(uid);
    grupo.chats.push(c);
    grupo.actualizada = Math.max(grupo.actualizada, c.actualizada);
  });
  return [...grupos.values()].sort((a, b) => b.actualizada - a.actualizada);
}

// "Visto" por persona (en este celular): { uidDelOtro: milisegundos }
function claveChatVisto() {
  return `chatVistoPorPersona_${usuarioActual.uid}`;
}

function leerChatVisto() {
  try {
    return JSON.parse(localStorage.getItem(claveChatVisto())) || {};
  } catch {
    return {};
  }
}

function marcarPersonaVista(uidOtro) {
  const vistos = leerChatVisto();
  vistos[uidOtro] = Date.now();
  try {
    localStorage.setItem(claveChatVisto(), JSON.stringify(vistos));
  } catch {
    // Sin almacenamiento: el punto de "nuevo" simplemente no se recuerda.
  }
}

function grupoTieneNuevo(grupo, vistos) {
  const visto = vistos[grupo.uid] || 0;
  return grupo.chats.some((c) => c.ultimoDe !== usuarioActual.uid && c.actualizada > visto);
}

function pintarContadorChat(grupos) {
  const vistos = leerChatVisto();
  const nuevos = grupos.filter((g) => grupoTieneNuevo(g, vistos)).length;
  chatSinLeer.textContent = nuevos > 9 ? "9+" : String(nuevos);
  chatSinLeer.hidden = nuevos === 0;
}

function haceCuanto(milisegundos) {
  const minutos = Math.floor((Date.now() - milisegundos) / 60000);
  return minutos < 1 ? "ahora" : `hace ${minutos} min`;
}

// Texto corto de la fila: lo último que pasó con esa persona.
function vistaPreviaChat(chat) {
  const esMiFoto = chat.autor === usuarioActual.uid;
  if (chat.respuesta && chat.ultimoDe === chat.autor) return esMiFoto ? `Tú: ${chat.respuesta}` : chat.respuesta;
  if (chat.comentario) return esMiFoto ? chat.comentario : `Tú: ${chat.comentario}`;
  return esMiFoto ? "Le gustó tu foto" : "Te gustó su foto";
}

function avatarChat(uid, perfil) {
  const avatar = document.createElement("span");
  avatar.className = "amigo-avatar";
  const nombre = perfil.apodo || "Amigo";
  const sumaLetras = [...uid].reduce((total, letra) => total + letra.charCodeAt(0), 0);
  avatar.style.background = COLORES_AVATAR[sumaLetras % COLORES_AVATAR.length];
  avatar.textContent = [...nombre.trim()][0]?.toUpperCase() || "?";
  if (perfil.avatar) pintarAvatarEn(avatar, perfil.avatar, nombre);
  return avatar;
}

function filaPersona(grupo, perfil, nuevo) {
  const li = document.createElement("li");
  li.className = nuevo ? "chat-persona chat-persona-nueva" : "chat-persona";
  li.tabIndex = 0;

  const datos = document.createElement("span");
  datos.className = "chat-persona-datos";
  const nombre = document.createElement("strong");
  nombre.textContent = perfil.apodo || "Amigo";
  const previa = document.createElement("small");
  previa.textContent = vistaPreviaChat(grupo.chats[0]);
  datos.append(nombre, previa);

  const lado = document.createElement("span");
  lado.className = "chat-persona-lado";
  const cuando = document.createElement("small");
  cuando.textContent = haceCuanto(grupo.actualizada);
  lado.appendChild(cuando);
  if (nuevo) {
    const punto = document.createElement("span");
    punto.className = "chat-punto-nuevo";
    lado.appendChild(punto);
  }

  li.append(avatarChat(grupo.uid, perfil), datos, lado);
  const abrir = () => {
    conversacionAbierta = grupo.uid;
    refrescarChat();
  };
  li.addEventListener("click", abrir);
  li.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter") abrir();
  });
  return li;
}

// Trae los chats, actualiza el número rojo y, si la pestaña está abierta,
// pinta la bandeja o la conversación abierta (salvo que estés escribiendo).
async function refrescarChat() {
  if (!usuarioActual) return;
  const idRender = ++ultimoRenderChat;
  const grupos = agruparPorPersona(chatsParaMi(await obtenerMisChats()));
  if (idRender !== ultimoRenderChat) return;

  if (vistaChat.hidden) {
    pintarContadorChat(grupos);
    return;
  }
  if (vistaChat.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;

  const grupoAbierto = conversacionAbierta && grupos.find((g) => g.uid === conversacionAbierta);
  // Si la conversación ya se borró (pasaron los 30 min), vuelve a la bandeja.
  if (!grupoAbierto) conversacionAbierta = null;

  const perfiles = await Promise.all(
    (grupoAbierto ? [grupoAbierto] : grupos).map((g) => obtenerPerfil(g.uid))
  );
  if (idRender !== ultimoRenderChat) return;

  chatBandeja.hidden = Boolean(grupoAbierto);
  chatConversacion.hidden = !grupoAbierto;

  if (grupoAbierto) {
    const perfil = perfiles[0];
    const nombre = perfil.apodo || "Amigo";
    chatConversacionAvatar.replaceChildren(avatarChat(grupoAbierto.uid, perfil));
    chatConversacionNombre.textContent = nombre;
    // Dentro de la conversación: lo más viejo arriba, como un chat.
    const enOrden = [...grupoAbierto.chats].sort((a, b) => a.creada - b.creada);
    listaConversacion.replaceChildren(...enOrden.map((c) => tarjetaChat(c, nombre)));
    marcarPersonaVista(grupoAbierto.uid);
  } else {
    const vistos = leerChatVisto();
    listaChats.replaceChildren(...grupos.map((g, i) => filaPersona(g, perfiles[i], grupoTieneNuevo(g, vistos))));
    if (!grupos.length) {
      mensajeVacio(listaChats, "No hay mensajes. Aquí llegan los me gusta y comentarios de las fotos.");
    }
  }
  pintarContadorChat(grupos);
}

function burbujaChat(texto, mia) {
  const burbuja = document.createElement("p");
  burbuja.className = mia ? "chat-burbuja chat-burbuja-mia" : "chat-burbuja";
  burbuja.textContent = texto;
  return burbuja;
}

async function responderChat(chat, input, boton) {
  const texto = input.value.trim();
  if (!texto) return;
  boton.disabled = true;
  try {
    await updateDoc(doc(db, "chats", chat.id), {
      respuesta: texto,
      actualizada: Date.now(),
      ultimoDe: usuarioActual.uid,
    });
    avisarAlInstante("avisar-chat", { idChat: chat.id });
    input.blur();
    refrescarChat();
  } catch (error) {
    console.error(error);
    boton.disabled = false;
    alert("No se pudo enviar la respuesta. Intenta de nuevo.");
  }
}

function tarjetaChat(chat, nombreOtro) {
  const miUid = usuarioActual.uid;
  const esMiFoto = chat.autor === miUid;
  const li = document.createElement("li");
  li.className = "chat-item";

  const mini = document.createElement("img");
  mini.className = "chat-mini";
  mini.src = chat.miniatura;
  mini.alt = "";

  const cuerpo = document.createElement("div");
  cuerpo.className = "chat-cuerpo";

  const titulo = document.createElement("div");
  titulo.className = "chat-titulo";
  const quien = document.createElement("strong");
  quien.textContent = esMiFoto ? "Tu foto" : `Foto de ${nombreOtro}`;
  const cuando = document.createElement("small");
  const minutos = Math.max(1, Math.ceil((chat.actualizada + DURACION_CHAT - Date.now()) / 60000));
  cuando.textContent = `se borra en ${minutos} min`;
  titulo.append(quien, cuando);
  cuerpo.appendChild(titulo);

  if (chat.textoFoto) {
    const textoFoto = document.createElement("small");
    textoFoto.className = "chat-texto-foto";
    textoFoto.textContent = `“${chat.textoFoto}”`;
    cuerpo.appendChild(textoFoto);
  }
  if (chat.like) {
    const like = document.createElement("p");
    like.className = "chat-like";
    like.textContent = esMiFoto ? "❤️ Le gustó tu foto" : "❤️ Te gustó esta foto";
    cuerpo.appendChild(like);
  }
  if (chat.comentario) cuerpo.appendChild(burbujaChat(chat.comentario, !esMiFoto));
  if (chat.respuesta) cuerpo.appendChild(burbujaChat(chat.respuesta, esMiFoto));

  if (esMiFoto && chat.comentario && !chat.respuesta) {
    const form = document.createElement("form");
    form.className = "chat-responder";
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 200;
    input.placeholder = "Responder…";
    input.autocomplete = "off";
    const boton = document.createElement("button");
    boton.type = "submit";
    boton.textContent = "Responder";
    form.append(input, boton);
    form.addEventListener("submit", (evento) => {
      evento.preventDefault();
      responderChat(chat, input, boton);
    });
    cuerpo.appendChild(form);
  } else if (!esMiFoto && chat.comentario && !chat.respuesta) {
    const espera = document.createElement("small");
    espera.className = "chat-espera";
    espera.textContent = "Esperando su respuesta";
    cuerpo.appendChild(espera);
  }

  li.append(mini, cuerpo);
  return li;
}

function iniciarFotos() {
  cargarFotos();
  refrescarChat();
  clearInterval(temporizadorFotos);
  temporizadorFotos = setInterval(() => {
    cargarFotos();
    refrescarChat(); // llegan los nuevos y se van los de más de 30 min
  }, 60 * 1000);
}

function detenerFotos() {
  clearInterval(temporizadorFotos);
  barraFotos.innerHTML = "";
  listaChats.innerHTML = "";
  listaConversacion.innerHTML = "";
  conversacionAbierta = null;
  chatSinLeer.hidden = true;
  cerrarVisor();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && usuarioActual) {
    cargarFotos();
    refrescarChat();
  }
});

// Qué hacer cuando la app se abre desde una notificación (por la URL o
// por un mensaje del service worker si ya estaba abierta).
function manejarAccionDeNotificacion(url) {
  if (!url) return;
  if (url.includes("foto=1")) modalFotoSalida.hidden = false;
  if (url.includes("ver=fotos")) cargarFotos();
  if (url.includes("ver=chat")) document.getElementById("tab-chat").click();
}

let accionPendiente = null;
(function leerAccionDeLaUrl() {
  const parametros = new URLSearchParams(location.search);
  if (!parametros.has("foto") && !parametros.has("ver")) return;
  accionPendiente = parametros.has("foto") ? "foto=1" : parametros.get("ver") === "chat" ? "ver=chat" : "ver=fotos";
  parametros.delete("foto");
  parametros.delete("ver");
  const resto = parametros.toString();
  history.replaceState(null, "", location.pathname + (resto ? `?${resto}` : "") + location.hash);
})();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (evento) => {
    if (evento.data?.tipo === "notificacion") manejarAccionDeNotificacion(evento.data.url);
  });
}

function minutosDesde(horaStr) {
  const [h, m] = horaStr.split(":").map(Number);
  return h * 60 + m;
}

function colorParaMateria(materia, listaClases = clases) {
  const nombresUnicos = [...new Set(listaClases.map((c) => c.materia))];
  if (!nombresUnicos.includes(materia)) nombresUnicos.push(materia);
  const indice = nombresUnicos.indexOf(materia) % PALETA_COLORES.length;
  return PALETA_COLORES[indice];
}

// La cuadrícula empieza a las 7:00, o a las 6:00 si hay alguna clase
// antes de las 7 (así nadie más ve una fila vacía de más).
function horaInicioGrid(listaClases) {
  const tieneClaseTemprano = listaClases.some((c) => minutosDesde(c.horaInicio) < HORA_INICIO_GRID * 60);
  return tieneClaseTemprano ? HORA_MINIMA_CLASE : HORA_INICIO_GRID;
}

function construirEsqueletoGrid(grid = document.getElementById("grid-horario"), listaClases = clases) {
  const inicio = horaInicioGrid(listaClases);
  const filasTotales = (HORA_FIN_GRID - inicio) * 2;
  grid.dataset.horaInicio = String(inicio);
  grid.innerHTML = "";
  grid.style.gridTemplateRows = `36px repeat(${filasTotales}, 28px)`;

  const esquina = document.createElement("div");
  esquina.style.gridColumn = "1";
  esquina.style.gridRow = "1";
  grid.appendChild(esquina);

  DIAS.forEach((dia, i) => {
    const celda = document.createElement("div");
    celda.className = "celda-dia";
    celda.textContent = dia;
    celda.style.gridColumn = String(i + 2);
    grid.appendChild(celda);
  });

  for (let f = 0; f < filasTotales; f++) {
    const filaGrid = f + 2;
    if (f % 2 === 0) {
      const hora = inicio + f / 2;
      const etiqueta = document.createElement("div");
      etiqueta.className = "celda-hora";
      etiqueta.textContent = `${String(hora).padStart(2, "0")}:00`;
      etiqueta.style.gridColumn = "1";
      etiqueta.style.gridRow = `${filaGrid} / span 2`;
      grid.appendChild(etiqueta);
    }
    for (let d = 0; d < DIAS.length; d++) {
      const linea = document.createElement("div");
      linea.className = "linea-hora";
      linea.style.gridColumn = String(d + 2);
      linea.style.gridRow = String(filaGrid);
      grid.appendChild(linea);
    }
  }
}

function pintarClasesEnGrid(grid = document.getElementById("grid-horario"), listaClases = clases, editable = true) {
  const inicio = Number(grid.dataset.horaInicio) || HORA_INICIO_GRID;
  const filasTotales = (HORA_FIN_GRID - inicio) * 2;
  listaClases.forEach((clase) => {
    const inicioMin = minutosDesde(clase.horaInicio) - inicio * 60;
    const finMin = minutosDesde(clase.horaFin) - inicio * 60;
    const filaInicio = 2 + Math.max(0, Math.round(inicioMin / 30));
    const filaFin = 2 + Math.min(filasTotales, Math.round(finMin / 30));
    if (filaFin <= filaInicio) return;

    (clase.dias || []).forEach((dia) => {
      const diaIndice = DIAS.indexOf(dia);
      if (diaIndice === -1) return;

      const bloque = document.createElement("div");
      bloque.className = "bloque-clase";
      bloque.style.gridColumn = String(diaIndice + 2);
      bloque.style.gridRow = `${filaInicio} / ${filaFin}`;
      bloque.style.background = colorParaMateria(clase.materia, listaClases);
      bloque.innerHTML = `
        <strong>${escaparHtml(clase.materia)}</strong>
        ${clase.aula ? `<span>${escaparHtml(clase.aula)}</span>` : ""}
        ${clase.profesor ? `<span>${escaparHtml(clase.profesor)}</span>` : ""}
      `;

      if (editable) hacerEditable(bloque, clase);

      grid.appendChild(bloque);
    });
  });
}

function pintarAgendaMovil(
  contenedor = document.getElementById("agenda-movil"),
  listaClases = clases,
  editable = true
) {
  contenedor.innerHTML = "";

  const diasConClases = DIAS.filter((dia) => listaClases.some((c) => (c.dias || []).includes(dia)));

  if (diasConClases.length === 0) {
    const vacio = document.createElement("p");
    vacio.className = "mensaje-vacio";
    vacio.textContent = "Todavía no agregaste ninguna clase.";
    contenedor.appendChild(vacio);
    return;
  }

  diasConClases.forEach((dia) => {
    const grupo = document.createElement("div");
    grupo.className = "agenda-dia";

    const titulo = document.createElement("h3");
    titulo.textContent = dia;
    grupo.appendChild(titulo);

    const clasesDelDia = listaClases
      .filter((c) => (c.dias || []).includes(dia))
      .sort((a, b) => minutosDesde(a.horaInicio) - minutosDesde(b.horaInicio));

    clasesDelDia.forEach((clase) => {
      const item = document.createElement("div");
      item.className = "agenda-clase";
      item.style.background = colorParaMateria(clase.materia, listaClases);
      item.innerHTML = `
        <strong>${escaparHtml(clase.materia)}</strong>
        <span>${clase.horaInicio} - ${clase.horaFin}</span>
        ${clase.aula ? `<span>${escaparHtml(clase.aula)}</span>` : ""}
        ${clase.profesor ? `<span>${escaparHtml(clase.profesor)}</span>` : ""}
      `;

      if (editable) hacerEditable(item, clase);

      grupo.appendChild(item);
    });

    contenedor.appendChild(grupo);
  });
}

// En el calendario propio: el ✏️ (o tocar la clase) la abre para editar y
// la × la elimina (con confirmación).
function hacerEditable(elemento, clase) {
  elemento.classList.add("clase-editable");
  elemento.title = "Toca para editar";
  elemento.addEventListener("click", () => iniciarEdicion(clase.id));

  const btnEditar = document.createElement("button");
  btnEditar.type = "button";
  btnEditar.className = "btn-editar-bloque";
  btnEditar.textContent = "✎";
  btnEditar.title = "Editar esta clase";
  btnEditar.addEventListener("click", (evento) => {
    evento.stopPropagation();
    iniciarEdicion(clase.id);
  });
  elemento.appendChild(btnEditar);

  const btnX = document.createElement("button");
  btnX.type = "button";
  btnX.className = "btn-borrar-bloque";
  btnX.textContent = "×";
  btnX.title = "Eliminar esta clase";
  btnX.addEventListener("click", (evento) => {
    evento.stopPropagation(); // que no abra también la edición
    if (confirm(`¿Eliminar ${clase.materia} de tu horario?`)) eliminarClase(clase.id);
  });
  elemento.appendChild(btnX);
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

const ICONOS_PENDIENTE = {
  Parcial: "📘",
  Taller: "🛠️",
  Tarea: "📝",
  Otro: "📌",
};

function pintarRecordatoriosSemana() {
  const contenedor = document.getElementById("recordatorios-semana");
  contenedor.innerHTML = "";

  const lunes = obtenerLunesDeEstaSemana(new Date());
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const deEstaSemana = pendientes
    .filter((p) => {
      const fecha = parsearFechaLocal(p.fecha);
      return fecha >= lunes && fecha <= domingo;
    })
    .sort((a, b) => parsearFechaLocal(a.fecha) - parsearFechaLocal(b.fecha));

  deEstaSemana.forEach((pendiente) => {
    const fecha = parsearFechaLocal(pendiente.fecha);

    const item = document.createElement("div");
    item.className = "recordatorio";
    item.innerHTML = `
      <span class="recordatorio-icono">${ICONOS_PENDIENTE[pendiente.tipo] || "📌"}</span>
      <span class="recordatorio-info">
        <strong>${escaparHtml(pendiente.titulo)}</strong>
        <span>${DIAS_COMPLETOS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}${
      pendiente.materia ? " · " + escaparHtml(pendiente.materia) : ""
    }</span>
      </span>
    `;

    const btnX = document.createElement("button");
    btnX.type = "button";
    btnX.className = "btn-borrar-recordatorio";
    btnX.textContent = "×";
    btnX.title = "Eliminar este recordatorio";
    btnX.addEventListener("click", () => eliminarPendiente(pendiente.id));
    item.appendChild(btnX);

    contenedor.appendChild(item);
  });
}

function pintarListaPendientes() {
  const listaPendientes = document.getElementById("lista-pendientes");
  listaPendientes.innerHTML = "";

  if (pendientes.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "mensaje-vacio";
    vacio.textContent = "No tienes tareas ni parciales agregados.";
    listaPendientes.appendChild(vacio);
    return;
  }

  const ordenados = [...pendientes].sort(
    (a, b) => parsearFechaLocal(a.fecha) - parsearFechaLocal(b.fecha)
  );

  ordenados.forEach((pendiente) => {
    const fecha = parsearFechaLocal(pendiente.fecha);
    const li = document.createElement("li");

    const icono = document.createElement("span");
    icono.textContent = ICONOS_PENDIENTE[pendiente.tipo] || "📌";

    const info = document.createElement("span");
    info.className = "info-clase";
    info.textContent = `${pendiente.titulo} — ${fecha.getDate()} de ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}${
      pendiente.materia ? " · " + pendiente.materia : ""
    }`;

    const acciones = document.createElement("span");
    acciones.className = "acciones-clase";

    const btnEliminar = document.createElement("button");
    btnEliminar.className = "btn-eliminar";
    btnEliminar.textContent = "Eliminar";
    btnEliminar.addEventListener("click", () => eliminarPendiente(pendiente.id));

    acciones.appendChild(btnEliminar);

    li.appendChild(icono);
    li.appendChild(info);
    li.appendChild(acciones);
    listaPendientes.appendChild(li);
  });
}

function actualizarOpcionesMateriaPendiente() {
  const select = document.getElementById("pendiente-materia");
  const valorPrevio = select.value;
  const materias = [...new Set(clases.map((c) => c.materia))];

  select.innerHTML = '<option value="">Ninguna / General</option>';
  materias.forEach((materia) => {
    const opcion = document.createElement("option");
    opcion.value = materia;
    opcion.textContent = materia;
    select.appendChild(opcion);
  });

  if (materias.includes(valorPrevio)) {
    select.value = valorPrevio;
  }
}

function render() {
  construirEsqueletoGrid();
  pintarClasesEnGrid();
  pintarAgendaMovil();
  actualizarOpcionesMateriaPendiente();
  pintarRecordatoriosSemana();
  pintarListaPendientes();
}

function iniciarEdicion(id) {
  const clase = clases.find((c) => c.id === id);
  if (!clase) return;

  editandoId = id;
  document.getElementById("materia").value = clase.materia;
  document.querySelectorAll('input[name="dia"]').forEach((casilla) => {
    casilla.checked = clase.dias.includes(casilla.value);
  });
  document.getElementById("hora-inicio").value = clase.horaInicio;
  document.getElementById("hora-fin").value = clase.horaFin;
  document.getElementById("aula").value = clase.aula || "";
  document.getElementById("profesor").value = clase.profesor || "";

  formTitulo.textContent = "Editar clase";
  btnGuardar.textContent = "Guardar cambios";
  btnCancelar.hidden = false;
  document.getElementById("detalle-clase").open = true;
  abrirHojaFormulario("clase");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicion() {
  editandoId = null;
  form.reset();
  formTitulo.textContent = "Agregar clase";
  btnGuardar.textContent = "Agregar clase";
  btnCancelar.hidden = true;
}

function eliminarClase(id) {
  clases = clases.filter((c) => c.id !== id);
  guardarDatos();
  render();
}

function eliminarPendiente(id) {
  pendientes = pendientes.filter((p) => p.id !== id);
  guardarDatos();
  render();
}

form.addEventListener("submit", (evento) => {
  evento.preventDefault();

  const materia = document.getElementById("materia").value.trim();
  const dias = [...document.querySelectorAll('input[name="dia"]:checked')].map(
    (casilla) => casilla.value
  );
  const horaInicio = document.getElementById("hora-inicio").value;
  const horaFin = document.getElementById("hora-fin").value;
  const aula = document.getElementById("aula").value.trim();
  const profesor = document.getElementById("profesor").value.trim();

  if (!materia || dias.length === 0 || !horaInicio || !horaFin) {
    if (dias.length === 0) alert("Selecciona al menos un día.");
    return;
  }

  if (minutosDesde(horaFin) <= minutosDesde(horaInicio)) {
    alert("La hora de fin debe ser posterior a la hora de inicio.");
    return;
  }

  if (editandoId) {
    const clase = clases.find((c) => c.id === editandoId);
    Object.assign(clase, { materia, dias, horaInicio, horaFin, aula, profesor });
  } else {
    clases.push({
      id: Date.now().toString(),
      materia,
      dias,
      horaInicio,
      horaFin,
      aula,
      profesor,
    });
  }

  guardarDatos();
  cancelarEdicion();
  cerrarHojaFormulario();
  render();
});

const formPendiente = document.getElementById("form-pendiente");

formPendiente.addEventListener("submit", (evento) => {
  evento.preventDefault();

  const titulo = document.getElementById("pendiente-titulo").value.trim();
  const tipo = document.getElementById("pendiente-tipo").value;
  const materia = document.getElementById("pendiente-materia").value;
  const fecha = document.getElementById("pendiente-fecha").value;

  if (!titulo || !fecha) return;

  pendientes.push({ id: Date.now().toString(), titulo, tipo, materia, fecha });

  guardarDatos();
  formPendiente.reset();
  cerrarHojaFormulario();
  render();
});

// ---------- Descargar PDF ----------

const CLAVE_ESTILO_PDF = "horarioEstiloPdf";
const modalPdf = document.getElementById("modal-pdf");
const estilosPdfEl = document.getElementById("estilos-pdf");
const canvasPdf = document.getElementById("canvas-pdf");
const pdfCargando = document.getElementById("pdf-cargando");
const btnDescargarPdf = document.getElementById("btn-descargar-pdf");

let moduloPdf = null;
let estiloPdf = "maquillaje";
let dibujoPdfActual = 0;

try {
  estiloPdf = localStorage.getItem(CLAVE_ESTILO_PDF) || estiloPdf;
} catch {}

async function cargarModuloPdf() {
  // Se carga solo cuando se usa, con la misma versión que script.js.
  if (!moduloPdf) moduloPdf = await import(`./pdf-horario.js?v=${VERSION_ACTUAL}`);
  return moduloPdf;
}

// Muestra cada estilo como una miniatura (sin nombre) para escoger.
async function pintarMiniaturasEstilo(modulo) {
  const estilos = modulo.LISTA_ESTILOS;
  estilosPdfEl.innerHTML = "";
  const botones = estilos.map((estilo) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "estilo-pdf";
    boton.setAttribute("aria-label", estilo.nombre);
    boton.classList.toggle("estilo-pdf-activo", estilo.id === estiloPdf);
    const miniatura = document.createElement("canvas");
    boton.appendChild(miniatura);
    boton.addEventListener("click", () => {
      estiloPdf = estilo.id;
      try {
        localStorage.setItem(CLAVE_ESTILO_PDF, estilo.id);
      } catch {}
      estilosPdfEl.querySelectorAll(".estilo-pdf").forEach((b) => b.classList.remove("estilo-pdf-activo"));
      boton.classList.add("estilo-pdf-activo");
      dibujarVistaPdf();
    });
    estilosPdfEl.appendChild(boton);
    return miniatura;
  });

  await Promise.all(estilos.map((estilo) => modulo.prepararEstilo(estilo.id)));

  // Se dibuja en tamaño real en un canvas auxiliar y se copia reducido.
  const auxiliar = document.createElement("canvas");
  estilos.forEach((estilo, i) => {
    modulo.dibujarHorario(auxiliar, clases, estilo.id);
    const miniatura = botones[i];
    miniatura.width = 400;
    miniatura.height = Math.round((400 * auxiliar.height) / auxiliar.width);
    miniatura.getContext("2d").drawImage(auxiliar, 0, 0, miniatura.width, miniatura.height);
  });
}

async function dibujarVistaPdf() {
  const turno = ++dibujoPdfActual;
  pdfCargando.hidden = false;
  btnDescargarPdf.disabled = true;
  const modulo = await cargarModuloPdf();
  await modulo.prepararEstilo(estiloPdf);
  if (turno !== dibujoPdfActual) return; // se eligió otro estilo mientras cargaba
  modulo.dibujarHorario(canvasPdf, clases, estiloPdf);
  pdfCargando.hidden = true;
  btnDescargarPdf.disabled = false;
}

document.getElementById("btn-abrir-pdf").addEventListener("click", async () => {
  if (clases.length === 0) {
    alert("Agrega al menos una clase para descargar tu horario.");
    return;
  }
  modalPdf.hidden = false;
  try {
    const modulo = await cargarModuloPdf();
    if (!modulo.LISTA_ESTILOS.some((e) => e.id === estiloPdf)) estiloPdf = modulo.LISTA_ESTILOS[0].id;
    await pintarMiniaturasEstilo(modulo);
    await dibujarVistaPdf();
  } catch (error) {
    console.error(error);
    pdfCargando.textContent = "No se pudo cargar. Revisa tu conexión.";
  }
});

btnDescargarPdf.addEventListener("click", async () => {
  const textoOriginal = btnDescargarPdf.textContent;
  btnDescargarPdf.disabled = true;
  btnDescargarPdf.textContent = "Generando PDF…";
  try {
    const modulo = await cargarModuloPdf();
    await modulo.descargarPdf(canvasPdf, estiloPdf);
  } catch (error) {
    console.error(error);
    alert("No se pudo generar el PDF. Revisa tu conexión e intenta de nuevo.");
  } finally {
    btnDescargarPdf.disabled = false;
    btnDescargarPdf.textContent = textoOriginal;
  }
});

document.getElementById("btn-cerrar-pdf").addEventListener("click", () => {
  modalPdf.hidden = true;
});

modalPdf.addEventListener("click", (evento) => {
  if (evento.target === modalPdf) modalPdf.hidden = true;
});

btnCancelar.addEventListener("click", () => {
  cancelarEdicion();
  document.getElementById("detalle-clase").open = false;
  cerrarHojaFormulario();
});

// ---------- Botón ➕ y formularios como hoja (en el celular) ----------
// En pantallas pequeñas los formularios no se muestran fijos arriba: el
// botón ➕ pregunta qué agregar y abre el formulario como una hoja desde
// abajo. En el computador todo sigue igual (las clases del body solo
// tienen efecto en el CSS del celular).

const modalAgregar = document.getElementById("modal-agregar");

function abrirHojaFormulario(tipo) {
  document.body.classList.remove("hoja-clase", "hoja-actividad");
  document.body.classList.add(tipo === "clase" ? "hoja-clase" : "hoja-actividad");
  document.getElementById(tipo === "clase" ? "detalle-clase" : "detalle-pendiente").open = true;
  modalAgregar.hidden = true;
}

function cerrarHojaFormulario() {
  document.body.classList.remove("hoja-clase", "hoja-actividad");
}

document.getElementById("btn-flotante-agregar").addEventListener("click", () => {
  modalAgregar.hidden = false;
});
document.getElementById("btn-agregar-clase").addEventListener("click", () => {
  cancelarEdicion();
  abrirHojaFormulario("clase");
});
document.getElementById("btn-agregar-actividad").addEventListener("click", () => abrirHojaFormulario("actividad"));
document.getElementById("btn-agregar-importar").addEventListener("click", () => {
  modalAgregar.hidden = true;
  abrirImportar();
});
modalAgregar.addEventListener("click", (evento) => {
  if (evento.target === modalAgregar) modalAgregar.hidden = true;
});

function cerrarHojaYCancelar() {
  if (editandoId) cancelarEdicion();
  cerrarHojaFormulario();
}
document.getElementById("btn-cerrar-hoja-formularios").addEventListener("click", cerrarHojaYCancelar);
document.getElementById("fondo-hoja-formularios").addEventListener("click", cerrarHojaYCancelar);

// ---------- Menú de la cuenta (circulito con tu inicial) ----------

const modalMenu = document.getElementById("modal-menu");
const btnMenuUsuario = document.getElementById("btn-menu-usuario");
const menuAvatar = document.getElementById("menu-avatar");

// ---------- Avatares ----------
// Los dibujos están en avatares.js (se carga solo cuando se necesita, con
// la misma versión que script.js). Sin avatar se muestra la inicial.

let miAvatar = null;
let moduloAvatares = null;

function cargarAvatares() {
  moduloAvatares ||= import(`./avatares.js?v=${VERSION_ACTUAL}`);
  return moduloAvatares;
}

async function pintarAvatarEn(elemento, avatarId, nombre) {
  const inicial = nombre && nombre !== "Sin apodo" ? [...nombre.trim()][0].toUpperCase() : "🙂";
  if (avatarId) {
    try {
      const svg = (await cargarAvatares()).svgAvatar(avatarId);
      if (svg) {
        elemento.innerHTML = svg;
        elemento.classList.add("con-avatar");
        return;
      }
    } catch (error) {
      console.error("No se pudieron cargar los avatares:", error);
    }
  }
  elemento.textContent = inicial;
  elemento.classList.remove("con-avatar");
}

function actualizarAvatarUsuario() {
  const nombre = usuarioEmailEl.textContent.trim();
  pintarAvatarEn(btnMenuUsuario, miAvatar, nombre);
  pintarAvatarEn(menuAvatar, miAvatar, nombre);
}

const modalAvatar = document.getElementById("modal-avatar");
const grillaAvatares = document.getElementById("grilla-avatares");

async function guardarAvatar(avatarId) {
  const anterior = miAvatar;
  miAvatar = avatarId;
  actualizarAvatarUsuario();
  modalAvatar.hidden = true;
  try {
    await setDoc(doc(db, "perfiles", usuarioActual.uid), { avatar: avatarId }, { merge: true });
  } catch (error) {
    console.error(error);
    miAvatar = anterior;
    actualizarAvatarUsuario();
    alert("No se pudo guardar tu avatar. Intenta de nuevo.");
  }
}

async function abrirSelectorAvatar() {
  modalMenu.hidden = true;
  modalAvatar.hidden = false;
  grillaAvatares.innerHTML = "";
  try {
    const { IDS_AVATARES, svgAvatar } = await cargarAvatares();
    IDS_AVATARES.forEach((id) => {
      const opcion = document.createElement("button");
      opcion.type = "button";
      opcion.className = "opcion-avatar";
      if (id === miAvatar) opcion.classList.add("opcion-avatar-activa");
      opcion.innerHTML = svgAvatar(id);
      opcion.addEventListener("click", () => guardarAvatar(id));
      grillaAvatares.appendChild(opcion);
    });
  } catch (error) {
    console.error(error);
    grillaAvatares.textContent = "No se pudieron cargar los avatares. Revisa tu conexión.";
  }
}

document.getElementById("btn-elegir-avatar").addEventListener("click", abrirSelectorAvatar);
menuAvatar.addEventListener("click", abrirSelectorAvatar);
document.getElementById("btn-sin-avatar").addEventListener("click", () => guardarAvatar(null));
document.getElementById("btn-cerrar-avatar").addEventListener("click", () => {
  modalAvatar.hidden = true;
});
modalAvatar.addEventListener("click", (evento) => {
  if (evento.target === modalAvatar) modalAvatar.hidden = true;
});

btnMenuUsuario.addEventListener("click", () => {
  modalMenu.hidden = false;
});

// Al elegir cualquier opción (o tocar afuera) el menú se cierra; la opción
// abre lo suyo con su propio manejador.
modalMenu.addEventListener("click", (evento) => {
  if (evento.target === modalMenu || evento.target.closest(".menu-opcion, .menu-nombre")) {
    modalMenu.hidden = true;
  }
});
