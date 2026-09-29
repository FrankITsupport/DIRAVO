(() => {
  'use strict';
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('primary-nav');
  const closeMenu = () => { document.body.classList.remove('menu-open'); menuToggle.setAttribute('aria-expanded', 'false'); };
  menuToggle.addEventListener('click', () => {
    const open = !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    if (open) nav.querySelector('a').focus();
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (!document.body.classList.contains('menu-open')) return;
    if (event.key === 'Escape') { closeMenu(); menuToggle.focus(); }
    if (event.key === 'Tab') {
      const controls = [menuToggle, ...nav.querySelectorAll('a')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
  const sections = [...document.querySelectorAll('main > section')];
  const navLinks = [...nav.querySelectorAll('a')];
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach(link => {
      if (link.hash === `#${visible.target.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-20% 0px -50% 0px', threshold: 0 });
  sections.forEach(section => observer.observe(section));
  function openServiceFromHash() {
    const target = document.getElementById(window.location.hash.slice(1));
    if (target?.classList.contains('service')) target.open = true;
  }
  window.addEventListener('hashchange', openServiceFromHash);
  openServiceFromHash();
  document.querySelectorAll('[data-service]').forEach(link => link.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('input[name="services[]"]');
    checkboxes.forEach(input => { if (input.value === link.dataset.service) input.checked = true; if (input.value === 'All services') input.checked = false; });
    document.getElementById('services-error').hidden = true;
  }));
  const allServices = document.querySelector('input[value="All services"]');
  const individualServices = [...document.querySelectorAll('input[name="services[]"]')].filter(input => input !== allServices);
  allServices.addEventListener('change', () => { if (allServices.checked) individualServices.forEach(input => { input.checked = false; }); });
  individualServices.forEach(input => input.addEventListener('change', () => { if (input.checked) allServices.checked = false; }));
  document.querySelectorAll('input[name="services[]"]').forEach(input => input.addEventListener('change', () => { document.getElementById('services-error').hidden = true; }));
  const gallery = [
    { source: 'hech-exhibition', width: 1620, height: 1080, alt: 'Wide view of the HECH exhibition booth and its branded display environment', caption: 'The exhibition environment' },
    { source: 'hech-detail', width: 1620, height: 1023, alt: 'HECH display graphics and product presentation details', caption: 'The details that bring a brand to life' },
    { source: 'hech-installation', width: 864, height: 1361, alt: 'A DIRAVO crew member installing HECH exhibition graphics', caption: 'Behind the experience' }
  ];
  let galleryIndex = 0;
  function changePhoto(direction) {
    galleryIndex = (galleryIndex + direction + gallery.length) % gallery.length;
    const photo = gallery[galleryIndex], image = document.getElementById('project-image');
    image.srcset = (photo.width < 1400 ? [480, 900] : [480, 900, 1400]).map(size => `assets/images/${photo.source}-${size}.webp ${Math.min(size, photo.width)}w`).join(', ');
    image.src = `assets/images/${photo.source}-900.webp`;
    image.alt = photo.alt; image.width = photo.width; image.height = photo.height;
    image.style.objectPosition = photo.source === 'hech-installation' ? 'center 35%' : 'center';
    const count = String(galleryIndex + 1).padStart(2, '0');
    document.getElementById('project-caption').textContent = `${count} / ${photo.caption}`;
    const counter = document.getElementById('gallery-counter');
    counter.replaceChildren(document.createTextNode(`${count} `));
    const total = document.createElement('span'); total.textContent = '/ 03'; counter.append(total);
  }
  document.getElementById('gallery-prev').addEventListener('click', () => changePhoto(-1));
  document.getElementById('gallery-next').addEventListener('click', () => changePhoto(1));
  document.getElementById('copyright-year').textContent = String(new Date().getFullYear());

  const form = document.getElementById('enquiry-form');
  const status = document.getElementById('form-status');
  const submit = document.getElementById('submit-enquiry');
  let tokenPromise;
  const fetchToken = () => {
    tokenPromise = fetch('api/enquiry.php', { headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok || !result.token) throw new Error('token'); document.getElementById('csrf-token').value = result.token; return result.token; });
    tokenPromise.catch(() => {});
    return tokenPromise;
  };
  fetchToken();
  function setStatus(message, state) { status.textContent = message; status.dataset.state = state; status.hidden = false; status.focus({ preventScroll: true }); }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    if (!form.reportValidity()) return;
    if (!form.querySelector('input[name="services[]"]:checked')) {
      const error = document.getElementById('services-error'); error.hidden = false;
      form.querySelector('input[name="services[]"]').focus(); return;
    }
    submit.disabled = true; submit.querySelector('span').textContent = 'Sending…'; status.hidden = true;
    try {
      await (tokenPromise || fetchToken());
      const response = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      const result = await response.json();
      if (response.ok && result.success) {
        form.reset(); setStatus('Thank you. Your enquiry has been sent to DIRAVO. We’ll be in touch using the details you provided.', 'success');
        await fetchToken().catch(() => {});
      } else {
        setStatus(result.message || 'We couldn’t send your enquiry. Please try again, email us or use WhatsApp.', 'error');
        if (response.status === 403) fetchToken().catch(() => {});
      }
    } catch {
      tokenPromise = undefined;
      setStatus('We couldn’t connect to send your enquiry. Your details are still here. Please try again, email us or use WhatsApp.', 'error');
    } finally { submit.disabled = false; submit.querySelector('span').textContent = 'Send enquiry'; }
  });
})();
