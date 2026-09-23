import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
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
const db = getFirestore(firebaseApp);

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const HORA_INICIO_GRID = 7; // 07:00
const HORA_FIN_GRID = 22; // 22:00
const FILAS_TOTALES = (HORA_FIN_GRID - HORA_INICIO_GRID) * 2; // bloques de 30 min

const TEMAS_COLOR = [
  {
    nombre: "Morado",
    principal: "#8b5cf6",
    secundario: "#7c3aed",
    acento1: "#d946ef",
    acento2: "#3b82f6",
    paleta: ["#8b5cf6", "#ec4899", "#3b82f6", "#d946ef", "#6366f1", "#f472b6", "#a855f7", "#0ea5e9"],
  },
  {
    nombre: "Azul",
    principal: "#3b82f6",
    secundario: "#2563eb",
    acento1: "#0ea5e9",
    acento2: "#06b6d4",
    paleta: ["#3b82f6", "#2563eb", "#0ea5e9", "#06b6d4", "#6366f1", "#0284c7", "#38bdf8", "#1d4ed8"],
  },
  {
    nombre: "Verde",
    principal: "#10b981",
    secundario: "#059669",
    acento1: "#22c55e",
    acento2: "#14b8a6",
    paleta: ["#10b981", "#059669", "#22c55e", "#14b8a6", "#65a30d", "#16a34a", "#0d9488", "#4ade80"],
  },
  {
    nombre: "Naranja",
    principal: "#f97316",
    secundario: "#ea580c",
    acento1: "#f59e0b",
    acento2: "#ef4444",
    paleta: ["#f97316", "#ea580c", "#f59e0b", "#ef4444", "#fb923c", "#dc2626", "#eab308", "#f43f5e"],
  },
  {
    nombre: "Rosado",
    principal: "#ec4899",
    secundario: "#db2777",
    acento1: "#f472b6",
    acento2: "#a855f7",
    paleta: ["#ec4899", "#db2777", "#f472b6", "#a855f7", "#f43f5e", "#c026d3", "#e879f9", "#be185d"],
  },
  {
    nombre: "Gris",
    principal: "#475569",
    secundario: "#334155",
    acento1: "#64748b",
    acento2: "#0ea5e9",
    paleta: ["#475569", "#334155", "#64748b", "#0ea5e9", "#7c3aed", "#059669", "#ea580c", "#db2777"],
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
    try {
      const registro = await navigator.serviceWorker.getRegistration("firebase-messaging-sw.js");
      if (registro) {
        registro.showNotification(payload.data.title, { body: payload.data.body || "" });
      } else {
        new Notification(payload.data.title, { body: payload.data.body || "" });
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

btnNotificaciones.addEventListener("click", async () => {
  if (!usuarioActual) {
    alert("Inicia sesión primero para activar las notificaciones.");
    return;
  }

  if (!messaging) {
    alert("Tu navegador no soporta notificaciones.");
    return;
  }

  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") {
      alert("No diste permiso de notificaciones. Puedes activarlo luego desde este mismo botón.");
      return;
    }

    const registro = await navigator.serviceWorker.register("firebase-messaging-sw.js");
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registro,
    });

    await setDoc(doc(db, "horarios", usuarioActual.uid), { fcmToken: token }, { merge: true });

    btnNotificaciones.title = "Notificaciones activadas";
    btnNotificaciones.classList.add("btn-icono-activo");
    alert("¡Listo! Vas a recibir un aviso 5 minutos antes de cada clase.");
  } catch (error) {
    console.error(error);
    alert("No se pudo activar la notificación. Intenta de nuevo.");
  }
});

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
const lista = document.getElementById("lista-clases");
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
}

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
    authTitulo.textContent = "Inicia sesión";
    authSubtexto.textContent = "Para guardar tu horario y verlo en todos tus dispositivos";
    btnAuthPrincipal.textContent = "Iniciar sesión";
    authToggleTexto.textContent = "¿No tienes cuenta?";
    btnCambiarModo.textContent = "Crea una aquí";
  } else {
    authCard.classList.add("auth-card-registro");
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
    const miApodo = await obtenerApodo(user.uid);
    usuarioEmailEl.textContent = miApodo || "Sin apodo";
    formAuth.reset();
    limpiarErrorAuth();
    const datos = await cargarDatosDesdeFirestore(user.uid);
    clases = datos.clases;
    pendientes = datos.pendientes;
    render();
    publicarHorarioCompartido();
  } else {
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

function generarCodigoAleatorio() {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "";
  for (let i = 0; i < 6; i++) {
    codigo += caracteres[Math.floor(Math.random() * caracteres.length)];
  }
  return codigo;
}

async function asegurarCodigoPropio() {
  const referenciaPropia = doc(db, "horarios", usuarioActual.uid);
  const snapshotPropio = await getDoc(referenciaPropia);
  const existente = snapshotPropio.exists() ? snapshotPropio.data().miCodigo : null;
  if (existente) return existente;

  for (let intento = 0; intento < 5; intento++) {
    const codigo = generarCodigoAleatorio();
    const referenciaCodigo = doc(db, "codigos", codigo);
    const snapshotCodigo = await getDoc(referenciaCodigo);
    if (snapshotCodigo.exists()) continue;

    await setDoc(referenciaCodigo, { uid: usuarioActual.uid });
    await setDoc(referenciaPropia, { miCodigo: codigo }, { merge: true });
    return codigo;
  }
  throw new Error("No se pudo generar un código único.");
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

  await setDoc(doc(db, "perfiles", usuarioActual.uid), { apodo });
  usuarioEmailEl.textContent = apodo;
  modalApodo.hidden = true;
});

const miCodigoEl = document.getElementById("mi-codigo");
const btnCopiarCodigo = document.getElementById("btn-copiar-codigo");
const formAgregarAmigo = document.getElementById("form-agregar-amigo");
const codigoAmigoInput = document.getElementById("codigo-amigo-input");
const amigoError = document.getElementById("amigo-error");
const listaSolicitudes = document.getElementById("lista-solicitudes");
const listaAmigos = document.getElementById("lista-amigos");

btnCopiarCodigo.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(miCodigoEl.textContent);
    btnCopiarCodigo.textContent = "¡Copiado!";
    setTimeout(() => (btnCopiarCodigo.textContent = "Copiar"), 1500);
  } catch {
    alert("No se pudo copiar. Selecciona el código manualmente.");
  }
});

formAgregarAmigo.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  amigoError.hidden = true;

  const codigo = codigoAmigoInput.value.trim().toUpperCase();
  if (!codigo) return;

  try {
    const snapshotCodigo = await getDoc(doc(db, "codigos", codigo));
    if (!snapshotCodigo.exists()) {
      amigoError.textContent = "Ese código no existe.";
      amigoError.hidden = false;
      return;
    }

    const uidDestino = snapshotCodigo.data().uid;
    if (uidDestino === usuarioActual.uid) {
      amigoError.textContent = "Ese es tu propio código.";
      amigoError.hidden = false;
      return;
    }

    await addDoc(collection(db, "solicitudesAmistad"), {
      de: usuarioActual.uid,
      para: uidDestino,
      estado: "pendiente",
      creada: Date.now(),
    });

    codigoAmigoInput.value = "";
    alert("¡Solicitud enviada!");
  } catch (error) {
    console.error(error);
    amigoError.textContent = "Ocurrió un error, intenta de nuevo.";
    amigoError.hidden = false;
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

function badgeEstado(estado) {
  if (estado === "Libre") return `<span class="estado-badge estado-libre">Libre</span>`;
  if (estado === "En clase") return `<span class="estado-badge estado-clase">En clase</span>`;
  return `<span class="estado-badge estado-desconocido">Sin datos</span>`;
}

function amigosDesdeSolicitudes(snapshotDestino, snapshotOrigen) {
  return [
    ...snapshotDestino.docs
      .filter((d) => d.data().estado === "aceptada")
      .map((d) => ({ uid: d.data().de })),
    ...snapshotOrigen.docs
      .filter((d) => d.data().estado === "aceptada")
      .map((d) => ({ uid: d.data().para })),
  ];
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
  miCodigoEl.textContent = "......";
  const codigo = await asegurarCodigoPropio();
  miCodigoEl.textContent = codigo;

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

  if (pendientesRecibidas.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "mensaje-vacio";
    vacio.textContent = "No tienes solicitudes pendientes.";
    listaSolicitudes.appendChild(vacio);
  } else {
    for (const docSnap of pendientesRecibidas) {
      const solicitud = docSnap.data();
      const apodo = await obtenerApodo(solicitud.de);
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

  listaAmigos.innerHTML = "";
  const amigosAceptados = amigosDesdeSolicitudes(snapshotDestino, snapshotOrigen);

  if (amigosAceptados.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "mensaje-vacio";
    vacio.textContent = "Todavía no tienes amigos agregados.";
    listaAmigos.appendChild(vacio);
    return;
  }

  const misPermitidos = await obtenerMisPermitidos();

  for (const amigo of amigosAceptados) {
    const [estado, apodo, clasesAmigo] = await Promise.all([
      obtenerEstadoAmigo(amigo.uid),
      obtenerApodo(amigo.uid),
      obtenerHorarioDeAmigo(amigo.uid),
    ]);
    const nombre = apodo || "Amigo sin apodo";
    const li = document.createElement("li");

    const info = document.createElement("span");
    info.className = "info-clase";
    info.textContent = nombre;

    li.appendChild(info);
    li.insertAdjacentHTML("beforeend", badgeEstado(estado));

    const acciones = document.createElement("span");
    acciones.className = "acciones-clase acciones-amigo";

    const etiquetaCompartir = document.createElement("label");
    etiquetaCompartir.className = "switch-compartir";
    etiquetaCompartir.title = "Elige si este amigo puede ver tu horario";
    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.checked = misPermitidos.includes(amigo.uid);
    casilla.addEventListener("change", () => cambiarPermiso(amigo.uid, casilla));
    etiquetaCompartir.appendChild(casilla);
    etiquetaCompartir.appendChild(document.createTextNode(" Ve mi horario"));
    acciones.appendChild(etiquetaCompartir);

    if (clasesAmigo) {
      const btnVer = document.createElement("button");
      btnVer.type = "button";
      btnVer.className = "btn-ver-horario";
      btnVer.textContent = "Ver horario";
      btnVer.addEventListener("click", () => abrirHorarioAmigo(nombre, clasesAmigo));
      acciones.appendChild(btnVer);
    }

    li.appendChild(acciones);
    listaAmigos.appendChild(li);
  }
}

// ---------- Compartir horario con amigos elegidos ----------

async function obtenerMisPermitidos() {
  try {
    const snapshot = await getDoc(doc(db, "horariosCompartidos", usuarioActual.uid));
    return snapshot.exists() ? snapshot.data().permitidos || [] : [];
  } catch {
    return [];
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

async function cambiarPermiso(uidAmigo, casilla) {
  casilla.disabled = true;
  try {
    await setDoc(
      doc(db, "horariosCompartidos", usuarioActual.uid),
      { clases, permitidos: casilla.checked ? arrayUnion(uidAmigo) : arrayRemove(uidAmigo) },
      { merge: true }
    );
  } catch (error) {
    console.error(error);
    casilla.checked = !casilla.checked;
    alert(
      error.code === "permission-denied"
        ? "Firebase no dio permiso para guardar esto. Revisa que las reglas de 'horariosCompartidos' estén publicadas."
        : `No se pudo cambiar el permiso (${error.code || error.message}). Intenta de nuevo.`
    );
  } finally {
    casilla.disabled = false;
  }
}

const modalHorarioAmigo = document.getElementById("modal-horario-amigo");
const tituloHorarioAmigo = document.getElementById("titulo-horario-amigo");
const gridAmigo = document.getElementById("grid-amigo");
const agendaAmigo = document.getElementById("agenda-amigo");

function abrirHorarioAmigo(nombre, clasesAmigo) {
  tituloHorarioAmigo.textContent = `Horario de ${nombre}`;
  construirEsqueletoGrid(gridAmigo);
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
  const total = Number(cuentaTotal.value);
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

cuentaTotal.addEventListener("input", actualizarResumenCuenta);
cuentaIncluirme.addEventListener("change", actualizarResumenCuenta);
cuentaAmigosEl.addEventListener("change", actualizarResumenCuenta);

function mensajeVacio(lista, texto) {
  const vacio = document.createElement("li");
  vacio.className = "mensaje-vacio";
  vacio.textContent = texto;
  lista.appendChild(vacio);
}

function pintarAmigosCuenta(amigos) {
  const marcadosAntes = new Set(
    [...cuentaAmigosEl.querySelectorAll("input:checked")].map((c) => c.value)
  );
  cuentaAmigosEl.innerHTML = "";

  if (amigos.length === 0) {
    const aviso = document.createElement("p");
    aviso.className = "mensaje-vacio";
    aviso.textContent = "Agrega amigos en la pestaña Amigos para poder dividir cuentas.";
    cuentaAmigosEl.appendChild(aviso);
    return;
  }

  amigos.forEach((amigo) => {
    const etiqueta = document.createElement("label");
    etiqueta.className = "dia-check";
    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.value = amigo.uid;
    casilla.checked = marcadosAntes.has(amigo.uid);
    etiqueta.appendChild(casilla);
    etiqueta.appendChild(document.createTextNode(` ${amigo.apodo}`));
    cuentaAmigosEl.appendChild(etiqueta);
  });
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
    };
  };

  docsCreadas.forEach((docCuenta) => {
    const cuenta = docCuenta.data();
    (cuenta.participantes || []).forEach((uid) => {
      if (!cuenta.pagos?.[uid]) parDe(uid).meDebe.push(item(docCuenta, uid));
    });
  });

  docsDebo.forEach((docCuenta) => {
    const cuenta = docCuenta.data();
    if (!cuenta.pagos?.[miUid]) parDe(cuenta.creador).leDebo.push(item(docCuenta, miUid));
  });

  const suma = (lista) => lista.reduce((total, i) => total + i.monto, 0);
  Object.values(pares).forEach((par) => {
    par.neto = suma(par.meDebe) - suma(par.leDebo); // > 0: el amigo me debe
  });
  return pares;
}

async function saldarPar(apodo, par) {
  const pregunta =
    par.neto > 0
      ? `¿${apodo} ya te pagó ${pesos(par.neto)}?`
      : par.neto < 0
        ? `¿Ya le pagaste ${pesos(-par.neto)} a ${apodo}?`
        : `¿Dejar a paz y salvo las cuentas con ${apodo}?`;
  if (!confirm(`${pregunta}\n\nSe marcarán como pagadas todas las cuentas pendientes entre ustedes dos.`)) return;

  try {
    await Promise.all(
      [...par.meDebe, ...par.leDebo].map(({ id, uid }) =>
        updateDoc(doc(db, "cuentas", id), { [`pagos.${uid}`]: true })
      )
    );
  } catch (error) {
    console.error(error);
    alert("No se pudo marcar como pagado. Intenta de nuevo.");
  }
  renderCuentas();
}

// Una línea con el monto final y, al tocar "Más info", el cálculo completo.
function pintarPersona(lista, apodo, par) {
  const meDeben = par.neto >= 0;
  const li = document.createElement("li");
  li.className = "cuenta-item";

  const cabecera = document.createElement("div");
  cabecera.className = "cuenta-cabecera";
  const principal = document.createElement("strong");
  principal.className = "info-clase";
  principal.textContent =
    par.neto > 0
      ? `${apodo} te debe ${pesos(par.neto)}`
      : par.neto < 0
        ? `Le debes ${pesos(-par.neto)} a ${apodo}`
        : `Con ${apodo} quedan a mano`;
  cabecera.appendChild(principal);
  cabecera.appendChild(
    botonAccion(par.neto > 0 ? "Ya me pagó" : par.neto < 0 ? "Ya pagué" : "Listo", "btn-aceptar", () =>
      saldarPar(apodo, par)
    )
  );
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

async function renderCuentas() {
  const amigos = await obtenerAmigos();
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

  listaDebo.innerHTML = "";
  listaMeDeben.innerHTML = "";

  for (const [uid, par] of pares) {
    const apodo = await nombreDe(uid);
    pintarPersona(par.neto < 0 ? listaDebo : listaMeDeben, apodo, par);
  }

  if (!listaDebo.children.length) mensajeVacio(listaDebo, "No le debes nada a nadie 🎉");
  if (!listaMeDeben.children.length) mensajeVacio(listaMeDeben, "Nadie te debe nada por ahora.");
}

// Servidor de avisos instantáneos (carpeta horario-avisos, en Cloudflare).
// Si falla, el script de GitHub manda el aviso en su siguiente revisión.
const URL_AVISOS = "https://horario-avisos.horario-avisos.workers.dev/avisar-cuenta";

async function avisarAlInstante(idCuenta) {
  if (!URL_AVISOS) return;
  try {
    const token = await usuarioActual.getIdToken();
    await fetch(URL_AVISOS, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ idCuenta }),
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
    avisarAlInstante(nuevaCuenta.id);
    formCuenta.reset();
    cuentaAmigosEl.querySelectorAll("input").forEach((c) => (c.checked = false));
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

function construirEsqueletoGrid(grid = document.getElementById("grid-horario")) {
  grid.innerHTML = "";
  grid.style.gridTemplateRows = `36px repeat(${FILAS_TOTALES}, 28px)`;

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

  for (let f = 0; f < FILAS_TOTALES; f++) {
    const filaGrid = f + 2;
    if (f % 2 === 0) {
      const hora = HORA_INICIO_GRID + f / 2;
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
  listaClases.forEach((clase) => {
    const inicioMin = minutosDesde(clase.horaInicio) - HORA_INICIO_GRID * 60;
    const finMin = minutosDesde(clase.horaFin) - HORA_INICIO_GRID * 60;
    const filaInicio = 2 + Math.max(0, Math.round(inicioMin / 30));
    const filaFin = 2 + Math.min(FILAS_TOTALES, Math.round(finMin / 30));
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

      if (editable) {
        const btnX = document.createElement("button");
        btnX.type = "button";
        btnX.className = "btn-borrar-bloque";
        btnX.textContent = "×";
        btnX.title = "Eliminar esta clase";
        btnX.addEventListener("click", () => eliminarClase(clase.id));
        bloque.appendChild(btnX);
      }

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

      if (editable) {
        const btnX = document.createElement("button");
        btnX.type = "button";
        btnX.className = "btn-borrar-bloque";
        btnX.textContent = "×";
        btnX.title = "Eliminar esta clase";
        btnX.addEventListener("click", () => eliminarClase(clase.id));
        item.appendChild(btnX);
      }

      grupo.appendChild(item);
    });

    contenedor.appendChild(grupo);
  });
}

function pintarLista() {
  lista.innerHTML = "";

  if (clases.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "mensaje-vacio";
    vacio.textContent = "Todavía no agregaste ninguna clase.";
    lista.appendChild(vacio);
    return;
  }

  const primerDiaIndice = (clase) =>
    Math.min(...clase.dias.map((d) => DIAS.indexOf(d)).filter((i) => i !== -1));

  const ordenadas = [...clases].sort((a, b) => {
    const diaDiff = primerDiaIndice(a) - primerDiaIndice(b);
    if (diaDiff !== 0) return diaDiff;
    return minutosDesde(a.horaInicio) - minutosDesde(b.horaInicio);
  });

  ordenadas.forEach((clase) => {
    const li = document.createElement("li");

    const punto = document.createElement("span");
    punto.className = "punto-color";
    punto.style.background = colorParaMateria(clase.materia);

    const info = document.createElement("span");
    info.className = "info-clase";
    info.textContent = `${clase.materia} — ${clase.dias.join(", ")} ${clase.horaInicio}-${clase.horaFin}${
      clase.aula ? " · " + clase.aula : ""
    }${clase.profesor ? " · " + clase.profesor : ""}`;

    const acciones = document.createElement("span");
    acciones.className = "acciones-clase";

    const btnEditar = document.createElement("button");
    btnEditar.className = "btn-editar";
    btnEditar.textContent = "Editar";
    btnEditar.addEventListener("click", () => iniciarEdicion(clase.id));

    const btnEliminar = document.createElement("button");
    btnEliminar.className = "btn-eliminar";
    btnEliminar.textContent = "Eliminar";
    btnEliminar.addEventListener("click", () => eliminarClase(clase.id));

    acciones.appendChild(btnEditar);
    acciones.appendChild(btnEliminar);

    li.appendChild(punto);
    li.appendChild(info);
    li.appendChild(acciones);
    lista.appendChild(li);
  });
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
  pintarLista();
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
});
