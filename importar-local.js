// Lector de horarios que corre en el celular, gratis y sin servidor.
//
// - PDF con texto: PDF.js saca cada palabra con su posición.
// - Foto o captura: Tesseract (OCR) reconoce las palabras con su posición.
//
// Con esas palabras se prueban dos formas comunes de horario y se queda la
// que encuentre más clases:
//   1. Cuadrícula: los días son columnas y las horas son filas.
//   2. Lista: cada fila trae materia, días y horas ("Cálculo · Lun Mié 7:00-9:00").
//
// Si no encuentra nada, la app le pasa la imagen a la IA gratis de Cloudflare.
// Las librerías se descargan solo cuando alguien importa (no pesan en la app).

const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
const TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const MAX_PAGINAS = 3;

export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// ---------- Texto: días, horas y limpieza ----------

function sinTildes(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const DIA_LARGO = {
  lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6,
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
};
const DIA_CORTO = {
  lun: 0, mar: 1, mie: 2, mier: 2, jue: 3, vie: 4, sab: 5, dom: 6,
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
};
// Las abreviaturas de 2 letras solo cuentan en MAYÚSCULAS ("LU MI"), para no
// confundir palabras como "a", "de" o "do".
const DIA_DOS = { LU: 0, MA: 1, MI: 2, JU: 3, VI: 4, SA: 5, DO: 6 };

// Cuántas letras hay que cambiar para pasar de una palabra a otra.
function distancia(a, b) {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return fila[b.length];
}

const DIAS_ESPANOL = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

// Día de un token suelto, o -1. Acepta errores de una letra en los nombres
// completos ("Viemes" por "Viernes"), que el OCR comete a menudo.
function diaDeToken(token) {
  const limpio = token.replace(/[.,:;()|]/g, "");
  if (!limpio) return -1;
  const t = sinTildes(limpio);
  if (t in DIA_LARGO) return DIA_LARGO[t];
  if (t in DIA_CORTO && limpio.length <= 4) return DIA_CORTO[t];
  if (limpio.length === 2 && limpio in DIA_DOS) return DIA_DOS[limpio];
  if (t.length >= 5 && /^[a-z]+$/.test(t)) {
    const i = DIAS_ESPANOL.findIndex((d) => distancia(t, d) <= (d.length >= 8 ? 2 : 1));
    if (i >= 0) return i;
  }
  return -1;
}

const AMPM = String.raw`(a\.?\s?m\.?|p\.?\s?m\.?)`;
const RE_RANGO = new RegExp(
  String.raw`(\d{1,2})(?:\s*[:.h]\s*(\d{2}))?\s*${AMPM}?\s*(?:-|–|—|\ba\b|\bal\b|hasta|\bto\b)\s*(\d{1,2})(?:\s*[:.h]\s*(\d{2}))?\s*${AMPM}?`,
  "gi"
);
const RE_HORA = new RegExp(String.raw`^\s*(\d{1,2})\s*(?:[:.h]\s*(\d{2}))?\s*${AMPM}?\s*$`, "i");

function aMinutos(hora, minutos, ampm) {
  let h = Number(hora);
  const m = Number(minutos || 0);
  if (h > 23 || m > 59) return NaN;
  if (ampm) {
    const pm = /p/i.test(ampm);
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  } else if (h >= 1 && h <= 5) {
    h += 12; // nadie tiene clase a las 3 de la mañana: son las 3 de la tarde
  }
  return h * 60 + m;
}

function textoHora(minutos) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

function rangoValido(inicio, fin) {
  return inicio >= 5 * 60 && fin <= 23 * 60 + 59 && fin - inicio >= 30 && fin - inicio <= 6 * 60;
}

// Rangos de hora dentro de un texto: [{ inicio, fin, desde, hasta }]
function rangosEnTexto(texto) {
  const encontrados = [];
  for (const m of texto.matchAll(RE_RANGO)) {
    const [, h1, m1, ap1, h2, m2, ap2] = m;
    // "2 - 3" suelto puede ser un grupo o un número: exige minutos o am/pm,
    // salvo que parezcan horas de clase normales.
    const conPistas = m1 || m2 || ap1 || ap2;
    if (!conPistas && !(Number(h1) >= 6 && Number(h1) <= 21 && Number(h2) > Number(h1))) continue;
    let inicio = aMinutos(h1, m1, ap1 || ap2);
    let fin = aMinutos(h2, m2, ap2 || ap1);
    if (fin <= inicio && !ap2 && fin + 12 * 60 <= 23 * 60 + 59) fin += 12 * 60;
    if (!rangoValido(inicio, fin)) continue;
    encontrados.push({ inicio, fin, desde: m.index, hasta: m.index + m[0].length });
  }
  return encontrados;
}

function horaSuelta(texto) {
  const m = texto.match(RE_HORA);
  if (!m || (!m[2] && !m[3])) return NaN;
  return aMinutos(m[1], m[2], m[3]);
}

const RE_AULA = /\b(aula|sal[oó]n|salon|bloque|edificio|sala|lab(?:oratorio)?|of(?:icina)?\.?)\s*[:#.]?\s*([\w-]+(?:\s*[-–]\s*[\w]+)?)/i;
const RE_CODIGO_SALON = /^[A-Z]{1,3}-?\d{2,4}[A-Z]?$/;
const RE_PROFESOR = /\b(?:prof(?:esor|esora)?|docente|profe)\.?\s*[:.-]?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ.]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ.]+){0,4})/i;
const PALABRAS_BASURA = /^(grupo|g\d+|gr\.?|nrc|cr[eé]ditos?|cr|sec(ci[oó]n)?|horario|hora|hor|d[ií]a|semestre|periodo|per[ií]odo|total|p[aá]gina|materia|asignatura|curso|docente|profesor|aula|sal[oó]n|lugar|codigo|c[oó]digo|nombre|tipo|te[oó]rica|pr[aá]ctica)$/i;

// Deja solo el nombre de la materia: sin códigos, grupos ni números.
function limpiarMateria(texto) {
  let t = texto
    .replace(/\b[A-Z]{2,5}[- ]?\d{2,5}[A-Z]?(?:[-.]\d{1,3})?\b\s*[-–:]?\s*/g, " ") // códigos tipo MAT201-03
    .replace(/\(\s*(g|gr|grupo)?\s*\d+\s*\)/gi, " ")
    .replace(/\b(grupo|gr\.?|nrc|secci[oó]n)\s*[:#]?\s*\d+\b/gi, " ")
    .replace(/^\s*\d+\s+/, " ") // número suelto al inicio (grupo, fila)
    .replace(/\s+/g, " ")
    .trim();
  t = t.replace(/^[\s\-–:·|,]+|[\s\-–:·|,]+$/g, "");
  const letras = (t.match(/[a-záéíóúñ]/gi) || []).length;
  if (letras < 3 || t.length > 80) return "";
  if (DIAS.some((d) => sinTildes(d) === sinTildes(t))) return "";
  return t;
}

// ---------- Palabras → líneas ----------

// items: [{ texto, x, y, ancho, alto }] (y crece hacia abajo)
// Agrupa por el centro de cada palabra: el OCR a veces devuelve cajas muy
// altas (pegadas a las líneas de la tabla) y por su borde de arriba
// quedarían en otro renglón.
function agruparEnLineas(items) {
  const validos = items.filter((i) => i.texto && i.texto.trim());
  const altos = validos.map((i) => i.alto).sort((a, b) => a - b);
  const altoTipico = Math.max(altos[Math.floor(altos.length / 2)] || 10, 4);
  const centro = (i) => i.y + Math.min(i.alto, altoTipico * 3) / 2;
  const ordenados = validos.sort((a, b) => centro(a) - centro(b) || a.x - b.x);
  const lineas = [];
  for (const item of ordenados) {
    const c = centro(item);
    const linea = lineas.find((l) => Math.abs(l.y - c) <= altoTipico * 0.6);
    if (linea) {
      linea.items.push(item);
      linea.y = (linea.y * (linea.items.length - 1) + c) / linea.items.length;
    } else {
      lineas.push({ y: c, items: [item] });
    }
  }
  lineas.forEach((l) => {
    l.items.sort((a, b) => a.x - b.x);
    l.texto = l.items.map((i) => i.texto.trim()).join(" ");
  });
  return lineas.sort((a, b) => a.y - b.y);
}

// Días de una línea con su posición en el texto.
function diasEnLinea(texto) {
  const dias = [];
  const re = /[A-Za-zÁÉÍÓÚáéíóúÑñ.]+/g;
  for (const m of texto.matchAll(re)) {
    const dia = diaDeToken(m[0]);
    if (dia >= 0) dias.push({ dia, desde: m.index, hasta: m.index + m[0].length });
  }
  return dias;
}

// ---------- Estrategia 1: lista (una clase por fila) ----------

// Columnas que se reconocen en el encabezado de una tabla. Día, hora,
// código y grupo no se usan como dato, pero marcan dónde empieza y termina
// cada columna (si no, el aula se "come" la hora de al lado).
const ENCABEZADOS = {
  materia: /^(materia|asignatura|curso|nombre\s+(de\s+la\s+)?(materia|asignatura)|descripci[oó]n)$/i,
  profesor: /^(docente|profesor(es)?|profesora|instructor)$/i,
  aula: /^(aula|sal[oó]n|lugar|ubicaci[oó]n|sala|edificio)$/i,
  dia: /^(d[ií]as?)$/i,
  hora: /^(hora|horas|horario)$/i,
  codigo: /^(c[oó]digo|cod\.?|nrc|clave)$/i,
  grupo: /^(grupo|gr\.?|secci[oó]n)$/i,
};

function buscarEncabezados(lineas) {
  for (const linea of lineas) {
    const columnas = {};
    linea.items.forEach((item) => {
      Object.entries(ENCABEZADOS).forEach(([clave, re]) => {
        if (re.test(item.texto.trim()) && !(clave in columnas)) columnas[clave] = item.x + item.ancho / 2;
      });
    });
    const utiles = ["materia", "profesor", "aula"].filter((c) => c in columnas).length;
    if (utiles >= 1 && Object.keys(columnas).length >= 3) return { y: linea.y, columnas };
  }
  return null;
}

// Texto de la línea que cae bajo una columna del encabezado.
function textoEnColumna(linea, encabezado, clave) {
  const posiciones = Object.entries(encabezado.columnas).sort((a, b) => a[1] - b[1]);
  const i = posiciones.findIndex(([c]) => c === clave);
  if (i < 0) return "";
  const izquierda = i > 0 ? (posiciones[i - 1][1] + posiciones[i][1]) / 2 : -Infinity;
  const derecha = i < posiciones.length - 1 ? (posiciones[i][1] + posiciones[i + 1][1]) / 2 : Infinity;
  return linea.items
    .filter((it) => {
      const centro = it.x + it.ancho / 2;
      return centro >= izquierda && centro < derecha;
    })
    .map((it) => it.texto.trim())
    .join(" ");
}

function leerComoLista(lineas) {
  const encabezado = buscarEncabezados(lineas);
  const clases = [];
  let ultimaMateria = "";
  let ultimoProfesor = "";
  let ultimaAula = "";

  lineas.forEach((linea) => {
    if (encabezado && linea.y <= encabezado.y) return;
    const texto = linea.texto;
    const rangos = rangosEnTexto(texto);
    const dias = diasEnLinea(texto);

    // Materia, aula y profesor de esta fila.
    let materia = "";
    let aula = "";
    let profesor = "";
    if (encabezado) {
      materia = limpiarMateria(textoEnColumna(linea, encabezado, "materia"));
      aula = textoEnColumna(linea, encabezado, "aula").trim();
      profesor = textoEnColumna(linea, encabezado, "profesor").trim();
    }
    if (!aula) {
      const m = texto.match(RE_AULA);
      if (m) aula = m[0].trim();
      else aula = linea.items.map((i) => i.texto.trim()).find((t) => RE_CODIGO_SALON.test(t)) || "";
    }
    if (!profesor) {
      const m = texto.match(RE_PROFESOR);
      if (m) profesor = m[1].trim();
    }
    if (!materia && !encabezado) {
      // Lo que queda al quitar días, horas, salón y basura.
      let resto = texto;
      [...rangos, ...dias]
        .sort((a, b) => b.desde - a.desde)
        .forEach((p) => (resto = resto.slice(0, p.desde) + " | " + resto.slice(p.hasta)));
      resto = resto.replace(RE_AULA, " | ").replace(RE_PROFESOR, " | ");
      const trozos = resto
        .split(/\s*\|\s*|\s{2,}/)
        .map((t) => t.split(" ").filter((p) => !PALABRAS_BASURA.test(p) && !RE_CODIGO_SALON.test(p)).join(" "))
        .map(limpiarMateria)
        .filter(Boolean);
      materia = trozos.sort((a, b) => b.length - a.length)[0] || "";
    }

    if (!rangos.length || !dias.length) {
      // Fila sin horario: puede ser el nombre de la materia de las filas de
      // abajo, o un renglón aparte con el docente ("Docente: Ana Gómez").
      if (!rangos.length) {
        if (materia) {
          ultimaMateria = materia;
          ultimoProfesor = profesor;
          ultimaAula = aula;
        } else if (profesor) {
          ultimoProfesor = profesor;
        }
      }
      return;
    }

    if (!materia) materia = ultimaMateria;
    if (!materia) return;
    if (encabezado && materia) ultimaMateria = materia;
    if (!profesor && materia === ultimaMateria) profesor = ultimoProfesor;
    if (!aula && materia === ultimaMateria) aula = ultimaAula;

    // Empareja cada rango con los días escritos antes de él (o, si no hay,
    // con los que vienen después): "Lun 7-9 Mié 10-12" o "7-9 Lun Mié".
    rangos.forEach((rango, i) => {
      const inicioZona = i === 0 ? 0 : rangos[i - 1].hasta;
      let suyos = dias.filter((d) => d.desde >= inicioZona && d.hasta <= rango.desde);
      if (!suyos.length) {
        const finZona = i < rangos.length - 1 ? rangos[i + 1].desde : Infinity;
        suyos = dias.filter((d) => d.desde >= rango.hasta && d.hasta <= finZona);
      }
      if (!suyos.length && rangos.length === 1) suyos = dias;
      if (!suyos.length) return;
      clases.push({
        materia,
        dias: [...new Set(suyos.map((d) => d.dia))],
        inicio: rango.inicio,
        fin: rango.fin,
        aula,
        profesor,
      });
    });
  });
  return clases;
}

// ---------- Estrategia 2: cuadrícula (días en columnas, horas en filas) ----------

// Bordes horizontales dibujados en el PDF: [{ y, x1, x2 }]. Sirven para saber
// dónde empieza y termina una celda combinada (una clase de 2-3 horas con
// el nombre escrito una sola vez en el medio).
function bordeArribaYAbajo(bordes, x, y) {
  let arriba = null;
  let abajo = null;
  bordes.forEach((b) => {
    if (b.x1 > x || b.x2 < x) return;
    if (b.y <= y && (!arriba || b.y > arriba)) arriba = b.y;
    if (b.y > y && (!abajo || b.y < abajo)) abajo = b.y;
  });
  return arriba !== null && abajo !== null ? { arriba, abajo } : null;
}

function leerComoCuadricula(lineas, bordes = []) {
  // Encabezado: la primera línea con al menos 3 días distintos.
  let columnas = null;
  let yEncabezado = 0;
  for (const linea of lineas) {
    const cols = [];
    linea.items.forEach((item) => {
      // Un mismo trozo de texto puede traer varios días ("Lunes Martes ...").
      const palabras = item.texto.trim().split(/\s+/);
      const anchoLetra = item.ancho / Math.max(item.texto.length, 1);
      let desplazamiento = 0;
      palabras.forEach((palabra) => {
        const dia = diaDeToken(palabra);
        if (dia >= 0) cols.push({ dia, x: item.x + (desplazamiento + palabra.length / 2) * anchoLetra });
        desplazamiento += palabra.length + 1;
      });
    });
    if (new Set(cols.map((c) => c.dia)).size >= 3) {
      columnas = cols;
      yEncabezado = linea.y;
      break;
    }
  }
  if (!columnas) return [];
  columnas.sort((a, b) => a.x - b.x);
  const distancias = columnas.slice(1).map((c, i) => c.x - columnas[i].x).sort((a, b) => a - b);
  const anchoColumna = distancias[Math.floor(distancias.length / 2)] || 100;
  const bordeTiempo = columnas[0].x - anchoColumna * 0.5;

  // Etiquetas de hora a la izquierda de la primera columna.
  const franjas = [];
  lineas.forEach((linea) => {
    if (linea.y <= yEncabezado) return;
    const izquierda = linea.items.filter((i) => i.x + i.ancho / 2 < bordeTiempo);
    if (!izquierda.length) return;
    const texto = izquierda.map((i) => i.texto.trim()).join(" ");
    const rango = rangosEnTexto(texto)[0];
    const inicio = rango ? rango.inicio : horaSuelta(texto);
    if (Number.isNaN(inicio)) return;
    const y = Math.min(...izquierda.map((i) => i.y));
    const x = izquierda.reduce((t, i) => t + i.x + i.ancho / 2, 0) / izquierda.length;
    if (!franjas.some((f) => Math.abs(f.y - y) < 3)) franjas.push({ y, x, inicio, fin: rango ? rango.fin : null });
  });
  franjas.sort((a, b) => a.y - b.y);
  if (franjas.length < 2) return [];
  const altoFranja = (franjas[franjas.length - 1].y - franjas[0].y) / (franjas.length - 1);

  // Texto de cada celda (día × franja).
  const celdas = new Map();
  lineas.forEach((linea) => {
    if (linea.y <= yEncabezado) return;
    linea.items.forEach((item) => {
      const centro = item.x + item.ancho / 2;
      if (centro < bordeTiempo) return;
      const columna = columnas.reduce((mejor, c) => (Math.abs(c.x - centro) < Math.abs(mejor.x - centro) ? c : mejor));
      if (Math.abs(columna.x - centro) > anchoColumna * 0.6) return;
      let franja = -1;
      franjas.forEach((f, i) => {
        if (f.y <= item.y + altoFranja * 0.35) franja = i;
      });
      if (franja < 0) return;
      const clave = `${columna.dia}|${franja}`;
      if (!celdas.has(clave)) celdas.set(clave, []);
      celdas.get(clave).push(item);
    });
  });

  const finDeFranja = (i) => franjas[i].fin ?? franjas[i + 1]?.inicio ?? franjas[i].inicio + 60;

  // Hora de una altura de la página (recta entre la primera y la última
  // etiqueta de hora). Las etiquetas quedan un poco más abajo que el borde
  // de su fila: ese "margen" se mide con los bordes dibujados.
  const primera = franjas[0];
  const ultima = franjas[franjas.length - 1];
  const minutosPorPunto = (ultima.inicio - primera.inicio) / (ultima.y - primera.y || 1);
  const margenes = franjas
    .map((f) => {
      const b = bordeArribaYAbajo(bordes, f.x, f.y + 1);
      if (b && f.y - b.arriba < altoFranja * 0.6) return f.y - b.arriba;
      // Sin líneas junto a la hora: el borde de fila más cercano en cualquier columna.
      const cercano = bordes
        .filter((bo) => bo.y <= f.y + 1 && f.y - bo.y < altoFranja * 0.6)
        .reduce((mejor, bo) => (mejor === null || bo.y > mejor ? bo.y : mejor), null);
      return cercano === null ? null : f.y - cercano;
    })
    .filter((m) => m !== null)
    .sort((a, b) => a - b);
  const margen = margenes.length ? margenes[Math.floor(margenes.length / 2)] : 0;
  const horaDeAltura = (y) => Math.round((primera.inicio + (y + margen - primera.y) * minutosPorPunto) / 5) * 5;

  const clases = [];
  DIAS.forEach((_, dia) => {
    const xColumna = columnas.find((c) => c.dia === dia)?.x;
    let actual = null;
    franjas.forEach((_, i) => {
      const items = (celdas.get(`${dia}|${i}`) || []).sort((a, b) => a.y - b.y || a.x - b.x);
      const lineasCelda = agruparEnLineas(items).map((l) => l.texto);
      const texto = lineasCelda.join(" ");
      let materia = "";
      for (const l of lineasCelda) {
        const sinRuido = l.split(" ").filter((p) => !PALABRAS_BASURA.test(p) && !RE_CODIGO_SALON.test(p)).join(" ");
        materia = limpiarMateria(sinRuido.replace(RE_AULA, "").replace(RE_PROFESOR, "").replace(RE_RANGO, ""));
        if (materia) break;
      }
      const aula = (texto.match(RE_AULA) || [])[0] || lineasCelda.flatMap((l) => l.split(" ")).find((t) => RE_CODIGO_SALON.test(t)) || "";
      const prof = (texto.match(RE_PROFESOR) || [])[1] || "";

      // (Si la clase trae su propia hora escrita, esa manda: no se alarga.)
      if (actual && materia && sinTildes(materia) === sinTildes(actual.materia)) {
        if (!actual.conRango) actual.fin = Math.max(actual.fin, finDeFranja(i)); // sigue en la franja de abajo
        return;
      }
      // Celda sin materia pero con salón/docente justo debajo: es la
      // continuación de la clase de arriba (texto partido en dos franjas).
      if (actual && !materia && items.length && (aula || prof)) {
        if (!actual.aula && aula) actual.aula = aula.trim();
        if (!actual.profesor && prof) actual.profesor = prof.trim();
        if (!actual.conRango) actual.fin = Math.max(actual.fin, finDeFranja(i));
        return;
      }
      if (actual) clases.push(actual);
      actual = null;
      if (!materia) return;

      // Si la celda trae su propio rango de hora ("7:00-9:00"), manda ese.
      const rango = rangosEnTexto(texto)[0];
      actual = {
        materia,
        dias: [dia],
        inicio: rango ? rango.inicio : franjas[i].inicio,
        fin: rango ? rango.fin : finDeFranja(i),
        aula: aula.trim(),
        profesor: prof.trim(),
        conRango: Boolean(rango),
        yTexto: items[0].y + items[0].alto / 2,
      };
    });
    if (actual) clases.push(actual);

    // Con los bordes dibujados, el bloque de la clase dice su hora exacta.
    if (bordes.length && xColumna !== undefined) {
      clases
        .filter((c) => c.dias[0] === dia && !c.conRango)
        .forEach((c) => {
          const bloque = bordeArribaYAbajo(bordes, xColumna, c.yTexto);
          if (!bloque || bloque.abajo - bloque.arriba < altoFranja * 0.6) return;
          const inicio = horaDeAltura(bloque.arriba);
          const fin = horaDeAltura(bloque.abajo);
          // Solo si el bloque es igual o más largo: en una cuadrícula con una
          // línea por fila, el borde de una sola fila no debe acortar la clase.
          if (rangoValido(inicio, fin) && fin - inicio >= c.fin - c.inicio) {
            c.inicio = inicio;
            c.fin = fin;
          }
        });
    }
  });
  return clases.filter((c) => rangoValido(c.inicio, c.fin));
}

// Quita de aula/docente los pedazos de hora que se colaron de la columna
// de al lado ("m. B-204" → "B-204").
function limpiarCampo(texto) {
  return (texto || "")
    .replace(RE_RANGO, " ")
    .replace(/\b\d{1,2}[:.]\d{2}\b/g, " ")
    .replace(/(^|\s)[ap]\.?\s?m\.?(?=\s|$|-)/gi, " ")
    .replace(/^\s*m\.\s+/i, " ") // "m." suelto: la "a."/"p." quedó en la otra columna
    .replace(/^[\s\-–.,:;|]+|[\s\-–.,:;|]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Junta resultados ----------

// Misma materia y mismas horas en varios días → una sola clase.
function unirPorMateria(clases) {
  const grupos = new Map();
  clases.forEach((c) => {
    const clave = `${sinTildes(c.materia)}|${c.inicio}|${c.fin}`;
    if (!grupos.has(clave)) grupos.set(clave, { ...c, dias: [] });
    const g = grupos.get(clave);
    c.dias.forEach((d) => g.dias.includes(d) || g.dias.push(d));
    if (!g.aula && c.aula) g.aula = c.aula;
    if (!g.profesor && c.profesor) g.profesor = c.profesor;
  });
  return [...grupos.values()].map((c) => ({
    materia: c.materia,
    dias: c.dias.sort((a, b) => a - b).map((d) => DIAS[d]),
    horaInicio: textoHora(c.inicio),
    horaFin: textoHora(c.fin),
    aula: limpiarCampo(c.aula).slice(0, 60),
    profesor: limpiarCampo(c.profesor).slice(0, 80),
  }));
}

// paginas: [{ items: [{ texto, x, y, ancho, alto }], bordes: [{ y, x1, x2 }] }]
// → clases en el formato de la app
export function analizarPaginas(paginas) {
  let mejor = [];
  paginas.forEach(({ items, bordes = [] }) => {
    const lineas = agruparEnLineas(items);
    const lista = unirPorMateria(leerComoLista(lineas));
    const cuadricula = unirPorMateria(leerComoCuadricula(lineas, bordes));
    const deEstaPagina = cuadricula.length >= lista.length ? cuadricula : lista;
    mejor = mejor.concat(deEstaPagina);
  });
  // Por si la misma clase aparece en dos páginas.
  const vistas = new Set();
  return mejor.filter((c) => {
    const clave = `${sinTildes(c.materia)}|${c.dias.join()}|${c.horaInicio}|${c.horaFin}`;
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

// Para pruebas y diagnóstico.
export const _interno = { agruparEnLineas, leerComoLista, leerComoCuadricula, rangosEnTexto, diasEnLinea };

// ---------- Leer archivos ----------

let pdfjs = null;
async function cargarPdfjs() {
  if (!pdfjs) {
    pdfjs = await import(PDFJS);
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  }
  return pdfjs;
}

function cargarScript(url) {
  return new Promise((listo, fallo) => {
    const script = document.createElement("script");
    script.src = url;
    script.onload = listo;
    script.onerror = () => fallo(new Error(`No se pudo cargar ${url}`));
    document.head.appendChild(script);
  });
}

function multiplicar(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

// Bordes horizontales que dibuja el PDF (rectángulos y líneas de la tabla),
// ya en las mismas coordenadas que el texto.
export function bordesDeOperaciones(operaciones, OPS, vista) {
  const bordes = [];
  const pila = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const aVista = (x, y) => {
    const px = ctm[0] * x + ctm[2] * y + ctm[4];
    const py = ctm[1] * x + ctm[3] * y + ctm[5];
    return vista.convertToViewportPoint(px, py);
  };
  const agregar = (a, b) => {
    if (Math.abs(a[1] - b[1]) > 1.5 || Math.abs(a[0] - b[0]) < 10) return; // solo horizontales
    bordes.push({ y: (a[1] + b[1]) / 2, x1: Math.min(a[0], b[0]), x2: Math.max(a[0], b[0]) });
  };
  const { fnArray, argsArray } = operaciones;
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i];
    if (fn === OPS.save) pila.push(ctm);
    else if (fn === OPS.restore) ctm = pila.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = multiplicar(ctm, args);
    else if (fn === OPS.constructPath && Array.isArray(args?.[0])) {
      const [ops, coords] = args;
      let k = 0;
      let actual = null;
      ops.forEach((op) => {
        if (op === OPS.rectangle) {
          const [x, y, w, h] = coords.slice(k, k + 4);
          k += 4;
          const esquinas = [aVista(x, y), aVista(x + w, y), aVista(x + w, y + h), aVista(x, y + h)];
          agregar(esquinas[0], esquinas[1]);
          agregar(esquinas[3], esquinas[2]);
        } else if (op === OPS.moveTo) {
          actual = aVista(coords[k], coords[k + 1]);
          k += 2;
        } else if (op === OPS.lineTo) {
          const punto = aVista(coords[k], coords[k + 1]);
          k += 2;
          if (actual) agregar(actual, punto);
          actual = punto;
        } else if (op === OPS.curveTo) k += 6;
        else if (op === OPS.curveTo2 || op === OPS.curveTo3) k += 4;
      });
    }
  }
  return bordes;
}

// Palabras de un PDF con texto (no sirve para PDFs escaneados).
async function palabrasDePdf(documento, OPS) {
  const paginas = [];
  for (let n = 1; n <= Math.min(documento.numPages, MAX_PAGINAS); n++) {
    const pagina = await documento.getPage(n);
    const vista = pagina.getViewport({ scale: 1 });
    const contenido = await pagina.getTextContent();
    let bordes = [];
    try {
      bordes = bordesDeOperaciones(await pagina.getOperatorList(), OPS, vista);
    } catch (error) {
      console.warn("No se pudieron leer las líneas del PDF:", error);
    }
    paginas.push({
      bordes,
      items: contenido.items
        .filter((i) => i.str && i.str.trim())
        .map((i) => {
          const alto = Math.hypot(i.transform[2], i.transform[3]) || i.height || 10;
          return { texto: i.str, x: i.transform[4], y: vista.height - i.transform[5] - alto, ancho: i.width, alto };
        }),
    });
  }
  return paginas;
}

// Dibuja las primeras páginas del PDF una debajo de otra (para OCR o IA).
async function pdfACanvas(documento, paginasMax = 2) {
  const lienzos = [];
  for (let n = 1; n <= Math.min(documento.numPages, paginasMax); n++) {
    const pagina = await documento.getPage(n);
    const base = pagina.getViewport({ scale: 1 });
    const vista = pagina.getViewport({ scale: Math.min(3, 1800 / base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vista.width);
    canvas.height = Math.round(vista.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvasContext: ctx, viewport: vista }).promise;
    lienzos.push(canvas);
  }
  const final = document.createElement("canvas");
  final.width = Math.max(...lienzos.map((c) => c.width));
  final.height = lienzos.reduce((t, c) => t + c.height, 0);
  const ctx = final.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, final.width, final.height);
  let y = 0;
  lienzos.forEach((c) => {
    ctx.drawImage(c, 0, y);
    y += c.height;
  });
  return final;
}

// Líneas horizontales de una tabla en una imagen (para las celdas
// combinadas de las capturas): filas de píxeles más oscuras que lo que
// tienen justo arriba y abajo, a lo largo de un buen tramo.
export function bordesDeImagen(gris, ancho, alto) {
  const bordes = [];
  const tramoMinimo = Math.max(40, ancho * 0.05);
  for (let y = 2; y < alto - 2; y++) {
    let inicio = -1;
    for (let x = 0; x <= ancho; x++) {
      let esLinea = false;
      if (x < ancho) {
        const aqui = gris[y * ancho + x];
        const vecino = Math.min(gris[(y - 2) * ancho + x], gris[(y + 2) * ancho + x]);
        esLinea = aqui < vecino - 20;
      }
      if (esLinea && inicio < 0) inicio = x;
      if (!esLinea && inicio >= 0) {
        if (x - inicio >= tramoMinimo) bordes.push({ y, x1: inicio, x2: x - 1 });
        inicio = -1;
      }
    }
  }
  // Une filas pegadas (una línea de 2-3 px de grosor es un solo borde).
  const unidos = [];
  bordes
    .sort((a, b) => a.x1 - b.x1 || a.y - b.y)
    .forEach((b) => {
      const previo = unidos.find((u) => Math.abs(u.y - b.y) <= 3 && b.x1 < u.x2 && b.x2 > u.x1);
      if (previo) {
        previo.x1 = Math.min(previo.x1, b.x1);
        previo.x2 = Math.max(previo.x2, b.x2);
      } else unidos.push({ ...b });
    });
  return unidos;
}

function grisDeCanvas(canvas) {
  const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  const gris = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0; i < gris.length; i++) {
    gris[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  }
  return gris;
}

function imagenACanvas(archivo) {
  return new Promise((listo, fallo) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      URL.revokeObjectURL(url);
      // El OCR lee mucho mejor si la imagen es grande: se agranda hasta
      // ~2000 px de ancho (sin pasar de 4000 px por lado).
      const escala = Math.min(4000 / Math.max(imagen.width, imagen.height), Math.max(1, 2000 / imagen.width));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(imagen.width * escala);
      canvas.height = Math.round(imagen.height * escala);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
      listo(canvas);
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      fallo(new Error("No se pudo abrir la imagen"));
    };
    imagen.src = url;
  });
}

// OCR en el celular: palabras de una imagen con su posición.
async function palabrasDeImagen(canvas, alProgresar) {
  if (!window.Tesseract) await cargarScript(TESSERACT);
  const worker = await window.Tesseract.createWorker("spa", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && alProgresar) alProgresar(Math.round(m.progress * 100));
    },
  });
  try {
    // Modo "texto disperso": encuentra mejor el texto suelto dentro de tablas.
    await worker.setParameters({ tessedit_pageseg_mode: "11" });
    const { data } = await worker.recognize(canvas);
    let bordes = [];
    try {
      bordes = bordesDeImagen(grisDeCanvas(canvas), canvas.width, canvas.height);
    } catch (error) {
      console.warn("No se pudieron buscar las líneas de la imagen:", error);
    }
    return [
      {
        bordes,
        items: (data.words || [])
          .filter((w) => w.text && w.text.trim() && w.confidence > 30)
          .map((w) => ({
            texto: w.text,
            x: w.bbox.x0,
            y: w.bbox.y0,
            ancho: w.bbox.x1 - w.bbox.x0,
            alto: w.bbox.y1 - w.bbox.y0,
          })),
      },
    ];
  } finally {
    await worker.terminate();
  }
}

function canvasABase64(canvas) {
  // Tamaño razonable para la IA: lado mayor de ~1600 px.
  const escala = Math.min(1, 1600 / Math.max(canvas.width, canvas.height));
  let fuente = canvas;
  if (escala < 1) {
    fuente = document.createElement("canvas");
    fuente.width = Math.round(canvas.width * escala);
    fuente.height = Math.round(canvas.height * escala);
    fuente.getContext("2d").drawImage(canvas, 0, 0, fuente.width, fuente.height);
  }
  return fuente.toDataURL("image/jpeg", 0.85).split(",")[1];
}

// Lee el horario en el celular. Devuelve las clases encontradas y una
// función para sacar la imagen que se le mandaría a la IA si hace falta.
export async function leerHorarioLocal(archivo, alProgresar = () => {}) {
  if (archivo.type === "application/pdf") {
    const lib = await cargarPdfjs();
    const documento = await lib.getDocument({ data: await archivo.arrayBuffer() }).promise;
    let canvasCache = null;
    const canvas = async () => (canvasCache ||= await pdfACanvas(documento));

    let paginas = await palabrasDePdf(documento, lib.OPS);
    const palabras = paginas.reduce((t, p) => t + p.items.length, 0);
    // PDF escaneado (sin texto): se lee como imagen con OCR.
    if (palabras < 10) paginas = await palabrasDeImagen(await canvas(), alProgresar);

    return { clases: analizarPaginas(paginas), imagenParaIA: async () => canvasABase64(await canvas()) };
  }

  const canvas = await imagenACanvas(archivo);
  const paginas = await palabrasDeImagen(canvas, alProgresar);
  return { clases: analizarPaginas(paginas), imagenParaIA: async () => canvasABase64(canvas) };
}
