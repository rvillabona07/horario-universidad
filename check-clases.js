const admin = require("firebase-admin");

const credencial = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(credencial) });

const ZONA_HORARIA = "America/Bogota";
const MINUTOS_ANTES = 5;

const MAPA_DIAS = {
  Sunday: "Domingo",
  Monday: "Lunes",
  Tuesday: "Martes",
  Wednesday: "Miércoles",
  Thursday: "Jueves",
  Friday: "Viernes",
  Saturday: "Sábado",
};

function obtenerDiaYHoraLocal() {
  const formateador = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_HORARIA,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const partes = formateador.formatToParts(new Date());
  const obtener = (tipo) => partes.find((p) => p.type === tipo).value;

  let hora = obtener("hour");
  if (hora === "24") hora = "00";

  return { dia: MAPA_DIAS[obtener("weekday")], horaMinuto: `${hora}:${obtener("minute")}` };
}

function minutosDesdeMedianoche(horaStr) {
  const [h, m] = horaStr.split(":").map(Number);
  return h * 60 + m;
}

const MENSAJES_LIBRE = [
  (nombre) => ({
    title: `🎉 ${nombre} ya salió de clase`,
    body: "Está libre ahora mismo. ¿Le escribes para parchar? 🙌",
  }),
  (nombre) => ({
    title: `🔥 ${nombre} quedó libre`,
    body: "¡Es buen momento para armar un parche!",
  }),
  (nombre) => ({
    title: `😎 ${nombre} acaba de desocuparse`,
    body: "Aprovecha y cuádrale un plan antes de que agarre otra vuelta.",
  }),
  (nombre) => ({
    title: `👀 ${nombre} está libre`,
    body: "Nadie está haciendo nada... ¿parche exprés?",
  }),
];

const formatoPesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

// Cuentas divididas desde la pestaña "Cuentas" de la app: avisa a cada
// participante cuánto debe y a quién, una sola vez por cuenta.
async function avisarCuentasNuevas(db, tokenPorUid, envios, escrituras) {
  const snapshotCuentas = await db.collection("cuentas").where("notificado", "==", false).get();

  for (const documento of snapshotCuentas.docs) {
    const cuenta = documento.data();

    let nombre = "Un amigo";
    try {
      const perfil = await db.collection("perfiles").doc(cuenta.creador).get();
      if (perfil.exists && perfil.data().apodo) nombre = perfil.data().apodo;
    } catch (error) {
      console.error("Error obteniendo perfil:", error.message);
    }

    const mensaje = {
      title: `💸 Le debes ${formatoPesos.format(cuenta.porPersona)} a ${nombre}`,
      body: `Por "${cuenta.descripcion}". Total ${formatoPesos.format(cuenta.total)} dividido entre ${cuenta.personas}.`,
    };

    (cuenta.participantes || []).forEach((uid) => {
      const token = tokenPorUid[uid];
      if (!token) return;
      console.log(`>>> ENVIANDO aviso de cuenta a uid=${uid} cuenta=${documento.id}`);
      envios.push(
        admin
          .messaging()
          .send({ token, data: mensaje })
          .catch((error) => console.error("Error avisando cuenta:", error.message))
      );
    });

    escrituras.push(
      documento.ref
        .update({ notificado: true })
        .catch((error) => console.error("Error marcando cuenta:", error.message))
    );
  }
}

async function main() {
  const { dia, horaMinuto } = obtenerDiaYHoraLocal();
  console.log(`Revisión: dia=${dia} horaMinuto=${horaMinuto}`);

  const db = admin.firestore();

  const [snapshotHorarios, snapshotEstados, snapshotSolicitudes] = await Promise.all([
    db.collection("horarios").get(),
    db.collection("estados").get(),
    db.collection("solicitudesAmistad").where("estado", "==", "aceptada").get(),
  ]);

  const tokenPorUid = {};
  const estadoAnteriorPorUid = {};
  const nuevoEstadoPorUid = {};
  const amigosPorUid = {};

  snapshotEstados.forEach((d) => {
    estadoAnteriorPorUid[d.id] = d.data().estado;
  });

  snapshotSolicitudes.forEach((d) => {
    const { de, para } = d.data();
    (amigosPorUid[de] ||= []).push(para);
    (amigosPorUid[para] ||= []).push(de);
  });

  const envios = [];
  const escrituras = [];

  snapshotHorarios.forEach((documento) => {
    const uid = documento.id;
    const datos = documento.data();
    const token = datos.fcmToken;
    const clases = datos.clases || [];

    tokenPorUid[uid] = token || null;

    if (token) {
      const horaActualMin = minutosDesdeMedianoche(horaMinuto);
      clases.forEach((clase) => {
        if (!clase.dias || !clase.dias.includes(dia)) return;

        const faltan = minutosDesdeMedianoche(clase.horaInicio) - horaActualMin;
        console.log(
          `uid=${uid} materia=${clase.materia} horaInicio=${clase.horaInicio} faltan=${faltan}`
        );
        if (faltan <= 0 || faltan > MINUTOS_ANTES) return;

        console.log(`>>> ENVIANDO aviso de clase a uid=${uid} materia=${clase.materia}`);

        envios.push(
          admin
            .messaging()
            .send({
              token,
              data: {
                title: `${clase.materia} en ${MINUTOS_ANTES} minutos`,
                body: `Empieza a las ${clase.horaInicio}${clase.aula ? " · " + clase.aula : ""}`,
              },
            })
            .then((id) => console.log(`Enviado OK id=${id}`))
            .catch((error) => console.error("Error enviando notificación:", error.message))
        );
      });
    }

    const enClaseAhora = clases.some(
      (clase) =>
        clase.dias &&
        clase.dias.includes(dia) &&
        clase.horaInicio <= horaMinuto &&
        horaMinuto < clase.horaFin
    );

    nuevoEstadoPorUid[uid] = enClaseAhora ? "En clase" : "Libre";

    escrituras.push(
      db
        .collection("estados")
        .doc(uid)
        .set({ estado: nuevoEstadoPorUid[uid], actualizado: Date.now() })
        .catch((error) => console.error("Error actualizando estado:", error.message))
    );
  });

  for (const uid of Object.keys(nuevoEstadoPorUid)) {
    const acabaDeQuedarLibre =
      estadoAnteriorPorUid[uid] === "En clase" && nuevoEstadoPorUid[uid] === "Libre";
    if (!acabaDeQuedarLibre) continue;

    const amigos = amigosPorUid[uid] || [];
    if (amigos.length === 0) continue;

    let nombre = "Tu amigo";
    try {
      const perfil = await db.collection("perfiles").doc(uid).get();
      if (perfil.exists && perfil.data().apodo) nombre = perfil.data().apodo;
    } catch (error) {
      console.error("Error obteniendo perfil:", error.message);
    }

    const mensaje = MENSAJES_LIBRE[Math.floor(Math.random() * MENSAJES_LIBRE.length)](nombre);

    amigos.forEach((amigoUid) => {
      const token = tokenPorUid[amigoUid];
      if (!token) return;

      envios.push(
        admin
          .messaging()
          .send({ token, data: mensaje })
          .catch((error) => console.error("Error avisando a amigo:", error.message))
      );
    });
  }

  await avisarCuentasNuevas(db, tokenPorUid, envios, escrituras);

  await Promise.all([...envios, ...escrituras]);
  console.log(
    `Revisado ${dia} ${horaMinuto}: ${envios.length} aviso(s), ${escrituras.length} estado(s) actualizados.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
