// 20 avatares dibujados en SVG: 4 personas (2 mujeres, 2 hombres) y 16
// personajes. Se guardan por id en perfiles/{uid}.avatar y se pintan donde
// va la inicial de la persona.

// Los ids de los degradados llevan un número único por dibujo: el mismo
// avatar sale varias veces en la página y, si repitieran id, algunos
// navegadores no pintan el degradado cuando el primero está oculto.
let contador = 0;

function degradado(id, arriba, abajo) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${arriba}"/><stop offset="1" stop-color="${abajo}"/></linearGradient>`;
}

function fondo(u, arriba, abajo) {
  return (
    `<defs>${degradado(`${u}f`, arriba, abajo)}</defs>` +
    `<rect width="100" height="100" fill="url(#${u}f)"/>` +
    `<circle cx="82" cy="18" r="16" fill="#fff" opacity=".18"/><circle cx="14" cy="80" r="10" fill="#fff" opacity=".12"/>`
  );
}

const TINTA = "#1e1b2e";

function ojo(x, y, r = 3) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${TINTA}"/><circle cx="${x + r * 0.38}" cy="${y - r * 0.38}" r="${r * 0.36}" fill="#fff"/>`;
}

function ojos(y = 48, separacion = 7, r = 3) {
  return ojo(50 - separacion, y, r) + ojo(50 + separacion, y, r);
}

function mejillas(y = 55, separacion = 12, color = "#ff6b8b") {
  return `<ellipse cx="${50 - separacion}" cy="${y}" rx="3.8" ry="2.3" fill="${color}" opacity=".4"/><ellipse cx="${50 + separacion}" cy="${y}" rx="3.8" ry="2.3" fill="${color}" opacity=".4"/>`;
}

function sonrisa(y = 56, ancho = 5, color = TINTA) {
  return `<path d="M${50 - ancho} ${y}q${ancho} ${ancho * 0.9} ${ancho * 2} 0" stroke="${color}" stroke-width="2.1" fill="none" stroke-linecap="round"/>`;
}

function hombros(u, arriba, abajo) {
  return `<defs>${degradado(`${u}r`, arriba, abajo)}</defs><path d="M15 104c0-19 15-31 35-31s35 12 35 31z" fill="url(#${u}r)"/>`;
}

// ---------- Personas ----------

const AVATARES = {
  mujer1: (u) =>
    fondo(u, "#c9b8ff", "#ffc4dc") +
    `<defs>${degradado(`${u}p`, "#6b4230", "#3a2419")}</defs>` +
    `<path d="M27 50c0-19 10-30 23-30s23 11 23 30v26c-6 4-13 5-23 5s-17-1-23-5z" fill="url(#${u}p)"/>` +
    hombros(u, "#ff8f70", "#f2542d") +
    `<path d="M40 74q10 7 20 0" stroke="#fff" stroke-width="1.6" fill="none" opacity=".6"/>` +
    `<rect x="44" y="58" width="12" height="15" rx="5" fill="#e3a57d"/>` +
    `<ellipse cx="50" cy="46" rx="18" ry="20" fill="#f7cda9"/>` +
    `<path d="M31 45c0-15 8-24 19-24s20 8 20 23c-5-8-12-12-21-13c-3 6-9 11-18 14z" fill="url(#${u}p)"/>` +
    `<path d="M39.5 42.5q3.5-2 7 0M53.5 42.5q3.5-2 7 0" stroke="#4a2c1f" stroke-width="1.5" fill="none" stroke-linecap="round"/>` +
    ojos(48) +
    `<path d="M40 45.6l-1.6-1.2M60 45.6l1.6-1.2" stroke="${TINTA}" stroke-width="1.2" stroke-linecap="round"/>` +
    mejillas(55) +
    `<path d="M45 56q5 4.5 10 0" stroke="#c2415d" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
    `<circle cx="32" cy="58" r="2" fill="#facc15"/><circle cx="68" cy="58" r="2" fill="#facc15"/>`,

  mujer2: (u) =>
    fondo(u, "#a7f3d0", "#5eead4") +
    `<defs>${degradado(`${u}p`, "#3b2619", "#1a100b")}</defs>` +
    `<circle cx="50" cy="19" r="11" fill="url(#${u}p)"/>` +
    hombros(u, "#fcd34d", "#f59e0b") +
    `<path d="M38 74h24v5c-4 3-8 4-12 4s-8-1-12-4z" fill="#fff" opacity=".35"/>` +
    `<rect x="44" y="58" width="12" height="15" rx="5" fill="#74472f"/>` +
    `<circle cx="32" cy="49" r="3.6" fill="#8d5a3c"/><circle cx="68" cy="49" r="3.6" fill="#8d5a3c"/>` +
    `<ellipse cx="50" cy="47" rx="18" ry="20" fill="#9a6444"/>` +
    `<path d="M31 45c-1-15 8-24 19-24s20 9 19 24c-3-7-8-11-13-12c-6 3-13 3-19 1c-3 2-5 6-6 11z" fill="url(#${u}p)"/>` +
    `<circle cx="31.5" cy="56" r="3" stroke="#facc15" stroke-width="1.6" fill="none"/><circle cx="68.5" cy="56" r="3" stroke="#facc15" stroke-width="1.6" fill="none"/>` +
    `<path d="M39.5 42.5q3.5-2 7 0M53.5 42.5q3.5-2 7 0" stroke="#1a100b" stroke-width="1.5" fill="none" stroke-linecap="round"/>` +
    ojos(48) +
    `<path d="M40 45.6l-1.6-1.2M60 45.6l1.6-1.2" stroke="${TINTA}" stroke-width="1.2" stroke-linecap="round"/>` +
    mejillas(55, 12, "#ff5a7a") +
    `<path d="M45 56q5 5 10 0z" fill="#7a2335"/>`,

  hombre1: (u) =>
    fondo(u, "#c7dcff", "#8fb8ff") +
    hombros(u, "#2dd4bf", "#0f9488") +
    `<path d="M36 74c3 5 8 7 14 7s11-2 14-7" stroke="#0b6e66" stroke-width="3" fill="none"/>` +
    `<path d="M45 80v9M55 80v9" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>` +
    `<rect x="44" y="58" width="12" height="15" rx="5" fill="#dca782"/>` +
    `<circle cx="32" cy="49" r="3.6" fill="#f1c7a1"/><circle cx="68" cy="49" r="3.6" fill="#f1c7a1"/>` +
    `<ellipse cx="50" cy="47" rx="18" ry="20" fill="#f6d1ae"/>` +
    `<defs>${degradado(`${u}p`, "#3b2d22", "#1f1712")}</defs>` +
    `<path d="M31 44c-1-15 8-24 20-24c9 0 16 5 18 12c1 4 1 8-1 12c-2-5-5-8-9-9c-7 3-15 3-21 0c-3 2-6 5-7 9z" fill="url(#${u}p)"/>` +
    `<path d="M38.5 42.5q4-2.5 8 0M53.5 42.5q4-2.5 8 0" stroke="#2b2118" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
    ojos(48) +
    sonrisa(56, 5),

  hombre2: (u) =>
    fondo(u, "#ffe0b8", "#fdae6b") +
    hombros(u, "#4f73e8", "#3348b8") +
    `<path d="M42 73l8 10 8-10z" fill="#fff"/>` +
    `<rect x="44" y="58" width="12" height="15" rx="5" fill="#5a3726"/>` +
    `<circle cx="32" cy="49" r="3.6" fill="#6b4430"/><circle cx="68" cy="49" r="3.6" fill="#6b4430"/>` +
    `<ellipse cx="50" cy="47" rx="18" ry="20" fill="#7a4e36"/>` +
    `<path d="M32 42c0-13 8-20 18-20s18 7 18 20c-4-4-10-6-18-6s-14 2-18 6z" fill="#1a120d"/>` +
    [36, 42, 48, 54, 60, 64].map((x, i) => `<circle cx="${x}" cy="${i % 2 ? 26 : 29}" r="3.4" fill="#1a120d"/>`).join("") +
    `<path d="M32 51c1 13 8 20 18 20s17-7 18-20c-3 5-8 7-18 7s-15-2-18-7z" fill="#1a120d"/>` +
    `<path d="M44 55q6-3 12 0" stroke="#1a120d" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M45.5 60q4.5 3 9 0" stroke="#f3d6c4" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<path d="M38.5 41.5q4-2 8 0M53.5 41.5q4-2 8 0" stroke="#1a120d" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
    ojos(47.5, 7, 2.7) +
    `<g stroke="#111" stroke-width="1.8" fill="rgba(255,255,255,.18)"><circle cx="43" cy="47.5" r="5.8"/><circle cx="57" cy="47.5" r="5.8"/></g><path d="M48.8 47h2.4" stroke="#111" stroke-width="1.8"/>`,

  // ---------- Personajes ----------

  astronauta: (u) =>
    fondo(u, "#1e1b4b", "#4c1d95") +
    `<circle cx="20" cy="22" r="1.2" fill="#fff"/><circle cx="30" cy="12" r=".8" fill="#fff"/><circle cx="76" cy="40" r="1" fill="#fff"/><circle cx="86" cy="62" r=".8" fill="#fff"/>` +
    hombros(u, "#f8fafc", "#cbd5e1") +
    `<rect x="56" y="82" width="12" height="8" rx="2" fill="#ef4444"/><rect x="33" y="82" width="10" height="10" rx="2" fill="#38bdf8"/>` +
    `<defs>${degradado(`${u}c`, "#ffffff", "#d7dee8")}${degradado(`${u}v`, "#334155", "#0f172a")}</defs>` +
    `<circle cx="50" cy="46" r="25" fill="url(#${u}c)"/>` +
    `<rect x="31" y="34" width="38" height="26" rx="13" fill="url(#${u}v)"/>` +
    `<path d="M37 40q5-4 12-3" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/>` +
    `<circle cx="61" cy="52" r="2" fill="#a78bfa" opacity=".8"/>` +
    `<rect x="22" y="42" width="5" height="10" rx="2.5" fill="#94a3b8"/><rect x="73" y="42" width="5" height="10" rx="2.5" fill="#94a3b8"/>`,

  extraterrestre: (u) =>
    fondo(u, "#e9d5ff", "#a78bfa") +
    hombros(u, "#7c3aed", "#5b21b6") +
    `<circle cx="50" cy="84" r="4" fill="#facc15"/>` +
    `<path d="M40 28l-8-13M60 28l8-13" stroke="#22c55e" stroke-width="2.6" stroke-linecap="round"/><circle cx="32" cy="14" r="4" fill="#facc15"/><circle cx="68" cy="14" r="4" fill="#facc15"/>` +
    `<defs>${degradado(`${u}c`, "#a7f3a0", "#34c759")}</defs>` +
    `<path d="M50 23c14 0 23 10 23 23c0 15-11 26-23 26S27 61 27 46c0-13 9-23 23-23z" fill="url(#${u}c)"/>` +
    `<ellipse cx="41" cy="47" rx="6.5" ry="9" fill="${TINTA}" transform="rotate(-22 41 47)"/><ellipse cx="59" cy="47" rx="6.5" ry="9" fill="${TINTA}" transform="rotate(22 59 47)"/>` +
    `<circle cx="39" cy="43.5" r="2.2" fill="#fff"/><circle cx="57" cy="43.5" r="2.2" fill="#fff"/>` +
    sonrisa(61, 4, "#166534"),

  robot: (u) =>
    fondo(u, "#dbeafe", "#93c5fd") +
    hombros(u, "#94a3b8", "#64748b") +
    `<rect x="40" y="80" width="20" height="9" rx="3" fill="#1e293b"/><circle cx="45" cy="84.5" r="2" fill="#22d3ee"/><circle cx="55" cy="84.5" r="2" fill="#f472b6"/>` +
    `<path d="M50 24V14" stroke="#64748b" stroke-width="2.6"/><circle cx="50" cy="12" r="4" fill="#f43f5e"/>` +
    `<rect x="22" y="40" width="7" height="14" rx="3" fill="#94a3b8"/><rect x="71" y="40" width="7" height="14" rx="3" fill="#94a3b8"/>` +
    `<defs>${degradado(`${u}c`, "#f1f5f9", "#b6c2d2")}</defs>` +
    `<rect x="27" y="23" width="46" height="46" rx="14" fill="url(#${u}c)"/>` +
    `<rect x="33" y="33" width="34" height="26" rx="9" fill="#0f172a"/>` +
    `<rect x="38.5" y="40" width="7" height="8" rx="3.5" fill="#22d3ee"/><rect x="54.5" y="40" width="7" height="8" rx="3.5" fill="#22d3ee"/>` +
    `<path d="M44 52q6 4 12 0" stroke="#22d3ee" stroke-width="2" fill="none" stroke-linecap="round"/>`,

  gato: (u) =>
    fondo(u, "#fde68a", "#fbbf24") +
    hombros(u, "#fb923c", "#ea580c") +
    `<defs>${degradado(`${u}c`, "#ffb066", "#f97316")}</defs>` +
    `<path d="M29 40l2-22 16 12zM71 40l-2-22-16 12z" fill="url(#${u}c)"/><path d="M33 34l1.5-11 8 6zM67 34l-1.5-11-8 6z" fill="#ffc2cf"/>` +
    `<ellipse cx="50" cy="49" rx="23" ry="21" fill="url(#${u}c)"/>` +
    `<path d="M45 30q5 3 10 0M43 35q7 3 14 0" stroke="#c2410c" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="50" cy="58" rx="10" ry="7" fill="#fff4e6"/>` +
    ojos(49, 9, 3.2) +
    `<path d="M47.5 55h5l-2.5 3z" fill="#f43f5e"/>` +
    `<path d="M46 60q4 2.5 4 0q0 2.5 4 0" stroke="${TINTA}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<path d="M24 55l11 1.5M25 61l10-1.5M76 55l-11 1.5M75 61l-10-1.5" stroke="#7c2d12" stroke-width="1.2" stroke-linecap="round"/>`,

  perro: (u) =>
    fondo(u, "#fecdd3", "#fb7185") +
    hombros(u, "#60a5fa", "#2563eb") +
    `<path d="M40 76h20l-2 6H42z" fill="#facc15"/>` +
    `<defs>${degradado(`${u}c`, "#f0c27b", "#d49a52")}</defs>` +
    `<ellipse cx="50" cy="48" rx="21" ry="22" fill="url(#${u}c)"/>` +
    `<path d="M31 32c-8 2-11 14-8 24c2 5 7 5 9 1c2-7 3-16-1-25z" fill="#8b5a2b"/><path d="M69 32c8 2 11 14 8 24c-2 5-7 5-9 1c-2-7-3-16 1-25z" fill="#8b5a2b"/>` +
    `<ellipse cx="59" cy="42" rx="7" ry="6" fill="#8b5a2b" opacity=".5"/>` +
    ojos(46, 8, 3) +
    `<ellipse cx="50" cy="57" rx="11" ry="8.5" fill="#fbe8cc"/>` +
    `<ellipse cx="50" cy="53" rx="4.2" ry="3" fill="${TINTA}"/>` +
    `<path d="M50 56v3M45.5 59q4.5 3 9 0" stroke="${TINTA}" stroke-width="1.7" fill="none" stroke-linecap="round"/>` +
    `<path d="M47.8 61h4.4v3.5a2.2 2.2 0 0 1-4.4 0z" fill="#fb7185"/>`,

  panda: (u) =>
    fondo(u, "#d1fae5", "#6ee7b7") +
    hombros(u, "#374151", "#111827") +
    `<circle cx="30" cy="30" r="8" fill="#1f2937"/><circle cx="70" cy="30" r="8" fill="#1f2937"/>` +
    `<defs>${degradado(`${u}c`, "#ffffff", "#e5e7eb")}</defs>` +
    `<ellipse cx="50" cy="49" rx="23" ry="21" fill="url(#${u}c)"/>` +
    `<ellipse cx="40" cy="48" rx="6" ry="8" fill="#1f2937" transform="rotate(-25 40 48)"/><ellipse cx="60" cy="48" rx="6" ry="8" fill="#1f2937" transform="rotate(25 60 48)"/>` +
    `<circle cx="41" cy="47" r="2.6" fill="#fff"/><circle cx="59" cy="47" r="2.6" fill="#fff"/><circle cx="41.6" cy="46.4" r="1.2" fill="${TINTA}"/><circle cx="59.6" cy="46.4" r="1.2" fill="${TINTA}"/>` +
    `<ellipse cx="50" cy="56" rx="3.6" ry="2.6" fill="#1f2937"/>` +
    sonrisa(59.5, 3.5) +
    mejillas(58, 14),

  zorro: (u) =>
    fondo(u, "#cffafe", "#67e8f9") +
    hombros(u, "#fb923c", "#c2410c") +
    `<path d="M40 74l10 12 10-12z" fill="#fff"/>` +
    `<defs>${degradado(`${u}c`, "#ff9a3c", "#ea580c")}</defs>` +
    `<path d="M27 42l-1-26 19 13zM73 42l1-26-19 13z" fill="url(#${u}c)"/><path d="M30 36l0-13 9 7zM70 36l0-13-9 7z" fill="${TINTA}" opacity=".8"/>` +
    `<path d="M50 28c14 0 24 9 24 20c0 8-8 14-15 18l-9 5-9-5c-7-4-15-10-15-18c0-11 10-20 24-20z" fill="url(#${u}c)"/>` +
    `<path d="M26 49c7 0 14 4 18 10l6 12-9-5c-7-4-15-10-15-17zM74 49c-7 0-14 4-18 10l-6 12 9-5c7-4 15-10 15-17z" fill="#fff7ed"/>` +
    ojos(47, 9, 3) +
    `<ellipse cx="50" cy="63" rx="3.6" ry="2.6" fill="${TINTA}"/>`,

  buho: (u) =>
    fondo(u, "#ede9fe", "#c4b5fd") +
    `<defs>${degradado(`${u}c`, "#b07a4f", "#7c4a2a")}</defs>` +
    `<path d="M20 104c0-26 13-44 30-44s30 18 30 44z" fill="url(#${u}c)"/>` +
    `<path d="M40 78q5 4 10 0q5 4 10 0M42 86q4 4 8 0q4 4 8 0" stroke="#f5deb3" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<path d="M28 34l4-14 10 9zM72 34l-4-14-10 9z" fill="url(#${u}c)"/>` +
    `<ellipse cx="50" cy="46" rx="24" ry="22" fill="url(#${u}c)"/>` +
    `<circle cx="40" cy="46" r="9.5" fill="#fef3c7"/><circle cx="60" cy="46" r="9.5" fill="#fef3c7"/>` +
    `<circle cx="40" cy="46" r="9.5" stroke="#f59e0b" stroke-width="2" fill="none"/><circle cx="60" cy="46" r="9.5" stroke="#f59e0b" stroke-width="2" fill="none"/>` +
    ojo(40, 46, 4.2) + ojo(60, 46, 4.2) +
    `<path d="M46 54h8l-4 6z" fill="#f97316"/>`,

  dinosaurio: (u) =>
    fondo(u, "#fef9c3", "#fde047") +
    hombros(u, "#4ade80", "#16a34a") +
    `<path d="M34 28l5-11 5 9 6-12 6 12 5-9 5 11z" fill="#f97316"/>` +
    `<defs>${degradado(`${u}c`, "#86efac", "#22c55e")}</defs>` +
    `<path d="M50 24c15 0 25 10 25 23c0 4-1 7-3 10c2 3 3 6 1 9c-3 5-12 6-23 6s-20-1-23-6c-2-3-1-6 1-9c-2-3-3-6-3-10c0-13 10-23 25-23z" fill="url(#${u}c)"/>` +
    `<circle cx="42" cy="34" r="2.5" fill="#15803d" opacity=".5"/><circle cx="60" cy="31" r="3" fill="#15803d" opacity=".5"/>` +
    ojos(44, 9, 3.4) +
    `<path d="M33 59q17 9 34 0" stroke="#14532d" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
    `<path d="M40 61.5l2.5 4 2.5-3M55 62.5l2.5 3 2.5-4" fill="#fff"/>` +
    `<circle cx="45" cy="53" r="1.4" fill="#14532d"/><circle cx="55" cy="53" r="1.4" fill="#14532d"/>` +
    mejillas(56, 16),

  fantasma: (u) =>
    fondo(u, "#312e81", "#6d28d9") +
    `<circle cx="18" cy="26" r="1.2" fill="#fde68a"/><circle cx="80" cy="74" r="1.2" fill="#fde68a"/><circle cx="84" cy="40" r=".9" fill="#fff"/>` +
    `<defs>${degradado(`${u}c`, "#ffffff", "#ddd6fe")}</defs>` +
    `<path d="M26 92V48c0-15 11-26 24-26s24 11 24 26v44l-6-5-6 5-6-5-6 5-6-5-6 5-6-5z" fill="url(#${u}c)"/>` +
    ojos(47, 8, 3.6) +
    `<ellipse cx="50" cy="60" rx="4.5" ry="5.5" fill="${TINTA}"/>` +
    mejillas(55, 15, "#f472b6"),

  pinguino: (u) =>
    fondo(u, "#bae6fd", "#38bdf8") +
    `<path d="M18 104c0-22 14-36 32-36s32 14 32 36z" fill="#1f2937"/><path d="M34 104c0-16 7-26 16-26s16 10 16 26z" fill="#fff"/>` +
    `<path d="M36 72h28l-3 6H39z" fill="#ef4444"/>` +
    `<defs>${degradado(`${u}c`, "#374151", "#111827")}</defs>` +
    `<ellipse cx="50" cy="45" rx="23" ry="23" fill="url(#${u}c)"/>` +
    `<path d="M50 34c4-5 14-5 16 3c2 8-3 17-16 25c-13-8-18-17-16-25c2-8 12-8 16-3z" fill="#fff"/>` +
    ojos(44, 7, 3) +
    `<path d="M45 51h10l-5 5z" fill="#f59e0b"/>` +
    mejillas(51, 11),

  monstruo: (u) =>
    fondo(u, "#fbcfe8", "#f472b6") +
    `<defs>${degradado(`${u}c`, "#a78bfa", "#6d28d9")}</defs>` +
    `<path d="M16 104c0-20 15-32 34-32s34 12 34 32z" fill="url(#${u}c)"/>` +
    `<path d="M33 30l-6-16 14 9zM67 30l6-16-14 9z" fill="#fde68a"/>` +
    `<path d="M26 50c-3-17 9-28 24-28s27 11 24 28c3 2 3 6 0 7c1 3-1 6-4 6c-2 5-10 9-20 9s-18-4-20-9c-3 0-5-3-4-6c-3-1-3-5 0-7z" fill="url(#${u}c)"/>` +
    `<circle cx="50" cy="42" r="11" fill="#fff"/>` + ojo(51, 43, 5.5) +
    `<path d="M36 55q14 13 28 0z" fill="${TINTA}"/><path d="M41 56.5l3 4 3-3.5M53 57l3 3.5 3-4" fill="#fff"/>` +
    mejillas(56, 17, "#f9a8d4"),

  pulpo: (u) =>
    fondo(u, "#cffafe", "#22d3ee") +
    `<defs>${degradado(`${u}c`, "#fda4af", "#f43f5e")}</defs>` +
    [20, 32, 44, 56, 68, 80]
      .map((x, i) => `<path d="M${x} 66q${i % 2 ? 4 : -4} 14 ${i < 3 ? -2 : 2} 30" stroke="url(#${u}c)" stroke-width="9" fill="none" stroke-linecap="round"/>`)
      .join("") +
    `<path d="M50 20c16 0 26 12 26 27c0 13-10 22-26 22S24 60 24 47c0-15 10-27 26-27z" fill="url(#${u}c)"/>` +
    `<circle cx="40" cy="31" r="3" fill="#fff" opacity=".35"/><circle cx="62" cy="28" r="2" fill="#fff" opacity=".35"/>` +
    ojos(48, 9, 3.4) +
    sonrisa(56, 4) +
    mejillas(55, 15, "#be123c"),

  rana: (u) =>
    fondo(u, "#fef3c7", "#fcd34d") +
    hombros(u, "#4ade80", "#15803d") +
    `<defs>${degradado(`${u}c`, "#86efac", "#22c55e")}</defs>` +
    `<circle cx="36" cy="32" r="11" fill="url(#${u}c)"/><circle cx="64" cy="32" r="11" fill="url(#${u}c)"/>` +
    `<ellipse cx="50" cy="52" rx="26" ry="19" fill="url(#${u}c)"/>` +
    `<circle cx="36" cy="32" r="7" fill="#fff"/><circle cx="64" cy="32" r="7" fill="#fff"/>` +
    ojo(36, 32, 3.8) + ojo(64, 32, 3.8) +
    `<path d="M34 55q16 12 32 0" stroke="#14532d" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    mejillas(56, 19) +
    `<circle cx="46" cy="47" r="1.3" fill="#14532d"/><circle cx="54" cy="47" r="1.3" fill="#14532d"/>`,

  oso: (u) =>
    fondo(u, "#fee2e2", "#fca5a5") +
    hombros(u, "#fbbf24", "#d97706") +
    `<defs>${degradado(`${u}c`, "#b7825a", "#8b5a3c")}</defs>` +
    `<circle cx="30" cy="30" r="9" fill="url(#${u}c)"/><circle cx="70" cy="30" r="9" fill="url(#${u}c)"/><circle cx="30" cy="30" r="4.5" fill="#f3c6a5"/><circle cx="70" cy="30" r="4.5" fill="#f3c6a5"/>` +
    `<ellipse cx="50" cy="49" rx="23" ry="21" fill="url(#${u}c)"/>` +
    ojos(46, 9, 3) +
    `<ellipse cx="50" cy="57" rx="10" ry="8" fill="#f3d2b5"/>` +
    `<ellipse cx="50" cy="53.5" rx="4" ry="3" fill="${TINTA}"/>` +
    sonrisa(58.5, 3.5) +
    mejillas(55, 16),

  unicornio: (u) =>
    fondo(u, "#fce7f3", "#e9d5ff") +
    hombros(u, "#f9a8d4", "#ec4899") +
    `<defs>${degradado(`${u}c`, "#ffffff", "#f1e8ff")}${degradado(`${u}m`, "#a78bfa", "#f472b6")}</defs>` +
    `<path d="M68 26c10 6 12 20 8 34c-3-6-6-10-10-12z" fill="url(#${u}m)"/>` +
    `<path d="M32 36l-3-14 12 8zM66 34l3-14-12 8z" fill="#fff"/>` +
    `<ellipse cx="50" cy="49" rx="21" ry="22" fill="url(#${u}c)"/>` +
    `<defs>${degradado(`${u}h`, "#fde68a", "#f59e0b")}</defs>` +
    `<path d="M44.5 31L50 7l5.5 24z" fill="url(#${u}h)"/>` +
    `<path d="M45.8 25.5l8-2.5M47 19.5l6-2M48.3 13.5l3.6-1.2" stroke="#d97706" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M36 30c6-6 16-6 22-2c-5 1-9 4-11 8c-4-3-8-4-11-6z" fill="url(#${u}m)"/>` +
    `<path d="M39 47q4 3 8 0M53 47q4 3 8 0" stroke="${TINTA}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
    `<path d="M39 48.5l-2 1.5M61 48.5l2 1.5" stroke="${TINTA}" stroke-width="1.3" stroke-linecap="round"/>` +
    `<ellipse cx="50" cy="60" rx="9" ry="6" fill="#fbcfe8"/><circle cx="46.5" cy="60" r="1.2" fill="#be185d"/><circle cx="53.5" cy="60" r="1.2" fill="#be185d"/>` +
    mejillas(54, 14, "#f472b6"),
};

// Avatares de antes (a1 … a20): cada uno pasa al nuevo más parecido, así
// nadie pierde el que había elegido.
const ANTERIORES = {
  a1: "hombre1", a2: "mujer1", a3: "hombre2", a4: "mujer2", a5: "hombre2", a6: "hombre1", a7: "hombre1",
  a8: "mujer2", a9: "mujer1", a10: "hombre1", a11: "mujer2", a12: "hombre1", a13: "mujer2", a14: "mujer1",
  a15: "hombre2", a16: "hombre1", a17: "gato", a18: "perro", a19: "robot", a20: "extraterrestre",
};

export const IDS_AVATARES = Object.keys(AVATARES);

// Id actual de un avatar guardado (traduce los de antes), o null.
export function idAvatar(id) {
  if (Object.prototype.hasOwnProperty.call(ANTERIORES, id)) return ANTERIORES[id];
  return Object.prototype.hasOwnProperty.call(AVATARES, id) ? id : null;
}

export function svgAvatar(id) {
  const actual = idAvatar(id);
  if (!actual) return null;
  const u = `av${++contador}`;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><clipPath id="${u}k"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#${u}k)">${AVATARES[actual](u)}</g></svg>`;
}
