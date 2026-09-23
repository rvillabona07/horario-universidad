// Dibuja el horario semanal como "póster" horizontal (A4 apaisado) en un
// canvas, con distintos estilos decorativos, y lo exporta a PDF.

const ANCHO = 2000;
const ALTO = 1414; // proporción A4 apaisado

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const FUENTE_EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

const URL_FUENTES =
  "https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Bebas+Neue&family=Nunito:wght@600;800" +
  "&family=Pacifico&family=Quicksand:wght@500;700&family=Dancing+Script:wght@700" +
  "&family=Special+Elite&family=Black+Ops+One&display=swap";
const URL_JSPDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

// Huecos en los márgenes donde van los adornos (x, y, tamaño). Orden:
// esquina sup. izq. (grande, chico), esquina sup. der. (grande, chico),
// 5 en el margen izquierdo y 5 en el derecho.
const HUECOS_ADORNOS = [
  [190, 120, 120], [420, 175, 70],
  [ANCHO - 190, 120, 120], [ANCHO - 420, 175, 70],
  [62, 400, 62], [62, 620, 54], [62, 840, 62], [62, 1060, 54], [62, 1290, 66],
  [ANCHO - 62, 400, 62], [ANCHO - 62, 620, 54], [ANCHO - 62, 840, 62], [ANCHO - 62, 1060, 54], [ANCHO - 62, 1290, 66],
];

// ---------- Utilidades de dibujo ----------

function aleatorioConSemilla(semilla) {
  let a = semilla;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rectRedondeado(ctx, x, y, w, h, r) {
  const radio = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + w, y, x + w, y + h, radio);
  ctx.arcTo(x + w, y + h, x, y + h, radio);
  ctx.arcTo(x, y + h, x, y, radio);
  ctx.arcTo(x, y, x + w, y, radio);
  ctx.closePath();
}

function corazon(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  ctx.fill();
}

function emoji(ctx, caracter, x, y, tamano, giro = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(giro);
  ctx.font = `${tamano}px ${FUENTE_EMOJI}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(caracter, 0, 0);
  ctx.restore();
}

function envolverTexto(ctx, texto, anchoMax) {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = "";
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width <= anchoMax || !actual) {
      actual = prueba;
    } else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function minutos(horaStr) {
  const [h, m] = horaStr.split(":").map(Number);
  return h * 60 + m;
}

function horaCorta(horaStr) {
  const [h, m] = horaStr.split(":");
  return `${Number(h)}:${m}`;
}

// ---------- Estilos ----------

const ESTILOS = [
  {
    id: "espacio",
    nombre: "Espacio",
    emoji: "🚀",
    fuenteTitulo: "900 118px Orbitron",
    fuenteSubtitulo: "700 40px Orbitron",
    fuenteCabecera: "700 30px Orbitron",
    fuenteTexto: "Nunito",
    pesoTexto: 800,
    titulo: "MI HORARIO",
    subtitulo: "MISIÓN: UNIVERSIDAD",
    colorTitulo: ["#67e8f9", "#c084fc", "#f472b6"],
    sombraTitulo: { color: "rgba(147, 197, 253, 0.8)", blur: 30 },
    colorSubtitulo: "#c7d2fe",
    cabeceraFondo: ["rgba(99, 102, 241, 0.55)"],
    cabeceraTexto: "#e0e7ff",
    horaFondo: "rgba(56, 189, 248, 0.25)",
    horaTexto: "#e0f2fe",
    celdaFondo: "rgba(255, 255, 255, 0.06)",
    celdaBorde: "rgba(165, 180, 252, 0.25)",
    paleta: ["#6366f1", "#8b5cf6", "#0891b2", "#db2777", "#2563eb", "#0d9488"],
    textoClase: "#ffffff",
    iconos: ["🪐", "⭐", "🛸", "☄️", "🌙", "🚀"],
    adornos: ["🚀", "⭐", null, "✨", "🛸", "🌙", "☄️", "⭐", "🌍", "🛰️", "🌟", "👽", "✨", "🌌"],
    fondo(ctx, azar) {
      const g = ctx.createRadialGradient(ANCHO * 0.45, ALTO * 0.35, 50, ANCHO * 0.5, ALTO * 0.5, ANCHO * 0.8);
      g.addColorStop(0, "#2a1b5e");
      g.addColorStop(0.5, "#120f35");
      g.addColorStop(1, "#04050d");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, ANCHO, ALTO);

      [["rgba(236, 72, 153, 0.22)", 300, 1100], ["rgba(56, 189, 248, 0.18)", 1650, 900], ["rgba(168, 85, 247, 0.2)", 1000, 250]].forEach(
        ([color, x, y]) => {
          const n = ctx.createRadialGradient(x, y, 0, x, y, 520);
          n.addColorStop(0, color);
          n.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = n;
          ctx.fillRect(0, 0, ANCHO, ALTO);
        }
      );

      for (let i = 0; i < 420; i++) {
        ctx.globalAlpha = 0.35 + azar() * 0.65;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(azar() * ANCHO, azar() * ALTO, 0.6 + azar() * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Planeta con anillo en la esquina superior derecha
      const px = ANCHO - 200;
      const py = 130;
      const planeta = ctx.createRadialGradient(px - 25, py - 25, 10, px, py, 75);
      planeta.addColorStop(0, "#fde68a");
      planeta.addColorStop(0.6, "#f59e0b");
      planeta.addColorStop(1, "#9a3412");
      ctx.fillStyle = planeta;
      ctx.beginPath();
      ctx.arc(px, py, 72, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-0.35);
      ctx.strokeStyle = "rgba(253, 230, 138, 0.85)";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.ellipse(0, 0, 125, 28, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: "futbol",
    nombre: "Fútbol",
    emoji: "⚽",
    fuenteTitulo: "140px 'Bebas Neue'",
    fuenteSubtitulo: "52px 'Bebas Neue'",
    fuenteCabecera: "40px 'Bebas Neue'",
    fuenteTexto: "Nunito",
    pesoTexto: 800,
    titulo: "MI HORARIO",
    subtitulo: "TEMPORADA UNIVERSITARIA",
    colorTitulo: "#ffffff",
    bordeTitulo: { color: "#0f172a", ancho: 12 },
    colorSubtitulo: "#fef08a",
    bordeSubtitulo: { color: "#0f172a", ancho: 7 },
    cabeceraFondo: ["#0f172a"],
    cabeceraTexto: "#ffffff",
    horaFondo: "#facc15",
    horaTexto: "#0f172a",
    celdaFondo: "rgba(255, 255, 255, 0.88)",
    celdaBorde: "rgba(255, 255, 255, 1)",
    paleta: ["#dc2626", "#1d4ed8", "#ea580c", "#7c3aed", "#0f766e", "#be185d", "#111827"],
    textoClase: "#ffffff",
    iconos: ["⚽", "🏆", "🥅", "👟", "🧤", "🎽"],
    adornos: ["⚽", "🥅", "🏆", "👟", "⚽", "🧤", "🏟️", "⚽", "🎽", "🥇", "⚽", "📣", "🏅", "⚽"],
    fondo(ctx) {
      const franja = 125;
      for (let x = 0; x < ANCHO; x += franja) {
        ctx.fillStyle = (x / franja) % 2 === 0 ? "#2f8f3f" : "#38a34a";
        ctx.fillRect(x, 0, franja, ALTO);
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 7;
      ctx.strokeRect(24, 24, ANCHO - 48, ALTO - 48);
      ctx.beginPath();
      ctx.moveTo(ANCHO / 2, 24);
      ctx.lineTo(ANCHO / 2, ALTO - 24);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ANCHO / 2, ALTO / 2, 190, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeRect(24, ALTO / 2 - 330, 270, 660);
      ctx.strokeRect(ANCHO - 294, ALTO / 2 - 330, 270, 660);
      ctx.strokeRect(24, ALTO / 2 - 150, 100, 300);
      ctx.strokeRect(ANCHO - 124, ALTO / 2 - 150, 100, 300);
    },
  },
  {
    id: "maquillaje",
    nombre: "Maquillaje",
    emoji: "💄",
    fuenteTitulo: "124px Pacifico",
    fuenteSubtitulo: "700 44px Quicksand",
    fuenteCabecera: "700 34px Quicksand",
    fuenteTexto: "Quicksand",
    pesoTexto: 700,
    titulo: "Mi Horario",
    subtitulo: "♡ Universidad ♡",
    colorTitulo: ["#7e22ce", "#c026d3", "#db2777"],
    sombraTitulo: { color: "rgba(255, 255, 255, 0.9)", blur: 14 },
    colorSubtitulo: "#9d174d",
    marcaCabecera: " ♡",
    cabeceraFondo: ["#fbcfe8", "#e9d5ff"],
    cabeceraTexto: "#6b21a8",
    horaFondo: "#fbcfe8",
    horaTexto: "#6b21a8",
    celdaFondo: "rgba(255, 255, 255, 0.72)",
    celdaBorde: "#f5d0e6",
    paleta: ["#f9a8d4", "#d8b4fe", "#f5b4d8", "#c4b5fd", "#f0abfc", "#fbb6ce"],
    textoClase: "#4a1d5e",
    iconos: ["💄", "💅", "🎀", "💋", "💖", "✨"],
    adornos: ["🎀", "💄", "💅", "💋", "💖", "👛", "🪞", "✨", "💗", "🌸", "💄", "🎀", "💅", "💖"],
    fondo(ctx, azar) {
      const g = ctx.createLinearGradient(0, 0, ANCHO, ALTO);
      g.addColorStop(0, "#fdf2f8");
      g.addColorStop(0.5, "#fae8ff");
      g.addColorStop(1, "#fce7f3");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, ANCHO, ALTO);
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = azar() > 0.5 ? "rgba(236, 72, 153, 0.13)" : "rgba(168, 85, 247, 0.12)";
        corazon(ctx, azar() * ANCHO, azar() * ALTO, 18 + azar() * 34);
      }
      ctx.fillStyle = "rgba(192, 38, 211, 0.35)";
      ctx.font = `34px ${FUENTE_EMOJI}`;
      for (let i = 0; i < 40; i++) ctx.fillText("✦", azar() * ANCHO, azar() * ALTO);
    },
  },
  {
    id: "flores",
    nombre: "Flores",
    emoji: "🌸",
    fuenteTitulo: "700 138px 'Dancing Script'",
    fuenteSubtitulo: "700 42px Quicksand",
    fuenteCabecera: "700 34px Quicksand",
    fuenteTexto: "Quicksand",
    pesoTexto: 700,
    titulo: "Mi Horario",
    subtitulo: "🌸 Universidad 🌸",
    colorTitulo: ["#be185d", "#db2777", "#15803d"],
    sombraTitulo: { color: "rgba(255, 255, 255, 0.9)", blur: 12 },
    colorSubtitulo: "#15803d",
    cabeceraFondo: ["#bbf7d0", "#fde68a", "#fbcfe8"],
    cabeceraTexto: "#14532d",
    horaFondo: "#dcfce7",
    horaTexto: "#166534",
    celdaFondo: "rgba(255, 255, 255, 0.8)",
    celdaBorde: "#d9f99d",
    paleta: ["#fbcfe8", "#bbf7d0", "#fde68a", "#fecaca", "#ddd6fe", "#bae6fd"],
    textoClase: "#3f3f46",
    iconos: ["🌸", "🌷", "🌻", "🌼", "🌺", "🌿"],
    adornos: ["🌸", "🌷", "🌻", "🌼", "🌺", "🌹", "🌿", "🌷", "🌸", "🌼", "🌻", "🍃", "🌺", "🌷"],
    fondo(ctx, azar) {
      const g = ctx.createLinearGradient(0, 0, 0, ALTO);
      g.addColorStop(0, "#fffbeb");
      g.addColorStop(1, "#f0fdf4");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, ANCHO, ALTO);
      const colores = ["rgba(244, 114, 182, 0.22)", "rgba(250, 204, 21, 0.22)", "rgba(167, 139, 250, 0.2)", "rgba(74, 222, 128, 0.2)"];
      for (let i = 0; i < 45; i++) {
        const x = azar() * ANCHO;
        const y = azar() * ALTO;
        const r = 14 + azar() * 22;
        ctx.fillStyle = colores[Math.floor(azar() * colores.length)];
        for (let p = 0; p < 5; p++) {
          const ang = (p / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r, r * 0.75, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
  {
    id: "guerra",
    nombre: "Guerra Mundial",
    emoji: "🎖️",
    fuenteTitulo: "112px 'Black Ops One'",
    fuenteSubtitulo: "38px 'Special Elite'",
    fuenteCabecera: "34px 'Black Ops One'",
    fuenteTexto: "Special Elite",
    pesoTexto: 400,
    titulo: "MI HORARIO",
    subtitulo: "ORDEN DE OPERACIONES · UNIVERSIDAD",
    colorTitulo: "#2f3321",
    colorSubtitulo: "#4b3b1a",
    cabeceraFondo: ["#4b5320"],
    cabeceraTexto: "#f3ecd2",
    horaFondo: "#6b5b3a",
    horaTexto: "#f3ecd2",
    celdaFondo: "rgba(255, 250, 235, 0.5)",
    celdaBorde: "#a39365",
    paleta: ["#4b5320", "#7c2d12", "#57534e", "#3f6212", "#854d0e", "#1e3a5f"],
    textoClase: "#f5f0dc",
    iconos: ["★", "🎖️", "📻", "✈️", "🗺️", "📜"],
    adornos: ["🎖️", "✈️", null, null, "🪖", "📻", "🗺️", "⭐", "📜", "✈️", "🎖️", "🪖", "📻", "⭐"],
    fondo(ctx, azar) {
      ctx.fillStyle = "#5b5a3c";
      ctx.fillRect(0, 0, ANCHO, ALTO);
      const camuflaje = ["#4b5320", "#3b3a2a", "#7a6f4a", "#2f3321"];
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = camuflaje[Math.floor(azar() * camuflaje.length)];
        ctx.beginPath();
        ctx.ellipse(azar() * ANCHO, azar() * ALTO, 30 + azar() * 90, 18 + azar() * 50, azar() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      // Hoja de papel envejecido
      const papel = ctx.createLinearGradient(0, 0, ANCHO, ALTO);
      papel.addColorStop(0, "#efe5c9");
      papel.addColorStop(1, "#dccca2");
      ctx.fillStyle = papel;
      ctx.fillRect(100, 30, ANCHO - 200, ALTO - 60);
      for (let i = 0; i < 14; i++) {
        const x = 150 + azar() * (ANCHO - 300);
        const y = 60 + azar() * (ALTO - 120);
        const mancha = ctx.createRadialGradient(x, y, 0, x, y, 60 + azar() * 140);
        mancha.addColorStop(0, "rgba(120, 90, 40, 0.14)");
        mancha.addColorStop(1, "rgba(120, 90, 40, 0)");
        ctx.fillStyle = mancha;
        ctx.fillRect(100, 30, ANCHO - 200, ALTO - 60);
      }
      ctx.strokeStyle = "#3b3a2a";
      ctx.lineWidth = 4;
      ctx.strokeRect(112, 42, ANCHO - 224, ALTO - 84);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(122, 52, ANCHO - 244, ALTO - 104);
    },
    encima(ctx) {
      // Sello "CLASIFICADO"
      ctx.save();
      ctx.translate(ANCHO - 330, 140);
      ctx.rotate(-0.18);
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "#b91c1c";
      ctx.lineWidth = 7;
      ctx.strokeRect(-190, -48, 380, 96);
      ctx.fillStyle = "#b91c1c";
      ctx.font = "50px 'Black Ops One'";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("CLASIFICADO", 0, 4);
      ctx.restore();
    },
  },
];

export const LISTA_ESTILOS = ESTILOS.map(({ id, nombre, emoji }) => ({ id, nombre, emoji }));

function buscarEstilo(id) {
  return ESTILOS.find((e) => e.id === id) || ESTILOS[0];
}

// ---------- Carga de recursos ----------

let fuentesPedidas = false;

export async function prepararEstilo(id) {
  const estilo = buscarEstilo(id);
  if (!fuentesPedidas) {
    fuentesPedidas = true;
    const enlace = document.createElement("link");
    enlace.rel = "stylesheet";
    enlace.href = URL_FUENTES;
    document.head.appendChild(enlace);
    await new Promise((listo) => {
      enlace.onload = listo;
      enlace.onerror = listo;
    });
  }
  const fuentes = [
    estilo.fuenteTitulo,
    estilo.fuenteSubtitulo,
    estilo.fuenteCabecera,
    `${estilo.pesoTexto} 24px '${estilo.fuenteTexto}'`,
  ];
  // Si una fuente tarda demasiado se dibuja con la de respaldo.
  const espera = new Promise((listo) => setTimeout(listo, 4000));
  await Promise.race([Promise.all(fuentes.map((f) => document.fonts.load(f).catch(() => null))), espera]);
}

function cargarJsPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  return new Promise((listo, fallo) => {
    const script = document.createElement("script");
    script.src = URL_JSPDF;
    script.onload = () => listo(window.jspdf);
    script.onerror = () => fallo(new Error("No se pudo cargar jsPDF"));
    document.head.appendChild(script);
  });
}

// ---------- Dibujo del horario ----------

function dibujarTitulo(ctx, estilo) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = estilo.fuenteTitulo;
  const anchoTitulo = ctx.measureText(estilo.titulo).width;
  if (Array.isArray(estilo.colorTitulo)) {
    const g = ctx.createLinearGradient(ANCHO / 2 - anchoTitulo / 2, 0, ANCHO / 2 + anchoTitulo / 2, 0);
    estilo.colorTitulo.forEach((c, i) => g.addColorStop(i / (estilo.colorTitulo.length - 1), c));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = estilo.colorTitulo;
  }
  if (estilo.bordeTitulo) {
    ctx.lineJoin = "round";
    ctx.strokeStyle = estilo.bordeTitulo.color;
    ctx.lineWidth = estilo.bordeTitulo.ancho;
    ctx.strokeText(estilo.titulo, ANCHO / 2, 120);
  }
  if (estilo.sombraTitulo) {
    ctx.shadowColor = estilo.sombraTitulo.color;
    ctx.shadowBlur = estilo.sombraTitulo.blur;
  }
  ctx.fillText(estilo.titulo, ANCHO / 2, 120);
  ctx.shadowBlur = 0;

  ctx.font = estilo.fuenteSubtitulo;
  if (estilo.bordeSubtitulo) {
    ctx.strokeStyle = estilo.bordeSubtitulo.color;
    ctx.lineWidth = estilo.bordeSubtitulo.ancho;
    ctx.strokeText(estilo.subtitulo, ANCHO / 2, 212);
  }
  ctx.fillStyle = estilo.colorSubtitulo;
  ctx.fillText(estilo.subtitulo, ANCHO / 2, 212);
  ctx.restore();
}

function dibujarAdornos(ctx, estilo, azar) {
  estilo.adornos.forEach((caracter, i) => {
    const hueco = HUECOS_ADORNOS[i];
    if (!caracter || !hueco) return;
    const [x, y, tamano] = hueco;
    emoji(ctx, caracter, x, y, tamano, (azar() - 0.5) * 0.6);
  });
}

// Escribe materia, hora y aula centradas dentro del bloque, achicando la
// letra hasta que quepa.
function dibujarTextoBloque(ctx, estilo, clase, x, y, w, h) {
  const familia = `'${estilo.fuenteTexto}', sans-serif`;
  const anchoTexto = w - 24;
  const horario = `(${horaCorta(clase.horaInicio)} – ${horaCorta(clase.horaFin)})`;

  let tamano = 30;
  let lineas = [];
  let alto = 0;
  for (; tamano >= 13; tamano -= 1) {
    ctx.font = `${estilo.pesoTexto} ${tamano}px ${familia}`;
    lineas = envolverTexto(ctx, clase.materia, anchoTexto);
    alto = lineas.length * tamano * 1.18 + tamano * 1.25;
    if (clase.aula) alto += tamano * 1.1;
    if (alto <= h - 16) break;
  }

  // Si ni con la letra mínima cabe, recorta líneas.
  const maxLineas = Math.max(1, Math.floor((h - 16 - tamano * 1.25) / (tamano * 1.18)));
  const mostrarAula = clase.aula && alto <= h - 16;
  if (lineas.length > maxLineas) {
    lineas = lineas.slice(0, maxLineas);
    lineas[maxLineas - 1] += "…";
  }

  const altoFinal = lineas.length * tamano * 1.18 + tamano * 1.25 + (mostrarAula ? tamano * 1.1 : 0);
  let cursor = y + (h - altoFinal) / 2 + tamano * 0.6;

  ctx.fillStyle = estilo.textoClase;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${estilo.pesoTexto} ${tamano}px ${familia}`;
  lineas.forEach((linea) => {
    ctx.fillText(linea, x + w / 2, cursor);
    cursor += tamano * 1.18;
  });

  ctx.font = `${estilo.pesoTexto} ${Math.round(tamano * 0.82)}px ${familia}`;
  ctx.globalAlpha = 0.85;
  cursor += tamano * 0.1;
  ctx.fillText(horario, x + w / 2, cursor);
  if (mostrarAula) {
    cursor += tamano * 1.1;
    ctx.fillText(clase.aula, x + w / 2, cursor);
  }
  ctx.globalAlpha = 1;
  return altoFinal;
}

export function dibujarHorario(canvas, clases, idEstilo) {
  const estilo = buscarEstilo(idEstilo);
  const azar = aleatorioConSemilla(20260923);
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext("2d");

  estilo.fondo(ctx, azar);
  dibujarTitulo(ctx, estilo);
  dibujarAdornos(ctx, estilo, azar);
  if (estilo.encima) estilo.encima(ctx);

  // Lunes a viernes siempre; sábado y domingo solo si hay clases.
  const dias = DIAS_SEMANA.filter(
    (dia, i) => i < 5 || clases.some((c) => (c.dias || []).includes(dia))
  );

  let horaInicio = 7;
  let horaFin = 18;
  clases.forEach((c) => {
    horaInicio = Math.min(horaInicio, Math.floor(minutos(c.horaInicio) / 60));
    horaFin = Math.max(horaFin, Math.ceil(minutos(c.horaFin) / 60));
  });
  const filas = horaFin - horaInicio;

  const area = { x: 135, y: 262, w: ANCHO - 270, h: ALTO - 262 - 78 };
  const separacion = 8;
  const anchoHora = 210;
  const altoCabecera = 70;
  const anchoColumna = (area.w - anchoHora - separacion * dias.length) / dias.length;
  const xColumna = (i) => area.x + anchoHora + separacion + i * (anchoColumna + separacion);
  const yFilas = area.y + altoCabecera + separacion;
  const altoFila = (area.y + area.h - yFilas) / filas;

  const celda = (x, y, w, h, fondo, borde, radio = 12) => {
    rectRedondeado(ctx, x, y, w, h, radio);
    ctx.fillStyle = fondo;
    ctx.fill();
    if (borde) {
      ctx.strokeStyle = borde;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  // Cabeceras
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  celda(area.x, area.y, anchoHora, altoCabecera, estilo.horaFondo, null, 16);
  ctx.font = estilo.fuenteCabecera;
  ctx.fillStyle = estilo.horaTexto;
  ctx.fillText("Hora", area.x + anchoHora / 2, area.y + altoCabecera / 2 + 2);

  dias.forEach((dia, i) => {
    const fondo = estilo.cabeceraFondo[i % estilo.cabeceraFondo.length];
    celda(xColumna(i), area.y, anchoColumna, altoCabecera, fondo, null, 16);
    ctx.font = estilo.fuenteCabecera;
    ctx.fillStyle = estilo.cabeceraTexto;
    ctx.fillText(dia + (estilo.marcaCabecera || ""), xColumna(i) + anchoColumna / 2, area.y + altoCabecera / 2 + 2);
  });

  // Filas de horas y celdas vacías
  // Tamaño de la hora: el que quepa a lo ancho y a lo alto de la celda.
  let tamanoHora = Math.min(30, Math.max(16, altoFila * 0.42));
  const fuenteHora = () => `${estilo.pesoTexto} ${tamanoHora}px '${estilo.fuenteTexto}', sans-serif`;
  ctx.font = fuenteHora();
  while (tamanoHora > 14 && ctx.measureText("20:00 – 21:00").width > anchoHora - 28) {
    tamanoHora -= 1;
    ctx.font = fuenteHora();
  }
  for (let f = 0; f < filas; f++) {
    const y = yFilas + f * altoFila;
    celda(area.x, y + 2, anchoHora, altoFila - 4, estilo.horaFondo, null, 10);
    ctx.font = fuenteHora();
    ctx.fillStyle = estilo.horaTexto;
    ctx.fillText(`${horaInicio + f}:00 – ${horaInicio + f + 1}:00`, area.x + anchoHora / 2, y + altoFila / 2 + 1);
    dias.forEach((_, i) => {
      celda(xColumna(i), y + 2, anchoColumna, altoFila - 4, estilo.celdaFondo, estilo.celdaBorde, 10);
    });
  }

  // Bloques de clases
  const materias = [...new Set(clases.map((c) => c.materia))];
  clases.forEach((clase) => {
    const indiceMateria = materias.indexOf(clase.materia);
    const color = estilo.paleta[indiceMateria % estilo.paleta.length];
    const icono = estilo.iconos[indiceMateria % estilo.iconos.length];
    const y1 = yFilas + ((minutos(clase.horaInicio) - horaInicio * 60) / 60) * altoFila + 3;
    const y2 = yFilas + ((minutos(clase.horaFin) - horaInicio * 60) / 60) * altoFila - 3;
    if (y2 <= y1) return;

    (clase.dias || []).forEach((dia) => {
      const i = dias.indexOf(dia);
      if (i === -1) return;
      const x = xColumna(i) + 3;
      const w = anchoColumna - 6;
      const h = y2 - y1;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      celda(x, y1, w, h, color, "rgba(255, 255, 255, 0.55)", 14);
      ctx.restore();

      const altoTexto = dibujarTextoBloque(ctx, estilo, clase, x, y1, w, h);

      // El icono va en la esquina solo si no tapa el texto.
      if (h - altoTexto >= 40 && w >= 200) {
        ctx.globalAlpha = 0.9;
        emoji(ctx, icono, x + w - 24, y1 + h - 24, 26);
        ctx.globalAlpha = 1;
      }
    });
  });
}

export async function descargarPdf(canvas, idEstilo) {
  const { jsPDF } = await cargarJsPdf();
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 297, 210);
  pdf.save(`mi-horario-${buscarEstilo(idEstilo).id}.pdf`);
}
