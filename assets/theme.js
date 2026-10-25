/* Inspot theme script. No build step: plain JavaScript, loaded with defer after GSAP, ScrollTrigger and Lenis. */
(() => {
  const theme = window.theme || {};
  const S = theme.strings || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';
  const root = (theme.routes?.root || '/').replace(/\/?$/, '/');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } },
  };

  /* ───────── Money ───────── */
  function formatMoney(cents, format = theme.moneyFormat || 'Rs. {{amount_no_decimals}}') {
    const value = Number(cents || 0) / 100;
    const fmt = (n, decimals, thousands = ',', dec = '.') => {
      const [whole, frac] = n.toFixed(decimals).split('.');
      return whole.replace(/\B(?=(\d{3})+(?!\d))/g, thousands) + (frac ? dec + frac : '');
    };
    return format.replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => ({
      amount: fmt(value, 2),
      amount_no_decimals: fmt(value, 0),
      amount_with_comma_separator: fmt(value, 2, '.', ','),
      amount_no_decimals_with_comma_separator: fmt(value, 0, '.', ','),
    }[key] ?? fmt(value, 2)));
  }

  /* ───────── Smooth scroll (mouse and trackpad only; phones keep native scrolling) ───────── */
  let lenis = null;
  if (theme.smoothScroll && !reduced && finePointer && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    if (hasGsap && window.ScrollTrigger) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add((time) => lenis.raf(time * 1000));
      window.gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  if (hasGsap && window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);

  let locks = 0;
  const lock = (on) => {
    locks = Math.max(0, locks + (on ? 1 : -1));
    document.documentElement.classList.toggle('is-locked', locks > 0);
    if (lenis) locks > 0 ? lenis.stop() : lenis.start();
  };

  /* ───────── Toast ───────── */
  const toastEl = $('[data-toast]');
  let toastTimer = 0;
  const toast = (msg) => {
    if (!toastEl || !msg) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
  };

  /* ───────── Reveal on scroll (CSS transitions; the script only flips data-reveal to "in") ───────── */
  const revealOn = document.documentElement.classList.contains('reveal-on') && !reduced && 'IntersectionObserver' in window;
  const io = revealOn ? new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.setAttribute('data-reveal', 'in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -6% 0px' }) : null;
  const reveal = (scope = document) => $$('[data-reveal]:not([data-reveal="in"])', scope).forEach((el) => (io ? io.observe(el) : el.setAttribute('data-reveal', 'in')));
  reveal();

  /* ───────── Sections fetched from Shopify (Section Rendering API) ───────── */
  const sectionCache = new Map();
  function fetchSection(url, id) {
    const sep = url.includes('?') ? '&' : '?';
    const full = `${url}${sep}section_id=${id}`;
    if (!sectionCache.has(full)) {
      sectionCache.set(full, fetch(full).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      }).then((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const wrap = doc.getElementById(`shopify-section-${id}`) || doc.body;
        return wrap.innerHTML;
      }).catch((err) => { sectionCache.delete(full); throw err; }));
    }
    return sectionCache.get(full);
  }

  /* ───────── Header and mega menu ───────── */
  const header = $('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const megas = $$('[data-mega]', header);
    let openItem = null;
    let hoverTimer = 0;
    const setMega = (item) => {
      if (openItem === item) return;
      megas.forEach((m) => {
        const on = m === item;
        m.classList.toggle('is-open', on);
        $('[data-mega-toggle]', m)?.setAttribute('aria-expanded', String(on));
      });
      openItem = item;
      header.classList.toggle('has-mega', !!item);
    };
    megas.forEach((item) => {
      $('[data-mega-toggle]', item)?.addEventListener('click', () => setMega(openItem === item ? null : item));
      if (finePointer) {
        item.addEventListener('pointerenter', () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => setMega(item), 90); });
        item.addEventListener('pointerleave', () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => setMega(null), 160); });
      }
      item.addEventListener('focusout', (e) => { if (!item.contains(e.relatedTarget)) setMega(null); });
    });
    $('[data-mega-scrim]', header)?.addEventListener('click', () => setMega(null));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && openItem) { $('[data-mega-toggle]', openItem)?.focus(); setMega(null); }
    });
  }

  /* ───────── Menu drawer ───────── */
  const menu = $('[data-menu]');
  const openMenu = (open) => {
    if (!menu || menu.classList.contains('is-open') === open) return;
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    $$('[data-menu-open]').forEach((b) => b.setAttribute('aria-expanded', String(open)));
    lock(open);
    if (open) $('a, summary', menu)?.focus();
  };
  $$('[data-menu-open]').forEach((b) => b.addEventListener('click', () => openMenu(true)));
  $$('[data-menu-close]').forEach((b) => b.addEventListener('click', () => openMenu(false)));

  /* ───────── Panels: wishlist, size guide, filters ───────── */
  const panels = new Map($$('[data-panel]').map((p) => [p.dataset.panel, p]));
  let lastFocus = null;
  const openPanel = (name, open = true) => {
    const p = panels.get(name);
    if (!p || p.classList.contains('is-open') === open) return;
    if (open) { lastFocus = document.activeElement; openMenu(false); }
    p.classList.toggle('is-open', open);
    p.setAttribute('aria-hidden', String(!open));
    document.documentElement.classList.toggle('panel-open', $$('[data-panel].is-open').length > 0);
    lock(open);
    if (open) setTimeout(() => $('[data-panel-close].icon-btn', p)?.focus(), 50);
    else lastFocus?.focus?.();
    p.dispatchEvent(new CustomEvent(open ? 'panel:open' : 'panel:close'));
  };
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-panel-open]');
    if (opener) { e.preventDefault(); openPanel(opener.dataset.panelOpen, true); return; }
    const closer = e.target.closest('[data-panel-close]');
    if (closer) openPanel(closer.closest('[data-panel]')?.dataset.panel, false);
  });

  /* ───────── Search with suggestions ───────── */
  const search = $('[data-search]');
  const openSearch = (open) => {
    if (!search || search.classList.contains('is-open') === open) return;
    search.classList.toggle('is-open', open);
    search.setAttribute('aria-hidden', String(!open));
    document.documentElement.classList.toggle('search-open', open);
    lock(open);
    if (open) setTimeout(() => $('[data-ps-input]', search)?.focus(), 150);
  };
  $$('[data-search-open]').forEach((b) => b.addEventListener('click', () => openSearch(true)));
  $$('[data-search-close]').forEach((b) => b.addEventListener('click', () => openSearch(false)));
  if (search) {
    const form = $('[data-ps-form]', search);
    const input = $('[data-ps-input]', search);
    const results = $('[data-ps-results]', search);
    const idle = $('[data-ps-idle]', search);
    let timer = 0;
    let seq = 0;
    const run = () => {
      const q = input.value.trim();
      if (!q) {
        results.hidden = true; idle.hidden = false; input.setAttribute('aria-expanded', 'false');
        return;
      }
      const mine = ++seq;
      const url = `${form.dataset.psUrl}?q=${encodeURIComponent(q)}&resources[type]=product,collection,page,query&resources[limit]=4&resources[limit_scope]=each`;
      results.classList.add('is-loading');
      fetchSection(url, 'predictive-search').then((html) => {
        if (mine !== seq) return;
        results.innerHTML = html;
        results.hidden = false; idle.hidden = true; input.setAttribute('aria-expanded', 'true');
      }).catch(() => { /* keep the last results */ }).finally(() => results.classList.remove('is-loading'));
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 220); });
    $$('[data-ps-term]', search).forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      input.value = a.dataset.psTerm;
      run();
      input.focus();
    }));
  }

  /* ───────── Bag ───────── */
  const drawer = $('[data-cart-drawer]');
  const artCache = new Map();
  const cacheArt = (scope = document) => {
    $$('[data-art-for]', scope).forEach((el) => { if (!artCache.has(el.dataset.artFor)) artCache.set(el.dataset.artFor, el.innerHTML); });
  };
  cacheArt();

  let quoteTimer = 0;
  function rotateQuotes(on) {
    clearInterval(quoteTimer);
    const quotes = $$('.drawer__quote');
    if (!on || quotes.length < 2 || reduced) return;
    let i = quotes.findIndex((q) => q.classList.contains('is-active'));
    quoteTimer = setInterval(() => {
      quotes[i].classList.remove('is-active');
      i = (i + 1) % quotes.length;
      quotes[i].classList.add('is-active');
    }, 5000);
  }

  const openDrawer = (open) => {
    if (!drawer || drawer.classList.contains('is-open') === open) return;
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    document.documentElement.classList.toggle('bag-open', open);
    lock(open);
    rotateQuotes(open);
    if (open) $('[data-cart-close].icon-btn', drawer)?.focus();
  };
  $$('[data-cart-close]').forEach((b) => b.addEventListener('click', () => openDrawer(false)));
  $$('[data-cart-open]').forEach((a) => a.addEventListener('click', (e) => {
    if (theme.cartType !== 'drawer' || !drawer) return;
    e.preventDefault();
    refreshCart().then(() => openDrawer(true));
  }));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    openDrawer(false);
    openMenu(false);
    openSearch(false);
    panels.forEach((_, name) => openPanel(name, false));
  });

  const sparkle = '<svg class="art" viewBox="0 0 400 480" aria-hidden="true"><path class="art__glint" d="M200 150c4 46 38 80 84 84-46 4-80 38-84 84-4-46-38-80-84-84 46-4 80-38 84-84z"/></svg>';
  const iconSvg = (d) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
  let lastCart = null;

  function renderShip(cart) {
    $$('[data-ship]').forEach((el) => {
      const threshold = Number(el.dataset.threshold || 0);
      if (!threshold) return;
      const left = threshold - cart.total_price;
      el.classList.toggle('is-done', left <= 0);
      $('[data-ship-text]', el).textContent = left > 0 ? (S.shipAway || '').replace('[amount]', formatMoney(left)) : S.shipDone;
      $('[data-ship-fill]', el).style.setProperty('--p', `${Math.min(100, (cart.total_price / threshold) * 100)}%`);
    });
  }

  function renderUpsell(cart) {
    const box = $('[data-upsell]');
    if (!box) return;
    const inCart = new Set(cart.items.map((i) => String(i.variant_id || i.id)));
    let shown = 0;
    $$('[data-upsell-id]', box).forEach((li) => {
      const show = shown < 1 && cart.item_count > 0 && !inCart.has(li.dataset.upsellId);
      li.hidden = !show;
      if (show) shown++;
    });
    box.hidden = shown === 0;
  }

  function renderGift(cart) {
    $$('[data-gift]').forEach((g) => {
      const wrap = $('[data-gift-wrap]', g);
      const hasWrap = !!wrap && cart.items.some((i) => String(i.variant_id || i.id) === wrap.dataset.giftWrap);
      if (wrap) wrap.checked = hasWrap;
      const toggle = $('[data-gift-toggle]', g);
      if (toggle && !g.contains(document.activeElement)) toggle.checked = hasWrap || cart.attributes?.Gift === 'Yes';
      $('[data-gift-more]', g).hidden = !toggle?.checked;
    });
  }

  function renderCart(cart) {
    lastCart = cart;
    $$('[data-cart-count]').forEach((el) => { el.textContent = cart.item_count; el.hidden = cart.item_count === 0; });
    $$('[data-cart-count-label]').forEach((el) => { el.textContent = `(${cart.item_count})`; });
    $$('[data-cart-subtotal]').forEach((el) => { el.textContent = formatMoney(cart.total_price); });
    $$('[data-cart-checkout]').forEach((el) => { el.disabled = cart.item_count === 0; });
    renderShip(cart);
    renderUpsell(cart);
    renderGift(cart);
    const lines = $('[data-cart-lines]');
    if (!lines) return;
    if (!cart.items.length) {
      lines.innerHTML = `<p class="drawer__empty">${esc(S.empty)}</p>`;
      return;
    }
    lines.innerHTML = cart.items.map((item, i) => {
      const media = item.image
        ? `<img src="${esc(item.image)}${item.image.includes('?') ? '&' : '?'}width=200" alt="" loading="lazy">`
        : (artCache.get(item.handle) || sparkle);
      const variant = item.product_has_only_default_variant ? '' : `<p class="line__variant">${esc(item.variant_title)}</p>`;
      const props = Object.entries(item.properties || {}).filter(([k, v]) => v && !k.startsWith('_')).map(([k, v]) => `<p class="line__prop">${esc(k)}: ${esc(v)}</p>`).join('');
      return `<div class="line" data-line="${i + 1}" data-qty="${item.quantity}">
        <a class="line__media" href="${esc(item.url)}">${media}</a>
        <div class="line__info">
          <a class="line__title" href="${esc(item.url)}">${esc(item.product_title)}</a>${variant}${props}
          <div class="line__controls">
            <div class="qty">
              <button type="button" class="qty__btn" data-line-step="-1" aria-label="Decrease">${iconSvg('M6 12h12')}</button>
              <span>${item.quantity}</span>
              <button type="button" class="qty__btn" data-line-step="1" aria-label="Increase">${iconSvg('M12 6v12M6 12h12')}</button>
            </div>
            <button type="button" class="line__remove" data-line-remove>Remove</button>
          </div>
        </div>
        <p class="line__price">${formatMoney(item.final_line_price)}</p>
      </div>`;
    }).join('');
  }

  const cartFetch = (url, body) => fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { Accept: 'application/json', ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  }).then((r) => {
    if (!r.ok) return r.json().then((j) => Promise.reject(j));
    return r.json();
  });

  const refreshCart = () => cartFetch(`${root}cart.js`).then((cart) => { renderCart(cart); return cart; });
  const changeLine = (line, quantity) => cartFetch(`${theme.routes?.cartChange || '/cart/change'}.js`, { line, quantity }).then(renderCart);
  const updateCart = (body) => cartFetch(`${theme.routes?.cartUpdate || '/cart/update'}.js`, body).then((c) => { renderCart(c); return c; });
  const removeVariant = (id) => {
    const idx = lastCart ? lastCart.items.findIndex((i) => String(i.variant_id || i.id) === String(id)) : -1;
    return idx < 0 ? Promise.resolve() : changeLine(idx + 1, 0);
  };

  drawer?.addEventListener('click', (e) => {
    const lineEl = e.target.closest('[data-line]');
    if (!lineEl) return;
    const line = Number(lineEl.dataset.line);
    const qty = Number(lineEl.dataset.qty || 1);
    const step = e.target.closest('[data-line-step]');
    if (step) changeLine(line, Math.max(0, qty + Number(step.dataset.lineStep)));
    if (e.target.closest('[data-line-remove]')) changeLine(line, 0);
  });

  // Gift options in the bag: the flag and message are cart attributes; gift wrap is a product line.
  $$('[data-gift]').forEach((g) => {
    const toggle = $('[data-gift-toggle]', g);
    const more = $('[data-gift-more]', g);
    const wrap = $('[data-gift-wrap]', g);
    const msg = $('[data-gift-message]', g);
    toggle?.addEventListener('change', () => {
      more.hidden = !toggle.checked;
      const jobs = [updateCart({ attributes: { Gift: toggle.checked ? 'Yes' : '', 'Gift message': toggle.checked ? msg?.value || '' : '' } })];
      if (!toggle.checked && wrap?.checked) jobs.push(removeVariant(wrap.dataset.giftWrap));
      Promise.all(jobs).then(refreshCart);
    });
    wrap?.addEventListener('change', () => {
      (wrap.checked ? cartFetch(`${theme.routes?.cartAdd || '/cart/add'}.js`, { items: [{ id: Number(wrap.dataset.giftWrap), quantity: 1 }] }) : removeVariant(wrap.dataset.giftWrap)).then(refreshCart);
    });
    let t = 0;
    msg?.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => updateCart({ attributes: { 'Gift message': msg.value } }), 600); });
  });

  // Order note under "Add a note".
  $$('[data-cart-note]').forEach((n) => {
    let t = 0;
    n.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => updateCart({ note: n.value }), 600); });
  });

  // Bag page: a quantity change saves at once.
  $$('[data-autoupdate] input').forEach((i) => i.addEventListener('change', () => i.form?.requestSubmit()));

  // Order the whole bag on WhatsApp.
  $$('[data-cart-whatsapp]').forEach((a) => a.addEventListener('click', () => {
    const cart = lastCart;
    if (!cart || !theme.whatsapp) return;
    const lines = cart.items.map((i) => `• ${i.product_title}${i.product_has_only_default_variant ? '' : ` (${i.variant_title})`} × ${i.quantity}: ${formatMoney(i.final_line_price)}`);
    const msg = [a.dataset.intro, ...lines, formatMoney(cart.total_price), window.location.origin + (theme.routes?.cart || '/cart')].join('\n');
    a.href = `https://wa.me/${theme.whatsapp}?text=${encodeURIComponent(msg)}`;
  }));

  // Every product form adds through the Ajax API and opens the bag. "This is a gift" adds the note and the wrap.
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-product-form]');
    if (!form) return;
    e.preventDefault();
    const button = $('[type="submit"]', form);
    button?.setAttribute('aria-busy', 'true');
    cacheArt(form.closest('.card, [data-product], .upsell__item') || document);
    let body = new FormData(form);
    const wrapInput = $('[data-gift-wrap-id]:not([disabled])', form);
    if (wrapInput) {
      const props = {};
      for (const [k, v] of body.entries()) if (k.startsWith('properties[') && v) props[k.slice(11, -1)] = v;
      body = { items: [{ id: Number(body.get('id')), quantity: Number(body.get('quantity') || 1), properties: props }, { id: Number(wrapInput.value), quantity: 1 }] };
    }
    const gift = $('[data-gift-pdp-toggle]', form)?.checked;
    cartFetch(`${theme.routes?.cartAdd || '/cart/add'}.js`, body)
      .then(() => (gift ? cartFetch(`${theme.routes?.cartUpdate || '/cart/update'}.js`, { attributes: { Gift: 'Yes' } }) : null))
      .then(() => {
        if (theme.cartType === 'page' || !drawer) {
          window.location.href = theme.routes?.cart || '/cart';
          return null;
        }
        button?.classList.add('is-done');
        setTimeout(() => button?.classList.remove('is-done'), 1600);
        if (form.closest('dialog[open]')) closeQuickView();
        return refreshCart().then(() => { openDrawer(true); toast(S.added); });
      })
      .catch((err) => { window.alert(err?.description || err?.message || 'Could not add this piece. Please try again.'); })
      .finally(() => button?.removeAttribute('aria-busy'));
  });

  /* ───────── Product page and quick view ───────── */
  function initProduct(section) {
    if (section.dataset.ready) return;
    section.dataset.ready = '1';
    const json = $('[data-product-json]', section);
    const product = json ? JSON.parse(json.textContent) : null;
    const idInput = $('[data-variant-id]', section);
    const addBtn = $('[data-add]', section);
    const addLabel = $('[data-add-label]', section);
    const stockMap = (() => { try { return JSON.parse($('[data-stock]', section)?.textContent || '{}'); } catch { return {}; } })();
    const stockLine = $('[data-stock-line]', section);
    const isQuick = section.hasAttribute('data-quick');

    // Remember this product's drawing for the bag.
    const art = $('.pdp__slide--art svg, .qv__art svg', section);
    if (art && product) artCache.set(product.handle, art.outerHTML);

    // Gallery: a scroll-snap track; thumbs and dots follow it; images zoom under a mouse.
    const track = $('[data-track]', section);
    const slides = $$('[data-slide]', section);
    const thumbs = $$('[data-thumb]', section);
    const dots = $$('[data-dot]', section);
    const setActive = (i) => {
      thumbs.forEach((t, k) => t.classList.toggle('is-active', k === i));
      dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
    };
    const goTo = (i) => {
      if (!track || !slides[i]) return;
      track.scrollTo({ left: slides[i].offsetLeft, behavior: reduced ? 'auto' : 'smooth' });
      setActive(i);
    };
    const goToMedia = (id) => { const i = slides.findIndex((s) => s.dataset.mediaId === String(id)); if (i >= 0) goTo(i); };
    thumbs.forEach((t) => t.addEventListener('click', () => goTo(Number(t.dataset.thumb))));
    if (track) {
      let raf = 0;
      track.addEventListener('scroll', () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => setActive(Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
      }, { passive: true });
    }
    if (finePointer) {
      $$('[data-zoom]', section).forEach((fig) => {
        fig.addEventListener('pointermove', (e) => {
          const r = fig.getBoundingClientRect();
          fig.style.setProperty('--zx', `${((e.clientX - r.left) / r.width) * 100}%`);
          fig.style.setProperty('--zy', `${((e.clientY - r.top) / r.height) * 100}%`);
          fig.classList.add('is-zoomed');
        });
        fig.addEventListener('pointerleave', () => fig.classList.remove('is-zoomed'));
      });
    }

    const showStock = (variant) => {
      if (!stockLine) return;
      const qty = stockMap[variant.id];
      const low = Number(theme.lowStock || 0);
      const show = variant.available && low > 0 && typeof qty === 'number' && qty > 0 && qty <= low;
      stockLine.hidden = !show;
      if (show) $('[data-stock-text]', stockLine).textContent = (S.onlyLeft || '').replace('[count]', qty);
    };

    // Options: match the choice to a variant; price, stock, URL and photo follow.
    $$('[data-option]', section).forEach((input) => input.addEventListener('change', () => {
      if (!product) return;
      const positions = [...new Set($$('[data-option]', section).map((i) => i.dataset.option))].sort();
      const chosen = positions.map((pos) => $(`[data-option="${pos}"]:checked`, section)?.value);
      $$('[data-option-label]', section).forEach((l) => { l.textContent = chosen[Number(l.dataset.optionLabel) - 1] || ''; });
      const variant = product.variants.find((v) => v.options.every((o, k) => o === chosen[k]));
      const sticky = $('[data-sticky-add]', section);
      if (!variant) {
        if (addBtn) addBtn.disabled = true;
        if (sticky) sticky.disabled = true;
        if (addLabel) addLabel.textContent = S.unavailable || 'Unavailable';
        return;
      }
      idInput.value = variant.id;
      if (addBtn) addBtn.disabled = !variant.available;
      if (sticky) sticky.disabled = !variant.available;
      if (addLabel) addLabel.textContent = variant.available ? S.addToBag : S.soldOut;
      $$('[data-price]', section).forEach((priceEl) => {
        const sale = variant.compare_at_price > variant.price;
        const save = sale && priceEl.hasAttribute('data-price-save') ? `<span class="price__save">Save ${formatMoney(variant.compare_at_price - variant.price)}</span>` : '';
        priceEl.classList.toggle('price--sale', sale);
        priceEl.innerHTML = `<span class="price__now">${formatMoney(variant.price)}</span>${sale ? `<s class="price__was">${formatMoney(variant.compare_at_price)}</s>` : ''}${save}`;
      });
      showStock(variant);
      if (!isQuick) {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url);
      }
      if (variant.featured_media) goToMedia(variant.featured_media.id);
    }));

    // WhatsApp order: the message carries the piece, option, price and link.
    $$('[data-whatsapp]', section).forEach((a) => a.addEventListener('click', () => {
      const variant = product?.variants.find((v) => String(v.id) === String(idInput?.value));
      const option = variant && product.variants.length > 1 ? ` (${variant.title})` : '';
      const price = variant ? ` · ${formatMoney(variant.price)}` : '';
      const msg = `${theme.whatsappMessage || ''}\n${a.dataset.title}${option}${price}\n${a.dataset.url}`.trim();
      a.href = `https://wa.me/${theme.whatsapp}?text=${encodeURIComponent(msg)}`;
    }));

    // "This is a gift": shows the note, and arms the gift wrap line.
    $$('[data-gift-pdp]', section).forEach((g) => {
      const toggle = $('[data-gift-pdp-toggle]', g);
      toggle.addEventListener('change', () => {
        $('[data-gift-more]', g).hidden = !toggle.checked;
        $('[data-gift-note]', g).disabled = !toggle.checked;
        const wrap = $('[data-gift-wrap-id]', g);
        if (wrap) wrap.disabled = !toggle.checked;
        if (toggle.checked) $('[data-gift-note]', g).focus();
      });
    });

    if (isQuick) return;

    // Remember it for "Recently viewed".
    if (product) store.set('inspot:recent', [product.handle, ...store.get('inspot:recent').filter((h) => h !== product.handle)].slice(0, 12));

    // Sticky bar once the main buttons have scrolled away.
    const bar = $('[data-sticky-buy]', section);
    const mainAdd = $('[data-buybox] [data-add]', section);
    if (bar && mainAdd) {
      // Shown once the Add to bag button has gone up under the header. A scroll check rather than an
      // IntersectionObserver, because a fast fling can jump the button past the screen in one frame.
      let shown = false;
      let ticking = false;
      const check = () => {
        ticking = false;
        const show = mainAdd.getBoundingClientRect().bottom < 90;
        if (show === shown) return;
        shown = show;
        bar.classList.toggle('is-visible', show);
        bar.setAttribute('aria-hidden', String(!show));
        $$('a, button', bar).forEach((b) => { b.tabIndex = show ? 0 : -1; });
        document.documentElement.classList.toggle('sticky-buy-on', show);
      };
      window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
      check();
    }

    // Same day: count down to today's cut-off, in Pakistan time.
    $$('[data-sameday]', section).forEach((el) => {
      const cutoff = Number(el.dataset.cutoff || 14) * 60;
      const tick = () => {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date()).map((p) => [p.type, p.value]));
        const left = cutoff - (Number(parts.hour) * 60 + Number(parts.minute));
        el.classList.toggle('is-live', left > 0);
        if (left > 0) el.textContent = `${(S.within || '').replace('[time]', `${Math.floor(left / 60)}h ${left % 60}m`)} · ${el.dataset.line}`;
      };
      tick();
      setInterval(tick, 30000);
    });
  }
  $$('[data-product]').forEach(initProduct);

  /* ───────── Quick view ───────── */
  const qv = $('[data-qv]');
  const qvBody = $('[data-qv-body]');
  function closeQuickView() { if (qv?.open) qv.close(); }
  qv?.addEventListener('close', () => lock(false));
  qv?.addEventListener('click', (e) => { if (e.target === qv) closeQuickView(); });
  $('[data-qv-close]')?.addEventListener('click', closeQuickView);
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quick-view]');
    if (!btn || !qv) return;
    e.preventDefault();
    btn.setAttribute('aria-busy', 'true');
    fetchSection(btn.dataset.quickView, 'quick-view').then((html) => {
      qvBody.innerHTML = html;
      const section = $('[data-product]', qvBody);
      if (section) initProduct(section);
      syncWish();
      if (!qv.open) { qv.showModal(); lock(true); }
    }).catch(() => { window.location.href = btn.dataset.quickView; })
      .finally(() => btn.removeAttribute('aria-busy'));
  });

  /* ───────── Wishlist (kept in this browser) ───────── */
  const WISH = 'inspot:wishlist';
  function syncWish() {
    const list = store.get(WISH);
    $$('[data-wish]').forEach((b) => {
      const on = list.includes(b.dataset.wish);
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-on', on);
    });
    $$('[data-wish-count]').forEach((el) => { el.textContent = list.length; el.hidden = list.length === 0; });
    $$('[data-wish-count-label]').forEach((el) => { el.textContent = `(${list.length})`; });
  }
  syncWish();

  const cardHtml = (handle) => fetchSection(`${root}products/${encodeURIComponent(handle)}`, 'card');
  function renderCards(handles, grid) {
    return Promise.all(handles.map((h) => cardHtml(h).catch(() => null))).then((cards) => {
      const found = cards.filter((c) => c && c.trim());
      grid.innerHTML = found.join('');
      $$('[data-reveal]', grid).forEach((el) => el.setAttribute('data-reveal', 'in'));
      cacheArt(grid);
      syncWish();
      return found.length;
    });
  }
  function renderWish() {
    const grid = $('[data-wish-list]');
    const empty = $('[data-wish-empty]');
    if (!grid) return;
    const list = store.get(WISH);
    empty.hidden = list.length > 0;
    if (!list.length) { grid.innerHTML = ''; return; }
    renderCards(list, grid);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-wish]');
    if (!b) return;
    e.preventDefault();
    const handle = b.dataset.wish;
    const list = store.get(WISH);
    const on = !list.includes(handle);
    store.set(WISH, on ? [handle, ...list] : list.filter((h) => h !== handle));
    syncWish();
    if (on) toast(S.saved);
    if (on && hasGsap && !reduced) window.gsap.fromTo(b, { scale: 0.7 }, { scale: 1, duration: 0.6, ease: 'back.out(3)', clearProps: 'transform' });
    if (panels.get('wishlist')?.classList.contains('is-open')) renderWish();
  });
  $$('[data-wish-open]').forEach((b) => b.addEventListener('click', () => openPanel('wishlist', true)));
  panels.get('wishlist')?.addEventListener('panel:open', renderWish);

  /* ───────── Recently viewed ───────── */
  $$('[data-recent]').forEach((sec) => {
    const list = store.get('inspot:recent').filter((h) => h && h !== sec.dataset.exclude).slice(0, Number(sec.dataset.limit || 4));
    if (!list.length) return;
    renderCards(list, $('[data-recent-grid]', sec)).then((n) => { sec.hidden = n === 0; });
  });

  /* ───────── Collection: filters, sort, load more ───────── */
  $$('[data-collection-form]').forEach((form) => {
    const go = () => {
      const params = new URLSearchParams();
      for (const [k, v] of new FormData(form).entries()) if (v !== '') params.append(k, v);
      window.location.search = params.toString();
    };
    const wide = window.matchMedia('(min-width: 990px)');
    [...form.elements].filter((el) => el.matches('[data-sort]')).forEach((i) => i.addEventListener('change', go));
    // On desktop the sidebar applies each change at once; in the phone drawer, "Show results" applies them.
    $$('[data-filter-auto] input', form).forEach((i) => i.addEventListener('change', () => { if (wide.matches) go(); }));
    $$('[data-price-preset]', form).forEach((b) => b.addEventListener('click', () => {
      const group = b.closest('[data-price-filter]');
      $('[data-price-min]', group).value = b.dataset.min;
      $('[data-price-max]', group).value = b.dataset.max;
      go();
    }));
    const panel = $('[data-panel="filters"]', form);
    if (panel && !wide.matches) panel.setAttribute('aria-hidden', 'true');
    form.addEventListener('submit', (e) => { e.preventDefault(); go(); });
  });
  $$('[data-load-more]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.preventDefault();
    const grid = $(btn.dataset.target);
    btn.setAttribute('aria-busy', 'true');
    fetch(btn.href).then((r) => r.text()).then((html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const next = $(btn.dataset.target, doc);
      if (next && grid) { grid.insertAdjacentHTML('beforeend', next.innerHTML); reveal(grid); cacheArt(grid); syncWish(); }
      const more = $('[data-load-more]', doc);
      if (more) btn.href = more.href; else btn.remove();
    }).finally(() => btn.removeAttribute('aria-busy'));
  }));

  /* ───────── Gift box builder ───────── */
  $$('[data-giftbox]').forEach((box) => {
    const size = Number(box.dataset.size || 3);
    const slots = $$('[data-slot]', box);
    const total = $('[data-box-total]', box);
    const status = $('[data-box-status]', box);
    const add = $('[data-box-add]', box);
    const message = $('[data-box-message]', box);
    let picks = [];
    const render = () => {
      slots.forEach((slot, i) => {
        const p = picks[i];
        slot.classList.toggle('is-filled', !!p);
        $('[data-slot-media]', slot).innerHTML = p ? p.media : '';
        $('[data-slot-name]', slot).textContent = p ? p.title : slot.dataset.emptyLabel;
        const rm = $('[data-slot-remove]', slot);
        rm.hidden = !p;
        rm.dataset.id = p ? p.id : '';
      });
      $$('[data-pick]', box).forEach((b) => {
        const on = picks.some((p) => p.id === b.dataset.id);
        b.setAttribute('aria-pressed', String(on));
        b.closest('.box__piece')?.classList.toggle('is-picked', on);
      });
      total.textContent = formatMoney(picks.reduce((n, p) => n + p.price, 0));
      const need = size - picks.length;
      status.textContent = need > 0 ? (need === 1 ? S.needsOne : (S.needs || '').replace('[count]', need)) : S.boxReady;
      add.disabled = need > 0;
      box.classList.toggle('is-ready', need === 0);
    };
    box.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-slot-remove]');
      if (rm) { picks = picks.filter((p) => p.id !== rm.dataset.id); render(); return; }
      const pick = e.target.closest('[data-pick]');
      if (!pick) return;
      const id = pick.dataset.id;
      if (picks.some((p) => p.id === id)) picks = picks.filter((p) => p.id !== id);
      else if (picks.length >= size) { toast(S.boxFull); return; }
      else {
        picks.push({ id, title: pick.dataset.title, price: Number(pick.dataset.price), media: $('[data-pick-media]', pick.closest('.box__piece'))?.innerHTML || '' });
        const slot = slots[picks.length - 1];
        if (hasGsap && !reduced && slot) window.gsap.fromTo(slot, { scale: 0.92 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.6)', clearProps: 'transform' });
      }
      render();
    });
    add.addEventListener('click', () => {
      const code = `Box ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const note = message?.value.trim();
      const items = picks.map((p, i) => ({ id: Number(p.id), quantity: 1, properties: { 'Gift box': code, ...(i === 0 && note ? { 'Gift message': note } : {}) } }));
      add.setAttribute('aria-busy', 'true');
      cartFetch(`${theme.routes?.cartAdd || '/cart/add'}.js`, { items })
        .then(() => { picks = []; if (message) message.value = ''; render(); return refreshCart(); })
        .then(() => openDrawer(true))
        .catch((err) => window.alert(err?.description || 'Could not add the box. Please try again.'))
        .finally(() => add.removeAttribute('aria-busy'));
    });
    render();
  });

  /* ───────── Hero: the spotlight, the 3D jewel, the tone switch ───────── */
  const hero = $('[data-hero]');
  if (hero) {
    const canvas = $('[data-sparkles]', hero);
    const ctx = canvas?.getContext('2d');
    const light = { x: 0.62, y: 0.4, tx: 0.62, ty: 0.4 };
    let w = 0, h = 0, dpr = 1, stars = [], visible = true, raf = 0, auto = !finePointer;
    const t0 = performance.now();

    const resize = () => {
      const r = hero.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      if (!canvas) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(140, (w * h) / 10000));
      stars = Array.from({ length: count }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.6 + Math.random() * 1.6, p: Math.random() * Math.PI * 2, s: 0.6 + Math.random() * 1.4 }));
    };
    const glint = (x, y, r, a) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = `rgba(255, 238, 205, ${a})`;
      ctx.beginPath();
      const k = r * 0.22;
      ctx.moveTo(0, -r); ctx.quadraticCurveTo(k, -k, r, 0); ctx.quadraticCurveTo(k, k, 0, r); ctx.quadraticCurveTo(-k, k, -r, 0); ctx.quadraticCurveTo(-k, -k, 0, -r);
      ctx.fill();
      ctx.restore();
    };
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const t = (now - t0) / 1000;
      if (auto) {
        light.tx = 0.6 + Math.sin(t * 0.32) * 0.24;
        light.ty = 0.42 + Math.sin(t * 0.21 + 1) * 0.16;
      }
      light.x += (light.tx - light.x) * 0.06;
      light.y += (light.ty - light.y) * 0.06;
      hero.style.setProperty('--mx', `${(light.x * 100).toFixed(2)}%`);
      hero.style.setProperty('--my', `${(light.y * 100).toFixed(2)}%`);
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      const lx = light.x * w, ly = light.y * h, reach = Math.max(w, h) * 0.32;
      for (const s of stars) {
        const near = Math.max(0, 1 - Math.hypot(s.x - lx, s.y - ly) / reach);
        const tw = (Math.sin(t * s.s * 2 + s.p) + 1) / 2;
        const a = 0.05 + near * 0.85 * tw;
        if (a < 0.04) continue;
        if (near > 0.45 && tw > 0.82) glint(s.x, s.y, s.r * 5 * near, a);
        else { ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (0.6 + near), 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 236, 200, ${a})`; ctx.fill(); }
      }
    };
    const start = () => { if (!raf && visible && !reduced && !document.hidden) raf = requestAnimationFrame(frame); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    resize();
    window.addEventListener('resize', resize);
    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      auto = false;
      const r = hero.getBoundingClientRect();
      light.tx = (e.clientX - r.left) / r.width;
      light.ty = (e.clientY - r.top) / r.height;
    });
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; visible ? start() : stop(); }).observe(hero);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    if (reduced) { frame(performance.now()); stop(); }
    start();

    // The 3D jewel loads once the page is idle, only where WebGL works, so it never holds up the first paint.
    const jewel = $('[data-jewel]', hero);
    const webgl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
    if (jewel && jewel.dataset.src && webgl) {
      const load = () => { const s = document.createElement('script'); s.src = jewel.dataset.src; s.async = true; document.body.appendChild(s); };
      if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 2500 }); else setTimeout(load, 800);
    }
    $$('[data-tone]', hero).forEach((b) => b.addEventListener('click', () => {
      hero.dataset.tone = b.dataset.tone;
      $$('[data-tone]', hero).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      hero.dispatchEvent(new CustomEvent('inspot:tone', { detail: b.dataset.tone }));
    }));

    // The headline is the first paint on a phone (it is the page's largest element), so it only rises in on desktop.
    if (hasGsap && !reduced && finePointer) {
      const g = window.gsap;
      g.from($$('.hero__line > span', hero), { yPercent: 110, duration: 1.4, ease: 'expo.out', stagger: 0.12, delay: 0.15 });
      g.from($$('.hero__eyebrow, .hero__text, .hero__ctas, .hero__foot', hero), { y: 20, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, delay: 0.45, clearProps: 'transform,opacity' });
      if (window.ScrollTrigger) {
        g.to($('.hero__content', hero), { yPercent: 14, opacity: 0.25, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
      }
    }
  }

  /* ───────── Gentle parallax on story pictures ───────── */
  if (hasGsap && window.ScrollTrigger && !reduced) {
    $$('[data-parallax]').forEach((el) => {
      window.gsap.fromTo(el, { yPercent: 6 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  /* ───────── Countdown to a real sale end (occasion section) ───────── */
  $$('[data-countdown]').forEach((el) => {
    const end = new Date(el.dataset.countdown).getTime();
    if (!Number.isFinite(end) || end <= Date.now()) { el.hidden = true; return; }
    const units = $$('[data-unit]', el);
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      if (left === 0) { el.hidden = true; return; }
      const parts = { d: Math.floor(left / 864e5), h: Math.floor(left / 36e5) % 24, m: Math.floor(left / 6e4) % 60, s: Math.floor(left / 1e3) % 60 };
      units.forEach((u) => { u.textContent = String(parts[u.dataset.unit]).padStart(2, '0'); });
    };
    el.hidden = false;
    tick();
    setInterval(tick, 1000);
  });

  /* ───────── Announcement: one message at a time ───────── */
  $$('[data-announce]').forEach((bar) => {
    const items = $$('.announce__item', bar);
    if (items.length < 2 || reduced) return;
    let i = 0;
    setInterval(() => {
      items[i].classList.remove('is-active');
      i = (i + 1) % items.length;
      items[i].classList.add('is-active');
    }, 4500);
  });

  /* ───────── Footer: join new-drop updates on WhatsApp ───────── */
  $$('[data-wa-join]').forEach((form) => form.addEventListener('submit', (e) => {
    e.preventDefault();
    const phone = $('input[type="tel"]', form).value.trim();
    const msg = `${form.dataset.message}${phone ? ` ${phone}` : ''}`;
    window.open(`https://wa.me/${form.dataset.number}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  }));

  /* ───────── First paint of the bag state ───────── */
  if (drawer) refreshCart().catch(() => {});
})();
