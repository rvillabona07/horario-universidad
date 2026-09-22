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
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getMessaging,
  getToken,
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

  // El aviso se muestra únicamente desde el service worker
  // (firebase-messaging-sw.js), tanto con la app cerrada como abierta.
  // No duplicamos con un manejador aquí para evitar avisos repetidos.

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
  await setDoc(doc(db, "horarios", usuarioActual.uid), { clases, pendientes }, { merge: true });
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

const tabHorario = document.getElementById("tab-horario");
const tabAmigos = document.getElementById("tab-amigos");
const vistaHorario = document.getElementById("vista-horario");
const vistaAmigos = document.getElementById("vista-amigos");

tabHorario.addEventListener("click", () => {
  tabHorario.classList.add("tab-activo");
  tabAmigos.classList.remove("tab-activo");
  vistaHorario.hidden = false;
  vistaAmigos.hidden = true;
});

tabAmigos.addEventListener("click", () => {
  tabAmigos.classList.add("tab-activo");
  tabHorario.classList.remove("tab-activo");
  vistaHorario.hidden = true;
  vistaAmigos.hidden = false;
  renderAmigos();
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
  const amigosAceptados = [
    ...snapshotDestino.docs
      .filter((d) => d.data().estado === "aceptada")
      .map((d) => ({ uid: d.data().de })),
    ...snapshotOrigen.docs
      .filter((d) => d.data().estado === "aceptada")
      .map((d) => ({ uid: d.data().para })),
  ];

  if (amigosAceptados.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "mensaje-vacio";
    vacio.textContent = "Todavía no tienes amigos agregados.";
    listaAmigos.appendChild(vacio);
    return;
  }

  for (const amigo of amigosAceptados) {
    const estado = await obtenerEstadoAmigo(amigo.uid);
    const apodo = await obtenerApodo(amigo.uid);
    const li = document.createElement("li");

    const info = document.createElement("span");
    info.className = "info-clase";
    info.textContent = apodo || "Amigo sin apodo";

    li.appendChild(info);
    li.insertAdjacentHTML("beforeend", badgeEstado(estado));
    listaAmigos.appendChild(li);
  }
}

function minutosDesde(horaStr) {
  const [h, m] = horaStr.split(":").map(Number);
  return h * 60 + m;
}

function colorParaMateria(materia) {
  const nombresUnicos = [...new Set(clases.map((c) => c.materia))];
  if (!nombresUnicos.includes(materia)) nombresUnicos.push(materia);
  const indice = nombresUnicos.indexOf(materia) % PALETA_COLORES.length;
  return PALETA_COLORES[indice];
}

function construirEsqueletoGrid() {
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

function pintarClasesEnGrid() {
  clases.forEach((clase) => {
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
      bloque.style.background = colorParaMateria(clase.materia);
      bloque.innerHTML = `
        <strong>${escaparHtml(clase.materia)}</strong>
        ${clase.aula ? `<span>${escaparHtml(clase.aula)}</span>` : ""}
        ${clase.profesor ? `<span>${escaparHtml(clase.profesor)}</span>` : ""}
      `;

      const btnX = document.createElement("button");
      btnX.type = "button";
      btnX.className = "btn-borrar-bloque";
      btnX.textContent = "×";
      btnX.title = "Eliminar esta clase";
      btnX.addEventListener("click", () => eliminarClase(clase.id));
      bloque.appendChild(btnX);

      grid.appendChild(bloque);
    });
  });
}

function pintarAgendaMovil() {
  const contenedor = document.getElementById("agenda-movil");
  contenedor.innerHTML = "";

  const diasConClases = DIAS.filter((dia) => clases.some((c) => c.dias.includes(dia)));

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

    const clasesDelDia = clases
      .filter((c) => c.dias.includes(dia))
      .sort((a, b) => minutosDesde(a.horaInicio) - minutosDesde(b.horaInicio));

    clasesDelDia.forEach((clase) => {
      const item = document.createElement("div");
      item.className = "agenda-clase";
      item.style.background = colorParaMateria(clase.materia);
      item.innerHTML = `
        <strong>${escaparHtml(clase.materia)}</strong>
        <span>${clase.horaInicio} - ${clase.horaFin}</span>
        ${clase.aula ? `<span>${escaparHtml(clase.aula)}</span>` : ""}
        ${clase.profesor ? `<span>${escaparHtml(clase.profesor)}</span>` : ""}
      `;

      const btnX = document.createElement("button");
      btnX.type = "button";
      btnX.className = "btn-borrar-bloque";
      btnX.textContent = "×";
      btnX.title = "Eliminar esta clase";
      btnX.addEventListener("click", () => eliminarClase(clase.id));
      item.appendChild(btnX);

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

btnCancelar.addEventListener("click", () => {
  cancelarEdicion();
  document.getElementById("detalle-clase").open = false;
});
