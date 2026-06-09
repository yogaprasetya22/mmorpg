// 1. Import SDK Firebase Service Worker dari CDN resmi Google
importScripts(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
);
importScripts(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js",
);

// 2. Masukkan Firebase Config yang sama persis dengan milikmu
const firebaseConfig = {
    apiKey: "AIzaSyA0l_tXSImmdJuWnzvscZL7dBNgMBuFz10",
    authDomain: "mmorpg-55d25.firebaseapp.com",
    projectId: "mmorpg-55d25",
    storageBucket: "mmorpg-55d25.firebasestorage.app",
    messagingSenderId: "561790747457",
    appId: "1:561790747457:web:ccb9cdc3a995f8eabe97c0",
    measurementId: "G-NK7BCYRBER",
};

// 3. Inisialisasi Firebase di dalam Service Worker
firebase.initializeApp(firebaseConfig);

// 4. Ambil instance Messaging
const messaging = firebase.messaging();

// 5. Opsional: Handle notifikasi saat aplikasi berada di background (ditutup/tab lain)
messaging.onBackgroundMessage((payload) => {
    console.log(
        "[firebase-messaging-sw.js] Menerima background message ",
        payload,
    );

    const title = payload.notification.title || "MMORPG Update";
    const options = {
        body: payload.notification.body,
        icon: payload.notification.icon || "/favicon.ico", // sesuaikan path icon kamu
    };

    self.registration.showNotification(title, options);
});
