/* Portal Tandatangan – paparan Ketua Jabatan (senarai, semakan, tandatangan, tetapan) */
(function () {
  'use strict';
  var $ = P.$, esc = P.esc, badge = P.badge;
  var PENDING = ['Dihantar', 'Dalam Semakan'];
  var DATE_RE = /^(tarikh|date)\b/i;
  var REASONS = ['Format tidak betul', 'Lampiran tidak lengkap', 'Maklumat tidak lengkap', 'Perlu semakan Ketua Program dahulu', 'Sila betulkan kesilapan ejaan/fakta', 'Tarikh tidak tepat'];
  var S = { data: null, tab: 'pending', sel: {}, sig: null, stamp: null, R: null, batch: [], started: false };

  // ================= MULA =================
  function start(user) {
    $('btnExtend').textContent = 'Lanjutkan ' + dlDays() + ' hari';
    $('hodName').textContent = user.nama.split(' ').slice(0, 2).join(' ');
    if (!S.started) bind();
    S.started = true;
    Promise.all([loadAll(), loadAssets(), P.loadPdfLibs()]).catch(function (e) { P.toast(e.message, true); });
  }

  function loadAll() {
    return P.api('hodInit').then(function (d) {
      S.data = d;
      P.show('noSig', !d.hasSignature && !S.sig);
      var fj = $('fJenis'), cur = fj.value;
      fj.innerHTML = '<option value="">Semua jenis</option>' + d.docTypes.map(function (t) { return '<option>' + esc(t.jenis) + '</option>'; }).join('');
      fj.value = cur;
      renderList();
      if (S.tab === 'settings') renderSettings();
    });
  }
  function loadAssets() {
    return P.api('getAssets').then(function (a) {
      return Promise.all([mkAsset(a.sig), mkAsset(a.stamp)]).then(function (r) { S.sig = r[0]; S.stamp = r[1]; showAssets(); });
    });
  }
  function mkAsset(b64) {
    if (!b64) return Promise.resolve(null);
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () { res({ b64: b64, bytes: P.b64ToBytes(b64), url: img.src, ar: img.naturalHeight / img.naturalWidth, img: img }); };
      img.onerror = function () { res(null); };
      img.src = 'data:image/png;base64,' + b64;
    });
  }
  function cfgFor(jenis) {
    var list = (S.data && S.data.docTypes) || [];
    return list.filter(function (t) { return t.jenis === jenis; })[0] ||
      list.filter(function (t) { return t.jenis === 'Lain-lain'; })[0] ||
      { jenis: jenis, kataKunci: 'Disemak Oleh|Verified by', dx: 0, dy: 48, lebar: 110 };
  }
  function rowOf(ref) { return S.data.requests.filter(function (r) { return r.refNo === ref; })[0]; }

  // ================= IKATAN =================
  function bind() {
    $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setTab(b.dataset.t); });
    $('fJenis').addEventListener('change', renderList);
    $('fQ').addEventListener('input', renderList);
    $('btnReloadAll').addEventListener('click', function () { loadAll().catch(function (e) { P.toast(e.message, true); }); });
    $('goSettings').addEventListener('click', function (e) { e.preventDefault(); setTab('settings'); });
    $('btnOpenBatch').addEventListener('click', openBatch);
    $('btnClearSel').addEventListener('click', function () { S.sel = {}; renderList(); });
    $('hodStats').addEventListener('click', function (e) { var t = e.target.closest('[data-tab]'); if (t) setTab(t.dataset.tab); });

    $('list').addEventListener('click', function (e) {
      if (e.target.matches('input')) return;
      var cell = e.target.closest('.c-sel');
      if (cell) { var cb = cell.querySelector('input'); if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); } return; }
      var tr = e.target.closest('[data-ref]'); if (tr) openReview(tr.dataset.ref);
    });
    $('list').addEventListener('keydown', function (e) {
      var tr = e.target.closest && e.target.closest('tr[data-ref]');
      if (tr && e.target === tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openReview(tr.dataset.ref); }
    });
    $('list').addEventListener('change', function (e) {
      var c = e.target;
      if (c.id === 'selAll') { visibleRows().forEach(function (r) { if (c.checked) S.sel[r.refNo] = 1; else delete S.sel[r.refNo]; }); renderList(); return; }
      if (c.classList.contains('sel')) { if (c.checked) S.sel[c.dataset.ref] = 1; else delete S.sel[c.dataset.ref]; updateSel(); }
    });

    $('btnCloseReview').addEventListener('click', closeReview);
    $('btnSign').addEventListener('click', doSign);
    $('btnReturn').addEventListener('click', function () { openDecide('return'); });
    $('btnReject').addEventListener('click', function () { openDecide('reject'); });
    $('btnNext').addEventListener('click', function () { gotoNext(); });
    $('btnDecide').addEventListener('click', doDecide);
    $('btnDlHod').addEventListener('click', function () {
      var b = this, ref = S.R && S.R.ref; P.busy(b, true, '');
      P.api('downloadSigned', { ref: ref }).then(function (f) { P.downloadB64(f.name, f.data); })
        .catch(function (e) { P.toast(e.message, true); }).then(function () { P.busy(b, false); });
    });
    $('btnExtend').addEventListener('click', function () {
      var b = this, R = S.R; if (!R) return; P.busy(b, true, 'Membuka…');
      P.api('extendDownload', { ref: R.ref }).then(function (res) {
        R.row.muatTurunHingga = res.muatTurunHingga; showSignedInfo(R.row); renderList();
        P.toast('Pensyarah boleh muat turun sehingga ' + P.fmtDT(res.muatTurunHingga));
      }).catch(function (e) { P.toast(e.message, true); }).then(function () { P.busy(b, false); });
    });
    $('btnBatch').addEventListener('click', doBatch);
    $('oDate').addEventListener('change', drawOverlays);
    $('oQr').addEventListener('change', drawOverlays);
    $('oStamp').addEventListener('change', function () {
      var D = S.R && S.R.D; if (!D) return;
      D.ovs = D.ovs.filter(function (o) { return o.kind !== 'stamp'; });
      if (this.checked && S.stamp) D.ovs.push(stampOverlay(getOv('sig')));
      drawOverlays();
    });
    document.addEventListener('keydown', function (e) {
      if (!S.R || document.querySelector('.modal-bg.show')) return;
      if (e.key === 'Escape') closeReview();
    });

    // tetapan
    $('sigFile').addEventListener('change', function () { if (this.files[0]) uploadAsset('sig', this.files[0], $('sigClean').checked); this.value = ''; });
    $('stampFile').addEventListener('change', function () { if (this.files[0]) uploadAsset('stamp', this.files[0], true); this.value = ''; });
    $('btnAddDt').addEventListener('click', function () {
      $('dtList').querySelector('tbody').insertAdjacentHTML('beforeend', dtRow({ jenis: '', kataKunci: 'Disemak Oleh|Verified by', dx: 0, dy: 48, lebar: 110 }));
    });
    $('dtList').addEventListener('click', function (e) { var b = e.target.closest('button[data-save]'); if (b) saveDt(b); });
    $('btnAddStaff').addEventListener('click', addStaff);
    $('staffList').addEventListener('change', function (e) {
      var c = e.target; if (!c.dataset.email) return;
      P.api('setStaffActive', { email: c.dataset.email, aktif: c.checked })
        .then(function () { P.toast(c.checked ? 'Diaktifkan' : 'Dinyahaktifkan'); }).catch(function (err) { P.toast(err.message, true); });
    });
    $('staffList').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-reset]'); if (!b) return;
      if (!confirmInline(b, 'Pasti?')) return;
      P.busy(b, true, '');
      P.api('resetPassword', { email: b.dataset.reset }).then(function () { P.toast('Kata laluan sementara diemelkan kepada ' + b.dataset.reset); })
        .catch(function (err) { P.toast(err.message, true); }).then(function () { P.busy(b, false); b.textContent = 'Set semula'; b._armed = false; });
    });
    initPad();
  }
  function confirmInline(btn, label) {
    if (btn._armed) return true;
    btn._armed = true; var old = btn.textContent; btn.textContent = label; btn.classList.add('armed');
    setTimeout(function () { btn._armed = false; btn.textContent = old; btn.classList.remove('armed'); }, 3000);
    return false;
  }

  // ================= SENARAI =================
  function setTab(t) {
    S.tab = t;
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
    P.show('hodList', t !== 'settings');
    P.show('hodSettings', t === 'settings');
    if (t === 'settings') { renderSettings(); setTimeout(fitPad, 30); } else renderList();
    window.scrollTo(0, 0);
  }
  function inTab(r, t) {
    if (t === 'pending') return PENDING.indexOf(r.status) >= 0;
    if (t === 'returned') return r.status === 'Dikembalikan';
    if (t === 'done') return r.status === 'Ditandatangani' || r.status === 'Ditolak';
    return true;
  }
  function visibleRows(tab) {
    tab = tab || S.tab;
    var j = $('fJenis').value, q = $('fQ').value.toLowerCase().trim();
    var rows = S.data.requests.filter(function (r) {
      return inTab(r, tab) && (!j || r.jenis === j) &&
        (!q || (r.nama + ' ' + r.tajuk + ' ' + r.refNo + ' ' + r.jenis).toLowerCase().indexOf(q) >= 0);
    });
    if (tab === 'pending') rows.sort(function (a, b) {
      var x = a.tarikhPerlu || '9999', y = b.tarikhPerlu || '9999';
      return x < y ? -1 : x > y ? 1 : (a.dihantarPada < b.dihantarPada ? -1 : 1);
    });
    else rows.sort(function (a, b) { return a.dikemaskiniPada < b.dikemaskiniPada ? 1 : -1; });
    return rows;
  }
  function renderStats() {
    var all = S.data.requests;
    var pend = all.filter(function (r) { return inTab(r, 'pending'); });
    var urgent = pend.filter(function (r) { return r.tarikhPerlu && P.daysLeft(r.tarikhPerlu) <= 2; }).length;
    var monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    var signed30 = all.filter(function (r) { return r.status === 'Ditandatangani' && (r.ditandatanganiPada || '') >= monthAgo; }).length;
    var ret = all.filter(function (r) { return r.status === 'Dikembalikan'; }).length;
    $('hodStats').innerHTML = [
      ['pending', 'Perlu tandatangan', pend.length, 'blue'],
      ['pending', 'Segera (≤ 2 hari)', urgent, 'red'],
      ['returned', 'Menunggu pembetulan', ret, 'amber'],
      ['done', 'Ditandatangani (30 hari)', signed30, 'green']
    ].map(function (s) {
      return '<button class="stat stat-' + s[3] + '" data-tab="' + s[0] + '"><div class="stat-n">' + s[2] + '</div><div class="stat-l">' + s[1] + '</div></button>';
    }).join('');
    $('hodSummary').textContent = pend.length
      ? pend.length + ' dokumen menunggu tandatangan anda' + (urgent ? ', ' + urgent + ' daripadanya segera.' : '.')
      : 'Tiada dokumen menunggu. Semua sudah selesai.';
  }
  function renderList() {
    if (!S.data) return;
    var all = S.data.requests;
    ['pending', 'returned', 'done'].forEach(function (t) {
      var el = $('n-' + t); el.textContent = all.filter(function (r) { return inTab(r, t); }).length;
      if (t === 'pending') el.classList.toggle('hot', all.some(function (r) { return inTab(r, 'pending') && r.tarikhPerlu && P.daysLeft(r.tarikhPerlu) <= 2; }));
    });
    renderStats();
    var rows = visibleRows(), pend = S.tab === 'pending', el = $('list');
    if (!rows.length) {
      el.innerHTML = '<div class="empty">' + (pend ? '<b>Tiada dokumen menunggu tandatangan.</b><br>Anda sudah selesai semua.' : 'Tiada rekod.') + '</div>';
      updateSel(); return;
    }
    el.innerHTML = '<table class="list"><thead><tr>' + (pend ? '<th class="c-sel"><input type="checkbox" id="selAll" aria-label="Pilih semua"></th>' : '') +
      '<th>Pensyarah</th><th>Dokumen</th><th>Tarikh perlu</th><th>Status</th><th>Dihantar</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var active = PENDING.indexOf(r.status) >= 0;
        return '<tr class="click" tabindex="0" data-ref="' + esc(r.refNo) + '">' +
          (pend ? '<td class="c-sel"><input type="checkbox" class="sel" data-ref="' + esc(r.refNo) + '"' + (S.sel[r.refNo] ? ' checked' : '') + ' aria-label="Pilih"></td>' : '') +
          '<td class="c-who"><span class="avatar sm">' + esc(P.initials(r.nama)) + '</span><div><b>' + esc(r.nama) + '</b><div class="muted tiny">' + esc(r.refNo) + '</div></div></td>' +
          '<td class="c-doc"><div class="doc-title">' + esc(r.tajuk) + '</div><div class="muted tiny">' + esc(r.jenis) + (Number(r.versi) > 1 ? ' · v' + esc(r.versi) : '') + '</div>' +
          (r.catatan ? '<div class="note">“' + esc(r.catatan) + '”</div>' : '') + '</td>' +
          '<td class="c-due">' + P.dueHtml(r.tarikhPerlu, active) + '</td>' +
          '<td class="c-status">' + badge(r.status) + (r.status === 'Ditandatangani' && r.muatTurunHingga
            ? (isGone(r) ? '<div class="muted tiny">Fail dipadam</div>' : '<div class="muted tiny">Muat turun: ' + esc(P.expiryInfo(r.muatTurunHingga).left) + '</div>') : '') + '</td><td class="c-when muted tiny">' + P.fmtDT(r.dihantarPada) + '</td></tr>';
      }).join('') + '</tbody></table>';
    updateSel();
  }
  function updateSel() {
    var n = Object.keys(S.sel).filter(function (k) { var r = rowOf(k); return r && PENDING.indexOf(r.status) >= 0; }).length;
    $('selCount').textContent = n;
    $('batchbar').classList.toggle('show', n > 0 && S.tab === 'pending');
  }

  // ================= ANALISIS PDF =================
  function textLines(tc) {
    var items = tc.items.filter(function (it) { return it.str && it.transform; }).map(function (it) {
      var t = it.transform;
      return { str: it.str.replace(/\s+/g, ' '), x: t[4], y: t[5], w: it.width || 0, h: Math.hypot(t[2], t[3]) || it.height || 10 };
    });
    items.sort(function (a, b) { return Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x; });
    var lines = [];
    items.forEach(function (it) {
      var L = lines[lines.length - 1];
      if (!L || Math.abs(L.y - it.y) > 2) { L = { y: it.y, items: [], text: '' }; lines.push(L); }
      var prev = L.items[L.items.length - 1];
      if (!L.text || /\s$/.test(L.text)) it.str = it.str.replace(/^\s+/, '');
      else if (!/^\s/.test(it.str) && prev && it.x - (prev.x + prev.w) > it.h * 0.15) L.text += ' ';
      if (!it.str) return;
      it.start = L.text.length; L.text += it.str; L.items.push(it);
    });
    return lines;
  }
  function hitsIn(lines, kw, pageIdx) {
    var out = [];
    kw = kw.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!kw) return out;
    lines.forEach(function (L) {
      var low = L.text.toLowerCase(), i = low.indexOf(kw);
      while (i >= 0) {
        var it = L.items.filter(function (x) { return x.start <= i; }).pop() || L.items[0];
        var frac = it.str.length ? Math.min(1, (i - it.start) / it.str.length) : 0;
        out.push({ page: pageIdx, x: it.x + it.w * frac, y: L.y, h: it.h, kw: kw });
        i = low.indexOf(kw, i + kw.length);
      }
    });
    return out;
  }
  function dateLabels(lines, pageIdx) {
    var out = [];
    lines.forEach(function (L) {
      L.items.forEach(function (it) {
        if (!DATE_RE.test(it.str.trim())) return;
        var w = it.w, colon = L.items.filter(function (c) { return c.x > it.x && c.x - (it.x + it.w) < 80 && /^\s*:\s*$/.test(c.str); })[0];
        if (!/:/.test(it.str) && colon) w = colon.x + colon.w - it.x;
        out.push({ page: pageIdx, x: it.x, y: L.y, w: w, str: it.str });
      });
    });
    return out;
  }
  function analyze(bytes, jenis) {
    var cfg = cfgFor(jenis);
    return pdfjsLib.getDocument({ data: bytes.slice() }).promise.then(function (pdf) {
      var jobs = [];
      for (var i = 1; i <= pdf.numPages; i++) jobs.push(pdf.getPage(i));
      return Promise.all(jobs).then(function (pages) {
        return Promise.all(pages.map(function (p) { return p.getTextContent(); })).then(function (tcs) {
          var D = { pdf: pdf, pages: pages, bytes: bytes, cfg: cfg, lines: tcs.map(textLines), anchors: [], dates: [] };
          D.lines.forEach(function (ls, i) { D.dates = D.dates.concat(dateLabels(ls, i)); });
          var kws = String(cfg.kataKunci || '').split('|');
          for (var k = 0; k < kws.length && !D.anchors.length; k++) {
            D.lines.forEach(function (ls, i) { D.anchors = D.anchors.concat(hitsIn(ls, kws[k], i)); });
          }
          D.anchors.sort(function (a, b) {
            if (a.page !== b.page) return a.page - b.page;
            return Math.abs(a.y - b.y) < 30 ? a.x - b.x : b.y - a.y;
          });
          D.ovs = defaultOverlays(D);
          return D;
        });
      });
    });
  }
  function pageBox(D, i) { var v = D.pages[i].view; return { x: v[0], y: v[1], w: v[2] - v[0], h: v[3] - v[1] }; }
  function sigAr() { return S.sig ? S.sig.ar : 0.4; }
  function defaultOverlays(D) {
    var a = D.anchors[0], cfg = D.cfg, w = cfg.lebar || 110, h = w * sigAr(), sig;
    if (a) sig = { kind: 'sig', page: a.page, x: a.x + cfg.dx, y: a.y - cfg.dy, w: w, h: h };
    else {
      var last = D.pages.length - 1, b = pageBox(D, last);
      sig = { kind: 'sig', page: last, x: b.x + b.w / 2 - w / 2, y: b.y + 120, w: w, h: h };
    }
    D.found = !!a;
    return [sig, dateOverlay(D, sig), qrOverlay(D, sig.page)];
  }
  function dateOverlay(D, sig) {
    var text = P.fmtDate(P.todayStr()), size = 10, tw = text.length * size * 0.52;
    var cand = D.dates.filter(function (d) {
      return d.page === sig.page && d.y < sig.y + sig.h * 0.3 && d.y > sig.y - 80 && Math.abs(d.x - sig.x) < 130;
    }).sort(function (p, q) { return q.y - p.y; })[0];
    if (cand) return { kind: 'date', page: sig.page, x: cand.x + cand.w + 4, y: cand.y, w: tw, h: size, size: size, text: text, auto: true };
    return { kind: 'date', page: sig.page, x: sig.x + 8, y: sig.y - 12, w: tw, h: size, size: size, text: text, auto: true };
  }
  function qrOverlay(D, page) {
    var b = pageBox(D, page), s = 46;
    return { kind: 'qr', page: page, x: b.x + b.w - s - 16, y: b.y + 14, w: s, h: s + 12 };
  }
  function stampOverlay(sig) {
    var w = 90, ar = S.stamp ? S.stamp.ar : 1;
    return { kind: 'stamp', page: sig.page, x: sig.x + sig.w + 6, y: sig.y, w: w, h: w * ar };
  }

  // ================= SKRIN SEMAKAN =================
  function openReview(ref) {
    var r = rowOf(ref); if (!r) return;
    var editable = PENDING.indexOf(r.status) >= 0;
    if (editable && !S.sig) { P.toast('Sila muat naik tandatangan di Tetapan dahulu.', true); setTab('settings'); return; }
    S.R = { ref: ref, row: r, editable: editable };
    P.show('vReview', true);
    document.body.classList.add('no-scroll');
    $('rvRef').textContent = r.refNo;
    $('rvBadge').innerHTML = badge(r.status);
    $('rvInfo').innerHTML =
      '<div><span>Pensyarah</span>' + esc(r.nama) + '<small>' + esc(r.email || '') + '</small></div>' +
      '<div><span>Jenis</span>' + esc(r.jenis) + '</div><div><span>Tajuk</span>' + esc(r.tajuk) + '</div>' +
      '<div><span>Tarikh perlu</span>' + P.dueHtml(r.tarikhPerlu, editable) + '</div>' +
      (r.catatan ? '<div><span>Catatan</span>' + esc(r.catatan) + '</div>' : '') +
      (r.komen ? '<div><span>Komen terdahulu</span>' + esc(r.komen) + '</div>' : '') +
      '<div><span>Fail</span>' + esc(r.namaFail) + (Number(r.versi) > 1 ? ' (v' + esc(r.versi) + ')' : '') +
      (r.fileUrl && r.fileUrl !== '#' ? ' · <a href="' + esc(r.fileUrl) + '" target="_blank" rel="noopener">buka asal</a>' : '') + '</div>';
    P.show('rvOpts', editable); P.show('rvActions', editable);
    P.show('rvSigned', r.status === 'Ditandatangani');
    if (r.status === 'Ditandatangani') showSignedInfo(r);
    $('oStamp').checked = false; P.show('oStampWrap', !!S.stamp);
    $('oRemember').checked = false;
    P.show('rvHint', false);
    var pagesEl = $('pages');
    if (isGone(r)) {
      pagesEl.innerHTML = '<div class="loading-doc gone"><b>Fail telah dipadam kekal</b><br>Tempoh simpanan tamat' +
        (r.failDipadam ? ' (' + esc(P.fmtDT(r.failDipadam)) + ')' : '') + '. Rekod dan semakan QR masih disimpan.</div>';
      return;
    }
    pagesEl.innerHTML = '<div class="loading-doc"><span class="spinner"></span> Memuatkan dokumen…</div>';
    Promise.all([P.api('getPdf', { ref: ref }), P.loadPdfLibs()]).then(function (res) {
      var b64 = res[0];
      if (!S.R || S.R.ref !== ref) return;
      if (r.status === 'Dihantar') { r.status = 'Dalam Semakan'; $('rvBadge').innerHTML = badge(r.status); renderList(); }
      return analyze(P.b64ToBytes(b64), r.jenis).then(function (D) {
        if (!S.R || S.R.ref !== ref) { D.pdf.destroy(); return; }
        S.R.D = D;
        if (!editable) D.ovs = [];
        return renderPages(D).then(function () {
          if (editable) {
            P.show('rvHint', true);
            $('rvHint').innerHTML = D.found
              ? 'Tandatangan diletakkan automatik di <b>“' + esc(D.anchors[0].kw) + '”</b> (m/s ' + (D.anchors[0].page + 1) + ').' +
                (D.anchors.length > 1 ? ' Ada <b>' + D.anchors.length + ' slot</b>; klik label kuning untuk tukar.' : '') + ' Seret untuk laras.'
              : 'Slot tandatangan tidak dijumpai. <b>Klik pada halaman</b> di tempat tandatangan patut diletakkan.';
          }
          var sig = D.ovs.filter(function (o) { return o.kind === 'sig'; })[0];
          if (sig) scrollToOv(sig);
        });
      });
    }).catch(function (e) { P.toast(e.message, true); pagesEl.innerHTML = '<div class="loading-doc">Gagal memuatkan: ' + esc(e.message) + '</div>'; });
  }
  function isGone(r) { return r.status === 'Ditandatangani' && (!!r.failDipadam || P.expiryInfo(r.muatTurunHingga).expired); }
  function showSignedInfo(r) {
    var e = P.expiryInfo(r.muatTurunHingga), el = $('rvSignedInfo'), gone = isGone(r);
    el.className = 'dl-window' + (gone ? ' expired' : e.soon ? ' soon' : '');
    el.innerHTML = gone
      ? '<b>Fail telah dipadam kekal</b> dari Drive selepas tempoh muat turun tamat (' + esc(e.until) + ').'
      : 'Pensyarah boleh muat turun sehingga <b>' + esc(e.until) + '</b> <span>(' + esc(e.left) + ')</span>. Selepas itu fail <b>dipadam kekal</b>.';
    P.show('btnDlHod', !gone); P.show('btnExtend', !gone);
  }
  function closeReview() {
    P.show('vReview', false);
    document.body.classList.remove('no-scroll');
    $('pages').innerHTML = '';
    if (S.R && S.R.D) S.R.D.pdf.destroy();
    S.R = null;
    renderList();
  }
  function renderPages(D) {
    var host = $('pages');
    host.innerHTML = '';
    var maxW = Math.min(host.clientWidth - (window.innerWidth > 900 ? 96 : 24), 920);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    D.el = []; D.vp = [];
    return D.pages.reduce(function (p, page, i) {
      return p.then(function () {
        var vp1 = page.getViewport({ scale: 1 });
        var vp = page.getViewport({ scale: maxW / vp1.width });
        var div = document.createElement('div');
        div.className = 'pg'; div.style.width = vp.width + 'px'; div.style.height = vp.height + 'px';
        div.innerHTML = '<span class="pgno">' + (i + 1) + '</span>';
        var cv = document.createElement('canvas');
        cv.width = Math.floor(vp.width * dpr); cv.height = Math.floor(vp.height * dpr);
        div.appendChild(cv); host.appendChild(div);
        D.el[i] = div; D.vp[i] = vp;
        div.addEventListener('click', function (e) {
          if (!S.R || !S.R.editable || e.target !== cv) return;
          var rc = div.getBoundingClientRect();
          placeSigAt(i, e.clientX - rc.left, e.clientY - rc.top);
        });
        return page.render({ canvasContext: cv.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise;
      });
    }, Promise.resolve()).then(function () {
      if (S.R && S.R.editable) {
        D.anchors.forEach(function (a, n) {
          var pt = D.vp[a.page].convertToViewportPoint(a.x, a.y);
          var s = document.createElement('button');
          s.type = 'button'; s.className = 'slot'; s.textContent = 'Slot ' + (n + 1);
          s.style.left = pt[0] + 'px'; s.style.top = pt[1] + 'px';
          s.addEventListener('click', function (e) { e.stopPropagation(); placeAtAnchor(a); });
          D.el[a.page].appendChild(s);
        });
      }
      drawOverlays();
    });
  }
  function ovRect(D, o) {
    var r = D.vp[o.page].convertToViewportRectangle([o.x, o.y, o.x + o.w, o.y + o.h]);
    return { left: Math.min(r[0], r[2]), top: Math.min(r[1], r[3]), width: Math.abs(r[2] - r[0]), height: Math.abs(r[3] - r[1]) };
  }
  function drawOverlays() {
    var D = S.R && S.R.D; if (!D || !D.el) return;
    document.querySelectorAll('#pages .ov').forEach(function (n) { n.remove(); });
    var showDate = $('oDate').checked, showQr = $('oQr').checked;
    D.ovs.forEach(function (o) {
      if ((o.kind === 'date' && !showDate) || (o.kind === 'qr' && !showQr)) return;
      var rc = ovRect(D, o), el = document.createElement('div'), scale = D.vp[o.page].scale;
      el.className = 'ov ' + o.kind;
      el.style.left = rc.left + 'px'; el.style.top = rc.top + 'px'; el.style.width = rc.width + 'px'; el.style.height = rc.height + 'px';
      var tag = { sig: 'Tandatangan', stamp: 'Cop', date: 'Tarikh', qr: 'QR' }[o.kind];
      if (o.kind === 'sig') el.innerHTML = '<img alt="" src="' + S.sig.url + '">';
      if (o.kind === 'stamp') el.innerHTML = '<img alt="" src="' + S.stamp.url + '">';
      if (o.kind === 'date') { el.style.fontSize = (o.size * scale) + 'px'; el.textContent = o.text; }
      if (o.kind === 'qr') el.innerHTML = '<img alt="" src="' + qrDataUrl(verifyUrl(S.R.ref)) + '" style="height:' + (o.w * scale) + 'px">' +
        '<div class="qr-txt" style="font-size:' + (4.6 * scale) + 'px">' + esc(S.R.ref) + '</div>';
      el.insertAdjacentHTML('beforeend', '<span class="tag">' + tag + '</span>' + (o.kind === 'date' ? '' : '<span class="h" title="Ubah saiz"></span>'));
      D.el[o.page].appendChild(el);
      makeDraggable(el, o);
    });
  }
  function makeDraggable(el, o) {
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      var D = S.R.D, vp = D.vp[o.page], resize = e.target.classList.contains('h');
      var sx = e.clientX, sy = e.clientY, st = { x: o.x, y: o.y, w: o.w, h: o.h };
      el.setPointerCapture(e.pointerId); el.classList.add('dragging');
      function mv(ev) {
        var dx = (ev.clientX - sx) / vp.scale, dy = (ev.clientY - sy) / vp.scale;
        if (resize) { var nw = Math.max(20, st.w + dx), ar = st.h / st.w; o.w = nw; o.h = nw * ar; o.y = st.y + st.h - o.h; }
        else { o.x = st.x + dx; o.y = st.y - dy; }
        var rc = ovRect(D, o);
        el.style.left = rc.left + 'px'; el.style.top = rc.top + 'px'; el.style.width = rc.width + 'px'; el.style.height = rc.height + 'px';
        if (o.kind === 'qr') el.querySelector('img').style.height = (o.w * vp.scale) + 'px';
      }
      function up() {
        el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.classList.remove('dragging');
        if (o.kind === 'date') o.auto = false;
        if (o.kind === 'sig') followSig(o);
      }
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
    });
  }
  function plus48() {
    var d = new Date(Date.now() + dlDays() * 24 * 3600000 + 8 * 3600000); // waktu Malaysia
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
  function dlDays() { return Number(P.CFG.DOWNLOAD_DAYS) || 7; }
  function getOv(kind) { return S.R.D.ovs.filter(function (o) { return o.kind === kind; })[0]; }
  function followSig(sig) {
    var D = S.R.D, date = getOv('date');
    if (date && date.auto) { var nd = dateOverlay(D, sig); date.page = nd.page; date.x = nd.x; date.y = nd.y; }
    var qr = getOv('qr');
    if (qr && qr.page !== sig.page) { var nq = qrOverlay(D, sig.page); qr.page = nq.page; qr.x = nq.x; qr.y = nq.y; }
    var st = getOv('stamp');
    if (st && st.page !== sig.page) { var ns = stampOverlay(sig); st.page = ns.page; st.x = ns.x; st.y = ns.y; }
    drawOverlays();
  }
  function placeSigAt(page, cx, cy) {
    var D = S.R.D, sig = getOv('sig'), pt = D.vp[page].convertToPdfPoint(cx, cy);
    sig.page = page; sig.x = pt[0] - sig.w / 2; sig.y = pt[1] - sig.h / 2;
    var date = getOv('date'); if (date) date.auto = true;
    followSig(sig);
  }
  function placeAtAnchor(a) {
    var cfg = S.R.D.cfg, sig = getOv('sig');
    sig.page = a.page; sig.x = a.x + cfg.dx; sig.y = a.y - cfg.dy;
    var date = getOv('date'); if (date) date.auto = true;
    followSig(sig); scrollToOv(sig);
  }
  function scrollToOv(o) {
    var D = S.R.D, host = $('pages'), rc = ovRect(D, o);
    host.scrollTop = D.el[o.page].offsetTop + rc.top - host.clientHeight / 3;
  }

  // ================= CAP PDF =================
  function verifyUrl(ref) {
    return location.origin + location.pathname.replace(/[^/]*$/, '') + 'verify.html?ref=' + encodeURIComponent(ref);
  }
  function qrObj(text) { var q = qrcode(0, 'L'); q.addData(text); q.make(); return q; }
  function qrDataUrl(text) {
    var q = qrObj(text), n = q.getModuleCount(), c = document.createElement('canvas'), cell = 4;
    c.width = c.height = n * cell;
    var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000';
    for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(k * cell, r * cell, cell, cell);
    return c.toDataURL('image/png');
  }
  function stampPdf(bytes, ovs, ref, opts) {
    var PL = PDFLib;
    return PL.PDFDocument.load(bytes, { ignoreEncryption: true }).then(function (doc) {
      try { doc.getForm().flatten(); } catch (e) { }
      var pages = doc.getPages();
      return Promise.all([
        doc.embedFont(PL.StandardFonts.Helvetica),
        doc.embedPng(S.sig.bytes),
        S.stamp && opts.stamp ? doc.embedPng(S.stamp.bytes) : null
      ]).then(function (r) {
        var font = r[0], sigImg = r[1], stampImg = r[2], black = PL.rgb(0, 0, 0);
        ovs.forEach(function (o) {
          var p = pages[o.page];
          if (o.kind === 'sig') p.drawImage(sigImg, { x: o.x, y: o.y, width: o.w, height: o.h });
          if (o.kind === 'stamp' && stampImg) p.drawImage(stampImg, { x: o.x, y: o.y, width: o.w, height: o.h, opacity: 0.92 });
          if (o.kind === 'date' && opts.date) p.drawText(o.text, { x: o.x, y: o.y, size: o.size, font: font, color: black });
          if (o.kind === 'qr' && opts.qr) {
            var q = qrObj(verifyUrl(ref)), n = q.getModuleCount(), cell = o.w / n, top = o.y + o.h;
            p.drawRectangle({ x: o.x - 2, y: o.y - 2, width: o.w + 4, height: o.h + 4, color: PL.rgb(1, 1, 1) });
            for (var rr = 0; rr < n; rr++) for (var cc = 0; cc < n; cc++) {
              if (q.isDark(rr, cc)) p.drawRectangle({ x: o.x + cc * cell, y: top - (rr + 1) * cell, width: cell + 0.02, height: cell + 0.02, color: black });
            }
            var fs = 4.6, tw = font.widthOfTextAtSize(ref, fs);
            p.drawText(ref, { x: o.x + (o.w - tw) / 2, y: o.y + 6, size: fs, font: font, color: black });
            var t2 = 'e-Tandatangan', tw2 = font.widthOfTextAtSize(t2, fs);
            p.drawText(t2, { x: o.x + (o.w - tw2) / 2, y: o.y + 0.5, size: fs, font: font, color: PL.rgb(.35, .35, .35) });
          }
        });
        doc.setSubject('Ditandatangani secara elektronik – ' + ref);
        doc.setKeywords([ref, 'e-tandatangan']);
        doc.setModificationDate(new Date());
        return doc.save();
      });
    });
  }
  function doSign() {
    var R = S.R; if (!R || !R.D) return;
    var btn = $('btnSign'); P.busy(btn, true, 'Menandatangan…');
    var D = R.D, sig = getOv('sig'), pos = null;
    if ($('oRemember').checked) {
      var a = D.anchors.filter(function (x) { return x.page === sig.page; })
        .sort(function (p, q) { return Math.hypot(p.x - sig.x, p.y - sig.y) - Math.hypot(q.x - sig.x, q.y - sig.y); })[0];
      if (a) pos = { jenis: R.row.jenis, dx: sig.x - a.x, dy: a.y - sig.y, lebar: sig.w };
      else P.toast('Tiada kata kunci di muka surat ini; kedudukan tidak disimpan.', true);
    }
    var opts = { date: $('oDate').checked, qr: $('oQr').checked, stamp: $('oStamp').checked };
    stampPdf(D.bytes, D.ovs, R.ref, opts).then(function (out) {
      return P.api('sign', { ref: R.ref, pdf: P.bytesToB64(out), pos: pos });
    }).then(function () {
      R.row.status = 'Ditandatangani'; R.row.ditandatanganiPada = P.todayStr(); R.row.muatTurunHingga = plus48();
      if (pos) { D.cfg.dx = pos.dx; D.cfg.dy = pos.dy; D.cfg.lebar = pos.lebar; }
      delete S.sel[R.ref];
      P.toast('Ditandatangani: ' + R.ref);
      gotoNext(R.ref);
    }).catch(function (e) { P.toast(e.message, true); }).then(function () { P.busy(btn, false); });
  }
  function gotoNext(fromRef) {
    var cur = fromRef || (S.R && S.R.ref);
    var ordered = visibleRows('pending');
    var idx = ordered.map(function (r) { return r.refNo; }).indexOf(cur);
    var next = ordered[idx + 1] || ordered.filter(function (r) { return r.refNo !== cur; })[0];
    if (next) { if (S.R && S.R.D) S.R.D.pdf.destroy(); openReview(next.refNo); }
    else { closeReview(); P.toast('Semua dokumen telah disemak.'); }
  }

  // ================= KEMBALIKAN / TOLAK =================
  function openDecide(kind) {
    S.decide = kind;
    $('decTitle').textContent = (kind === 'return' ? 'Kembalikan untuk pembetulan – ' : 'Tolak dokumen – ') + S.R.ref;
    $('decKomen').value = '';
    $('decChips').innerHTML = REASONS.map(function (r) { return '<button type="button" class="chip">' + esc(r) + '</button>'; }).join('');
    $('decChips').querySelectorAll('button').forEach(function (b) {
      b.onclick = function () { var t = $('decKomen'); t.value = (t.value ? t.value.replace(/\s*$/, '. ') : '') + b.textContent; b.classList.add('on'); };
    });
    P.openModal('mDecide');
    setTimeout(function () { $('decKomen').focus(); }, 50);
  }
  function doDecide() {
    var komen = $('decKomen').value.trim();
    if (!komen) { P.toast('Sila tulis komen.', true); return; }
    var btn = $('btnDecide'), R = S.R; P.busy(btn, true, 'Menghantar…');
    P.api(S.decide === 'return' ? 'returnDoc' : 'rejectDoc', { ref: R.ref, komen: komen }).then(function () {
      R.row.status = S.decide === 'return' ? 'Dikembalikan' : 'Ditolak'; R.row.komen = komen;
      P.closeModal('mDecide'); P.toast('Dimaklumkan kepada ' + R.row.nama);
      gotoNext(R.ref);
    }).catch(function (e) { P.toast(e.message, true); }).then(function () { P.busy(btn, false); });
  }

  // ================= TANDATANGAN PUKAL =================
  function openBatch() {
    if (!S.sig) { P.toast('Sila muat naik tandatangan di Tetapan dahulu.', true); setTab('settings'); return; }
    var refs = Object.keys(S.sel).filter(function (k) { var r = rowOf(k); return r && PENDING.indexOf(r.status) >= 0; });
    S.batch = [];
    var grid = $('bGrid'), msg = $('bMsg'), btn = $('btnBatch');
    grid.innerHTML = ''; btn.disabled = true; btn.textContent = 'Tandatangan';
    P.openModal('mBatch');
    P.loadPdfLibs().then(function () {
      return refs.reduce(function (p, ref, i) {
        return p.then(function () {
          msg.innerHTML = '<span class="spinner"></span> Menyemak ' + (i + 1) + '/' + refs.length + '…';
          var r = rowOf(ref);
          return P.api('getPdf', { ref: ref }).then(function (b64) {
            if (r.status === 'Dihantar') r.status = 'Dalam Semakan';
            return analyze(P.b64ToBytes(b64), r.jenis);
          }).then(function (D) {
            var item = { ref: ref, row: r, D: D, ok: D.found };
            S.batch.push(item);
            var card = document.createElement('div');
            card.className = 'bcard' + (D.found ? '' : ' bad');
            card.innerHTML = '<label class="check"><input type="checkbox" ' + (D.found ? 'checked' : 'disabled') + '> <b>' + esc(ref) + '</b></label>' +
              '<div class="bname">' + esc(r.nama) + '</div><div class="muted tiny">' + esc(r.jenis) + '</div>' +
              (D.found ? '' : '<div class="bwarn">Slot tidak dijumpai: semak secara manual</div>');
            card.querySelector('input').onchange = function () { item.ok = this.checked; countBatch(); };
            grid.appendChild(card);
            return thumb(D).then(function (cv) { card.appendChild(cv); });
          }).catch(function (e) {
            grid.insertAdjacentHTML('beforeend', '<div class="bcard bad"><b>' + esc(ref) + '</b><div class="bwarn">' + esc(e.message) + '</div></div>');
          });
        });
      }, Promise.resolve());
    }).then(function () { msg.textContent = ''; countBatch(); renderList(); });
  }
  function countBatch() {
    var n = S.batch.filter(function (b) { return b.ok; }).length;
    var btn = $('btnBatch'); btn.disabled = !n; btn.textContent = 'Tandatangan (' + n + ')';
  }
  function thumb(D) {
    var sig = D.ovs[0], page = D.pages[sig.page];
    var vp1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: 440 / vp1.width });
    var cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
    var g = cv.getContext('2d');
    return page.render({ canvasContext: g, viewport: vp }).promise.then(function () {
      D.ovs.forEach(function (o) {
        var r = vp.convertToViewportRectangle([o.x, o.y, o.x + o.w, o.y + o.h]);
        var L = Math.min(r[0], r[2]), T = Math.min(r[1], r[3]), W = Math.abs(r[2] - r[0]), H = Math.abs(r[3] - r[1]);
        if (o.kind === 'sig') g.drawImage(S.sig.img, L, T, W, H);
        if (o.kind === 'date') { g.font = (o.size * vp.scale) + 'px Helvetica, Arial'; g.fillStyle = '#000'; g.fillText(o.text, L, T + H); }
      });
      var r = vp.convertToViewportRectangle([sig.x, sig.y, sig.x + sig.w, sig.y + sig.h]);
      var cy = (r[1] + r[3]) / 2, h = Math.min(cv.height, 240), y0 = Math.max(0, Math.min(cv.height - h, cy - h / 2));
      var out = document.createElement('canvas'); out.width = cv.width; out.height = h;
      out.getContext('2d').drawImage(cv, 0, y0, cv.width, h, 0, 0, cv.width, h);
      return out;
    });
  }
  function doBatch() {
    var items = S.batch.filter(function (b) { return b.ok; });
    var msg = $('bMsg'), btn = $('btnBatch');
    btn.disabled = true; $('btnBatchCancel').disabled = true;
    var done = 0, fail = 0;
    items.reduce(function (p, it) {
      return p.then(function () {
        msg.innerHTML = '<span class="spinner"></span> Menandatangan ' + (done + fail + 1) + '/' + items.length + '…';
        return stampPdf(it.D.bytes, it.D.ovs, it.ref, { date: true, qr: true, stamp: false })
          .then(function (out) { return P.api('sign', { ref: it.ref, pdf: P.bytesToB64(out), pos: null }); })
          .then(function () { it.row.status = 'Ditandatangani'; it.row.ditandatanganiPada = P.todayStr(); it.row.muatTurunHingga = plus48(); delete S.sel[it.ref]; done++; })
          .catch(function (e) { fail++; P.toast(it.ref + ': ' + e.message, true); });
      });
    }, Promise.resolve()).then(function () {
      S.batch.forEach(function (b) { b.D.pdf.destroy(); });
      $('btnBatchCancel').disabled = false; msg.textContent = '';
      P.closeModal('mBatch');
      P.toast(done + ' dokumen ditandatangani' + (fail ? ', ' + fail + ' gagal' : '') + '.', !!fail);
      renderList();
    });
  }

  // ================= TETAPAN =================
  function renderSettings() {
    showAssets();
    var dts = (S.data && S.data.docTypes) || [];
    $('dtList').innerHTML = '<table class="list compact"><thead><tr><th>Jenis</th><th>Kata kunci (pisah dengan |)</th><th class="num">dx</th><th class="num">dy</th><th class="num">Lebar</th><th></th></tr></thead><tbody>' +
      dts.map(dtRow).join('') + '</tbody></table>';
    P.api('staffList').then(function (list) {
      $('staffCount').textContent = list.filter(function (s) { return s.peranan !== 'hod'; }).length;
      $('staffList').innerHTML = '<table class="list compact"><thead><tr><th>Nama</th><th>Emel</th><th>No Staf</th><th>Log masuk terakhir</th><th>Aktif</th><th></th></tr></thead><tbody>' +
        list.map(function (s) {
          var hod = s.peranan === 'hod';
          return '<tr><td><b>' + esc(s.nama) + '</b>' + (hod ? ' <span class="badge b-Ditandatangani">KJ</span>' : '') + '</td><td>' + esc(s.email) + '</td><td>' + esc(s.noStaf) + '</td>' +
            '<td class="muted tiny">' + (P.fmtDT(s.logMasukTerakhir) || '–') + '</td>' +
            '<td>' + (hod ? '–' : '<label class="switch"><input type="checkbox" data-email="' + esc(s.email) + '"' + (s.aktif !== 'tidak' ? ' checked' : '') + '><span></span></label>') + '</td>' +
            '<td>' + (hod ? '' : '<button class="btn small ghost" data-reset="' + esc(s.email) + '">Set semula</button>') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }).catch(function (e) { P.toast(e.message, true); });
  }
  function dtRow(t) {
    return '<tr><td><input type="text" class="dj" value="' + esc(t.jenis) + '"' + (t.jenis ? ' readonly' : '') + ' placeholder="Nama jenis"></td>' +
      '<td><input type="text" class="dk" value="' + esc(t.kataKunci) + '"></td>' +
      '<td class="num"><input type="number" class="dx" value="' + Math.round(t.dx) + '"></td><td class="num"><input type="number" class="dy" value="' + Math.round(t.dy) + '"></td>' +
      '<td class="num"><input type="number" class="dl" value="' + Math.round(t.lebar) + '"></td>' +
      '<td><button class="btn small ghost" data-save="1">Simpan</button></td></tr>';
  }
  function saveDt(btn) {
    var tr = btn.closest('tr'), o = {
      jenis: tr.querySelector('.dj').value.trim(), kataKunci: tr.querySelector('.dk').value.trim(),
      dx: tr.querySelector('.dx').value, dy: tr.querySelector('.dy').value, lebar: tr.querySelector('.dl').value
    };
    P.api('saveDocType', o).then(function () { P.toast('Disimpan.'); return loadAll(); }).catch(function (e) { P.toast(e.message, true); });
  }
  function addStaff() {
    var btn = $('btnAddStaff'); P.busy(btn, true, 'Menambah…');
    P.api('addStaff', { text: $('staffBulk').value }).then(function (r) {
      $('staffMsg').textContent = r.added + ' ditambah, ' + r.updated + ' dikemas kini' + (r.errors.length ? '. ' + r.errors.join('; ') : '');
      $('staffBulk').value = '';
      renderSettings();
    }).catch(function (e) { P.toast(e.message, true); }).then(function () { P.busy(btn, false); });
  }
  function showAssets() {
    $('sigPrev').innerHTML = S.sig ? '<img alt="Tandatangan" src="' + S.sig.url + '">' : '<span class="muted">Tiada tandatangan</span>';
    $('stampPrev').innerHTML = S.stamp ? '<img alt="Cop" src="' + S.stamp.url + '">' : '<span class="muted">Tiada</span>';
    if (S.data) P.show('noSig', !S.sig);
  }
  function cleanImage(img, removeWhite) {
    var maxW = 900, sc = Math.min(1, maxW / img.naturalWidth);
    var c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
    var g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
    var d = g.getImageData(0, 0, c.width, c.height), px = d.data;
    var minX = c.width, minY = c.height, maxX = -1, maxY = -1;
    for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) {
      var i = (y * c.width + x) * 4, lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (removeWhite) { if (lum > 200) px[i + 3] = 0; else if (lum > 140) px[i + 3] = Math.round(px[i + 3] * (200 - lum) / 60); }
      if (px[i + 3] > 20) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    g.putImageData(d, 0, 0);
    if (maxX < 0) throw new Error('Gambar kosong: tiada tandatangan dikesan.');
    var pad = 6; minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(c.width - 1, maxX + pad); maxY = Math.min(c.height - 1, maxY + pad);
    var o = document.createElement('canvas'); o.width = maxX - minX + 1; o.height = maxY - minY + 1;
    o.getContext('2d').drawImage(c, minX, minY, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL('image/png').split(',')[1];
  }
  function saveAssetB64(kind, b64) {
    return P.api('saveAsset', { kind: kind, data: b64 }).then(function () { return mkAsset(b64); }).then(function (a) {
      if (kind === 'stamp') S.stamp = a; else S.sig = a;
      showAssets(); P.toast(kind === 'stamp' ? 'Cop disimpan.' : 'Tandatangan disimpan.');
    });
  }
  function uploadAsset(kind, file, removeWhite) {
    var img = new Image();
    img.onload = function () {
      var b64;
      try { b64 = cleanImage(img, removeWhite); } catch (e) { P.toast(e.message, true); return; }
      saveAssetB64(kind, b64).catch(function (e) { P.toast(e.message, true); });
    };
    img.onerror = function () { P.toast('Gambar tidak dapat dibaca.', true); };
    img.src = URL.createObjectURL(file);
  }

  // pad lukisan
  var pad, pg, drawing = false, last, dirty = false;
  function fitPad() {
    var r = pad.getBoundingClientRect(); if (!r.width) return;
    pad.width = r.width * 2; pad.height = r.height * 2; pg = pad.getContext('2d');
    pg.scale(2, 2); pg.lineWidth = 2.6; pg.lineCap = 'round'; pg.lineJoin = 'round'; pg.strokeStyle = '#0b2a8a'; dirty = false;
  }
  function initPad() {
    pad = $('pad');
    function pos(e) { var r = pad.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    pad.addEventListener('pointerdown', function (e) { if (!pg) fitPad(); drawing = true; pad.setPointerCapture(e.pointerId); last = pos(e); });
    pad.addEventListener('pointermove', function (e) {
      if (!drawing) return; var p = pos(e);
      pg.beginPath(); pg.moveTo(last.x, last.y); pg.lineTo(p.x, p.y); pg.stroke(); last = p; dirty = true;
    });
    pad.addEventListener('pointerup', function () { drawing = false; });
    $('btnPadClear').addEventListener('click', fitPad);
    $('btnPadSave').addEventListener('click', function () {
      if (!dirty) { P.toast('Sila lukis tandatangan dahulu.', true); return; }
      var img = new Image();
      img.onload = function () {
        var b64; try { b64 = cleanImage(img, false); } catch (e) { P.toast(e.message, true); return; }
        saveAssetB64('sig', b64).then(fitPad).catch(function (e) { P.toast(e.message, true); });
      };
      img.src = pad.toDataURL('image/png');
    });
    window.addEventListener('resize', function () { if (!$('hodSettings').hidden && !dirty) fitPad(); });
  }

  window.Hod = { start: start };
})();
