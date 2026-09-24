// 20 avatares ("muñequitos") dibujados en SVG. Se guardan por id en
// perfiles/{uid}.avatar y se pintan donde va la inicial de la persona.

const CUERPO = "M20 100c0-17 13-28 30-28s30 11 30 28z";

// ---------- Personas ----------

const PERSONAS = {
  a1: { fondo: "#c4b5fd", piel: "#f1c29b", pelo: "#3b2a20", peinado: "corto", ropa: "#7c3aed" },
  a2: { fondo: "#fbcfe8", piel: "#f9d7b9", pelo: "#f59e0b", peinado: "largo", ropa: "#db2777", extras: ["lazo"], mejillas: true },
  a3: { fondo: "#fde68a", piel: "#8d5a3b", pelo: "#1f1410", peinado: "rizado", ropa: "#f97316", extras: ["gafas"] },
  a4: { fondo: "#bbf7d0", piel: "#d9a07a", pelo: "#7c2d12", peinado: "coletas", ropa: "#16a34a", mejillas: true },
  a5: { fondo: "#bae6fd", piel: "#5e3b28", pelo: "#1f1410", peinado: "calvo", ropa: "#0ea5e9", extras: ["barba", "gafas"] },
  a6: { fondo: "#fecaca", piel: "#f1c29b", pelo: "#111827", peinado: "corto", ropa: "#1f2937", extras: ["gorra"], gorra: "#ef4444" },
  a7: { fondo: "#e9d5ff", piel: "#f9d7b9", pelo: "#ec4899", peinado: "cresta", ropa: "#111827" },
  a8: { fondo: "#fed7aa", piel: "#b87a55", pelo: "#2b1b12", peinado: "mono", ropa: "#8b5cf6", extras: ["audifonos"], audifonos: "#f43f5e" },
  a9: { fondo: "#a5f3fc", piel: "#f1c29b", pelo: "#111827", peinado: "largo", ropa: "#0891b2", ojos: "guino" },
  a10: { fondo: "#fef08a", piel: "#d9a07a", pelo: "#a16207", peinado: "corto", ropa: "#65a30d", extras: ["bigote"] },
  a11: { fondo: "#fbcfe8", piel: "#8d5a3b", pelo: "#3f2a1d", peinado: "rizado", ropa: "#e11d48", extras: ["lazo"], lazo: "#facc15" },
  a12: { fondo: "#d9f99d", piel: "#f9d7b9", pelo: "#c2410c", peinado: "corto", ropa: "#4d7c0f", extras: ["gafas"], mejillas: true },
  a13: { fondo: "#fbcfe8", piel: "#5e3b28", pelo: "#111827", peinado: "coletas", ropa: "#a21caf", boca: "abierta" },
  a14: { fondo: "#fde68a", piel: "#f1c29b", pelo: "#7c3aed", peinado: "largo", ropa: "#9333ea", extras: ["corona"], ojos: "feliz" },
  a15: { fondo: "#bfdbfe", piel: "#b87a55", pelo: "#1f1410", peinado: "corto", ropa: "#1e40af", extras: ["gorra"], gorra: "#2563eb", boca: "abierta" },
  a16: { fondo: "#bbf7d0", piel: "#d9a07a", pelo: "#16a34a", peinado: "cresta", ropa: "#111827", extras: ["gafasSol"] },
};

function pelo(p) {
  const c = p.pelo;
  switch (p.peinado) {
    case "corto":
      return {
        atras: "",
        frente: `<path d="M28.5 46c-1-15 9-24 21.5-24s22.5 9 21.5 24c-3-6-8-10-13-11c-6 4-14 5-22 3c-4 2-7 5-8 8z" fill="${c}"/>`,
      };
    case "largo":
      return {
        atras: `<path d="M27 48c0-17 10-27 23-27s23 10 23 27v26H27z" fill="${c}"/>`,
        frente: `<path d="M29 44c1-13 10-21 21-21s20 8 21 21c-6-7-14-10-21-10s-15 3-21 10z" fill="${c}"/>`,
      };
    case "rizado":
      return {
        atras: "",
        frente: [[32, 38, 7], [38, 30, 7], [46, 26, 7], [54, 26, 7], [62, 30, 7], [68, 38, 7], [29, 46, 5], [71, 46, 5]]
          .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`)
          .join(""),
      };
    case "coletas":
      return {
        atras: `<circle cx="22" cy="52" r="8" fill="${c}"/><circle cx="78" cy="52" r="8" fill="${c}"/>`,
        frente: `<path d="M29 44c1-13 10-21 21-21s20 8 21 21c-6-5-14-8-21-8s-15 3-21 8z" fill="${c}"/>`,
      };
    case "mono":
      return {
        atras: `<circle cx="50" cy="22" r="8" fill="${c}"/>`,
        frente: `<path d="M29 44c1-13 10-21 21-21s20 8 21 21c-6-5-14-8-21-8s-15 3-21 8z" fill="${c}"/>`,
      };
    case "cresta":
      return {
        atras: "",
        frente: `<path d="M36 33l4-13 4 10 4-13 4 13 4-10 4 13z" fill="${c}"/><path d="M29 46c0-8 3-13 7-15v9c-3 1-5 3-7 6zM71 46c0-8-3-13-7-15v9c3 1 5 3 7 6z" fill="${c}"/>`,
      };
    default:
      return { atras: "", frente: `<ellipse cx="42" cy="32" rx="5" ry="2.5" fill="#fff" opacity=".35"/>` };
  }
}

function ojos(tipo) {
  if (tipo === "feliz") {
    return `<path d="M39.5 50q2.5-3.5 5 0M55.5 50q2.5-3.5 5 0" stroke="#1f2937" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  }
  if (tipo === "guino") {
    return `<path d="M39.5 50q2.5-3.5 5 0" stroke="#1f2937" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="58" cy="49" r="2.6" fill="#1f2937"/>`;
  }
  return `<circle cx="42" cy="49" r="2.6" fill="#1f2937"/><circle cx="58" cy="49" r="2.6" fill="#1f2937"/>`;
}

function boca(tipo) {
  return tipo === "abierta"
    ? `<path d="M43 57q7 9 14 0z" fill="#7f1d1d"/>`
    : `<path d="M43 57.5q7 6 14 0" stroke="#1f2937" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
}

function extra(nombre, p) {
  switch (nombre) {
    case "gafas":
      return `<g stroke="#111827" stroke-width="2" fill="rgba(255,255,255,.2)"><circle cx="42" cy="49" r="5.5"/><circle cx="58" cy="49" r="5.5"/></g><path d="M47.5 49h5" stroke="#111827" stroke-width="2"/>`;
    case "gafasSol":
      return `<g fill="#111827"><rect x="35.5" y="44.5" width="13" height="9" rx="4"/><rect x="51.5" y="44.5" width="13" height="9" rx="4"/></g><path d="M48.5 48h3" stroke="#111827" stroke-width="2"/>`;
    case "barba":
      return `<path d="M31 53c2 13 10 18 19 18s17-5 19-18c-4 5-10 7-19 7s-15-2-19-7z" fill="${p.pelo}"/>`;
    case "bigote":
      return `<path d="M42 55.5q4-3 8 0q4-3 8 0q-4 3-8 1q-4 2-8-1z" fill="${p.pelo}"/>`;
    case "gorra": {
      const color = p.gorra || "#ef4444";
      return `<path d="M28 42c0-13 10-20 22-20s22 7 22 20z" fill="${color}"/><path d="M50 40h27q2 4-2 5H50z" fill="${color}"/><path d="M50 40h27q2 4-2 5H50z" fill="#000" opacity=".2"/><circle cx="50" cy="23" r="2" fill="#fff" opacity=".7"/>`;
    }
    case "lazo": {
      const color = p.lazo || "#f472b6";
      return `<path d="M66 27l-9-6v12zM66 27l9-6v12z" fill="${color}"/><circle cx="66" cy="27" r="3" fill="${color}"/><circle cx="66" cy="27" r="3" fill="#000" opacity=".15"/>`;
    }
    case "corona":
      return `<path d="M36 29l3-13 7 7 4-10 4 10 7-7 3 13z" fill="#facc15" stroke="#eab308" stroke-width="1.2" stroke-linejoin="round"/><circle cx="50" cy="22" r="1.8" fill="#ef4444"/>`;
    case "audifonos": {
      const color = p.audifonos || "#f43f5e";
      return `<path d="M27 48c0-15 10-25 23-25s23 10 23 25" stroke="#1f2937" stroke-width="3.5" fill="none"/><rect x="23" y="43" width="8" height="13" rx="3.5" fill="${color}"/><rect x="69" y="43" width="8" height="13" rx="3.5" fill="${color}"/>`;
    }
    default:
      return "";
  }
}

function persona(p) {
  const { atras, frente } = pelo(p);
  const piel = p.piel;
  return [
    `<circle cx="50" cy="50" r="50" fill="${p.fondo}"/>`,
    atras,
    `<path d="${CUERPO}" fill="${p.ropa}"/>`,
    `<rect x="45" y="62" width="10" height="12" rx="3" fill="${piel}"/>`,
    `<circle cx="29" cy="50" r="4" fill="${piel}"/><circle cx="71" cy="50" r="4" fill="${piel}"/>`,
    `<circle cx="50" cy="48" r="21" fill="${piel}"/>`,
    frente,
    ojos(p.ojos),
    p.mejillas ? `<circle cx="37" cy="55" r="3.5" fill="#fb7185" opacity=".4"/><circle cx="63" cy="55" r="3.5" fill="#fb7185" opacity=".4"/>` : "",
    (p.extras || []).includes("barba") ? extra("barba", p) : "",
    boca(p.boca),
    ...(p.extras || []).filter((e) => e !== "barba").map((e) => extra(e, p)),
  ].join("");
}

// ---------- Personajes ----------

const PERSONAJES = {
  a17: () => // gato
    `<circle cx="50" cy="50" r="50" fill="#fed7aa"/>` +
    `<path d="${CUERPO}" fill="#fb923c"/>` +
    `<path d="M30 38l1-20 15 11zM70 38l-1-20-15 11z" fill="#fb923c"/><path d="M33 33l1-10 7 6zM67 33l-1-10-7 6z" fill="#fda4af"/>` +
    `<circle cx="50" cy="49" r="21" fill="#fb923c"/>` +
    `<path d="M44 30q6 4 12 0M42 35q8 4 16 0" stroke="#c2410c" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="42" cy="48" rx="2.8" ry="3.6" fill="#1f2937"/><ellipse cx="58" cy="48" rx="2.8" ry="3.6" fill="#1f2937"/>` +
    `<path d="M48 54h4l-2 2.5z" fill="#f43f5e"/>` +
    `<path d="M46 58q4 3 4 0q0 3 4 0" stroke="#1f2937" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
    `<path d="M26 52l12 2M26 58l12-1M74 52l-12 2M74 58l-12-1" stroke="#7c2d12" stroke-width="1.3" stroke-linecap="round"/>`,
  a18: () => // perro
    `<circle cx="50" cy="50" r="50" fill="#bae6fd"/>` +
    `<path d="${CUERPO}" fill="#3b82f6"/>` +
    `<circle cx="50" cy="49" r="21" fill="#d6a064"/>` +
    `<ellipse cx="29" cy="48" rx="7" ry="14" fill="#8b5a2b" transform="rotate(15 29 48)"/><ellipse cx="71" cy="48" rx="7" ry="14" fill="#8b5a2b" transform="rotate(-15 71 48)"/>` +
    `<circle cx="59" cy="44" r="7" fill="#8b5a2b" opacity=".55"/>` +
    `<circle cx="42" cy="46" r="2.6" fill="#1f2937"/><circle cx="58" cy="46" r="2.6" fill="#1f2937"/>` +
    `<ellipse cx="50" cy="57" rx="10" ry="7.5" fill="#f5deb3"/>` +
    `<ellipse cx="50" cy="53.5" rx="3.6" ry="2.6" fill="#1f2937"/>` +
    `<path d="M50 56v3M45.5 59q4.5 3 9 0" stroke="#1f2937" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
    `<path d="M48 61h4v4a2 2 0 0 1-4 0z" fill="#f43f5e"/>`,
  a19: () => // robot
    `<circle cx="50" cy="50" r="50" fill="#e2e8f0"/>` +
    `<path d="${CUERPO}" fill="#64748b"/><rect x="42" y="80" width="16" height="8" rx="2" fill="#38bdf8"/>` +
    `<path d="M50 26V16" stroke="#475569" stroke-width="2.5"/><circle cx="50" cy="15" r="3.5" fill="#ef4444"/>` +
    `<rect x="24" y="42" width="6" height="12" rx="2" fill="#94a3b8"/><rect x="70" y="42" width="6" height="12" rx="2" fill="#94a3b8"/>` +
    `<rect x="29" y="26" width="42" height="42" rx="9" fill="#cbd5e1" stroke="#94a3b8" stroke-width="2"/>` +
    `<rect x="36" y="40" width="10" height="8" rx="2" fill="#22d3ee"/><rect x="54" y="40" width="10" height="8" rx="2" fill="#22d3ee"/>` +
    `<rect x="39" y="56" width="22" height="6" rx="2" fill="#475569"/><path d="M44 56v6M50 56v6M56 56v6" stroke="#cbd5e1" stroke-width="1.5"/>`,
  a20: () => // extraterrestre
    `<circle cx="50" cy="50" r="50" fill="#ddd6fe"/>` +
    `<path d="${CUERPO}" fill="#7c3aed"/>` +
    `<path d="M40 28l-7-12M60 28l7-12" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round"/><circle cx="33" cy="15" r="3.5" fill="#facc15"/><circle cx="67" cy="15" r="3.5" fill="#facc15"/>` +
    `<ellipse cx="50" cy="48" rx="22" ry="24" fill="#86efac"/>` +
    `<ellipse cx="41" cy="47" rx="6" ry="8.5" fill="#111827" transform="rotate(-20 41 47)"/><ellipse cx="59" cy="47" rx="6" ry="8.5" fill="#111827" transform="rotate(20 59 47)"/>` +
    `<circle cx="39.5" cy="44" r="1.8" fill="#fff"/><circle cx="57.5" cy="44" r="1.8" fill="#fff"/>` +
    `<path d="M45 61q5 4 10 0" stroke="#166534" stroke-width="2" fill="none" stroke-linecap="round"/>`,
};

export const IDS_AVATARES = [...Object.keys(PERSONAS), ...Object.keys(PERSONAJES)];

export function svgAvatar(id) {
  const contenido = PERSONAS[id] ? persona(PERSONAS[id]) : PERSONAJES[id] ? PERSONAJES[id]() : null;
  if (!contenido) return null;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><clipPath id="recorte-${id}"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#recorte-${id})">${contenido}</g></svg>`;
}
