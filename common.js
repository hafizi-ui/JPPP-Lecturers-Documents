/* Portal Tandatangan – fungsi kongsi (API, sesi, UI kecil) */
(function () {
  'use strict';
  var CFG = window.PORTAL_CONFIG || {};
  var DEMO = !CFG.API_URL;

  // ---------- Storan selamat ----------
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { } }
  };

  var session = { token: store.get('pt_token'), user: null };

  // ---------- API ----------
  function api(action, params) {
    params = params || {};
    if (DEMO) {
      return window.DemoAPI.call(action, params, session.token).then(null, handleErr);
    }
    return fetch(CFG.API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: action, params: params, token: session.token }),
      redirect: 'follow'
    }).then(function (res) {
      if (!res.ok) throw new Error('Pelayan tidak dapat dihubungi (' + res.status + ').');
      return res.json();
    }, function () {
      throw new Error('Tiada sambungan ke pelayan. Semak internet anda.');
    }).then(function (j) {
      if (!j.ok) throw new Error(j.error || 'Ralat tidak diketahui');
      return j.data;
    }).then(null, handleErr);
  }
  function handleErr(e) {
    if (e && e.message === 'SESI_TAMAT') {
      clearSession();
      if (window.App) window.App.showLogin('Sesi anda telah tamat. Sila log masuk semula.');
      throw new Error('Sesi tamat');
    }
    throw e;
  }
  function setSession(token, user) { session.token = token; session.user = user; store.set('pt_token', token); }
  function clearSession() { session.token = null; session.user = null; store.del('pt_token'); }

  // ---------- Pemuat skrip (pdf.js, pdf-lib, qrcode) ----------
  var LIBS = {
    pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfjsWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    pdflib: 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
    qrcode: 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'
  };
  var loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = function () { delete loaded[src]; reject(new Error('Gagal memuatkan ' + src)); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }
  function loadPdfLibs() {
    return Promise.all([loadScript(LIBS.pdfjs), loadScript(LIBS.pdflib), loadScript(LIBS.qrcode)]).then(function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfjsWorker;
    });
  }

  // ---------- UI kecil ----------
  function $(id) { return document.getElementById(id); }
  function show(el, on) { (typeof el === 'string' ? $(el) : el).hidden = !on; }
  function toast(msg, isErr) {
    var t = $('toast');
    t.textContent = msg; t.className = 'show' + (isErr ? ' err' : '');
    clearTimeout(t._h); t._h = setTimeout(function () { t.className = ''; }, isErr ? 6000 : 3200);
  }
  function openModal(id) { $(id).classList.add('show'); }
  function closeModal(id) { $(id).classList.remove('show'); }
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-close]');
    if (c) closeModal(c.getAttribute('data-close'));
    if (e.target.classList && e.target.classList.contains('modal-bg') && e.target.id !== 'mPdpa' && e.target.id !== 'mBatch') closeModal(e.target.id);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var open = document.querySelector('.modal-bg.show');
      if (open && open.id !== 'mPdpa') closeModal(open.id);
    }
  });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function badge(status) {
    return '<span class="badge b-' + String(status).split(' ')[0] + '">' + esc(status) + '</span>';
  }
  function todayStr() {
    var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  function daysLeft(due) {
    if (!due) return null;
    return Math.round((new Date(due + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 86400000);
  }
  function fmtDate(due) { if (!due) return ''; var p = due.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function dueHtml(due, active) {
    if (!due) return '<span class="muted">–</span>';
    var n = daysLeft(due), txt = fmtDate(due);
    if (!active) return '<span class="due">' + txt + '</span>';
    var cls = n <= 2 ? 'due-red' : n <= 3 ? 'due-amber' : '';
    var note = n < 0 ? 'lewat ' + (-n) + ' hari' : n === 0 ? 'hari ini' : n === 1 ? 'esok' : n + ' hari lagi';
    return '<span class="due ' + cls + '">' + txt + '<small>' + note + '</small></span>';
  }
  function fmtDT(s) {
    if (!s) return '';
    var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
    return m ? m[3] + '/' + m[2] + '/' + m[1] + m[4] : s;
  }
  /** 'yyyy-MM-dd HH:mm' (waktu Malaysia) -> Date */
  function parseDT(s) { return s ? new Date(String(s).replace(' ', 'T') + ':00+08:00') : null; }
  /** Status tempoh muat turun PDF bertandatangan. */
  function expiryInfo(until) {
    var d = parseDT(until);
    if (!d || isNaN(d)) return { expired: false, left: '', until: '' };
    var ms = d - Date.now(), h = Math.floor(ms / 3600000);
    var left = ms <= 0 ? '' : h >= 24 ? Math.floor(h / 24) + ' hari ' + (h % 24) + ' jam lagi' : h >= 1 ? h + ' jam lagi' : Math.max(1, Math.ceil(ms / 60000)) + ' minit lagi';
    return { expired: ms <= 0, left: left, until: fmtDT(until), soon: ms > 0 && ms < 24 * 3600000 };
  }
  function initials(name) {
    return String(name || '?').replace(/\b(bin|binti|bt|b\.)\b/gi, '').trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
  }
  function b64ToBytes(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64(bytes) {
    var s = '', chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  }
  function readFileB64(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(',')[1] || ''); };
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }
  function downloadB64(name, b64, mime) {
    var blob = new Blob([b64ToBytes(b64)], { type: mime || 'application/pdf' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn._label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> ' + (label || 'Sila tunggu…'); }
    else { btn.disabled = false; if (btn._label) btn.innerHTML = btn._label; }
  }

  // isi teks tetapan (nama jabatan dll.)
  document.querySelectorAll('[data-cfg]').forEach(function (el) { el.textContent = CFG[el.getAttribute('data-cfg')] || ''; });

  window.P = {
    CFG: CFG, DEMO: DEMO, session: session, store: store,
    api: api, setSession: setSession, clearSession: clearSession, loadPdfLibs: loadPdfLibs,
    $: $, show: show, toast: toast, openModal: openModal, closeModal: closeModal,
    esc: esc, badge: badge, todayStr: todayStr, daysLeft: daysLeft, fmtDate: fmtDate, dueHtml: dueHtml, fmtDT: fmtDT,
    initials: initials, parseDT: parseDT, expiryInfo: expiryInfo, b64ToBytes: b64ToBytes, bytesToB64: bytesToB64, readFileB64: readFileB64, downloadB64: downloadB64, busy: busy
  };
})();
