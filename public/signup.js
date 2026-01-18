// signup.js
document.getElementById("signup-btn").addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorMsg = document.getElementById("error-msg");

  if (!username || !password) {
    errorMsg.textContent = "Please fill both fields";
    return;
  }

  try {
    const res = await fetch("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (res.status === 201) {
      const data = await res.json();
      // Save JWT + user info locally
      localStorage.setItem("token", data.token);
      localStorage.setItem("user_id", data.user_id);
      localStorage.setItem("username", data.username);

      // Redirect to chat page
      window.location.href = "/index.html";
    } else {
      const text = await res.text();
      errorMsg.textContent = text || "Signup failed";
    }
  } catch (err) {
    console.error(err);
    errorMsg.textContent = "Server error";
  }
});
