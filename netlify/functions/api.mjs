// خادم المدونة: دالة Netlify واحدة تخدم كل مسارات /api/*
// البيانات تنحفظ في Netlify Blobs (متجران: blog للنصوص، media للصور والفيديو).
import { getStore } from "@netlify/blobs";

const MAX_TITLE = 200;
const MAX_BODY = 100000;
const MAX_NAME = 40;
const MAX_FOLDER = 60;
const MAX_FOLDERS = 100;
const MAX_COMMENT = 1000;
const MAX_COMMENTS_PER_POST = 500;
const MAX_ACTIVITY = 300;
const MAX_MEDIA_BYTES = 5_000_000; // حد الطلب الواحد في دوال Netlify حوالي 6 ميغابايت
const MEDIA_TYPES = /^(image\/(jpeg|png|gif|webp|avif)|video\/(mp4|webm|quicktime))$/;
const MARKER = /\[(?:صورة|فيديو):([A-Za-z0-9_-]+)\]/g;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const COLORS = ["green", "red", "blue", "purple", "gold", "pink", "orange", "teal"];
const OWNER_NAME = "صاحب المدونة";

const blog = () => getStore({ name: "blog", consistency: "strong" });
const media = () => getStore({ name: "media", consistency: "strong" });

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const fail = (status, message) => json({ error: message }, status);

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function isAdmin(req) {
  const pw = process.env.ADMIN_PASSWORD || "";
  if (!pw) return false;
  return safeEqual(req.headers.get("x-admin-password") || "", pw);
}
function clientToken(req) {
  const t = req.headers.get("x-client-token") || "";
  return TOKEN_RE.test(t) ? t : "";
}
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const clean = (s, max) => String(s ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

function mediaIdsOf(post) {
  const ids = new Set();
  if (post?.thumb) ids.add(post.thumb);
  for (const m of String(post?.body || "").matchAll(MARKER)) ids.add(m[1]);
  return ids;
}
async function deleteMedia(ids) {
  const store = media();
  for (const id of ids) {
    if (ID_RE.test(id)) { try { await store.delete(id); } catch (e) { /* تجاهل */ } }
  }
}
async function readJson(req) {
  try { return await req.json(); } catch (e) { return null; }
}

async function loadFolders(store) {
  return (await store.get("folders", { type: "json" })) || [];
}
const folderOk = (folders, id) => (ID_RE.test(id || "") && folders.some((f) => f.id === id) ? id : "");
const colorOk = (c) => (COLORS.includes(c) ? c : "green");
const thumbOk = (t) => (ID_RE.test(t || "") ? t : "");
const freshOf = (want, old) => (want ? (old || Date.now()) : 0);

const sanitizeComment = (c, token, admin) => ({
  id: c.id, name: c.name, text: c.text, ts: c.ts, edited: c.edited || 0,
  parent: c.parent || "", owner: !!c.owner,
  likes: Object.keys(c.likes || {}).length,
  liked: !!token && !!(c.likes || {})[token],
  mine: !!token && c.token === token, canManage: admin || (!!token && c.token === token),
});

async function addActivity(store, ev) {
  const list = (await store.get("activity", { type: "json" })) || [];
  list.unshift(ev);
  await store.setJSON("activity", list.slice(0, MAX_ACTIVITY));
}
async function dropActivity(store, pred) {
  const list = (await store.get("activity", { type: "json" })) || [];
  const next = list.filter((e) => !pred(e));
  if (next.length !== list.length) await store.setJSON("activity", next);
}

export default async function handler(req) {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const method = req.method.toUpperCase();
  const admin = isAdmin(req);
  const token = clientToken(req);

  try {
    // ---- دخول صاحب المدونة ----
    if (parts[0] === "login" && method === "POST") {
      if (admin) return json({ ok: true });
      await new Promise((r) => setTimeout(r, 600));
      return fail(401, "كلمة السر غير صحيحة.");
    }

    // ---- الإشعارات ----
    if (parts[0] === "notifications" && parts.length === 1 && method === "GET") {
      const list = (await blog().get("activity", { type: "json" })) || [];
      const mine = list.filter((e) => (admin ? !e.owner : (!!token && e.parentToken === token && e.by !== token)));
      return json({
        events: mine.slice(0, 50).map((e) => ({
          id: e.id, type: e.type, postId: e.postId, postTitle: e.postTitle,
          commentId: e.commentId, name: e.name, text: e.text, ts: e.ts, owner: !!e.owner,
        })),
      });
    }

    // ---- الوسائط ----
    if (parts[0] === "media") {
      if (method === "POST" && parts.length === 1) {
        if (!admin) return fail(401, "هذا الإجراء لصاحب المدونة فقط.");
        const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (!MEDIA_TYPES.test(type)) return fail(415, "نوع الملف غير مدعوم. المسموح: صور JPG/PNG/GIF/WebP وفيديو MP4/WebM/MOV.");
        const buf = await req.arrayBuffer();
        if (buf.byteLength === 0) return fail(400, "الملف فارغ.");
        if (buf.byteLength > MAX_MEDIA_BYTES) return fail(413, "الملف أكبر من 5 ميغابايت.");
        const id = newId() + newId();
        await media().set(id, buf, { metadata: { type } });
        return json({ id });
      }
      if (method === "GET" && parts.length === 2) {
        const id = parts[1];
        if (!ID_RE.test(id)) return fail(404, "غير موجود.");
        const got = await media().getWithMetadata(id, { type: "arrayBuffer" });
        if (!got) return fail(404, "غير موجود.");
        const type = got.metadata?.type || "application/octet-stream";
        const data = new Uint8Array(got.data);
        const base = {
          "content-type": type, "accept-ranges": "bytes",
          "cache-control": "public, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        };
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
        if (range) {
          let start = range[1] === "" ? NaN : Number(range[1]);
          let end = range[2] === "" ? data.length - 1 : Number(range[2]);
          if (Number.isNaN(start)) { start = Math.max(0, data.length - Number(range[2])); end = data.length - 1; }
          end = Math.min(end, data.length - 1);
          if (start > end || start >= data.length) {
            return new Response(null, { status: 416, headers: { ...base, "content-range": `bytes */${data.length}` } });
          }
          return new Response(data.slice(start, end + 1), {
            status: 206,
            headers: { ...base, "content-range": `bytes ${start}-${end}/${data.length}`, "content-length": String(end - start + 1) },
          });
        }
        return new Response(data, { status: 200, headers: { ...base, "content-length": String(data.length) } });
      }
      return fail(405, "طلب غير مدعوم.");
    }

    // ---- المجلدات ----
    if (parts[0] === "folders") {
      const store = blog();
      if (parts.length === 1 && method === "GET") return json({ folders: await loadFolders(store) });
      if (!admin) return fail(401, "هذا الإجراء لصاحب المدونة فقط.");
      if (parts.length === 1 && method === "POST") {
        const b = await readJson(req);
        const name = clean(b?.name, MAX_FOLDER);
        if (!name) return fail(400, "اكتب اسم المجلد.");
        const folders = await loadFolders(store);
        if (folders.length >= MAX_FOLDERS) return fail(400, "وصلت للحد الأقصى من المجلدات.");
        const f = { id: newId(), name, thumb: thumbOk(b?.thumb), color: colorOk(b?.color), ts: Date.now() };
        folders.push(f);
        await store.setJSON("folders", folders);
        return json({ folder: f });
      }
      const fid = parts[1];
      if (!fid || !ID_RE.test(fid) || parts.length !== 2) return fail(404, "غير موجود.");
      const folders = await loadFolders(store);
      const i = folders.findIndex((f) => f.id === fid);
      if (i < 0) return fail(404, "ما لقينا هذا المجلد.");
      if (method === "PUT") {
        const b = await readJson(req);
        const name = clean(b?.name, MAX_FOLDER);
        if (!name) return fail(400, "اكتب اسم المجلد.");
        const old = folders[i];
        folders[i] = { ...old, name, thumb: thumbOk(b?.thumb), color: colorOk(b?.color) };
        await store.setJSON("folders", folders);
        if (old.thumb && old.thumb !== folders[i].thumb) await deleteMedia([old.thumb]);
        return json({ folder: folders[i] });
      }
      if (method === "DELETE") {
        const old = folders[i];
        folders.splice(i, 1);
        await store.setJSON("folders", folders);
        const index = (await store.get("index", { type: "json" })) || [];
        for (const e of index) {
          if (e.folder === fid) {
            e.folder = "";
            const post = await store.get(`post:${e.id}`, { type: "json" });
            if (post) { post.folder = ""; await store.setJSON(`post:${e.id}`, post); }
          }
        }
        await store.setJSON("index", index);
        if (old.thumb) await deleteMedia([old.thumb]);
        return json({ ok: true });
      }
      return fail(405, "طلب غير مدعوم.");
    }

    // ---- التدوينات ----
    if (parts[0] === "posts") {
      const store = blog();

      if (parts.length === 1 && method === "GET") {
        const index = (await store.get("index", { type: "json" })) || [];
        return json({ posts: index });
      }

      if (parts.length === 1 && method === "POST") {
        if (!admin) return fail(401, "هذا الإجراء لصاحب المدونة فقط.");
        const b = await readJson(req);
        const title = clean(b?.title, MAX_TITLE), body = clean(b?.body, MAX_BODY);
        const thumb = thumbOk(b?.thumb);
        const folder = folderOk(await loadFolders(store), b?.folder);
        if (!title || !body) return fail(400, "اكتب عنواناً ونصاً.");
        const fresh = freshOf(!!b?.fresh, 0);
        const post = { id: newId(), title, body, thumb, folder, fresh, ts: Date.now(), edited: 0 };
        await store.setJSON(`post:${post.id}`, post);
        const index = (await store.get("index", { type: "json" })) || [];
        index.unshift({ id: post.id, title, thumb, folder, fresh, ts: post.ts });
        await store.setJSON("index", index);
        return json({ id: post.id });
      }

      const id = parts[1];
      if (!id || !ID_RE.test(id)) return fail(404, "غير موجود.");

      if (parts.length === 2 && method === "GET") {
        const post = await store.get(`post:${id}`, { type: "json" });
        if (!post) return fail(404, "ما لقينا هذي التدوينة.");
        const likes = (await store.get(`likes:${id}`, { type: "json" })) || { voters: {} };
        const comments = (await store.get(`comments:${id}`, { type: "json" })) || [];
        const fl = (await loadFolders(store)).find((f) => f.id === post.folder);
        return json({
          post,
          folder: fl ? { id: fl.id, name: fl.name, color: fl.color || "green" } : null,
          likes: { count: Object.keys(likes.voters).length, liked: !!token && !!likes.voters[token] },
          comments: comments.map((c) => sanitizeComment(c, token, admin)),
        });
      }

      if (parts.length === 2 && method === "PUT") {
        if (!admin) return fail(401, "هذا الإجراء لصاحب المدونة فقط.");
        const old = await store.get(`post:${id}`, { type: "json" });
        if (!old) return fail(404, "ما لقينا هذي التدوينة.");
        const b = await readJson(req);
        const title = clean(b?.title, MAX_TITLE), body = clean(b?.body, MAX_BODY);
        const thumb = thumbOk(b?.thumb);
        const folder = folderOk(await loadFolders(store), b?.folder);
        if (!title || !body) return fail(400, "اكتب عنواناً ونصاً.");
        const fresh = freshOf(!!b?.fresh, old.fresh);
        const post = { ...old, title, body, thumb, folder, fresh, edited: Date.now() };
        await store.setJSON(`post:${id}`, post);
        const index = (await store.get("index", { type: "json" })) || [];
        const i = index.findIndex((x) => x.id === id);
        if (i >= 0) index[i] = { id, title, thumb, folder, fresh, ts: old.ts };
        await store.setJSON("index", index);
        const keep = mediaIdsOf(post);
        await deleteMedia([...mediaIdsOf(old)].filter((m) => !keep.has(m)));
        return json({ id });
      }

      if (parts.length === 2 && method === "DELETE") {
        if (!admin) return fail(401, "هذا الإجراء لصاحب المدونة فقط.");
        const old = await store.get(`post:${id}`, { type: "json" });
        await store.delete(`post:${id}`);
        await store.delete(`comments:${id}`);
        await store.delete(`likes:${id}`);
        const index = ((await store.get("index", { type: "json" })) || []).filter((x) => x.id !== id);
        await store.setJSON("index", index);
        await dropActivity(store, (e) => e.postId === id);
        if (old) await deleteMedia(mediaIdsOf(old));
        return json({ ok: true });
      }

      if (parts[2] === "like" && parts.length === 3 && method === "POST") {
        if (!token) return fail(400, "تعذر تحديد الجهاز.");
        const post = await store.get(`post:${id}`, { type: "json" });
        if (!post) return fail(404, "ما لقينا هذي التدوينة.");
        const likes = (await store.get(`likes:${id}`, { type: "json" })) || { voters: {} };
        if (likes.voters[token]) delete likes.voters[token]; else likes.voters[token] = 1;
        await store.setJSON(`likes:${id}`, likes);
        return json({ count: Object.keys(likes.voters).length, liked: !!likes.voters[token] });
      }

      if (parts[2] === "comments" && parts.length === 3 && method === "POST") {
        if (!token) return fail(400, "تعذر تحديد الجهاز.");
        const b = await readJson(req);
        let name = clean(b?.name, MAX_NAME);
        const text = clean(b?.text, MAX_COMMENT);
        if (admin && !name) name = OWNER_NAME;
        if (!name) return fail(400, "اكتب اسمك أولاً عشان يظهر مع تعليقك.");
        if (!text) return fail(400, "اكتب تعليقك.");
        const post = await store.get(`post:${id}`, { type: "json" });
        if (!post) return fail(404, "ما لقينا هذي التدوينة.");
        const list = (await store.get(`comments:${id}`, { type: "json" })) || [];
        if (list.length >= MAX_COMMENTS_PER_POST) return fail(429, "وصلت التدوينة للحد الأقصى من التعليقات.");
        let parent = "", parentToken = "";
        if (b?.parent) {
          const p = list.find((x) => x.id === b.parent);
          if (!p) return fail(404, "التعليق اللي ترد عليه انحذف.");
          parent = p.parent || p.id; // مستوى واحد من الردود
          parentToken = p.token || "";
        }
        const c = { id: newId(), name, text, ts: Date.now(), edited: 0, token, parent, owner: admin, likes: {} };
        list.push(c);
        await store.setJSON(`comments:${id}`, list);
        await addActivity(store, {
          id: newId(), type: parent ? "reply" : "comment", postId: id, postTitle: post.title,
          commentId: c.id, name, text: text.slice(0, 90), ts: c.ts, owner: admin, by: token, parentToken,
        });
        return json({ comment: sanitizeComment(c, token, admin) });
      }

      if (parts[2] === "comments" && parts.length === 5 && parts[4] === "like" && method === "POST") {
        if (!token) return fail(400, "تعذر تحديد الجهاز.");
        const list = (await store.get(`comments:${id}`, { type: "json" })) || [];
        const c = list.find((x) => x.id === parts[3]);
        if (!c) return fail(404, "ما لقينا هذا التعليق.");
        c.likes = c.likes || {};
        if (c.likes[token]) delete c.likes[token]; else c.likes[token] = 1;
        await store.setJSON(`comments:${id}`, list);
        return json({ likes: Object.keys(c.likes).length, liked: !!c.likes[token] });
      }

      if (parts[2] === "comments" && parts.length === 4 && (method === "PUT" || method === "DELETE")) {
        const cid = parts[3];
        const list = (await store.get(`comments:${id}`, { type: "json" })) || [];
        const i = list.findIndex((c) => c.id === cid);
        if (i < 0) return fail(404, "ما لقينا هذا التعليق.");
        const mine = !!token && list[i].token === token;
        if (!admin && !mine) return fail(403, "تقدر تعدّل أو تحذف تعليقاتك فقط.");
        if (method === "DELETE") {
          const gone = new Set([cid, ...list.filter((c) => c.parent === cid).map((c) => c.id)]);
          const next = list.filter((c) => !gone.has(c.id));
          await store.setJSON(`comments:${id}`, next);
          await dropActivity(store, (e) => e.postId === id && gone.has(e.commentId));
        } else {
          const b = await readJson(req);
          const text = clean(b?.text, MAX_COMMENT);
          if (!text) return fail(400, "اكتب نص التعليق.");
          list[i] = { ...list[i], text, edited: Date.now() };
          await store.setJSON(`comments:${id}`, list);
        }
        return json({ ok: true });
      }
    }

    return fail(404, "غير موجود.");
  } catch (e) {
    console.error(e);
    return fail(500, "صار خطأ في الخادم. حاول مرة ثانية.");
  }
}

export const config = { path: "/api/*" };
