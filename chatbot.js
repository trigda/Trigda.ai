(function () {
  var launcher = document.getElementById('chatLauncher');
  var panel = document.getElementById('chatPanel');
  var closeBtn = document.getElementById('chatClose');
  var messagesEl = document.getElementById('chatMessages');
  var form = document.getElementById('chatForm');
  var input = document.getElementById('chatInput');
  var sendBtn = document.getElementById('chatSend');
  var counterText = document.getElementById('chatCounterText');
  var counterFill = document.getElementById('chatCounterFill');

  if (!launcher || !panel) return;

  var csrfToken = null;
  var limited = false;
  var loaded = false;

  function escapeText(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function addBubble(text, kind) {
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + kind;
    bubble.textContent = text; // textContent only - never innerHTML with server/user content
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function showLoading() {
    var loading = document.createElement('div');
    loading.className = 'chat-loading';
    loading.id = 'chatLoadingIndicator';
    loading.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(loading);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideLoading() {
    var el = document.getElementById('chatLoadingIndicator');
    if (el) el.remove();
  }

  function updateCounter(count, limit) {
    counterText.textContent = count + ' / ' + limit + ' messages used';
    counterFill.style.width = Math.min(100, (count / limit) * 100) + '%';
  }

  function setLimited(message) {
    limited = true;
    input.disabled = true;
    sendBtn.disabled = true;
    input.placeholder = 'Message limit reached';
    if (message) addBubble(message, 'system');
  }

  async function ensureCsrf() {
    if (csrfToken) return csrfToken;
    var res = await fetch('/api/csrf-token');
    var data = await res.json();
    csrfToken = data.csrfToken;
    return csrfToken;
  }

  async function loadStatus() {
    try {
      var res = await fetch('/api/chatbot/status');
      var data = await res.json();
      updateCounter(data.messageCount, data.limit);
      if (data.status === 'limited') {
        setLimited(null);
      }
    } catch (e) {
      // Non-fatal - the counter simply won't be pre-filled.
    }
  }

  function openPanel() {
    panel.classList.add('open');
    launcher.setAttribute('aria-expanded', 'true');
    if (!loaded) {
      loaded = true;
      addBubble("Hi! I'm the TRIGDA Assistant. Ask me about our services, process, or how to book a consultation.", 'assistant');
      ensureCsrf();
      loadStatus();
    }
    input.focus();
  }

  function closePanel() {
    panel.classList.remove('open');
    launcher.setAttribute('aria-expanded', 'false');
  }

  launcher.addEventListener('click', function () {
    if (panel.classList.contains('open')) closePanel();
    else openPanel();
  });
  closeBtn.addEventListener('click', closePanel);

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (limited) return;

    var text = input.value.trim();
    if (!text) return;
    if (text.length > 500) {
      addBubble('Please keep questions under 500 characters.', 'error');
      return;
    }

    addBubble(text, 'visitor');
    input.value = '';
    sendBtn.disabled = true;
    showLoading();

    try {
      var token = await ensureCsrf();
      var res = await fetch('/api/chatbot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ message: text }),
      });
      var data = await res.json();
      hideLoading();

      if (res.status === 429 && data.limited) {
        updateCounter(data.messageCount, data.limit);
        setLimited(data.message);
        return;
      }

      if (!res.ok) {
        addBubble(data.error || 'Something went wrong. Please try again.', 'error');
        sendBtn.disabled = false;
        return;
      }

      addBubble(data.answer, 'assistant');
      updateCounter(data.messageCount, data.limit);

      if (data.limited) {
        setLimited('You have reached the 10-message limit for this chat window. Your chat access will reset automatically after 24 hours. For immediate help, please schedule a consultation or contact TRIGDA.');
      } else {
        sendBtn.disabled = false;
      }
    } catch (err) {
      hideLoading();
      addBubble('The assistant is temporarily unavailable. Please try again in a moment.', 'error');
      sendBtn.disabled = false;
    }
  });
})();
