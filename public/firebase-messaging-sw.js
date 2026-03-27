importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCxJz4fnl1-dsmfTFZnHaDTU_ABTov1Olw",
  authDomain: "gen-lang-client-0267470165.firebaseapp.com",
  projectId: "gen-lang-client-0267470165",
  storageBucket: "gen-lang-client-0267470165.firebasestorage.app",
  messagingSenderId: "94398707009",
  appId: "1:94398707009:web:1df76e0b6f76dd7ab99dc0",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
