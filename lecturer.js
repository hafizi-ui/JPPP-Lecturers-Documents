/* Portal Tandatangan – paparan pensyarah */
(function () {
  'use strict';
  var $ = P.$, esc = P.esc;
  var S = { maxMb: 10, list: [], resubRef: null, started: false };

  function start(user) {
    $('lcName').textContent = user.nama.split(' ').slice(0, 2).join(' ');
    P.api('init').then(function (d) {
      S.maxMb = d.maxMb;
      $('maxmb').textContent = d.maxMb;
      $('sJenis').innerHTML = '<option value="">Pilih jenis dokumen</option>' +
        d.docTypes.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('');
      $('sDue').min = P.todayStr();
      if (!d.user.pdpaAck) P.openModal('mPdpa');
    }).catch(function (e) { P.toast(e.message, true); });
    loadList();
    if (!S.started) bind();
    S.started = true;
  }

  function bind() {
    $('btnPdpa').addEventListener('click', function () { P.closeModal('mPdpa'); P.api('ackPdpa').catch(function () { }); });
    $('btnReloadMine').addEventListener('click', loadList);
    var dz = $('dropzone'), fi = $('sFile');
    fi.addEventListener('change', function () { setDzText(fi.files[0]); });
    ['dragenter', 'dragover'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); }); });
    dz.addEventListener('drop', function (e) {
      if (e.dataTransfer.files.length) { fi.files = e.dataTransfer.files; setDzText(fi.files[0]); }
    });
    $('submitForm').addEventListener('submit', onSubmit);
    $('btnResub').addEventListener('click', doResubmit);
    $('myList').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]'); if (!b) return;
      if (b.dataset.act === 'dl') download(b.dataset.ref, b);
      if (b.dataset.act === 'resub') openResub(b.dataset.ref);
    });
  }

  function setDzText(f) {
    $('dzText').innerHTML = f ? '<b>' + esc(f.name) + '</b> · ' + (f.size / 1048576).toFixed(1) + 'MB' : 'Seret fail ke sini atau <u>pilih fail</u>';
    $('dropzone').classList.toggle('has-file', !!f);
  }

  function fileForm(file) {
    if (!file) return Promise.reject(new Error('Sila pilih fail.'));
    if (!/\.(pdf|docx?|xlsx?)$/i.test(file.name)) return Promise.reject(new Error('Format tidak disokong. Guna PDF, Word atau Excel.'));
    if (file.size > S.maxMb * 1048576) return Promise.reject(new Error('Fail melebihi ' + S.maxMb + 'MB.'));
    return P.readFileB64(file).then(function (b64) { return { fileName: file.name, mimeType: file.type, data: b64 }; });
  }

  function onSubmit(e) {
    e.preventDefault();
    var btn = $('btnSubmit'), msg = $('submitMsg');
    P.busy(btn, true, 'Menghantar…');
    msg.textContent = /\.(docx?|xlsx?)$/i.test(($('sFile').files[0] || {}).name || '') ? 'Menukar ke PDF…' : '';
    fileForm($('sFile').files[0]).then(function (form) {
      form.jenis = $('sJenis').value; form.tajuk = $('sTajuk').value.trim();
      form.tarikhPerlu = $('sDue').value; form.catatan = $('sCatatan').value;
      return P.api('submit', form);
    }).then(function (ref) {
      P.toast('Berjaya dihantar: ' + ref);
      $('submitForm').reset(); setDzText(null);
      msg.innerHTML = 'No. rujukan: <b>' + esc(ref) + '</b>';
      loadList();
    }).catch(function (err) { msg.textContent = ''; P.toast(err.message, true); })
      .then(function () { P.busy(btn, false); });
  }

  function loadList() {
    P.api('myRequests').then(function (rows) {
      S.list = rows;
      renderStats(rows);
      var el = $('myList');
      if (!rows.length) { el.innerHTML = '<div class="empty"><b>Belum ada permohonan.</b><br>Dokumen yang anda hantar akan dipaparkan di sini.</div>'; return; }
      el.innerHTML = rows.map(function (r) {
        var active = r.status === 'Dihantar' || r.status === 'Dalam Semakan';
        var act = '';
        var exp = r.status === 'Ditandatangani' ? P.expiryInfo(r.muatTurunHingga) : null;
        var gone = exp && (exp.expired || !!r.failDipadam);
        if (exp && !gone) act = '<button class="btn small success" data-act="dl" data-ref="' + esc(r.refNo) + '">Muat turun PDF</button>';
        if (r.status === 'Dikembalikan') act = '<button class="btn small warn" data-act="resub" data-ref="' + esc(r.refNo) + '">Hantar semula</button>';
        return '<article class="req s-' + esc(r.status.split(' ')[0]) + '">' +
          '<div class="req-top"><span class="ref">' + esc(r.refNo) + (Number(r.versi) > 1 ? ' · v' + esc(r.versi) : '') + '</span>' + P.badge(r.status) + '</div>' +
          '<div class="req-title">' + esc(r.tajuk) + '</div>' +
          '<div class="req-meta"><span>' + esc(r.jenis) + '</span><span>Dihantar ' + P.fmtDT(r.dihantarPada) + '</span>' +
          (r.tarikhPerlu ? '<span>Perlu: ' + P.dueHtml(r.tarikhPerlu, active) + '</span>' : '') + '</div>' +
          (r.komen ? '<div class="req-comment"><b>Komen KJ:</b> ' + esc(r.komen) + '</div>' : '') +
          (exp && exp.until ? (gone
            ? '<div class="dl-window expired"><b>Fail telah dipadam</b> dari pelayan selepas ' + esc(exp.until) + '. Gunakan salinan yang anda simpan. Kod QR pada dokumen masih boleh disemak.</div>'
            : '<div class="dl-window' + (exp.soon ? ' soon' : '') + '">Muat turun sebelum <b>' + esc(exp.until) + '</b> <span>(' + esc(exp.left) + ')</span>. Selepas itu fail <b>dipadam kekal</b>; sila simpan salinan anda.</div>') : '') +
          (act || r.ditandatanganiPada ? '<div class="req-foot">' + (r.ditandatanganiPada ? '<span class="muted tiny">Ditandatangani ' + P.fmtDT(r.ditandatanganiPada) + '</span>' : '') + '<span class="spacer"></span>' + act + '</div>' : '') +
          '</article>';
      }).join('');
    }).catch(function (e) { P.toast(e.message, true); });
  }

  function renderStats(rows) {
    function n(f) { return rows.filter(f).length; }
    var items = [
      ['Dalam proses', n(function (r) { return r.status === 'Dihantar' || r.status === 'Dalam Semakan'; }), 'blue'],
      ['Perlu dibetulkan', n(function (r) { return r.status === 'Dikembalikan'; }), 'amber'],
      ['Ditandatangani', n(function (r) { return r.status === 'Ditandatangani'; }), 'green']
    ];
    $('lcStats').innerHTML = items.map(function (i) {
      return '<div class="stat stat-' + i[2] + '"><div class="stat-n">' + i[1] + '</div><div class="stat-l">' + i[0] + '</div></div>';
    }).join('');
  }

  function download(ref, btn) {
    P.busy(btn, true, 'Memuat turun…');
    P.api('downloadSigned', { ref: ref }).then(function (f) { P.downloadB64(f.name, f.data); })
      .catch(function (e) { P.toast(e.message, true); }).then(function () { P.busy(btn, false); });
  }

  function openResub(ref) {
    var r = S.list.filter(function (x) { return x.refNo === ref; })[0];
    S.resubRef = ref;
    $('resubRef').textContent = ref;
    $('resubKomen').innerHTML = '<b>Komen KJ:</b> ' + esc(r.komen || '-');
    $('resubFile').value = ''; $('resubCatatan').value = '';
    P.openModal('mResub');
  }
  function doResubmit() {
    var btn = $('btnResub');
    P.busy(btn, true, 'Menghantar…');
    fileForm($('resubFile').files[0]).then(function (form) {
      form.ref = S.resubRef; form.catatan = $('resubCatatan').value;
      return P.api('resubmit', form);
    }).then(function () { P.toast('Dihantar semula.'); P.closeModal('mResub'); loadList(); })
      .catch(function (e) { P.toast(e.message, true); }).then(function () { P.busy(btn, false); });
  }

  window.Lecturer = { start: start };
})();
