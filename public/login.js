document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("login-btn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();

      localStorage.setItem("token", data.token);
      localStorage.setItem("user_id", data.user_id);
      localStorage.setItem("username", data.username);

      window.location.href = "/index.html";
    } catch (err) {
      alert(err.message);
    }
  });
});
