document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("signup-btn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const roomCodeInput = document.getElementById("room-code");
    const room_code = roomCodeInput?.value.trim();

    if (!username || !password) {
      alert("Fill all fields");
      return;
    }

    const payload = { username, password };

    // ✅ only send room_code if user entered it
    if (room_code) {
      payload.room_code = room_code;
    }

    try {
      const res = await fetch("/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();

      localStorage.setItem("token", data.token);
      localStorage.setItem("user_id", data.user_id);
      localStorage.setItem("username", data.username);
      localStorage.setItem("room_id", data.room_id);

      window.location.href = "/index.html";
    } catch (err) {
      alert(err.message);
    }
  });
});
