  // script.js - full restored and fixed version
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/login.html";
}

const socket = io("/", {
  auth: { token } // server will verify JWT
});

socket.on("connect", () => {
  console.log("✅ Socket connected", socket.id);
});

socket.on("connect_error", err => {
  console.error("❌ Socket auth error:", err.message);
});


document.addEventListener("DOMContentLoaded", () => {

  const token = localStorage.getItem("token");
const user_id = localStorage.getItem("user_id");
const username = localStorage.getItem("username");

if (!token || !user_id || !username) {
  window.location.href = "/login.html"; // redirect to login page
} else {
  document.querySelector(".header-container").style.display = "block";
  document.querySelector(".chat-container").style.display = "flex";
}


  /* ==========================
     Elements & globals
     ========================== */
  // Main UI elements
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const messages = document.getElementById("messages");
  const recordBtn = document.getElementById("record-btn");
  const typingIndicator = document.getElementById("typing-indicator");

  // Reply bar (WhatsApp-style)
  const replyBar = document.getElementById("reply-bar");
  const repliedMessageText = document.getElementById("replied-message-text");
  const cancelReplyBtn = document.getElementById("cancel-reply");

  // Music & controls
  const musicToggleLabel = document.getElementById("toggle-music-label");
  const musicToggle = document.getElementById("toggle-music");
  const musicController = document.getElementById("music-controller");
  const trackNameSpan = document.getElementById("track-name");
  const playPauseBtn = document.getElementById("play-pause");
  const nextBtn = document.getElementById("next-track");
  const prevBtn = document.getElementById("prev-track");

  // Effects & UI toggles
  const menuBtn = document.getElementById("menu-btn");
  const effectSwitches = document.getElementById("effect-switches");

  // Other
  const lightningContainer = document.getElementById("lightning-container");
  const flashOverlay = document.getElementById("flash-overlay");

  // State
  let username = "";
  let messageCounter = 0;
  let repliedMessage = null; // { user, text } when replying
  let musicEnabled = false;
  let currentTrackIndex = 0;
  let currentAudio = null;
  let mediaStream = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let flowerInterval = null;
  let usersTyping = new Set();
  let recordingUsers = new Set();
  let activeUsers = new Set();
  let typingTimeout = null;
  let isTyping = false;
  let startX = 0;
  let isRecording = false;
  let canceled = false;


  /* ==========================
     Music list (unchanged)
     ========================== */
  const musicUrls = [
    "https://files.catbox.moe/x4wwty.mp4",
    "https://files.catbox.moe/dr6g3i.mp4",
    "https://files.catbox.moe/hic3ht.mp4",
    "https://files.catbox.moe/fhuh4s.mp4",
    "https://files.catbox.moe/t8e1x9.mp4",
    "https://files.catbox.moe/rmf1cg.mp4",
    "https://files.catbox.moe/ioeftv.mp4",
    "https://files.catbox.moe/ri548a.mp4",
    "https://files.catbox.moe/jl8hvn.mp4",
    "https://files.catbox.moe/ceyeyl.mp4",
    "https://files.catbox.moe/6rm8vd.mp4",
    "https://files.catbox.moe/bcrbr6.mp4",
    "https://files.catbox.moe/paqtae.mp4",
    "https://files.catbox.moe/mx0pha.mp4",
    "https://files.catbox.moe/wfj659.mp4",
    "https://files.catbox.moe/ip9a6m.mp4",
    "https://files.catbox.moe/uj0338.mp4",
    "https://files.catbox.moe/kofc8i.mp4",
    "https://files.catbox.moe/ggx6bs.mp3",
    "https://files.catbox.moe/jf1jjs.mp4",
    "https://files.catbox.moe/i5i7a2.mp4",
    "https://files.catbox.moe/ljzval.mp4",
    "https://files.catbox.moe/5qox9n.mp4",
    "https://files.catbox.moe/hi2whc.mp4",
    "https://files.catbox.moe/h5hevr.mp4",
    "https://files.catbox.moe/qevape.mp4",
    "https://files.catbox.moe/s4us9i.mp3",
    "https://files.catbox.moe/76g7qu.mp4",
    "https://files.catbox.moe/zb08d5.mp4",
    "https://files.catbox.moe/gzdd9f.mp3",
    "https://files.catbox.moe/ni30vo.mp4",
    "https://files.catbox.moe/zqmlpu.mp4",
    "https://files.catbox.moe/t12usb.mp4",
    "https://files.catbox.moe/9olfxv.mp4",
    "https://files.catbox.moe/i541iw.mp4",
    "https://files.catbox.moe/zfgl60.mp4",
    "https://files.catbox.moe/b6fybu.mp4",
    "https://files.catbox.moe/js05nr.mp4",
    "https://files.catbox.moe/5504r6.mp3",
    "https://files.catbox.moe/9pw1ym.mp4",
    "https://files.catbox.moe/9nv0nw.mp3",
    "https://files.catbox.moe/exa8zj.mp3"
  ];

  /* ==========================
     Music helpers
     ========================== */
  function playTrack(index) {
    if (currentAudio) currentAudio.pause();
    currentTrackIndex = index % musicUrls.length;
    currentAudio = new Audio(musicUrls[currentTrackIndex]);
    currentAudio.volume = 0.25;
    currentAudio.play().catch(err => console.log("Autoplay blocked:", err));
    trackNameSpan.textContent = `Track ${currentTrackIndex + 1}`;
    currentAudio.onended = () => {
      currentTrackIndex = (currentTrackIndex + 1) % musicUrls.length;
      playTrack(currentTrackIndex);
    };
  }
  function startMusic() {
    musicEnabled = true;
    if (musicController) musicController.style.display = "flex";
    playTrack(currentTrackIndex);
  }
  function stopMusic() {
    musicEnabled = false;
    if (currentAudio) currentAudio.pause();
    if (musicController) musicController.style.display = "none";
  }

  if (typeof RENDER_MUSIC_ENABLED !== "undefined" && RENDER_MUSIC_ENABLED === "true") {
    if (musicToggleLabel) musicToggleLabel.style.display = "flex";
    if (musicToggle) musicToggle.addEventListener("change", () => {
      if (musicToggle.checked) startMusic(); else stopMusic();
    });
  } else {
    if (musicToggleLabel) musicToggleLabel.style.display = "none";
    musicEnabled = false;
  }

  if (playPauseBtn) playPauseBtn.addEventListener("click", () => {
    if (!currentAudio) playTrack(currentTrackIndex);
    else if (currentAudio.paused) currentAudio.play();
    else currentAudio.pause();
  });
  if (nextBtn) nextBtn.addEventListener("click", () => { currentTrackIndex = (currentTrackIndex + 1) % musicUrls.length; playTrack(currentTrackIndex); });
  if (prevBtn) prevBtn.addEventListener("click", () => { currentTrackIndex = (currentTrackIndex - 1 + musicUrls.length) % musicUrls.length; playTrack(currentTrackIndex); });

  /* ==========================
     Active users & UI helpers
     ========================== */
  socket.on("update users", (users) => {
    if (window.innerWidth >= 600) {
      activeUsers = new Set(users);
      updatePCActiveUsersList();
    }
  });

  function updatePCActiveUsersList() {
    const usersList = document.getElementById("users-list");
    if (!usersList) return;
    usersList.innerHTML = "";
    activeUsers.forEach(u => {
      const li = document.createElement("li");
      li.textContent = u;
      if (u === username) li.style.fontWeight = "bold";
      usersList.appendChild(li);
    });
  }
  /* ==========================
     Append message (handles replies)
     ========================== */
  function appendMessage(msgObj, type) {
    const li = document.createElement("li");
    li.classList.add(type);
    //ADDING METADATA TO EVERY MESG
    li.dataset.user = msgObj.user;
    li.dataset.text = msgObj.text || "";
    li.dataset.id = msgObj.id || (messageCounter++).toString(); // unique ID


    // If message has a replied preview
    let replyHtml = "";
    if (msgObj.replied) {
      // trim long text for preview (one-line)
      let preview = String(msgObj.replied.text || "").trim();
      if (preview.length > 120) preview = preview.slice(0, 117) + "...";
      replyHtml = `<div class="replied-preview" style="background:#f8f8f8; border-left:4px solid #ff69b4; padding:6px 8px; margin-bottom:6px; font-size:0.88em; border-radius:4px;">
                    <strong>${escapeHtml(msgObj.replied.user)}:</strong> ${escapeHtml(preview)}
                   </div>`;
    }

    li.innerHTML = `${replyHtml}<strong>${escapeHtml(msgObj.user)}:</strong> ${escapeHtml(msgObj.text)}`;

    // Effects: glow & heart ripple
    const glowToggle = document.getElementById("toggle-glow");
    if (glowToggle && glowToggle.checked) {
      li.classList.add("glow");
      li.addEventListener("animationend", () => li.classList.remove("glow"), { once: true });
    }
    const heartToggle = document.getElementById("toggle-heart");
    if (heartToggle && heartToggle.checked) {
      const heart = document.createElement("div");
      heart.classList.add("heart-ripple");
      li.appendChild(heart);
      setTimeout(() => heart.remove(), 700);
    }

    messages.appendChild(li);
    messages.scrollTop = messages.scrollHeight;
  }

  // safe HTML escape helper
  function escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* ==========================
   Sending & receiving messages
   ========================== */

// SEND
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!input.value || !username) return;

  const text = input.value.trim();

  // *** FIXED: include an id and ts when sending a chat message ***
  const msg = {
    user: username,
    text,
    id: (messageCounter++).toString(),
    ts: Date.now()
  };

  // If replying to a message
  if (repliedMessage) {
    // *** FIXED: include replied message id so delete can target it exactly ***
    msg.replied = {
      user: repliedMessage.user,
      text: repliedMessage.text,
      id: repliedMessage.id || null
    };
  }

  /* 
        DELETE COMMAND ("dlt") */
  if (text === "dlt" && repliedMessage) {
    socket.emit("delete message", {
        targetUser: repliedMessage.user,
        targetText: repliedMessage.text,
        targetId: repliedMessage.id, // SEND ID
        commandUser: username,
        commandText: "dlt"
    });


    // Clear reply UI
    repliedMessage = null;
    if (replyBar) replyBar.style.display = "none";

    // DO NOT append "dlt" locally
    input.value = "";
    return;
  }

  // Normal message
  socket.emit("chat message", msg);
  appendMessage(msg, "sent");

  // Reset UI
  repliedMessage = null;
  if (replyBar) replyBar.style.display = "none";
  input.value = "";
  socket.emit("stop typing", username);
});

// RECEIVE
socket.on("chat message", (msg) => {
  if (msg.user !== username) {
    appendMessage(msg, "received");
  }
});



/* ==========================
   Animate message delete (glowing dust)
========================== */
function animateDeleteMessage(li) {
  const rect = li.getBoundingClientRect();
  const count = 50; // increased number of particles
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const particle = document.createElement("div");
    particle.classList.add("glow-particle");

    // Random spread and velocity
    const angle = Math.random() * 2 * Math.PI;
    const radius = Math.random() * 80 + 20; // distance to fly
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    particle.style.setProperty("--x", x + "px");
    particle.style.setProperty("--y", y + "px");
    particle.style.left = centerX + "px";
    particle.style.top = centerY + "px";
    particle.style.animationDuration = (Math.random() * 0.8 + 0.6) + "s"; // vary speed

    document.body.appendChild(particle);

    // remove after animation
    setTimeout(() => particle.remove(), 1200);
  }

  // fade out and shrink the message bubble
  li.style.transition = "opacity 0.6s, transform 0.6s";
  li.style.opacity = 0;
  li.style.transform = "scale(0.3) rotate(" + (Math.random()*30-15) + "deg)";
  setTimeout(() => li.remove(), 600);
}

/*Handle delete command with animation */
socket.on("delete message", (data) => {
  const items = document.querySelectorAll("#messages li");

  items.forEach(li => {
    const u = li.getAttribute("data-user");
    const t = li.getAttribute("data-text");
    const id = li.getAttribute("data-id"); // *** FIXED: read id from element ***

    // Animate the target replied message (match by id first, fallback to user+text)
    if (
      id === data.targetId ||
      (u === data.targetUser && t === data.targetText)
    ) {
      animateDeleteMessage(li);
    }

    // Animate the "dlt" command message itself
    if (u === data.commandUser && t === data.commandText) {
      animateDeleteMessage(li);
    }
  });
});




  /* ==========================
   Voice recording (fixed)
   ========================== */

function startRecordingIndicator() {
  // Optional: show recording UI
  console.log("Recording started...");
}

function stopRecordingIndicator() {
  // Optional: hide recording UI
  console.log("Recording stopped...");
}

async function ensureMediaStream() {
  if (!mediaStream) {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }
  return mediaStream;
}

// Helper function to append a voice message to the chat
function appendVoiceMessage(msg) {
  const li = document.createElement("li");
  li.classList.add(msg.user === username ? "sent" : "received");

  li.dataset.user = msg.user;
  li.dataset.text = "voice";
  li.dataset.id = msg.id;

  li.innerHTML = `<strong>${escapeHtml(msg.user)}:</strong><br>`;
  const audio = document.createElement("audio");
  audio.controls = true;
  audio.src = msg.audio;
  audio.preload = "none";
  audio.style.maxWidth = "100%";
  li.appendChild(audio);

  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

async function handleStart(e) {
  const slideText = document.getElementById("slideToCancel");
  if (isRecording) return;

  isRecording = true;
  canceled = false;
  startX = e.touches ? e.touches[0].clientX : e.clientX;

  slideText.classList.add("show");
  startRecordingIndicator();

  const stream = await ensureMediaStream();
  audioChunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.canceled = false;

  mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);

  mediaRecorder.onstart = () => {
    socket.emit("start recording", username);
  };

  mediaRecorder.onstop = () => {
    stopRecordingIndicator();

    if (!mediaRecorder.canceled) {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = () => {
        const voiceMsg = {
          user: username,
          audio: reader.result,
          id: (messageCounter++).toString(),
          ts: Date.now()
        };
        socket.emit("voice message", voiceMsg);
        appendVoiceMessage(voiceMsg); // append locally for sender
      };
      reader.readAsDataURL(blob);
    }

    socket.emit("stop recording", username);

    // Reset UI
    recordBtn.textContent = "🎤";
    isRecording = false;
    canceled = false;
  };

  mediaRecorder.start();
  recordBtn.textContent = "⏺️ Recording...";
}

function handleMove(e) {
  const slideText = document.getElementById("slideToCancel");
  if (!isRecording) return;

  const currentX = e.touches ? e.touches[0].clientX : e.clientX;
  const diff = startX - currentX;

  if (diff > 80) {
    canceled = true;
    slideText.classList.add("canceling");
    recordBtn.style.background = "gray";
    slideText.textContent = "Release to cancel";
  } else {
    canceled = false;
    slideText.classList.remove("canceling");
    recordBtn.style.background = "";
    slideText.textContent = "← Slide to cancel";
  }
}

function handleEnd() {
  const slideText = document.getElementById("slideToCancel");
  if (!isRecording) return;

  slideText.classList.remove("show", "canceling");
  recordBtn.style.background = "";

  if (mediaRecorder && mediaRecorder.state === "recording") {
    // ✅ Respect cancel
    mediaRecorder.canceled = canceled;

    mediaRecorder.stop(); // triggers onstop
  } else {
    stopRecordingIndicator();
    recordBtn.textContent = "🎤";
    isRecording = false;
    canceled = false;
  }
}
/* ==========================
   Mic ↔ Send Button Toggle (FIXED)
   ========================== */

const holdThreshold = 200; // ms
let holdTimeout = null;
let isHold = false;

function updateRecordBtn() {
  if (input.value.trim().length > 0) {
    recordBtn.textContent = "➤";
    recordBtn.dataset.mode = "send";
  } else {
    recordBtn.textContent = "🎤";
    recordBtn.dataset.mode = "mic";
  }
}

// Initial check
updateRecordBtn();

// Input listener for toggle
input.addEventListener("input", updateRecordBtn);

// Click action
recordBtn.addEventListener("click", (e) => {
  if (recordBtn.dataset.mode === "send") {
    form.requestSubmit(); // send message
  }
});

// Press & hold voice only in mic mode
recordBtn.addEventListener("mousedown", (e) => {
  if (recordBtn.dataset.mode !== "mic") return;
  isHold = false;
  holdTimeout = setTimeout(() => {
    isHold = true;
    handleStart(e); // start recording
  }, holdThreshold);
});

recordBtn.addEventListener("mouseup", () => {
  clearTimeout(holdTimeout);
  if (isHold) handleEnd();
});

recordBtn.addEventListener("mouseleave", () => {
  clearTimeout(holdTimeout);
  if (isHold) handleEnd();
});

// Touch support
recordBtn.addEventListener("touchstart", (e) => {
  if (recordBtn.dataset.mode !== "mic") return;
  isHold = false;
  holdTimeout = setTimeout(() => {
    isHold = true;
    handleStart(e);
  }, holdThreshold);
}, { passive: false });

recordBtn.addEventListener("touchend", () => {
  clearTimeout(holdTimeout);
  if (isHold) handleEnd();
}, { passive: false });
// Track mouse movement for slide-to-cancel
document.addEventListener("mousemove", (e) => {
  if (isRecording) handleMove(e);
});

// Track touch movement for mobile
document.addEventListener("touchmove", (e) => {
  if (!isRecording) return;
  handleMove(e.touches[0]);
}, { passive: false });


// Reset button when recording ends
function resetRecordBtn() {
  updateRecordBtn();
  isHold = false;
}
// Receiving voice messages from other users
socket.on("voice message", (msg) => {
  if (msg.user !== username) {
    appendVoiceMessage(msg);
  }
});
 /*Falling flowers & trail particles*/
  function createFlower() {
    const wrapper = document.createElement("div");
    wrapper.classList.add("flower-wrapper");

    const flower = document.createElement("div");
    flower.classList.add("flower");
    flower.innerText = "🌸";

    wrapper.style.left = Math.random() * 100 + "vw";
    flower.style.fontSize = (20 + Math.random() * 15) + "px";

    const fallDuration = 4 + Math.random() * 3;
    const swayDuration = 2 + Math.random() * 2;
    const rotateDuration = 3 + Math.random() * 4;

    wrapper.style.animationDuration = `${fallDuration}s`;
    flower.style.animationDuration = `${swayDuration}s, ${rotateDuration}s`;

    wrapper.appendChild(flower);
    document.body.appendChild(wrapper);

    const maxDuration = Math.max(fallDuration, swayDuration, rotateDuration);
    setTimeout(() => wrapper.remove(), maxDuration * 1000);
  }

  const toggleFlowers = document.getElementById("toggle-flowers");
  if (toggleFlowers) {
    toggleFlowers.addEventListener("change", (e) => {
      if (e.target.checked) flowerInterval = setInterval(createFlower, 500);
      else {
        clearInterval(flowerInterval);
        document.querySelectorAll(".flower-wrapper").forEach(f => f.remove());
      }
    });
  }

  // trail particles
  function createTrail(x, y) {
    const trail = document.createElement("div");
    trail.classList.add("trail-particle");
    trail.style.left = x + "px";
    trail.style.top = y + "px";
    document.body.appendChild(trail);
    setTimeout(() => trail.remove(), 1000);
  }
  document.addEventListener("mousemove", (e) => {
    if (e.buttons) createTrail(e.clientX, e.clientY);
  });
  document.addEventListener("touchmove", (e) => {
    // do not prevent default globally; only prevented when swipe triggers
    for (let t of e.touches) createTrail(t.clientX, t.clientY);
  }, { passive: true });

  
  /*Notifications (join/leave) */

     let previousUsers = [];

socket.on("update users", (userList) => {
  if (window.innerWidth >= 600) {
    // Desktop: just update the active users list
    updatePCActiveUsersList(userList);
  } else {
    // Mobile: detect who joined or left
    const joinedUsers = userList.filter((u) => !previousUsers.includes(u));
    const leftUsers = previousUsers.filter((u) => !userList.includes(u));

    joinedUsers.forEach((user) => showMobileNotification(user, "joined"));
    leftUsers.forEach((user) => showMobileNotification(user, "left"));
  }

  previousUsers = userList;
});

function showMobileNotification(uname, action) {
  console.log("MOBILE NOTIFICATION TRIGGERED:", uname, action);

  const container = document.getElementById("mobile-user-notifications");
  if (!container) return;

  const el = document.createElement("div");
  el.classList.add("mobile-notification");
  el.textContent = `${uname} ${action}`;

  container.appendChild(el);

  setTimeout(() => el.remove(), 3000);
}

 /*Typing & Recording indicators */
input.addEventListener("input", () => {
  if (!isTyping) socket.emit("typing", username);
  isTyping = true;
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("stop typing", username);
    isTyping = false;
  }, 1000);
});

// OTHER USERS
socket.on("typing", user => {
  if (user !== username) {
    usersTyping.add(user);
    updateIndicator();
  }
});
socket.on("stop typing", user => {
  if (user !== username) {
    usersTyping.delete(user);
    updateIndicator();
  }
});
socket.on("start recording", user => {
  if (user !== username) {
    recordingUsers.add(user);
    updateIndicator();
  }
});
socket.on("stop recording", user => {
  if (user !== username) {
    recordingUsers.delete(user);
    updateIndicator();
  }
});


function updateIndicator() {
  if (recordingUsers.size > 0) {
    typingIndicator.textContent = [...recordingUsers].join(", ") + " is recording...";
  } else if (usersTyping.size > 0) {
    typingIndicator.textContent = [...usersTyping].join(", ") + " is typing...";
  } else {
    typingIndicator.textContent = "";
  }
}

  /*Background slideshow (unchanged)*/
  const bgImages = [
  "/assets/l1.jpg",
  "/assets/l2.jpg",
  "/assets/l3.jpg",
  "/assets/l4.jpg",
  "/assets/l5.jpg",
  "/assets/l6.jpg",
  "/assets/l7.jpg",
  "/assets/l8.jpg",
  "/assets/l9.jpg",
  "/assets/l10.jpg",
  "/assets/l11.jpg",
  "/assets/l12.jpg",
  "/assets/l13.jpg",
  "/assets/l14.jpg",
  "/assets/l15.jpg",
  "/assets/l16.jpg",
  "/assets/l17.jpg",
  "/assets/l18.jpg",
  "/assets/l19.jpg",
  "/assets/l20.jpg",
  "/assets/l21.jpg",
  "/assets/l22.jpg",
  "/assets/l23.jpg",
  "/assets/l24.jpg",
  "/assets/l25.jpg",
  "/assets/l26.jpg",
  "/assets/l26.jpg",
  "/assets/l27.jpg",
  "assets/l28.jpg"
];

  let bgIndex = 0;
  const chatContainer = document.querySelector(".chat-container");
  if (chatContainer) chatContainer.style.backgroundImage = `url('${bgImages[0]}')`;
  function changeBackground() {
    if (!chatContainer) return;
    bgIndex = (bgIndex + 1) % bgImages.length;
    chatContainer.style.setProperty("--bg-next", `url('${bgImages[bgIndex]}')`);
    chatContainer.classList.add("fade-bg");
    setTimeout(() => {
      chatContainer.style.backgroundImage = `url('${bgImages[bgIndex]}')`;
      chatContainer.classList.remove("fade-bg");
    }, 1500);
  }
  setInterval(changeBackground, 25000);

  /* ==========================
     Menu toggle
     ========================== */
  if (menuBtn && effectSwitches) {
    menuBtn.addEventListener("click", () => {
      effectSwitches.classList.toggle("show");
    });
    document.addEventListener("click", (e) => {
      if (!menuBtn.contains(e.target) && !effectSwitches.contains(e.target)) {
        effectSwitches.classList.remove("show");
      }
    });
  }

  /* ==========================
     Swipe / Drag to reply (works for mobile, desktop, and click)
     - triggers the WhatsApp-style reply bar above input
     ========================== */
  (function setupReplyTriggers() {
    const container = messages;
    if (!container) return;

    let startX = 0;
    let startY = 0;
    const swipeThreshold = 80;
    let isMouseDown = false;

    // helper to extract clean text and user from li
    function extractFromLi(li) {
      const strong = li.querySelector("strong");
      const user = strong ? (strong.textContent.replace(/:$/, "").trim()) : "";
      // get message text by removing strong text from innerText (safe fallback)
      let full = li.innerText || "";
      if (strong) {
        const strongText = strong.textContent;
        // remove only the first occurrence of strongText
        full = full.replace(new RegExp("^" + escapeRegExp(strongText)), "").trim();
      }
      return { user, text: full };
    }

    function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    // main trigger that uses our triggerReply function (defined below)
    function handleTrigger(targetLi) {
      if (!targetLi) return;
      triggerReply(targetLi);
    }

    // touch events
    container.addEventListener("touchstart", (e) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    }, { passive: true });

    container.addEventListener("touchmove", (e) => {
      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      if (Math.abs(deltaY) > Math.abs(deltaX)) return; // vertical scroll
      if (deltaX > swipeThreshold) {
        const target = e.target.closest("li");
        if (target) {
          // prevent scrolling only when we actually trigger reply
          e.preventDefault();
          handleTrigger(target);
          startX = touch.clientX;
        }
      }
    }, { passive: false });

    // mouse events for desktop drag
    container.addEventListener("mousedown", (e) => { isMouseDown = true; startX = e.clientX; startY = e.clientY; });
    container.addEventListener("mousemove", (e) => {
      if (!isMouseDown) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;
      if (deltaX > swipeThreshold) {
        const target = e.target.closest("li");
        if (target) {
          handleTrigger(target);
          isMouseDown = false;
        }
      }
    });
    container.addEventListener("mouseup", () => { isMouseDown = false; });
    container.addEventListener("mouseleave", () => { isMouseDown = false; });

    // simple click/tap to reply as well (optional, like WhatsApp long-press)
    container.addEventListener("click", (e) => {
      const target = e.target.closest("li");
      // if user tapped a sent/received bubble quickly, open the reply bar (makes UX easier)
      if (target) {
        // small delay to differentiate from drag/swipe
        setTimeout(() => {
          // require the user to hold ctrl/cmd for click-reply on desktop? No — we'll allow simple click.
          // If you prefer to require modifier, check e.ctrlKey / e.metaKey here.
          triggerReply(target);
        }, 100);
      }
    });

    // actual logic that fills reply UI
    function triggerReply(messageEl) {
      if (!messageEl || !username) {
        // if user hasn't joined, show a brief hint
        if (!username) {
          // small toast style mobile notification
          showMobileNotification("Please join chat first", "");
        }
        return;
      }

      const strong = messageEl.querySelector("strong");
      if (!strong) return;

      const user = strong.textContent.replace(/:$/, "").trim();
      // compute message text content (remove strong content)
      let full = messageEl.innerText || "";
      full = full.replace(new RegExp("^" + escapeRegExp(strong.textContent)), "").trim();

      // save replied message object
      repliedMessage = {
    user,
    text: full,
    id: messageEl.dataset.id   // ADD THIS
};

      // show reply bar
      if (repliedMessageText) repliedMessageText.textContent = `${user}: ${full}`;
      if (replyBar) replyBar.style.display = "flex";

      // highlight
      messageEl.classList.add("replying");
      setTimeout(() => messageEl.classList.remove("replying"), 400);

      // focus input
      input.focus();
    }

    // expose triggerReply to outer scope (used elsewhere earlier)
    window.triggerReply = (el) => triggerReply(el);

  })();

  /* ==========================
     Reply cancel button
     ========================== */
  if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener("click", () => {
      repliedMessage = null;
      if (replyBar) replyBar.style.display = "none";
      input.value = "";
    });
  }

  /* ==========================
     Utility helpers
     ========================== */
  function showMobileNotification(usernameText, action) {
    // reusing earlier function behavior
    if (!usernameText) return;
    let container = document.getElementById("mobile-user-notifications");
    if (!container) {
      container = document.createElement("div");
      container.id = "mobile-user-notifications";
      container.style.position = "absolute";
      container.style.top = "10px";
      container.style.left = "50%";
      container.style.transform = "translateX(-50%)";
      container.style.zIndex = "20";
      container.style.pointerEvents = "none";
      document.body.appendChild(container);
    }
    const el = document.createElement("div");
    el.classList.add("mobile-notification");
    el.textContent = action ? `${usernameText} ${action}` : usernameText;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
  /* ==========================
     Finish DOMContentLoaded
     ========================== */

}); // end DOMContentLoaded
