// Al tocar un aviso: abre la app (o la trae al frente si ya estaba abierta)
// en la dirección que trae el aviso, p. ej. "?foto=1" para tomar una foto.
// Va antes de importScripts para que sea el primero en atender el clic.
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = new URL(evento.notification.data?.url || "./", self.registration.scope).href;

  evento.waitUntil(
    (async () => {
      const ventanas = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const abierta = ventanas.find((v) => v.url.startsWith(self.registration.scope));
      if (abierta) {
        await abierta.focus();
        abierta.postMessage({ tipo: "notificacion", url });
        return;
      }
      await clients.openWindow(url);
    })()
  );
});

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBg5MQc-Kn64dALtGG6PyHNh0gZ02y0OOY",
  authDomain: "horario-universidad-9eafa.firebaseapp.com",
  projectId: "horario-universidad-9eafa",
  storageBucket: "horario-universidad-9eafa.firebasestorage.app",
  messagingSenderId: "21064593434",
  appId: "1:21064593434:web:27abcd2b12f9a72aa561a3",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // Si llega sin datos (una repetición vacía del mismo aviso), no mostramos nada.
  if (!payload.data || !payload.data.title) return;

  self.registration.showNotification(payload.data.title, {
    body: payload.data.body || "",
    data: { url: payload.data.url || "./" },
  });
});
