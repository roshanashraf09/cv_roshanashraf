/* ============================================================
   SoloFit — Firebase init
   Config pre-filled with Roshan's project values
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyD4pIL2gQatneP5bdUwC39043tPw7IpUm4",
  authDomain: "hunterexp-5b893.firebaseapp.com",
  projectId: "hunterexp-5b893",
  storageBucket: "hunterexp-5b893.firebasestorage.app",
  messagingSenderId: "858973897604",
  appId: "1:858973897604:web:9c675894bfa43f8de353d1"
};

firebase.initializeApp(firebaseConfig);
window.fbAuth = firebase.auth();
