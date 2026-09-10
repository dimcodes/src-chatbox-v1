// Stable Version (Jangan Ubah)
import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
// End

const firebaseConfig = {
  apiKey: "AIzaSyA1234567890ExampleKey_abcdefg",
  authDomain: "namaproyek-kamu.firebaseapp.com",
  databaseURL: "https://namaproyek-kamu-default-rtdb.firebaseio.com",
  projectId: "namaproyek-kamu",
  storageBucket: "namaproyek-kamu.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:a1b2c3d4e5f6g7h8i9j0",
};

// Jangan Ubah
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const provider = new GoogleAuthProvider();
// End
