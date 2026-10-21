/* Homepage validation. Production delivery uses the existing native FormSubmit POST. */
(() => {
  const quoteForm = document.querySelector('.inline-quote-form');
  const context = {source_page: location.pathname};
  const params = new URLSearchParams(location.search);
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(key => {
    if (params.has(key)) context[key] = params.get(key).slice(0,200);
  });
  Object.entries(context).forEach(([name,value]) => {
    const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;quoteForm.append(input);
  });
  const quoteFields = [...quoteForm.querySelectorAll('input:not([type="hidden"])')];
  const errorSummary = document.getElementById('quote-errors');
  const quoteStatus = document.getElementById('quote-status');
  let attempted = false;
  // Keep the browser's native validation as a fallback when this script is unavailable.
  quoteForm.noValidate = true;
  function fieldError(input) {
    const value = input.value.trim();
    if (input.required && !value) return input.name === 'name' ? 'Enter your name.' : 'Enter your phone number.';
    if (input.name === 'phone' && value) {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15 || /[a-z]/i.test(value)) return 'Enter a phone number with 7–15 digits.';
    }
    if (input.name === 'email' && value && input.validity.typeMismatch) return 'Enter an email address, such as name@example.com.';
    return '';
  }
  function validate(input) {
    const message = fieldError(input);
    const error = document.getElementById(input.id + '-error');
    error.textContent = message;
    error.hidden = !message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return !message;
  }
  quoteFields.forEach(input => input.addEventListener('input', () => {
    quoteStatus.hidden = true;
    if (attempted) {
      validate(input);
      const remaining = quoteFields.filter(field => field.getAttribute('aria-invalid') === 'true').length;
      errorSummary.hidden = !remaining;
      if (remaining) errorSummary.textContent = 'Please check the highlighted ' + (remaining === 1 ? 'field.' : 'fields.');
    }
  }));
  quoteForm.addEventListener('submit', event => {
    attempted = true;
    quoteStatus.hidden = true;
    quoteFields.forEach(input => { input.value = input.value.trim(); });
    const invalid = quoteFields.filter(input => !validate(input));
    errorSummary.hidden = !invalid.length;
    if (invalid.length) {
      event.preventDefault();
      errorSummary.textContent = 'Please check the highlighted ' + (invalid.length === 1 ? 'field.' : 'fields.');
      invalid[0].focus();
      return;
    }
    if (['localhost','127.0.0.1','::1','[::1]'].includes(location.hostname)) {
      event.preventDefault();
      quoteStatus.textContent = 'Local review only — your request has not been sent.';
      quoteStatus.hidden = false;
      quoteStatus.focus();
    }
  });
  document.addEventListener('invalid', event => {
    const details = event.target.closest('.estimate-details');
    if (details) details.open = true;
  }, true);
  document.querySelectorAll('.mobile-nav nav a[href^="#"]').forEach(link=>link.addEventListener('click',()=>{
    link.closest('details').open=false;
    const target=document.querySelector(link.hash);
    if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
  }));
  document.addEventListener('click',event=>{
    const menu=document.querySelector('.mobile-nav');
    if(menu.open&&!menu.contains(event.target))menu.open=false;
  });
})();
