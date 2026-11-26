document.getElementById('allow').addEventListener('click', async () => {
  const status = document.getElementById('status');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    status.textContent = '✓ Microphone allowed. You can close this tab and use the 🎤 button in WebSaathi.';
  } catch (err) {
    status.textContent = 'Microphone was not allowed (' + err.name + '). You can still type in WebSaathi.';
  }
});
