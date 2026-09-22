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
  const titulo = (payload.data && payload.data.title) || "Recordatorio";
  const cuerpo = (payload.data && payload.data.body) || "";
  self.registration.showNotification(titulo, { body: cuerpo });
});
