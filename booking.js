(function () {
  var form = document.getElementById('bookingForm');
  if (!form) return;

  var statusBox = document.getElementById('formStatus');
  var submitBtn = document.getElementById('bookingSubmit');
  var dateInput = document.getElementById('appointment_date');
  var idemInput = document.getElementById('idempotency_key');
  var modal = document.getElementById('successModal');
  var modalCloseBtns = document.querySelectorAll('[data-modal-close]');

  // Block past dates at the picker level too (server re-checks this).
  var today = new Date().toISOString().slice(0, 10);
  if (dateInput) dateInput.setAttribute('min', today);

  function newIdempotencyKey() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'idem-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }
  if (idemInput) idemInput.value = newIdempotencyKey();

  function clearErrors() {
    form.querySelectorAll('.form-field').forEach(function (f) {
      f.classList.remove('has-error');
      var err = f.querySelector('.field-error');
      if (err) err.textContent = '';
    });
    statusBox.className = 'form-status';
    statusBox.textContent = '';
  }

  function showFieldError(fieldName, message) {
    var input = form.querySelector('[name="' + fieldName + '"]');
    if (!input) return;
    var wrap = input.closest('.form-field');
    if (!wrap) return;
    wrap.classList.add('has-error');
    var err = wrap.querySelector('.field-error');
    if (err) err.textContent = message;
  }

  function showStatus(message, kind) {
    statusBox.textContent = message;
    statusBox.className = 'form-status show ' + kind;
  }

  async function getCsrfToken() {
    var res = await fetch('/api/csrf-token');
    var data = await res.json();
    return data.csrfToken;
  }

  function openModal() {
    modal.classList.add('show');
  }
  function closeModal() {
    modal.classList.remove('show');
  }
  modalCloseBtns.forEach(function (btn) { btn.addEventListener('click', closeModal); });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    var formData = new FormData(form);
    var payload = {
      full_name: formData.get('full_name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      company_name: formData.get('company_name'),
      service: formData.get('service'),
      appointment_date: formData.get('appointment_date'),
      appointment_time: formData.get('appointment_time'),
      issue_details: formData.get('issue_details'),
      budget_context: formData.get('budget_context'),
      consent: formData.get('consent') === 'on',
      idempotency_key: formData.get('idempotency_key'),
    };

    try {
      var token = await getCsrfToken();
      var res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify(payload),
      });
      var data = await res.json();

      if (res.ok && data.success) {
        openModal();
        form.reset();
        if (dateInput) dateInput.setAttribute('min', today);
        idemInput.value = newIdempotencyKey();
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm Booking';
        return;
      }

      if (res.status === 400 && Array.isArray(data.fields)) {
        data.fields.forEach(function (f) { showFieldError(f.field, f.message); });
        showStatus('Please correct the highlighted fields.', 'error');
      } else if (res.status === 409) {
        showStatus(data.error, 'error');
      } else {
        showStatus(data.error || 'Something went wrong. Please try again.', 'error');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Booking';
    } catch (err) {
      showStatus('Network error - please check your connection and try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Booking';
    }
  });
})();
