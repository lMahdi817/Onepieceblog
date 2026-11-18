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

  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.4-9.6A5.1 5.1 0 0 1 12 6.4a5.1 5.1 0 0 1 9.4 4.5c-1.9 5-9.4 9.6-9.4 9.6z"/></svg>';
  const dateFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'long' });
  const fmt = (ts) => { try { return dateFmt.format(new Date(ts)); } catch (e) { return ''; } };
  const mediaUrl = (id) => '/api/media/' + encodeURIComponent(id);
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

  /* ---------- مساعدات ---------- */
  const readMins = (t) => Math.max(1, Math.ceil(String(t || '').split(/\s+/).length / 170));
  const paragraphs = (t) => String(t || '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);

  const FOLDER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/></svg>';

  /* هايلايت: ==نص== يظهر بخلفية ملوّنة */
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

  /* ---------- التوجيه ---------- */
  function parseRoute() {
    const h = (location.hash || '').replace(/^#/, '');
    if (h.indexOf('p-') === 0) return { name: 'post', id: h.slice(2) };
    if (h.indexOf('edit-') === 0) return { name: 'edit', id: h.slice(5) };
    if (h.indexOf('f-') === 0) return { name: 'folder', id: h.slice(2) };
    if (h === 'write') return { name: 'write' };
    if (h.indexOf('write-') === 0) return { name: 'write', folder: h.slice(6) };
    if (h === 'login') return { name: 'login' };
    return { name: 'home' };
  }

  function renderChrome(route) {
    topActions.textContent = '';
    foot.textContent = '';
    if (isAdmin) {
      if (route.name === 'home' || route.name === 'folder') {
        topActions.append(el('a', { class: 'btn primary', href: route.folder || route.id ? '#write-' + route.id : '#write', text: 'تدوينة جديدة' }));
      }
      const out = el('button', { class: 'btn', type: 'button', text: 'خروج' });
      out.addEventListener('click', () => { adminPw = ''; isAdmin = false; lsDel('blog-admin'); location.hash = 'home'; go(); });
      topActions.append(out);
    } else {
      foot.append(el('a', { href: '#login', text: 'دخول صاحب المدونة' }));
    }
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
        renderHome(d.posts, fd.folders);
      } else if (route.name === 'folder') {
        const [d, fd] = await Promise.all([api('GET', '/posts'), api('GET', '/folders')]);
        if (my !== routeSeq) return;
        renderFolder(route.id, d.posts, fd.folders);
      } else if (route.name === 'post') {
        const d = await api('GET', '/posts/' + encodeURIComponent(route.id));
        if (my !== routeSeq) return;
        renderPost(d);
      } else if (route.name === 'write') {
        if (!isAdmin) { location.hash = 'login'; return; }
        const fd = await api('GET', '/folders');
        if (my !== routeSeq) return;
        renderEditor(null, fd.folders, route.folder || '');
      } else if (route.name === 'edit') {
        if (!isAdmin) { location.hash = 'login'; return; }
        const [d, fd] = await Promise.all([api('GET', '/posts/' + encodeURIComponent(route.id)), api('GET', '/folders')]);
        if (my !== routeSeq) return;
        renderEditor(d.post, fd.folders, d.post.folder || '');
      } else if (route.name === 'login') {
        renderLogin();
      }
    } catch (e) {
      if (my !== routeSeq) return;
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
      kids.push(el('h2', { text: p.title }));
      list.append(el('a', { class: 'card' + (p.thumb ? '' : ' plain'), href: '#p-' + p.id }, kids));
    });
    return list;
  }

  function renderHome(posts, folders) {
    view.textContent = '';
    if (isAdmin) {
      const name = el('input', { class: 'field', type: 'text', maxlength: '60', placeholder: 'اسم مجلد جديد', 'aria-label': 'اسم المجلد' });
      const add = el('button', { class: 'btn primary', type: 'submit', text: 'إضافة مجلد' });
      const form = el('form', { class: 'newfolder' }, [name, add]);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = name.value.trim();
        if (!v) return;
        add.disabled = true;
        try { await api('POST', '/folders', { name: v }); go(); }
        catch (err) { add.disabled = false; notify(err.message); }
      });
      view.append(form);
    }
    if (folders.length) {
      const grid = el('section', { class: 'folders' });
      folders.forEach((f) => {
        const n = posts.filter((p) => p.folder === f.id).length;
        grid.append(el('a', { class: 'folder', href: '#f-' + f.id }, [
          el('span', { class: 'ficon', html: FOLDER_ICON }),
          el('b', { text: f.name }),
          el('small', { text: n + (n === 1 ? ' تدوينة' : ' تدوينات') }),
        ]));
      });
      view.append(grid);
    }
    const ids = new Set(folders.map((f) => f.id));
    const loose = posts.filter((p) => !p.folder || !ids.has(p.folder));
    if (folders.length && loose.length) view.append(el('h3', { class: 'sec', text: 'تدوينات بدون مجلد' }));
    if (!posts.length) {
      view.append(el('p', { class: 'empty', text: isAdmin ? 'ما كتبت شي للحين. اضغط «تدوينة جديدة» وابدأ.' : 'ما فيه تدوينات للحين. ارجع قريب.' }));
    } else if (loose.length) {
      view.append(postCards(loose));
    }
  }

  function renderFolder(fid, posts, folders) {
    view.textContent = '';
    const f = folders.find((x) => x.id === fid);
    if (!f) {
      view.append(el('p', { class: 'empty', text: 'ما لقينا هذا المجلد.' }), el('a', { class: 'back', href: '#home', text: '→ الرئيسية' }));
      return;
    }
    view.append(el('a', { class: 'back', href: '#home', text: '→ الرئيسية' }));
    const h = el('h1', { class: 'ftitle', text: f.name });
    view.append(h);
    if (isAdmin) {
      const name = el('input', { class: 'field', type: 'text', maxlength: '60', 'aria-label': 'اسم المجلد' });
      name.value = f.name;
      const ren = el('button', { class: 'btn', type: 'submit', text: 'تغيير الاسم' });
      const del = el('button', { class: 'btn danger', type: 'button', text: 'حذف المجلد' });
      const form = el('form', { class: 'newfolder' }, [name, ren]);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = name.value.trim();
        if (!v) return;
        ren.disabled = true;
        try { await api('PUT', '/folders/' + f.id, { name: v }); go(); }
        catch (err) { ren.disabled = false; notify(err.message); }
      });
      del.addEventListener('click', async () => {
        if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = 'تأكيد الحذف (التدوينات ما تنحذف)'; return; }
        del.disabled = true;
        try { await api('DELETE', '/folders/' + f.id); location.hash = 'home'; }
        catch (err) { del.disabled = false; notify(err.message); }
      });
      view.append(form, el('div', { class: 'owner-actions' }, [del]));
    }
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
    if (d.folder) art.append(el('a', { class: 'crumb', href: '#f-' + d.folder.id, text: d.folder.name }));
    art.append(cover, el('h1', { text: p.title }), el('div', { class: 'meta' }, [
      el('span', { text: fmt(p.ts) }), el('span', { text: 'قراءة ' + readMins(p.body) + ' د' }),
    ]));
    if (isAdmin) {
      const del = el('button', { class: 'btn danger', type: 'button', text: 'حذف' });
      del.addEventListener('click', async () => {
        if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = 'تأكيد الحذف'; return; }
        del.disabled = true;
        try { await api('DELETE', '/posts/' + p.id); location.hash = 'home'; }
        catch (e) { del.disabled = false; notify(e.message); }
      });
      art.append(el('div', { class: 'owner-actions' }, [el('a', { class: 'btn', href: '#edit-' + p.id, text: 'تعديل' }), del]));
    }
    const body = el('div', { class: 'body' });
    renderBody(body, p.body);
    art.append(body);

    /* الإعجاب */
    const likeBtn = el('button', { class: 'like', type: 'button' });
    let likes = d.likes;
    function paintLike() {
      likeBtn.setAttribute('aria-pressed', likes.liked ? 'true' : 'false');
      likeBtn.innerHTML = HEART + '<span>' + (likes.liked ? 'أعجبتك' : 'أعجبتني') + '</span><span>' + likes.count + '</span>';
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
    function paintComments(list) {
      cTitle.textContent = 'التعليقات (' + list.length + ')';
      if (editing) return;
      cList.textContent = '';
      if (!list.length) cList.append(el('p', { class: 'empty', text: 'ما فيه تعليقات للحين.' }));
      list.forEach((c) => {
        const card = el('div', { class: 'comment' });
        const bodyP = el('p', { text: c.text });
        const head = el('div', { class: 'who' }, [
          el('span', {}, [el('b', { text: c.name }), document.createTextNode(' · ' + fmt(c.ts) + (c.edited ? ' · معدّل' : ''))]),
        ]);
        if (c.canManage) {
          const ed = el('button', { class: 'del', type: 'button', text: 'تعديل' });
          const del = el('button', { class: 'del', type: 'button', text: 'حذف' });
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
            if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = 'تأكيد'; del.classList.add('sure'); return; }
            try { await api('DELETE', '/posts/' + p.id + '/comments/' + c.id); await reload(); }
            catch (e) { notify(e.message); }
          });
          head.append(ed, del);
        }
        card.append(head, bodyP);
        cList.append(card);
      });
    }
    paintComments(d.comments);

    async function reload() {
      try {
        const nd = await api('GET', '/posts/' + encodeURIComponent(p.id));
        likes = nd.likes; paintLike(); paintComments(nd.comments);
      } catch (e) { notify(e.message); }
    }

    /* نموذج التعليق: الاسم إلزامي */
    const nameIn = el('input', { class: 'field', id: 'c-name', type: 'text', maxlength: '40', placeholder: 'اسمك (يظهر مع تعليقك)', 'aria-label': 'اسمك' });
    nameIn.value = lsGet('blog-name') || '';
    const ta = el('textarea', { class: 'field', id: 'c-text', maxlength: '1000', placeholder: 'اكتب تعليقك…', 'aria-label': 'تعليقك' });
    const send = el('button', { class: 'btn primary', type: 'submit', text: 'أرسل التعليق' });
    const form = el('form', { class: 'write' }, [nameIn, ta, el('div', { class: 'row' }, [send])]);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = nameIn.value.trim(), text = ta.value.trim();
      if (!name) { notify('اكتب اسمك أولاً عشان يظهر مع تعليقك.'); nameIn.focus(); return; }
      if (!text) return;
      lsSet('blog-name', name);
      send.disabled = true;
      try { await api('POST', '/posts/' + p.id + '/comments', { name, text }); ta.value = ''; await reload(); }
      catch (err) { notify(err.message); }
      send.disabled = false;
    });

    const back = () => d.folder
      ? el('a', { class: 'back', href: '#f-' + d.folder.id, text: '→ ' + d.folder.name })
      : el('a', { class: 'back', href: '#home', text: '→ الرئيسية' });
    view.append(back(), art, react, el('section', { class: 'comments' }, [cTitle, cList, form]), back());

    current = { id: p.id, refresh: () => { if (!editing && !ta.value) return reload(); } };
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && current) current.refresh();
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
    const folderSel = el('select', { class: 'field', 'aria-label': 'المجلد' }, [el('option', { value: '', text: 'بدون مجلد' })]);
    folders.forEach((f) => folderSel.append(el('option', { value: f.id, text: f.name })));
    folderSel.value = (saved && saved.folder !== undefined) ? saved.folder : defFolder;
    if (folderSel.value !== ((saved && saved.folder !== undefined) ? saved.folder : defFolder)) folderSel.value = '';

    let t;
    function keep() {
      clearTimeout(t);
      t = setTimeout(() => lsSet(draftKey, JSON.stringify({ title: title.value, body: body.value, thumb: thumbId, folder: folderSel.value })), 600);
    }
    title.addEventListener('input', keep);
    folderSel.addEventListener('change', keep);
    body.addEventListener('input', () => { keep(); renderPreviews(); });

    /* صورة الغلاف */
    const thumbPrev = el('div', { class: 'cover' });
    const thumbFile = el('input', { type: 'file', accept: 'image/*', id: 'f-thumb', class: 'sr' });
    const thumbPick = el('label', { class: 'btn', for: 'f-thumb' });
    const thumbRm = el('button', { class: 'btn danger', type: 'button', text: 'إزالة الغلاف' });
    function renderThumb() {
      thumbPrev.textContent = '';
      if (thumbId) thumbPrev.append(el('img', { src: mediaUrl(thumbId), alt: '' }));
      thumbPick.textContent = thumbId ? 'تغيير صورة الغلاف' : 'إضافة صورة غلاف';
      thumbRm.hidden = !thumbId;
    }
    thumbFile.addEventListener('change', async () => {
      const f = thumbFile.files && thumbFile.files[0];
      if (!f) return;
      notify('جارٍ رفع الغلاف…');
      try { thumbId = await uploadFile(f); keep(); renderThumb(); notify('تم رفع الغلاف.'); }
      catch (e) { notify(e.message); }
      thumbFile.value = '';
    });
    thumbRm.addEventListener('click', () => { thumbId = ''; keep(); renderThumb(); });
    renderThumb();
    const thumbBox = el('div', { class: 'thumbbox' }, [thumbPrev, el('div', { class: 'row' }, [thumbPick, thumbFile, thumbRm])]);

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
      el('p', { class: 'hint', text: 'اترك سطراً فارغاً بين الفقرات. ابدأ السطر بـ ## لعنوان فرعي. لتظليل كلام: حدده واضغط «هايلايت». الصور تتصغّر تلقائياً قبل الرفع، والفيديو الحد الأقصى له 5 ميغابايت. المسودة تنحفظ تلقائياً في هذا المتصفح.' }),
      el('div', { class: 'row' }, [save, el('a', { class: 'btn', href: p ? '#p-' + p.id : '#home', text: 'إلغاء' })]),
    ]);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ti = title.value.trim(), bo = body.value.trim();
      if (!ti || !bo) { notify('اكتب عنواناً ونصاً أولاً.'); return; }
      save.disabled = true;
      try {
        const payload = { title: ti, body: bo, thumb: thumbId, folder: folderSel.value };
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
        location.hash = 'home'; go();
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
  })();
})();
