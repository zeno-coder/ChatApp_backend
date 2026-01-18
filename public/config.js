<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Student Web Developers</title>
  <style>
    :root {
      --bg: #ffffff;
      --text: #000000;
      --card: #f2f2f2;
    }
    [data-theme="dark"] {
      --bg: #0a0a0a;
      --text: #ffffff;
      --card: #1a1a1a;
    }

    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      transition: 0.3s ease;
    }

    header {
      padding: 20px;
      text-align: center;
      font-size: 28px;
      font-weight: bold;
    }

    .toggle-box {
      position: absolute;
      top: 20px;
      right: 20px;
    }

    .container {
      max-width: 900px;
      margin: 20px auto;
      padding: 20px;
    }

    .card {
      padding: 20px;
      background: var(--card);
      border-radius: 14px;
      margin-bottom: 20px;
      transition: 0.3s ease;
    }

    a.button {
      display: inline-block;
      text-decoration: none;
      padding: 12px 18px;
      background: #25D366;
      color: white;
      border-radius: 8px;
      font-weight: bold;
    }

  </style>
</head>
<body data-theme="light">

  <div class="toggle-box">
    <label>
      <input type="checkbox" id="themeToggle"> Dark Mode
    </label>
  </div>

  <header>Student Web Developers — Business Website Builder</header>

  <div class="container">

    <div class="card">
      <h2>💡 How It Works</h2>
      <p>• Enter your name</p>
      <p>• Join the chat</p>
      <p>• Chat privately with full confidence</p>
      <p>• For music mode in 3-dot menu:</p>
      <p>&nbsp;&nbsp;– Fork the repo</p>
      <p>&nbsp;&nbsp;– Add environment variable on Render</p>
      <p>&nbsp;&nbsp;– Set <b>MUSIC_ENABLED=true</b> (off by default)</p>
      <p>&nbsp;&nbsp;– Enjoy songs (editable on PC)</p>
    </div>

    <div class="card">
      <h2>🆘 Support</h2>
      <p>Contact for any support from the developer side.</p>
      <p>Extra features and customization are available — just contact!</p>
    </div>

    <div class="card" style="text-align:center;">
      <h2>📞 Contact Us</h2>
      <a class="button" href="https://wa.me/918129927512" target="_blank">Message on WhatsApp</a>
    </div>

  </div>

<script>
  const toggle = document.getElementById('themeToggle');
  const body = document.body;

  toggle.addEventListener('change', () => {
    if (toggle.checked) body.setAttribute('data-theme', 'dark');
    else body.setAttribute('data-theme', 'light');
  });
</script>

</body>
</html>
