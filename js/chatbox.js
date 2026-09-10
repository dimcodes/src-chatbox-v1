import {
  signInWithPopup,
  onAuthStateChanged,
  signInWithCredential,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  ref,
  set,
  get,
  push,
  onValue,
  remove,
  query,
  limitToLast,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { auth, db, provider } from "./config/firebase.js";

// ==========================================
// 1. STATE & VARIABLE GLOBAL
// ==========================================

// Variabel data profil (nama, avatar, role)
let currentUserProfile = null;

// Variabel menyimpan cache
let cachedMessagesSnapshot = null;

// Menyimpan data objek autentikasi user dari Firebase Auth
let cachedUserSnapshot = undefined;

// Menyimpan pointer fungsi render agar bisa dipanggil saat ada perubahan data Realtime Database
let renderMessagesFn = null;

// Menyimpan file gambar yang dipilih user sebelum diunggah ke server
let selectedFile = null;

// Mengambil data chat dari Database hanya 150 (Fokus Performa kecuali hostingmu mahal king)
const messagesQuery = query(ref(db, "messages"), limitToLast(150));

// Variabel untuk load img chat
const listloadimg = new Set();

// ==========================================
// 2. LISTENER REALTIME DATABASE (MESSAGES)
// ==========================================

// Mendengarkan perubahan data pesan di Firebase secara otomatis
onValue(
  messagesQuery,
  (snapshot) => {
    cachedMessagesSnapshot = snapshot;
    // Jika fungsi render sudah siap, langsung tampilkan data terbaru
    if (typeof renderMessagesFn === "function") {
      renderMessagesFn(snapshot);
    }
  },
  (error) => {
    console.error("Gagal subscribe messages:", error);
  },
);

// ==========================================
// 3. AUTENTIKASI & STATE USER
// ==========================================

// Promise penanda bahwa proses pemeriksaan status login awal Firebase telah selesai
let authReadyResolve;
const authReadyPromise = new Promise((resolve) => {
  authReadyResolve = resolve;
});

// Listener perubahan status login user (login / logout)
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userRef = ref(db, `users/${user.uid}`);
      const snapshot = await get(userRef);

      // Jika user baru pertama kali login, simpan data profil awal ke database
      if (!snapshot.exists()) {
        currentUserProfile = {
          name: user.displayName,
          // Callback kalo profil google gabisa dimuat
          avatar:
            user.photoURL ||
            `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`,
          role: "visitor",
        };
        await set(userRef, currentUserProfile);
      } else {
        // Jika profil sudah ada di database, gunakan profil tersebut
        currentUserProfile = snapshot.val();
      }
      cachedUserSnapshot = user;
    } catch (err) {
      console.error("Gagal ambil profile user:", err);
      cachedUserSnapshot = null;
    }
  } else {
    currentUserProfile = null;
    cachedUserSnapshot = null;
    setTimeout(inisialisasiGoogleOneTap, 150);
  }

  authReadyResolve();
  updateAuthUI();
});

// Inisialisasi pop-up login otomatis (Google One Tap)
function inisialisasiGoogleOneTap() {
  if (
    typeof google === "undefined" ||
    !document.getElementById("login-btn-chat")
  )
    return;

  // Memanggil API Google Identity Services menggunakan Client ID proyek
  google.accounts.id.initialize({
    client_id: "676767676767-xxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com",
    callback: async (response) => {
      try {
        const credential = GoogleAuthProvider.credential(response.credential);
        const result = await signInWithCredential(auth, credential);
        alert(`Hai ${result.user.displayName}, Berhasil login nih!`);
      } catch (err) {
        console.error("Gagal Login One Tap:", err);
        switch (err.code) {
          case "auth/user-disabled":
            alert("Akun kamu telah dinonaktifkan oleh admin!");
            break;
          default:
            alert("Gagal login, coba tombol manual");
            break;
        }
      }
    },
  });

  // Tampilkan prompt pop-up Google One Tap
  google.accounts.id.prompt();
}

function updateAuthUI() {
  const loginBtn = document.getElementById("login-btn-chat");
  const chatInputWrapper = document.querySelector(".chat-input-wrapper");
  if (!loginBtn && !chatInputWrapper) return;

  if (cachedUserSnapshot) {
    // Jika sudah login: sembunyikan tombol login, tampilkan form input chat
    if (loginBtn) loginBtn.style.display = "none";
    if (chatInputWrapper) chatInputWrapper.style.display = "block";
  } else {
    // Jika belum login: tampilkan tombol login, sembunyikan form input chat
    if (loginBtn) loginBtn.style.display = "block";
    if (chatInputWrapper) chatInputWrapper.style.display = "none";
  }
}

// ==========================================
// 4. UTILS & HELPER FUNCTIONS
// ==========================================

// Mencegah serangan XSS dengan mengubah karakter khusus HTML menjadi teks biasa (Jangan Ubah)
function escapeHTML(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Mengubah emoji kd versi Apple/iOS melalui CDN (Jangan Ubah)
function ubahemojiIos(text) {
  if (!text) return "";
  const emojiRegex =
    /(?:\u2764\uFE0F|\p{Extended_Pictographic}(?:[\u{1F3FB}-\u{1F3FF}]|\u200D\p{Extended_Pictographic})*)/gu;
  return text.replace(emojiRegex, (emoji) => {
    const codePoints = Array.from(emoji)
      .map((char) => char.codePointAt(0).toString(16))
      .filter((hex) => hex !== "fe0f")
      .join("-");

    const finalCode = codePoints === "2764" ? "2764-fe0f" : codePoints;
    const cdnUrl = `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${finalCode}.png`;
    return `<img class="ios-emoji" src="${cdnUrl}" alt="${emoji}" title="${emoji}" onerror="this.replaceWith('${emoji}')" loading="lazy" />`;
  });
}

// Kompresi ukuran foto
function kompresFoto(file) {
  return new Promise((resolve, reject) => {
    // Jika ukuran file sudah di bawah atau sama dengan 100 KB, langsung tanpa kompress
    if (file.size <= 100 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // limit maksimum 1200px
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Turunkan kualitas JPEG secara bertahap hingga ukurannya pas
        let quality = 0.85;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);

        while (dataUrl.length * 0.75 > 100 * 1024 && quality > 0.1) {
          quality -= 0.05;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        fetch(dataUrl)
          .then((res) => res.blob())
          .then((blob) => {
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^/.]+$/, "") + ".jpg",
              {
                type: "image/jpeg",
                lastModified: Date.now(),
              },
            );
            resolve(compressedFile);
          })
          .catch((err) => reject(err));
      };
    };
    reader.onerror = (err) => reject(err);
  });
}

// ==========================================
// 5. RENDER CHAT MESSAGES
// ==========================================

// Fungsi untuk merender elemen-elemen pesan ke HTML DOM
function renderMessages(snapshot) {
  const container = document.getElementById("chat-messages-box");
  if (!container) return;

  // Cek apakah posisi scroll user sedang di paling bawah (toleransi 100px)
  const isAtBottom =
    container.scrollHeight - container.scrollTop <=
    container.clientHeight + 100;
  const previousScrollTop = container.scrollTop;

  // Bersihkan elemen lama sebelum rendering ulang
  container.innerHTML = "";
  if (!snapshot || !snapshot.exists()) return;

  // Realtime baca database biar teks ga delay muncul
  snapshot.forEach((childSnapshot) => {
    const msgId = childSnapshot.key;
    const msg = childSnapshot.val();
    const date = new Date(msg.timestamp);
    const daftarBulan = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];

    // Format tampilan tanggal dan jam
    const day = String(date.getDate()).padStart(2, "0");
    const month = daftarBulan[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const timeString = `${day} ${month} ${year}, ${hours}:${minutes}`;

    const isAuthor = msg.role === "author";
    const rowClass = isAuthor ? "outgoing" : "incoming";
    const authorLabel = isAuthor
      ? '<span class="author-label">Author</span>'
      : "";
    const safeText = ubahemojiIos(escapeHTML(msg.text));

    // Render HTML media/gambar jika pesan mengandung imageUrl
    let mediaHtml = "";
    if (msg.imageUrl) {
      const loadimgYes = listloadimg.has(msgId);

      mediaHtml = `
        <div class="msg-media-content ${loadimgYes ? "" : "media-skeleton-shimmer"}" 
             style="margin-top: 8px; position: relative; max-width: 240px; ${loadimgYes ? "aspect-ratio: auto;" : "aspect-ratio: 4/3;"} border-radius: 8px; overflow: hidden; background: rgba(255,255,255,0.05);">
          
          <img src="${msg.imageUrl}" 
               alt="${msg.name}" 
               class="chat-media-img" 
               loading="lazy" 
               decoding="async"
               ${loadimgYes ? "" : `onload="window.efekImage(this, '${msgId}')"`}
               onerror="this.style.display='none'; this.parentElement.classList.remove('media-skeleton-shimmer');"
               style="width: 100%; max-height: 240px; border-radius: 8px; object-fit: cover; display: block; ${loadimgYes ? "opacity: 1;" : "opacity: 0; transition: opacity 0.3s ease-in-out;"}">
               
        </div>
      `;
    }

    // Render daftar emoji reaksi jika ada
    let reactionsHtml = "";
    if (msg.reactions) {
      const counts = {};
      Object.values(msg.reactions).forEach((emoji) => {
        counts[emoji] = (counts[emoji] || 0) + 1;
      });

      reactionsHtml = `<div class="msg-active-reactions">`;
      Object.entries(counts).forEach(([emoji, count]) => {
        const iosEmoji = ubahemojiIos(emoji);
        reactionsHtml += `<span class="reaction-badge" onclick="toggleReaction('${msgId}', '${emoji}')">${iosEmoji} <span class="reaction-count">${count}</span></span>`;
      });
      reactionsHtml += `</div>`;
    }

    // Template susunan DOM dari baris pesan chat
    const messageHtml = `
      <div class="message-row ${rowClass}" id="${msgId}">
        ${!isAuthor ? `<div class="msg-avatar-wrapper"><img src="${msg.avatar}" alt="Avatar" class="msg-avatar preview-img"></div>` : ""}
        <div class="msg-content-group">
          
          <div class="msg-meta">
            ${isAuthor ? `<span class="msg-time desktop-time">${timeString}</span><span class="msg-username">${msg.name}</span>${authorLabel}` : `<span class="msg-username">${msg.name}</span><span class="msg-time desktop-time">${timeString}</span>`}
          </div>
          
          <div class="msg-bubble-wrapper">
            <div class="msg-bubble">
              ${safeText}
              ${mediaHtml} </div>
          </div>
          
          <div class="msg-reactions-footer">
            ${reactionsHtml}
            <div class="add-reaction-wrapper">
              <button class="add-reaction-btn" title="Tambah Reaksi">+</button>
              <div class="emoji-picker-inline">
  <button class="react-btn" onclick="toggleReaction('${msgId}', '👍')"><img class="ios-emoji" src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f44d.png" alt="👍"></button>
  <button class="react-btn" onclick="toggleReaction('${msgId}', '❤️')"><img class="ios-emoji" src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/2764-fe0f.png" alt="❤️"></button>
  <button class="react-btn" onclick="toggleReaction('${msgId}', '🔥')"><img class="ios-emoji" src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f525.png" alt="🔥"></button>
  <button class="react-btn" onclick="toggleReaction('${msgId}', '🗿')"><img class="ios-emoji" src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f5ff.png" alt="🗿"></button>
</div>
            </div>
          </div>

          <span class="msg-time mobile-time">${timeString}</span>

        </div>
        ${isAuthor ? `<div class="msg-avatar-wrapper"><img src="${msg.avatar}" alt="Avatar" class="msg-avatar preview-img"></div>` : ""}
      </div>
    `;

    // Sisipkan elemen HTML ke posisi paling bawah wadah tanpa me-render ulang seluruh isi
    container.insertAdjacentHTML("beforeend", messageHtml);
  });

  // Jaga posisi scroll tetap di paling bawah jika sebelumnya user berada di posisi terbawah
  if (isAtBottom) {
    container.scrollTop = container.scrollHeight;
  } else {
    container.scrollTop = previousScrollTop;
  }
}

// ==========================================
// 6. INITIALIZATION & EVENT LISTENERS
// ==========================================

// Fungsi utama penyiapan event listener UI Chatbox
window.initChatbox = function () {
  const loginBtn = document.getElementById("login-btn-chat");
  const chatForm = document.querySelector(".chat-input-form");
  const chatField = document.querySelector(".chat-field");
  const messagesContainer = document.getElementById("chat-messages-box");

  const selectPhotoBtn = document.getElementById("select-photo-btn");
  const photoInput = document.getElementById("photo-input");
  const imagePreviewContainer = document.getElementById(
    "image-preview-container",
  );
  const imagePreview = document.getElementById("image-preview");
  const cancelImageBtn = document.getElementById("cancel-image-btn");

  if (!messagesContainer) {
    renderMessagesFn = null;
    return;
  }

  renderMessagesFn = renderMessages;
  if (cachedMessagesSnapshot) {
    renderMessages(cachedMessagesSnapshot);
  } else {
    // Tampilkan efek skeleton loading saat menunggu pesan pertama kali di-download
    messagesContainer.innerHTML = `
      <div class="chat-skeleton">
        <div class="skeleton-bubble"></div>
        <div class="skeleton-bubble"></div>
        <div class="skeleton-bubble"></div>
      </div>
    `;
  }

  updateAuthUI();

  // Memproses file gambar yang dipilih (preview dan validasi)
  function prosesImage(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Hanya boleh kirim gambar!");
      return;
    }

    selectedFile = file;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (imagePreview) imagePreview.src = event.target.result;
      if (imagePreviewContainer) imagePreviewContainer.style.display = "flex";
    };
    reader.readAsDataURL(file);
  }

  // Listener tombol/input pemilih foto
  if (selectPhotoBtn && photoInput) {
    selectPhotoBtn.addEventListener("click", () => photoInput.click());

    photoInput.addEventListener("change", (e) => {
      prosesImage(e.target.files[0]);
    });
  }

  // Listener event paste (Ctrl+V / Salin-Tempel gambar langsung dari clipboard)
  if (chatField) {
    chatField.addEventListener("paste", (e) => {
      const items = e.clipboardData || e.originalEvent.clipboardData;
      if (!items) return;

      for (let i = 0; i < items.items.length; i++) {
        const item = items.items[i];
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          prosesImage(file);
          e.preventDefault();
          break;
        }
      }
    });
  }

  // Listener fitur Drag and Drop file gambar ke area form chat
  if (chatForm) {
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      chatForm.addEventListener(eventName, (e) => e.preventDefault(), false);
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      chatForm.addEventListener(
        eventName,
        () => {
          chatForm.classList.add("drag-over");
        },
        false,
      );
    });

    ["dragleave", "drop"].forEach((eventName) => {
      chatForm.addEventListener(
        eventName,
        () => {
          chatForm.classList.remove("drag-over");
        },
        false,
      );
    });

    chatForm.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        prosesImage(files[0]);
      }
    });
  }

  // Listener batal pilih foto
  if (cancelImageBtn) {
    cancelImageBtn.addEventListener("click", () => {
      clearImgselect();
    });
  }

  // Reset pilihan foto dan tampilan preview
  function clearImgselect() {
    selectedFile = null;
    if (photoInput) photoInput.value = "";
    if (imagePreview) imagePreview.src = "";
    if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
  }

  // Listener tombol login popup manual
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      signInWithPopup(auth, provider)
        .then((result) => {
          alert(`Hai ${result.user.displayName}, Berhasil login nih!`);
        })
        .catch((err) => {
          console.error("Gagal Login Manual:", err);
          switch (err.code) {
            case "auth/user-disabled":
              alert("Akun kamu telah dinonaktifkan oleh admin!");
              break;
            case "auth/popup-closed-by-user":
              break;
            default:
              alert(err.message || "Gagal login, coba lagi");
              break;
          }
        });
    });
  }

  // Listener submit form (Proses pengiriman pesan teks dan/atau foto)
  if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = chatField.value.trim();

      if ((!text && !selectedFile) || !currentUserProfile) {
        alert("Kamu belum mengisi pesan!");
        return;
      }

      let finalImageUrl = null;
      const sendBtn = chatForm.querySelector(".chat-send-btn");

      if (sendBtn) sendBtn.disabled = true;

      try {
        // Jika terdapat file gambar, lakukan kompresi dan upload via backend API
        if (selectedFile) {
          const idToken = await auth.currentUser.getIdToken();

          const fileSiapKirim = await kompresFoto(selectedFile);
          const formDataToApi = new FormData();
          formDataToApi.append("file", fileSiapKirim);

          // Ubah dengan Backend API Kamu
          const apiResponse = await fetch("/api/uploadgambarkamu", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
            body: formDataToApi,
          });

          if (!apiResponse.ok) {
            throw new Error("Gagal mengunggah gambar via server API");
          }

          const apiResult = await apiResponse.json();
          finalImageUrl = apiResult.url;
        }

        // Simpan data pesan baru ke Firebase Realtime Database (Jangan Ubah)
        const messagesRef = ref(db, "messages");
        const newMsgData = {
          uid: auth.currentUser.uid,
          name: currentUserProfile.name,
          avatar: currentUserProfile.avatar,
          role: currentUserProfile.role,
          timestamp: serverTimestamp(),
          ...(text && { text: text }),
          ...(finalImageUrl && { imageUrl: finalImageUrl }),
        };

        await push(messagesRef, newMsgData);

        chatField.value = "";
        clearImgselect();
      } catch (err) {
        console.error("Gagal melakukan pengiriman pesan media:", err);
        alert("Terjadi kendala, coba lagi!");
      } finally {
        if (sendBtn) sendBtn.disabled = false;
      }
    });
  }
};

// ==========================================
// 7. GLOBAL ACTION HANDLERS
// ==========================================

// Fungsi menambah / menghapus reaksi emoji pada pesan (Toggle)
window.toggleReaction = async function (targetMessageId, selectedEmoji) {
  if (!auth.currentUser) {
    alert("Login dulu untuk beri reaction!");
    return;
  }

  const uid = auth.currentUser.uid;
  const reactionRef = ref(db, `messages/${targetMessageId}/reactions/${uid}`);

  try {
    const snapshot = await get(reactionRef);
    // Jika user mengeklik emoji yang sama, hapus reaksi (unlike). Jika beda, set reaksi baru.
    if (snapshot.exists() && snapshot.val() === selectedEmoji) {
      await remove(reactionRef);
    } else {
      await set(reactionRef, selectedEmoji);
    }
  } catch (err) {
    console.error("Gagal toggle reaction:", err);
  }
};

// Fungsi callback setelah gambar fisik selesai dimuat oleh browser
window.efekImage = function (imgElement, msgId) {
  if (msgId) {
    listloadimg.add(msgId);
  }
  imgElement.style.opacity = "1";

  const wrapper = imgElement.parentElement;
  if (wrapper) {
    wrapper.classList.remove("media-skeleton-shimmer");
    wrapper.style.aspectRatio = "auto";
  }

  // Memastikan posisi scroll menyesuaikan setelah ukuran gambar asli muncul
  const container = document.getElementById("chat-messages-box");
  if (container) {
    const isAtBottom =
      container.scrollHeight - container.scrollTop <=
      container.clientHeight + 150;
    if (isAtBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }
};

// Menjalankan semua script (Jangan Ubah)
if (document.readyState !== "loading") {
  window.initChatbox();
} else {
  document.addEventListener("DOMContentLoaded", () => window.initChatbox());
}
