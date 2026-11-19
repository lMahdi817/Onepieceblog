(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const view = $('view'), topActions = $('topActions'), foot = $('foot'), statusEl = $('status');

  /* ---------- تخزين محلي آمن ---------- */
  const mem = {};
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } };

  function randomToken() {
    const a = new Uint8Array(24);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let token = lsGet('blog-token');
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) { token = randomToken(); lsSet('blog-token', token); }
  let adminPw = lsGet('blog-admin') || '';
  let isAdmin = false;

  /* ---------- أيقونات ---------- */
  const svg = (inner, fill) => '<svg viewBox="0 0 24 24" aria-hidden="true"' + (fill ? ' class="solid"' : '') + '>' + inner + '</svg>';
  const IC = {
    heart: svg('<path d="M12 20.5s-7.5-4.6-9.4-9.6A5.1 5.1 0 0 1 12 6.4a5.1 5.1 0 0 1 9.4 4.5c-1.9 5-9.4 9.6-9.4 9.6z"/>'),
    pencil: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
    trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    bell: svg('<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21a2 2 0 0 0 4 0"/>'),
    drop: svg('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>'),
    moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'),
    auto: svg('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/>'),
    folder: svg('<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>'),
    doc: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
    gear: svg('<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
    out: svg('<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>'),
  };

  /* ---------- الثيم والمظهر ---------- */
  const PAL = {
    green: ['#0E6B5A', '#4FC3A9'], red: ['#C2362B', '#F0877D'], blue: ['#2557C7', '#7FA6F5'],
    purple: ['#7B3FBF', '#B891F0'], gold: ['#9A6A00', '#F2C14E'], pink: ['#C2336F', '#F08AB4'],
    orange: ['#C4510C', '#F4A261'], teal: ['#0B7285', '#63D0E0'],
  };
  const COLOR_KEYS = Object.keys(PAL);
  let mode = lsGet('blog-mode') || '';               // '' تلقائي، light، dark
  let siteAccent = PAL[lsGet('blog-accent')] ? lsGet('blog-accent') : 'green';
  let folderAccent = null;
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = () => (mode ? mode === 'dark' : !!(mq && mq.matches));
  const colorOf = (k) => (PAL[k] || PAL.green)[isDark() ? 1 : 0];

  function applyTheme() {
    const root = document.documentElement, st = root.style, dark = isDark();
    root.dataset.theme = dark ? 'dark' : 'light';
    st.setProperty('--accent', colorOf(folderAccent || siteAccent));
    st.setProperty('--accent-fg', dark ? '#0b0f0e' : '#ffffff');
    if (folderAccent) {
      st.setProperty('--bg', 'color-mix(in srgb, var(--accent) ' + (dark ? 6 : 5) + '%, ' + (dark ? '#0B1013' : '#ffffff') + ')');
      st.setProperty('--surface', 'color-mix(in srgb, var(--accent) ' + (dark ? 6 : 4) + '%, ' + (dark ? '#10171B' : '#fafafa') + ')');
      st.setProperty('--line', 'color-mix(in srgb, var(--accent) 22%, ' + (dark ? '#1D262B' : '#dbdbdb') + ')');
    } else {
      ['--bg', '--surface', '--line'].forEach((p) => st.removeProperty(p));
    }
    st.setProperty('--accent-soft', 'color-mix(in srgb, var(--accent) 16%, var(--surface))');
  }
  function setFolderAccent(k) { folderAccent = k && PAL[k] ? k : null; applyTheme(); }
  if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (!mode) { applyTheme(); } });
  applyTheme();

  /* ---------- مساعدات عامة ---------- */
  const dateFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'long' });
  const fmt = (ts) => { try { return dateFmt.format(new Date(ts)); } catch (e) { return ''; } };
  let rtf = null;
  try { rtf = new Intl.RelativeTimeFormat('ar-u-nu-latn', { numeric: 'always' }); } catch (e) { /* تجاهل */ }
  const UNITS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  function ago(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'الحين';
    if (!rtf) return fmt(ts);
    for (let i = 0; i < UNITS.length; i++) {
      if (s >= UNITS[i][1]) return rtf.format(-Math.floor(s / UNITS[i][1]), UNITS[i][0]);
    }
    return fmt(ts);
  }
  const FRESH_MS = 7 * 86400000;
  const isFresh = (p) => !!p.fresh && Date.now() - p.fresh < FRESH_MS;
  const mediaUrl = (id) => (window.__mediaUrl && window.__mediaUrl(id)) || '/api/media/' + encodeURIComponent(id);
  const MARKER = /^\[(صورة|فيديو):([A-Za-z0-9_-]+)\]$/;

  function el(tag, props, kids) {
    const e = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach((k) => {
      const v = props[k];
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v);
    });
    (kids || []).forEach((c) => { if (c) e.append(c); });
    return e;
  }
  const iconBtn = (icon, cls, label) => el('button', { class: cls, type: 'button', 'aria-label': label, title: label, html: icon });

  let statusTimer = null;
  function notify(msg) {
    statusEl.textContent = msg; statusEl.hidden = false;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { statusEl.hidden = true; }, 5000);
  }

  /* ---------- الاتصال بالخادم ---------- */
  async function api(method, path, body) {
    const headers = { 'x-client-token': token };
    if (adminPw) headers['x-admin-password'] = adminPw;
    const init = { method, headers };
    if (body instanceof Blob) { init.body = body; headers['content-type'] = body.type; }
    else if (body !== undefined) { init.body = JSON.stringify(body); headers['content-type'] = 'application/json'; }
    let res;
    try { res = await fetch('/api' + path, init); }
    catch (e) { const err = new Error('ما قدرنا نتصل بالخادم. تأكد من الإنترنت.'); err.status = 0; throw err; }
    let data = null;
    try { data = await res.json(); } catch (e) { /* ليس JSON */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || 'صار خطأ. حاول مرة ثانية.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ---------- عرض النص (فقرات + عناوين + هايلايت) ---------- */
  const readMins = (t) => Math.max(1, Math.ceil(String(t || '').split(/\s+/).length / 170));
  const paragraphs = (t) => String(t || '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);

  function inline(parent, text) {
    const re = /==([\s\S]+?)==/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) parent.append(document.createTextNode(text.slice(last, m.index)));
      parent.append(el('mark', { text: m[1] }));
      last = m.index + m[0].length;
    }
    if (last < text.length) parent.append(document.createTextNode(text.slice(last)));
    return parent;
  }
  function renderBody(box, text) {
    box.textContent = '';
    paragraphs(text).forEach((para) => {
      const m = para.match(MARKER);
      if (m) {
        box.append(m[1] === 'صورة'
          ? el('img', { src: mediaUrl(m[2]), alt: '', loading: 'lazy' })
          : el('video', { src: mediaUrl(m[2]), controls: '', preload: 'metadata', playsinline: '' }));
      } else if (para.indexOf('## ') === 0) {
        box.append(inline(el('h2'), para.slice(3)));
      } else {
        box.append(inline(el('p'), para));
      }
    });
  }
  const newTag = () => el('span', { class: 'newtag' }, [el('span', { text: 'مدونة جديدة' })]);

  /* ---------- النوافذ الصغيرة (قوائم الأعلى) ---------- */
  let popEl = null;
  function closePop() { if (popEl) { popEl.remove(); popEl = null; } }
  function openPop(key, build) {
    const same = popEl && popEl.getAttribute('data-k') === key;
    closePop();
    if (same) return;
    popEl = el('div', { class: 'pop', 'data-k': key });
    build(popEl);
    const top = document.querySelector('.top');
    if (top) top.append(popEl);
  }
  document.addEventListener('click', (e) => {
    if (popEl && !popEl.contains(e.target) && !e.target.closest('.topbtn')) closePop();
  });

  /* ---------- الإشعارات ---------- */
  let notes = [];
  const seenKey = () => 'blog-seen-' + (isAdmin ? 'a' : 'r');
  const unseenCount = () => { const seen = Number(lsGet(seenKey()) || 0); return notes.filter((n) => n.ts > seen).length; };
  function paintDot() {
    const d = document.querySelector('.bell .reddot');
    if (d) d.hidden = unseenCount() === 0;
  }
  async function refreshNotes() {
    try { const d = await api('GET', '/notifications'); notes = d.events || []; } catch (e) { /* تجاهل */ }
    paintDot();
  }
  let pendingScroll = '';
  function openComment(postId, cid) {
    closePop();
    pendingScroll = cid || '';
    if (location.hash === '#p-' + postId) go(); else location.hash = 'p-' + postId;
  }
  function noteLabel(n) {
    if (isAdmin) return n.type === 'reply' ? ' ردّ على تعليق في ' : ' علّق على ';
    return n.owner ? ' (صاحب المدونة) ردّ على تعليقك في ' : ' ردّ على تعليقك في ';
  }
  function openBell() {
    openPop('bell', (box) => {
      const seenBefore = Number(lsGet(seenKey()) || 0);
      if (!notes.length) box.append(el('p', { class: 'pempty', text: 'ما فيه إشعارات للحين.' }));
      notes.forEach((n) => {
        const it = el('button', { class: 'note-item' + (n.ts > seenBefore ? ' new' : ''), type: 'button' }, [
          el('span', {}, [el('b', { text: n.name }), document.createTextNode(noteLabel(n)), el('b', { text: '«' + n.postTitle + '»' })]),
          el('small', { text: n.text }),
          el('small', { class: 'when', text: ago(n.ts) }),
        ]);
        it.addEventListener('click', () => openComment(n.postId, n.commentId));
        box.append(it);
      });
      if (notes.length) lsSet(seenKey(), String(Math.max.apply(null, notes.map((n) => n.ts))));
      paintDot();
    });
  }
  setInterval(() => { if (!document.hidden) refreshNotes(); }, 60000);

  /* ---------- التوجيه ---------- */
  function parseRoute() {
    const h = (location.hash || '').replace(/^#/, '');
    if (h.indexOf('p-') === 0) return { name: 'post', id: h.slice(2) };
    if (h.indexOf('edit-') === 0) return { name: 'edit', id: h.slice(5) };
    if (h.indexOf('f-') === 0) return { name: 'folder', id: h.slice(2) };
    if (h === 'folder-new') return { name: 'foldernew' };
    if (h.indexOf('folder-edit-') === 0) return { name: 'folderedit', id: h.slice(12) };
    if (h === 'write') return { name: 'write' };
    if (h.indexOf('write-') === 0) return { name: 'write', folder: h.slice(6) };
    if (h === 'login') return { name: 'login' };
    return { name: 'home' };
  }

  function renderChrome(route) {
    topActions.textContent = '';
    foot.textContent = '';
    closePop();

    const bell = el('button', { class: 'topbtn bell', type: 'button', 'aria-label': 'الإشعارات', title: 'الإشعارات' }, [
      el('span', { html: IC.bell }), el('i', { class: 'reddot', hidden: '' }),
    ]);
    bell.addEventListener('click', openBell);

    const theme = iconBtn(IC.gear, 'topbtn', 'المظهر');
    theme.addEventListener('click', () => openPop('theme', (box) => {
      const dots = el('div', { class: 'dots' });
      COLOR_KEYS.forEach((k) => {
        const b = el('button', { class: 'swatch', type: 'button', 'aria-label': k, 'aria-pressed': k === siteAccent ? 'true' : 'false' });
        b.style.background = colorOf(k);
        b.addEventListener('click', () => {
          siteAccent = k; lsSet('blog-accent', k); applyTheme();
          Array.prototype.forEach.call(dots.children, (c) => c.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
          dots.querySelectorAll('.swatch').forEach((s, i) => { s.style.background = colorOf(COLOR_KEYS[i]); });
        });
        dots.append(b);
      });
      const modes = el('div', { class: 'modes' });
      [['light', IC.sun, 'ساطع'], ['dark', IC.moon, 'داكن'], ['', IC.auto, 'تلقائي']].forEach((m) => {
        const b = iconBtn(m[1], 'mbtn', m[2]);
        b.setAttribute('aria-pressed', mode === m[0] ? 'true' : 'false');
        b.addEventListener('click', () => {
          mode = m[0]; if (mode) lsSet('blog-mode', mode); else lsDel('blog-mode'); applyTheme();
          Array.prototype.forEach.call(modes.children, (c) => c.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
          dots.querySelectorAll('.swatch').forEach((s, i) => { s.style.background = colorOf(COLOR_KEYS[i]); });
        });
        modes.append(b);
      });
      box.append(dots, modes);
    }));
    topActions.append(bell, theme);

    if (isAdmin) {
      const plus = iconBtn(IC.plus, 'topbtn plus', 'إضافة');
      plus.addEventListener('click', () => openPop('plus', (box) => {
        const item = (icon, text, fn) => {
          const b = el('button', { class: 'pitem', type: 'button' }, [el('span', { html: icon }), el('span', { text })]);
          b.addEventListener('click', () => { closePop(); fn(); });
          box.append(b);
        };
        const inFolder = route.name === 'folder' ? route.id : '';
        item(IC.doc, 'تدوينة جديدة', () => { location.hash = inFolder ? 'write-' + inFolder : 'write'; });
        item(IC.folder, 'مجلد جديد', () => { location.hash = 'folder-new'; });
        if (inFolder) item(IC.pencil, 'تعديل هذا المجلد', () => { location.hash = 'folder-edit-' + inFolder; });
        item(IC.out, 'خروج', () => { adminPw = ''; isAdmin = false; lsDel('blog-admin'); notes = []; location.hash = 'home'; go(); });
      }));
      topActions.append(plus);
    } else {
      foot.append(el('a', { href: '#login', text: 'دخول صاحب المدونة' }));
    }
    paintDot();
  }

  let routeSeq = 0;
  let current = null; // { id, refresh() } للتدوينة المفتوحة

  async function go() {
    const my = ++routeSeq;
    current = null;
    const route = parseRoute();
    renderChrome(route);
    view.textContent = '';
    view.append(el('p', { class: 'empty', text: 'جارٍ التحميل…' }));
    window.scrollTo(0, 0);
    try {
      if (route.name === 'home') {
        const [d, fd] = await Promise.all([api('GET', '/posts'), api('GET', '/folders')]);
        if (my !== routeSeq) return;
        setFolderAccent(null);
        renderHome(d.posts, fd.folders);
      } else if (route.name === 'folder') {
        const [d, fd] = await Promise.all([api('GET', '/posts'), api('GET', '/folders')]);
        if (my !== routeSeq) return;
        const f = fd.folders.find((x) => x.id === route.id);
        setFolderAccent(f && f.color);
        renderFolder(route.id, d.posts, fd.folders);
      } else if (route.name === 'post') {
        const d = await api('GET', '/posts/' + encodeURIComponent(route.id));
        if (my !== routeSeq) return;
        setFolderAccent(d.folder && d.folder.color);
        renderPost(d);
      } else if (route.name === 'write') {
        if (!isAdmin) { location.hash = 'login'; return; }
        const fd = await api('GET', '/folders');
        if (my !== routeSeq) return;
        setFolderAccent(null);
        renderEditor(null, fd.folders, route.folder || '');
      } else if (route.name === 'edit') {
        if (!isAdmin) { location.hash = 'login'; return; }
        const [d, fd] = await Promise.all([api('GET', '/posts/' + encodeURIComponent(route.id)), api('GET', '/folders')]);
        if (my !== routeSeq) return;
        setFolderAccent(null);
        renderEditor(d.post, fd.folders, d.post.folder || '');
      } else if (route.name === 'foldernew') {
        if (!isAdmin) { location.hash = 'login'; return; }
        setFolderAccent(null);
        renderFolderEditor(null);
      } else if (route.name === 'folderedit') {
        if (!isAdmin) { location.hash = 'login'; return; }
        const fd = await api('GET', '/folders');
        if (my !== routeSeq) return;
        const f = fd.folders.find((x) => x.id === route.id);
        if (!f) { const e = new Error('x'); e.status = 404; throw e; }
        setFolderAccent(f.color);
        renderFolderEditor(f);
      } else if (route.name === 'login') {
        setFolderAccent(null);
        renderLogin();
      }
    } catch (e) {
      if (my !== routeSeq) return;
      setFolderAccent(null);
      view.textContent = '';
      const retry = el('button', { class: 'btn', type: 'button', text: 'حاول مرة ثانية' });
      retry.addEventListener('click', go);
      view.append(el('p', { class: 'empty', text: e.status === 404 ? 'ما لقينا هذي الصفحة. ممكن تكون انحذفت.' : e.message }),
        e.status === 404 ? el('a', { class: 'back', href: '#home', text: '→ الرئيسية' }) : retry);
    }
  }

  /* ---------- الصفحة الرئيسية ---------- */
  function postCards(posts) {
    const list = el('section', { class: 'cards' });
    posts.forEach((p) => {
      const kids = [];
      if (p.thumb) kids.push(el('img', { src: mediaUrl(p.thumb), alt: '', loading: 'lazy' }));
      const cap = el('div', { class: 'cap' });
      if (isFresh(p)) cap.append(newTag());
      cap.append(el('h2', { text: p.title }));
      kids.push(cap);
      list.append(el('a', { class: 'card' + (p.thumb ? '' : ' plain'), href: '#p-' + p.id }, kids));
    });
    return list;
  }

  function renderHome(posts, folders) {
    view.textContent = '';
    if (folders.length) {
      const grid = el('section', { class: 'folders' });
      folders.forEach((f) => {
        const n = posts.filter((p) => p.folder === f.id).length;
        const kids = [];
        if (f.thumb) kids.push(el('img', { src: mediaUrl(f.thumb), alt: '', loading: 'lazy' }));
        kids.push(el('div', { class: 'fcap' }, [
          el('span', { class: 'ficon', html: IC.folder }),
          el('b', { text: f.name }),
          el('small', { text: n ? n + (n === 1 ? ' تدوينة' : ' تدوينات') : 'فاضي' }),
        ]));
        const a = el('a', { class: 'ftile' + (f.thumb ? ' has-img' : ''), href: '#f-' + f.id }, kids);
        a.style.setProperty('--tc', colorOf(f.color));
        grid.append(a);
      });
      view.append(grid);
    }
    const ids = new Set(folders.map((f) => f.id));
    const loose = posts.filter((p) => !p.folder || !ids.has(p.folder));
    if (folders.length && loose.length) view.append(el('h3', { class: 'sec', text: 'تدوينات بدون مجلد' }));
    if (!posts.length && !folders.length) {
      view.append(el('p', { class: 'empty', text: isAdmin ? 'ما كتبت شي للحين. اضغط زر + وابدأ.' : 'ما فيه تدوينات للحين. ارجع قريب.' }));
    } else if (loose.length) {
      view.append(postCards(loose));
    }
  }

  function renderFolder(fid, posts, folders) {
    view.textContent = '';
    const f = folders.find((x) => x.id === fid);
    view.append(el('a', { class: 'back', href: '#home', text: '→ الرئيسية' }));
    if (!f) { view.append(el('p', { class: 'empty', text: 'ما لقينا هذا المجلد.' })); return; }
    view.append(el('h1', { class: 'ftitle', text: f.name }));
    const mine = posts.filter((p) => p.folder === fid);
    if (!mine.length) view.append(el('p', { class: 'empty', text: 'المجلد فاضي للحين.' }));
    else view.append(postCards(mine));
  }

  /* ---------- صفحة التدوينة ---------- */
  function renderPost(d) {
    const p = d.post;
    view.textContent = '';

    const art = el('article');
    const cover = el('div', { class: 'cover' });
    if (p.thumb) cover.append(el('img', { src: mediaUrl(p.thumb), alt: '' }));
    art.append(cover);
    if (isFresh(p)) art.append(el('div', { class: 'tagrow' }, [newTag()]));
    art.append(el('h1', { text: p.title }), el('div', { class: 'meta' }, [
      el('span', { text: fmt(p.ts) }), el('span', { text: 'قراءة ' + readMins(p.body) + ' د' }),
    ]));
    if (isAdmin) {
      const del = el('button', { class: 'btn danger', type: 'button', text: 'حذف' });
      del.addEventListener('click', async () => {
        if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = 'تأكيد الحذف'; return; }
        del.disabled = true;
        try { await api('DELETE', '/posts/' + p.id); location.hash = d.folder ? 'f-' + d.folder.id : 'home'; }
        catch (e) { del.disabled = false; notify(e.message); }
      });
      art.append(el('div', { class: 'owner-actions' }, [el('a', { class: 'btn', href: '#edit-' + p.id, text: 'تعديل' }), del]));
    }
    const body = el('div', { class: 'body' });
    renderBody(body, p.body);
    art.append(body);

    /* الإعجاب بالتدوينة */
    const likeBtn = el('button', { class: 'like', type: 'button' });
    let likes = d.likes;
    function paintLike() {
      likeBtn.setAttribute('aria-pressed', likes.liked ? 'true' : 'false');
      likeBtn.innerHTML = IC.heart + '<span>' + (likes.liked ? 'أعجبتك' : 'أعجبتني') + '</span><span>' + likes.count + '</span>';
    }
    paintLike();
    likeBtn.addEventListener('click', async () => {
      likeBtn.disabled = true;
      try { likes = await api('POST', '/posts/' + p.id + '/like'); paintLike(); }
      catch (e) { notify(e.message); }
      likeBtn.disabled = false;
    });
    const react = el('div', { class: 'react' }, [likeBtn]);

    /* التعليقات */
    const cTitle = el('h3'), cList = el('div');
    let editing = false;
    let allComments = d.comments;

    function replyForm(c, card, repliesBox) {
      if (editing) return;
      editing = true;
      const nameIn = el('input', { class: 'field', type: 'text', maxlength: '40', placeholder: 'اسمك', 'aria-label': 'اسمك' });
      nameIn.value = lsGet('blog-name') || '';
      const ta = el('textarea', { class: 'field', maxlength: '1000', placeholder: 'اكتب ردك على ' + c.name + '…', 'aria-label': 'ردك' });
      const ok = el('button', { class: 'btn primary', type: 'button', text: 'أرسل الرد' });
      const no = el('button', { class: 'btn', type: 'button', text: 'إلغاء' });
      const box = el('div', { class: 'cedit' }, [isAdmin ? null : nameIn, ta, el('div', { class: 'row' }, [ok, no])]);
      (repliesBox || card).append(box);
      ta.focus();
      no.addEventListener('click', () => { editing = false; reload(); });
      ok.addEventListener('click', async () => {
        const name = nameIn.value.trim(), text = ta.value.trim();
        if (!isAdmin && !name) { notify('اكتب اسمك أولاً عشان يظهر مع ردك.'); nameIn.focus(); return; }
        if (!text) return;
        if (!isAdmin) lsSet('blog-name', name);
        ok.disabled = true;
        try { await api('POST', '/posts/' + p.id + '/comments', { name, text, parent: c.id }); editing = false; await reload(); }
        catch (e) { ok.disabled = false; notify(e.message); }
      });
    }

    function commentCard(c, repliesBox) {
      const card = el('div', { class: 'comment' + (c.parent ? ' is-reply' : ''), id: 'c-' + c.id });
      const bodyP = el('p', { text: c.text });
      const who = el('span', { class: 'wname' }, [el('b', { text: c.name })]);
      if (c.owner) who.append(el('span', { class: 'badge', text: 'صاحب المدونة' }));
      who.append(document.createTextNode(' · ' + ago(c.ts) + (c.edited ? ' · معدّل' : '')));

      const acts = el('div', { class: 'cact' });
      const lk = el('button', { class: 'clike', type: 'button', 'aria-label': 'إعجاب بالتعليق' });
      const paintLk = () => {
        lk.setAttribute('aria-pressed', c.liked ? 'true' : 'false');
        lk.innerHTML = IC.heart + (c.likes ? '<span>' + c.likes + '</span>' : '');
      };
      paintLk();
      lk.addEventListener('click', async () => {
        lk.disabled = true;
        try { const r = await api('POST', '/posts/' + p.id + '/comments/' + c.id + '/like'); c.likes = r.likes; c.liked = r.liked; paintLk(); }
        catch (e) { notify(e.message); }
        lk.disabled = false;
      });
      acts.append(lk);
      if (c.canManage) {
        const ed = iconBtn(IC.pencil, 'cbtn', 'تعديل');
        const del = iconBtn(IC.trash, 'cbtn', 'حذف');
        ed.addEventListener('click', () => {
          if (editing) return;
          editing = true;
          const ta = el('textarea', { class: 'field', maxlength: '1000', 'aria-label': 'تعديل التعليق' });
          ta.value = c.text;
          const ok = el('button', { class: 'btn primary', type: 'button', text: 'حفظ' });
          const no = el('button', { class: 'btn', type: 'button', text: 'إلغاء' });
          card.replaceChild(el('div', { class: 'cedit' }, [ta, el('div', { class: 'row' }, [ok, no])]), bodyP);
          ta.focus();
          no.addEventListener('click', () => { editing = false; reload(); });
          ok.addEventListener('click', async () => {
            const text = ta.value.trim();
            if (!text) return;
            ok.disabled = true;
            try { await api('PUT', '/posts/' + p.id + '/comments/' + c.id, { text }); editing = false; await reload(); }
            catch (e) { ok.disabled = false; notify(e.message); }
          });
        });
        del.addEventListener('click', async () => {
          if (!del.dataset.sure) { del.dataset.sure = '1'; del.classList.add('sure'); del.append(el('span', { text: 'تأكيد' })); return; }
          try { await api('DELETE', '/posts/' + p.id + '/comments/' + c.id); await reload(); }
          catch (e) { notify(e.message); }
        });
        acts.append(ed, del);
      }
      const reply = el('button', { class: 'replybtn', type: 'button', text: 'رد' });
      reply.addEventListener('click', () => replyForm(c, card, repliesBox));
      card.append(el('div', { class: 'who' }, [who, acts]), bodyP, el('div', { class: 'cfoot' }, [reply]));
      return card;
    }

    function paintComments(list) {
      allComments = list;
      cTitle.textContent = 'التعليقات (' + list.length + ')';
      if (editing) return;
      cList.textContent = '';
      if (!list.length) cList.append(el('p', { class: 'empty', text: 'ما فيه تعليقات للحين.' }));
      const kids = {};
      list.forEach((c) => { if (c.parent) (kids[c.parent] = kids[c.parent] || []).push(c); });
      list.filter((c) => !c.parent).forEach((c) => {
        const thread = el('div', { class: 'thread' });
        const box = el('div', { class: 'replies' });
        thread.append(commentCard(c, box));
        (kids[c.id] || []).forEach((r) => box.append(commentCard(r, box)));
        thread.append(box);
        cList.append(thread);
      });
    }
    paintComments(d.comments);

    async function reload() {
      try {
        const nd = await api('GET', '/posts/' + encodeURIComponent(p.id));
        likes = nd.likes; paintLike(); paintComments(nd.comments);
        refreshNotes();
      } catch (e) { notify(e.message); }
    }

    /* نموذج التعليق: الاسم إلزامي للزوار */
    const nameIn = el('input', { class: 'field', id: 'c-name', type: 'text', maxlength: '40', placeholder: 'اسمك (يظهر مع تعليقك)', 'aria-label': 'اسمك' });
    nameIn.value = lsGet('blog-name') || '';
    const ta = el('textarea', { class: 'field', id: 'c-text', maxlength: '1000', placeholder: 'اكتب تعليقك…', 'aria-label': 'تعليقك' });
    const send = el('button', { class: 'btn primary', type: 'submit', text: 'أرسل التعليق' });
    const form = el('form', { class: 'write' }, [isAdmin ? null : nameIn, ta, el('div', { class: 'row' }, [send])]);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = nameIn.value.trim(), text = ta.value.trim();
      if (!isAdmin && !name) { notify('اكتب اسمك أولاً عشان يظهر مع تعليقك.'); nameIn.focus(); return; }
      if (!text) return;
      if (!isAdmin) lsSet('blog-name', name);
      send.disabled = true;
      try { await api('POST', '/posts/' + p.id + '/comments', { name, text }); ta.value = ''; await reload(); }
      catch (err) { notify(err.message); }
      send.disabled = false;
    });

    const back = () => (d.folder
      ? el('a', { class: 'back', href: '#f-' + d.folder.id, text: '→ ' + d.folder.name })
      : el('a', { class: 'back', href: '#home', text: '→ الرئيسية' }));
    view.append(back(), art, react, el('section', { class: 'comments' }, [cTitle, cList, form]), back());

    if (pendingScroll) {
      const target = pendingScroll; pendingScroll = '';
      requestAnimationFrame(() => {
        const c = document.getElementById('c-' + target);
        if (c) { c.scrollIntoView({ block: 'center' }); c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 2500); }
      });
    }
    current = { id: p.id, refresh: () => { if (!editing && !ta.value) return reload(); } };
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { refreshNotes(); if (current) current.refresh(); }
  });

  /* ---------- رفع الصور ---------- */
  const MAX_SIDE = 1600, MAX_BYTES = 5000000;

  function loadImg(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')); };
      img.src = url;
    });
  }
  function drawScaled(src, w, h) {
    const s = Math.min(1, MAX_SIDE / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', 0.85));
  }
  async function prepareImage(file) {
    if (file.type === 'image/gif') return file;
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return await drawScaled(bmp, bmp.width, bmp.height);
    } catch (e) {
      try { const img = await loadImg(file); return await drawScaled(img, img.naturalWidth, img.naturalHeight); }
      catch (e2) { return file; }
    }
  }
  async function uploadFile(f) {
    const blob = f.type.indexOf('image/') === 0 ? await prepareImage(f) : f;
    if (blob.size > MAX_BYTES) throw new Error('الملف أكبر من 5 ميغابايت: ' + (f.name || ''));
    const r = await api('POST', '/media', blob);
    return r.id;
  }

  /* صورة غلاف (للتدوينة أو للمجلد) */
  function coverPicker(idKey, getId, setId, onChange, labelAdd, labelChange, labelRemove) {
    const prev = el('div', { class: 'cover' });
    const input = el('input', { type: 'file', accept: 'image/*', id: idKey, class: 'sr' });
    const pick = el('label', { class: 'btn', for: idKey });
    const rm = el('button', { class: 'btn danger', type: 'button', text: labelRemove });
    function paint() {
      prev.textContent = '';
      if (getId()) prev.append(el('img', { src: mediaUrl(getId()), alt: '' }));
      pick.textContent = getId() ? labelChange : labelAdd;
      rm.hidden = !getId();
    }
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      notify('جارٍ رفع الصورة…');
      try { setId(await uploadFile(f)); onChange(); paint(); notify('تم رفع الصورة.'); }
      catch (e) { notify(e.message); }
      input.value = '';
    });
    rm.addEventListener('click', () => { setId(''); onChange(); paint(); });
    paint();
    return el('div', { class: 'thumbbox' }, [prev, el('div', { class: 'row' }, [pick, input, rm])]);
  }

  /* ---------- المحرر (لصاحب المدونة) ---------- */
  function renderEditor(p, folders, defFolder) {
    view.textContent = '';
    const draftKey = 'blog-draft-' + (p ? p.id : 'new');
    let saved = null;
    try { saved = JSON.parse(lsGet(draftKey) || 'null'); } catch (e) { /* تجاهل */ }

    const title = el('input', { class: 'field title', id: 'f-title', type: 'text', maxlength: '200', placeholder: 'عنوان التدوينة', 'aria-label': 'عنوان التدوينة' });
    const body = el('textarea', { class: 'field long', id: 'f-body', placeholder: 'اكتب هنا براحتك…', 'aria-label': 'نص التدوينة' });
    title.value = (saved && saved.title) || (p ? p.title : '');
    body.value = (saved && saved.body) || (p ? p.body : '');
    let thumbId = (saved && saved.thumb !== undefined) ? saved.thumb : (p ? (p.thumb || '') : '');
    const want = (saved && saved.folder !== undefined) ? saved.folder : defFolder;
    const folderSel = el('select', { class: 'field', 'aria-label': 'المجلد' }, [el('option', { value: '', text: 'بدون مجلد' })]);
    folders.forEach((f) => folderSel.append(el('option', { value: f.id, text: f.name })));
    folderSel.value = want;
    if (folderSel.value !== want) folderSel.value = '';
    const freshCb = el('input', { type: 'checkbox', id: 'f-fresh' });
    freshCb.checked = (saved && saved.fresh !== undefined) ? !!saved.fresh : !!(p && p.fresh);

    let t;
    function keep() {
      clearTimeout(t);
      t = setTimeout(() => lsSet(draftKey, JSON.stringify({ title: title.value, body: body.value, thumb: thumbId, folder: folderSel.value, fresh: freshCb.checked })), 600);
    }
    title.addEventListener('input', keep);
    folderSel.addEventListener('change', keep);
    freshCb.addEventListener('change', keep);
    body.addEventListener('input', () => { keep(); renderPreviews(); });

    const thumbBox = coverPicker('f-thumb', () => thumbId, (v) => { thumbId = v; }, keep, 'إضافة صورة غلاف', 'تغيير صورة الغلاف', 'إزالة الغلاف');

    /* صور وفيديوهات داخل النص */
    let busy = false;
    const file = el('input', { type: 'file', accept: 'image/*,video/*', multiple: '', id: 'f-file', class: 'sr' });
    const pick = el('label', { class: 'btn', for: 'f-file', text: 'إضافة صورة أو فيديو' });
    const previews = el('div', { class: 'previews' });
    function renderPreviews() {
      previews.textContent = '';
      const re = /\[(صورة|فيديو):([A-Za-z0-9_-]+)\]/g;
      let m;
      while ((m = re.exec(body.value))) {
        ((full, kind, id) => {
          const thumb = kind === 'صورة'
            ? el('img', { src: mediaUrl(id), alt: '' })
            : el('video', { src: mediaUrl(id), preload: 'metadata', muted: '', playsinline: '' });
          const rm = el('button', { class: 'btn danger', type: 'button', text: 'إزالة' });
          rm.addEventListener('click', () => {
            body.value = body.value.replace(full, '').replace(/\n{3,}/g, '\n\n');
            keep(); renderPreviews();
          });
          previews.append(el('div', { class: 'pv' }, [thumb, rm]));
        })(m[0], m[1], m[2]);
      }
    }
    async function onPick() {
      if (busy) return;
      const picked = Array.prototype.slice.call(file.files || []);
      if (!picked.length) return;
      busy = true;
      const pos = body.selectionStart != null ? body.selectionStart : body.value.length;
      let ins = '', failed = 0, lastErr = '';
      for (let k = 0; k < picked.length; k++) {
        notify('جارٍ رفع الملف ' + (k + 1) + ' من ' + picked.length + '…');
        try {
          const id = await uploadFile(picked[k]);
          ins += '\n\n[' + (picked[k].type.indexOf('video') === 0 ? 'فيديو' : 'صورة') + ':' + id + ']';
        } catch (e) { failed++; lastErr = e.message; }
      }
      if (ins) {
        body.value = body.value.slice(0, pos) + ins + '\n\n' + body.value.slice(pos);
        keep(); renderPreviews();
      }
      notify(failed ? 'ما انرفع ' + failed + ' من الملفات. ' + lastErr : 'تم رفع ' + picked.length + ' ملف.');
      file.value = ''; busy = false;
    }
    file.addEventListener('change', onPick);
    renderPreviews();

    /* هايلايت: يلفّ النص المحدد بـ == == */
    const hl = el('button', { class: 'btn hl', type: 'button', text: 'هايلايت' });
    hl.addEventListener('click', () => {
      const a = body.selectionStart, b = body.selectionEnd;
      if (a == null || a === b) { notify('حدد النص اللي تبي تظلله أولاً، ثم اضغط هايلايت.'); return; }
      const v = body.value, sel = v.slice(a, b);
      if (sel.length > 4 && sel.slice(0, 2) === '==' && sel.slice(-2) === '==') {
        body.value = v.slice(0, a) + sel.slice(2, -2) + v.slice(b);
        body.setSelectionRange(a, b - 4);
      } else if (v.slice(a - 2, a) === '==' && v.slice(b, b + 2) === '==') {
        body.value = v.slice(0, a - 2) + sel + v.slice(b + 2);
        body.setSelectionRange(a - 2, b - 2);
      } else {
        body.value = v.slice(0, a) + '==' + sel + '==' + v.slice(b);
        body.setSelectionRange(a, b + 4);
      }
      keep();
    });
    const prevBox = el('div', { class: 'body pvbox' });
    prevBox.hidden = true;
    const prevBtn = el('button', { class: 'btn', type: 'button', text: 'معاينة' });
    prevBtn.addEventListener('click', () => {
      prevBox.hidden = !prevBox.hidden;
      prevBtn.textContent = prevBox.hidden ? 'معاينة' : 'إخفاء المعاينة';
      if (!prevBox.hidden) renderBody(prevBox, body.value);
    });
    body.addEventListener('input', () => { if (!prevBox.hidden) renderBody(prevBox, body.value); });

    const save = el('button', { class: 'btn primary', type: 'submit', text: p ? 'حفظ التعديل' : 'انشر التدوينة' });
    const form = el('form', { class: 'write' }, [
      title, folderSel, thumbBox,
      el('div', { class: 'row' }, [hl, prevBtn]),
      body,
      prevBox,
      el('div', { class: 'row' }, [pick, file]),
      previews,
      el('label', { class: 'check', for: 'f-fresh' }, [freshCb, el('span', { text: 'علّمها «مدونة جديدة» (تظهر شارة ذهبية لمدة أسبوع)' })]),
      el('p', { class: 'hint', text: 'اترك سطراً فارغاً بين الفقرات. ابدأ السطر بـ ## لعنوان فرعي. لتظليل كلام: حدده واضغط «هايلايت». الصور تتصغّر تلقائياً قبل الرفع، والفيديو الحد الأقصى له 5 ميغابايت. المسودة تنحفظ تلقائياً في هذا المتصفح.' }),
      el('div', { class: 'row' }, [save, el('a', { class: 'btn', href: p ? '#p-' + p.id : '#home', text: 'إلغاء' })]),
    ]);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ti = title.value.trim(), bo = body.value.trim();
      if (!ti || !bo) { notify('اكتب عنواناً ونصاً أولاً.'); return; }
      save.disabled = true;
      try {
        const payload = { title: ti, body: bo, thumb: thumbId, folder: folderSel.value, fresh: freshCb.checked };
        const r = p ? await api('PUT', '/posts/' + p.id, payload) : await api('POST', '/posts', payload);
        lsDel(draftKey);
        location.hash = 'p-' + r.id;
      } catch (err) {
        save.disabled = false;
        notify(err.status === 401 ? 'انتهت صلاحية الدخول. ادخل من جديد.' : err.message);
      }
    });
    view.append(el('a', { class: 'back', href: p ? '#p-' + p.id : '#home', text: '→ رجوع' }), form);
  }

  /* ---------- محرر المجلد ---------- */
  function renderFolderEditor(f) {
    view.textContent = '';
    let color = f ? (f.color || 'green') : 'green';
    let thumbId = f ? (f.thumb || '') : '';
    setFolderAccent(color);
    const name = el('input', { class: 'field title', type: 'text', maxlength: '60', placeholder: 'اسم المجلد', 'aria-label': 'اسم المجلد' });
    name.value = f ? f.name : '';

    const dots = el('div', { class: 'dots big' });
    COLOR_KEYS.forEach((k) => {
      const b = el('button', { class: 'swatch', type: 'button', 'aria-label': k, 'aria-pressed': k === color ? 'true' : 'false' });
      b.style.background = colorOf(k);
      b.addEventListener('click', () => {
        color = k; setFolderAccent(k);
        dots.querySelectorAll('.swatch').forEach((s, i) => { s.setAttribute('aria-pressed', COLOR_KEYS[i] === k ? 'true' : 'false'); s.style.background = colorOf(COLOR_KEYS[i]); });
      });
      dots.append(b);
    });
    const thumbBox = coverPicker('fo-thumb', () => thumbId, (v) => { thumbId = v; }, () => {}, 'إضافة صورة للمجلد (16:9)', 'تغيير صورة المجلد', 'إزالة الصورة');

    const save = el('button', { class: 'btn primary', type: 'submit', text: f ? 'حفظ' : 'إنشاء المجلد' });
    const kids = [
      name,
      el('p', { class: 'hint', text: 'ثيم المجلد: اختر لوناً. المجلد وتدويناته ياخذون هذا اللون.' }), dots,
      thumbBox,
      el('div', { class: 'row' }, [save, el('a', { class: 'btn', href: f ? '#f-' + f.id : '#home', text: 'إلغاء' })]),
    ];
    const form = el('form', { class: 'write' }, kids);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = name.value.trim();
      if (!v) { notify('اكتب اسم المجلد.'); return; }
      save.disabled = true;
      try {
        const payload = { name: v, color, thumb: thumbId };
        const r = f ? await api('PUT', '/folders/' + f.id, payload) : await api('POST', '/folders', payload);
        location.hash = 'f-' + r.folder.id;
      } catch (err) { save.disabled = false; notify(err.message); }
    });
    view.append(el('a', { class: 'back', href: f ? '#f-' + f.id : '#home', text: '→ رجوع' }), form);
    if (f) {
      const del = el('button', { class: 'btn danger', type: 'button', text: 'حذف المجلد' });
      del.addEventListener('click', async () => {
        if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = 'تأكيد الحذف (التدوينات ما تنحذف)'; return; }
        del.disabled = true;
        try { await api('DELETE', '/folders/' + f.id); location.hash = 'home'; }
        catch (err) { del.disabled = false; notify(err.message); }
      });
      view.append(el('div', { class: 'owner-actions' }, [del]));
    }
  }

  /* ---------- دخول صاحب المدونة ---------- */
  function renderLogin() {
    view.textContent = '';
    if (isAdmin) { location.hash = 'home'; return; }
    const pw = el('input', { class: 'field', id: 'l-pw', type: 'password', autocomplete: 'current-password', placeholder: 'كلمة السر', 'aria-label': 'كلمة السر' });
    const go1 = el('button', { class: 'btn primary', type: 'submit', text: 'دخول' });
    const form = el('form', { class: 'write login' }, [
      el('h3', { text: 'دخول صاحب المدونة' }),
      pw, el('div', { class: 'row' }, [go1]),
    ]);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!pw.value) return;
      go1.disabled = true;
      const prev = adminPw;
      adminPw = pw.value;
      try {
        await api('POST', '/login');
        lsSet('blog-admin', adminPw); isAdmin = true;
        location.hash = 'home'; go(); refreshNotes();
      } catch (err) {
        adminPw = prev; go1.disabled = false;
        notify(err.status === 401 ? 'كلمة السر غير صحيحة.' : err.message);
      }
    });
    view.append(el('a', { class: 'back', href: '#home', text: '→ رجوع' }), form);
  }

  /* ---------- البداية ---------- */
  (async function start() {
    if (adminPw) {
      try { await api('POST', '/login'); isAdmin = true; }
      catch (e) { if (e.status === 401) { adminPw = ''; lsDel('blog-admin'); } }
    }
    window.addEventListener('hashchange', go);
    go();
    refreshNotes();
  })();
})();
