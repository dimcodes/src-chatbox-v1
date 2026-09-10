# Panduan Setup Source Code Chatbox

Utamakan LITERASI!! Ikuti langkah-langkah di bawah ini secara berurutan!

---

### 0. Persiapan Awal di Firebase Console ➔

Sebelum mengedit kode, pastikan kamu sudah menyiapkan layanan Firebase berikut di [console.firebase.google.com](https://console.firebase.google.com):

1. **Aktifkan Authentication Google:**
   ➔ Masuk ke menu **Build / Security** ➔ **Authentication** ➔ tab **Sign-in method**.  
   ➔ Pilih **Google** ➔ Aktifkan (Enable) ➔ Simpan.

2. **Buat Realtime Database:**
   ➔ Masuk ke menu **Build** ➔ **Realtime Database**.  
   ➔ Klik **Create Database** ➔ Pilih lokasi server Singapore (Biar Low Latensi) ➔ Mulai dalam mode Test atau Locked (nanti rules-nya diubah di langkah 3).

3. **Tambahkan Authorized Domains:**
   ➔ Masuk ke **Authentication** ➔ tab **Settings** ➔ **Authorized domains**.  
   ➔ Klik **Add domain** lalu masukkan `localhost` (supaya bisa di-preview / di-test di komputer lokal).  
   ➔ Tambahkan juga nama domain web kamu jika nanti sudah di-hosting (contoh: `namadomainkamu.com`).

   ![Preview Authorized Domain](https://i.ibb.co.com/GL9d24j/Screenshot-2026-09-10-191439.png)

---

### 1. Konfigurasi Firebase ➔

Ubah data `firebaseConfig` yang ada di path file berikut:
`rian-src-chatbox/js/config/firebase.js`

![Preview Ubah Firebase Config](https://i.ibb.co/hJTrkHYP/Screenshot-2026-09-10-110729.png)

**Cara nemuin `firebaseConfig` kamu:**
➔ Masuk ke [console.firebase.google.com](https://console.firebase.google.com).  
➔ Pilih proyek Chatbox kamu.  
➔ Klik ikon **Settings ⚙️ (Project Settings)** di panel sebelah kiri.  
➔ Scroll ke bawah sampai ketemu bagian **Your apps** (pilih ikon Web `</>` kalau belum buat app).  
➔ Salin seluruh kode objek `firebaseConfig` milikmu dan _paste_ ke file `firebase.js`.

---

### 2. Ganti Google Account Client ID ➔

Ubah nilai `client_id` Google Account kamu di path file berikut:
`rian-src-chatbox/js/chatbox.js`

![Preview Ubah Client ID](https://i.ibb.co/TD9h3jyn/Screenshot-2026-09-10-105749.png)

**Cara nemuin `client_id` Google:**
➔ Buka [console.cloud.google.com](https://console.cloud.google.com) (atau lewat Firebase Console ➔ _Project Settings_ ➔ _Integrations_).  
➔ Masuk ke menu **APIs & Services** ➔ **Credentials**.  
➔ Cari di bagian **OAuth 2.0 Client IDs** (biasanya otomatis terbuat saat fitur Google Sign-In di Firebase Auth kamu aktifkan).  
➔ Salin string Client ID yang akhiran `.apps.googleusercontent.com` lalu ganti di file `chatbox.js`.

![Preview nemuin Client ID](https://i.ibb.co.com/Tq17NpXQ/Screenshot-2026-09-10-191639.png)

---

### 3. Update API Backend Upload Gambar

Tanya ai aja dengan kirim semua file kode script `rian-src-chatbox/js/chatbox.js` dan tanyakan gimana kode API Backendnya dan sesuaikan layanan kamu (Firebase Storage, Supabase Storage, Appwrite Storage dll.)

![Preview ganti api gambar](https://i.ibb.co.com/tThhynk1/image.png)

---

### 4. Update Database Rules di Firebase ➔

Masuk ke [console.firebase.google.com](https://console.firebase.google.com), lalu buka proyek kamu. Masuk ke menu **Realtime Database** ➔ pilih tab **Rules**, lalu ganti semua kodenya jadi seperti ini:

![Preview Rules Firebase](https://i.ibb.co.com/fcNrcFK/Screenshot-2026-09-10-191315.png)

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid == $uid",

        ".validate": "newData.hasChildren(['name', 'avatar', 'role'])",

        "role": {
          ".validate": "(data.exists() == false && newData.val() == 'visitor') || (data.exists() == true && data.val() == newData.val())"
        },
        "name": {
          ".validate": "newData.isString() && newData.val().length > 0"
        },
        "avatar": {
          ".validate": "newData.isString()"
        }
      }
    },

    "messages": {
      ".read": true,
      "$message_id": {
        ".write": "auth != null && (data.exists() == false && newData.child('uid').val() == auth.uid)",

        ".validate": "newData.hasChildren(['uid', 'name', 'avatar', 'role', 'timestamp']) && (newData.child('text').exists() || newData.child('imageUrl').exists())",
        "uid": {
          ".read": "auth != null"
        },
        "avatar": {
          ".read": "auth != null"
        },
        "role": {
          ".validate": "newData.val() == root.child('users').child(auth.uid).child('role').val()"
        },
        "reactions": {
          "$user_id": {
            ".write": "auth != null && auth.uid == $user_id",
            ".validate": "newData.val().length <= 4"
          }
        }
      }
    }
  }
}
```

> ⚠️ **Catatan Penting!**
> ➔ **Jangan Ubah Kode Lain:** Selain langkah-langkah penyesuaian di atas, jangan mengubah baris kode lainnya agar fungsi chatbox tetap berjalan normal.

> ➔ **Pembersihan Komentar Kode:** Kalau kamu mau uncomment atau menghapus komentar di dalam kode biar lebih bersih, gunakan bantuan alat otomatis di [commentclean.com](commentclean.com). Jangan hapus manual untuk menghindari kesalahan struktur skrip!
