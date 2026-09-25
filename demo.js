/* Portal Tandatangan – MOD DEMO (aktif bila API_URL kosong dalam config.js).
 * Meniru pelayan sebenar dengan data contoh dalam pelayar. Tiada data dihantar ke mana-mana. */
(function () {
  'use strict';
  if (!window.P || !P.DEMO) return;
  var KEY = 'pt_demo_v3';
  var DB = null, mem = {};

  function ss() { try { return window.sessionStorage; } catch (e) { return null; } }
  function save() {
    var s = ss(); if (!s) return;
    try { s.setItem(KEY, JSON.stringify(DB)); } catch (e) { /* storan penuh: kekal dalam memori */ }
  }
  function load() { var s = ss(); try { return s && JSON.parse(s.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function now() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16).replace('T', ' '); }
  function plusDays(n) { var d = new Date(Date.now() + n * 86400000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function plusHours(h) { var d = new Date(Date.now() + h * 3600000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16).replace('T', ' '); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function sha256Hex(b64) {
    if (!(window.crypto && crypto.subtle)) return Promise.resolve('(demo)');
    return crypto.subtle.digest('SHA-256', P.b64ToBytes(b64)).then(function (h) {
      return Array.prototype.map.call(new Uint8Array(h), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }

  // ---------- PDF contoh ----------
  function mkPdfs() {
    var PL = window.PDFLib;
    return Promise.all([quiz(PL), minit(PL), cir(PL), kk(PL)]);
  }
  function base(PL, size) {
    return PL.PDFDocument.create().then(function (doc) {
      return Promise.all([doc.embedFont(PL.StandardFonts.Helvetica), doc.embedFont(PL.StandardFonts.HelveticaBold)]).then(function (f) {
        return { doc: doc, f: f[0], b: f[1], add: function () { return doc.addPage(size || [595.28, 841.89]); } };
      });
    });
  }
  function txt(p, s, x, y, font, size, color) { p.drawText(s, { x: x, y: y, size: size || 11, font: font, color: color || PDFLib.rgb(0.1, 0.1, 0.1) }); }
  function line(p, x1, y1, x2, y2, w) { p.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: w || 0.8, color: PDFLib.rgb(0.2, 0.2, 0.2) }); }
  function finish(o) { return o.doc.save().then(function (b) { return P.bytesToB64(b); }); }

  function quiz(PL) {
    return base(PL).then(function (o) {
      var qs = ['The job-search process is a significant stage in life.', 'Job seekers must stay organized in a changing market.',
        'Transferable skills are often referred to as technical skills.', 'A personal brand statement highlights your strengths.',
        'Networking provides additional chances to showcase your brand.', 'References should always be informed in advance.'];
      var p = o.add();
      txt(p, 'CONFIDENTIAL', 470, 800, o.b, 10);
      txt(p, 'KOLEJ POLY-TECH MARA KUANTAN', 190, 760, o.b, 13);
      txt(p, 'QUIZ 1  |  PHR3093 CAREER PLANNING  |  JUL 2026', 150, 738, o.f, 11);
      txt(p, 'PART B: TRUE AND FALSE', 60, 690, o.b, 11);
      qs.forEach(function (q, i) { txt(p, (i + 1) + '.  ' + q, 60, 660 - i * 34, o.f, 11); txt(p, 'TRUE / FALSE', 440, 660 - i * 34, o.b, 10); });
      txt(p, 'END OF QUESTION PAPER', 225, 420, o.b, 11);
      txt(p, 'Prepared by:', 70, 370, o.f, 11); txt(p, 'Verified by:', 250, 370, o.f, 11); txt(p, 'Endorsed by:', 430, 370, o.f, 11);
      txt(p, 'NURUL IZZATI', 70, 318, o.b, 7); txt(p, 'Pensyarah', 70, 309, o.f, 7); txt(p, '22/7/2026', 80, 290, o.f, 10);
      txt(p, 'CONFIDENTIAL', 60, 50, o.b, 10); txt(p, 'JUL2026/QUIZ 1/PHR3093', 400, 50, o.b, 10);
      return finish(o);
    });
  }
  function minit(PL) {
    return base(PL).then(function (o) {
      var p = o.add();
      p.drawRectangle({ x: 200, y: 770, width: 200, height: 36, borderColor: PL.rgb(0, 0, 0), borderWidth: 1.2 });
      txt(p, 'MINIT CURAI', 255, 783, o.b, 14);
      line(p, 60, 750, 535, 750);
      ['Program Tanggungjawab Sosial Korporat (CSR) - Sinergi Komuniti 2026 telah dilaksanakan',
        'dengan jayanya di tiga buah sekolah. Seramai 45 orang guru dan 180 orang pelajar terlibat.',
        'Maklum balas peserta amat positif dan program dicadangkan untuk diteruskan tahun hadapan.'
      ].forEach(function (s, i) { txt(p, s, 60, 715 - i * 18, o.f, 11); });
      txt(p, 'Disediakan Oleh:', 60, 600, o.f, 11);
      txt(p, 'NURUL IZZATI BINTI ABDULLAH', 60, 550, o.f, 11); txt(p, 'PENGARAH PROGRAM', 60, 536, o.f, 11); txt(p, 'Tarikh: 11/9/26', 60, 522, o.f, 11);
      txt(p, 'Disemak Oleh:', 60, 470, o.f, 11);
      txt(p, 'KETUA JABATAN', 60, 420, o.f, 11); txt(p, (P.CFG.DEPT_NAME || 'Jabatan'), 60, 406, o.f, 11); txt(p, 'Tarikh:', 60, 392, o.f, 11);
      return finish(o);
    });
  }
  function cir(PL) {
    return base(PL, [841.89, 595.28]).then(function (o) {
      var p = o.add();
      txt(p, 'KOLEJ POLY-TECH MARA KUANTAN', 300, 555, o.b, 13);
      txt(p, 'COURSE IMPLEMENTATION REPORT (CIR)  -  PHR3173  -  APRIL 2026', 220, 535, o.f, 11);
      var cols = [40, 330, 580, 800];
      p.drawRectangle({ x: 40, y: 250, width: 760, height: 260, borderColor: PL.rgb(0.3, 0.3, 0.3), borderWidth: 0.8 });
      for (var r = 0; r < 5; r++) line(p, 40, 460 - r * 42, 800, 460 - r * 42, 0.4);
      ['Week', 'Topic', 'Mode', 'Remarks'].forEach(function (h, i) { txt(p, h, 50 + i * 190, 485, o.b, 10); });
      ['1  Introduction to Career Planning  OFL  Completed', '2  Self Assessment  OFL  Completed', '3  Personal Branding  OFL  Completed', '4  Networking Skills  ODL  Completed']
        .forEach(function (s, i) { txt(p, s.replace(/  /g, '          '), 50, 440 - i * 42, o.f, 10); });
      p.drawRectangle({ x: 40, y: 40, width: 760, height: 190, borderColor: PL.rgb(0.3, 0.3, 0.3), borderWidth: 0.8 });
      line(p, cols[1], 40, cols[1], 230); line(p, cols[2], 40, cols[2], 230);
      txt(p, 'First Review', 415, 212, o.b, 10); txt(p, 'Second Review', 650, 212, o.b, 10);
      [50, 340, 590].forEach(function (x, i) {
        txt(p, 'Prepared by : ' + (i ? '______________' : 'NURUL IZZATI BINTI ABDULLAH'), x, 185, o.f, 9);
        txt(p, '(Lecturer)', x + 60, 172, o.f, 8); txt(p, 'Date', x, 152, o.f, 9); txt(p, ':', x + 60, 152, o.f, 9);
        txt(p, 'Verified by : ______________', x, 100, o.f, 9);
        txt(p, '(Head of Department)', x + 55, 87, o.f, 8); txt(p, 'Date', x, 62, o.f, 9); txt(p, ':', x + 60, 62, o.f, 9);
      });
      return finish(o);
    });
  }
  function kk(PL) {
    return base(PL).then(function (o) {
      var p = o.add();
      txt(p, 'KOLEJ POLY-TECH MARA KUANTAN', 190, 780, o.b, 13);
      txt(p, 'KERTAS CADANGAN PROGRAM HARI KERJAYA 2026', 150, 755, o.b, 12);
      var paras = ['1.  TUJUAN', 'Kertas cadangan ini bertujuan memohon kelulusan melaksanakan Program Hari Kerjaya 2026.',
        '2.  LATAR BELAKANG', 'Program ini memberi pendedahan kepada pelajar semester akhir tentang peluang kerjaya.',
        '3.  OBJEKTIF', 'i.   Mendedahkan pelajar kepada industri.', 'ii.  Meningkatkan kebolehpasaran graduan.',
        '4.  CADANGAN', 'Program akan diadakan pada 20 November 2026 di Dewan Utama KPTM Kuantan.'];
      paras.forEach(function (s, i) { txt(p, s, 60, 710 - i * 22, /^\d\./.test(s) ? o.b : o.f, 11); });
      var p2 = o.add();
      txt(p2, '5.  SYOR DAN KELULUSAN', 60, 780, o.b, 11);
      txt(p2, 'Pihak jabatan menyokong permohonan ini untuk pertimbangan pengurusan.', 60, 755, o.f, 11);
      txt(p2, 'Disediakan Oleh:', 60, 680, o.f, 11); txt(p2, 'FARAH LIYANA BINTI OSMAN', 60, 630, o.f, 11); txt(p2, 'Setiausaha Program', 60, 616, o.f, 11);
      txt(p2, 'Disokong Oleh:', 330, 680, o.f, 11); txt(p2, 'KETUA JABATAN', 330, 630, o.f, 11); txt(p2, 'Tarikh:', 330, 602, o.f, 11);
      return finish(o);
    });
  }
  function placeholderPdf(name) {
    return base(PDFLib).then(function (o) {
      var p = o.add();
      txt(p, 'MOD DEMO', 60, 780, o.b, 16);
      txt(p, 'Fail: ' + name, 60, 750, o.f, 11);
      txt(p, 'Di pelayan sebenar, fail Word/Excel ditukar ke PDF secara automatik.', 60, 730, o.f, 11);
      txt(p, 'Disemak Oleh:', 60, 600, o.f, 11); txt(p, 'KETUA JABATAN', 60, 550, o.f, 11); txt(p, 'Tarikh:', 60, 536, o.f, 11);
      return finish(o);
    });
  }
  function demoSignature() {
    var c = document.createElement('canvas'); c.width = 520; c.height = 200;
    var g = c.getContext('2d'); g.strokeStyle = '#0d1b6e'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(20, 160);
    g.bezierCurveTo(120, 120, 260, 60, 360, 30); g.lineTo(390, 26); g.lineTo(330, 60);
    g.bezierCurveTo(290, 100, 250, 170, 262, 176); g.bezierCurveTo(280, 180, 300, 120, 312, 118);
    g.lineTo(330, 130); g.lineTo(420, 128); g.bezierCurveTo(470, 110, 470, 150, 440, 150); g.bezierCurveTo(420, 150, 430, 120, 445, 132); g.lineTo(460, 170);
    g.stroke();
    g.lineWidth = 3; g.beginPath(); g.moveTo(60, 185); g.bezierCurveTo(200, 170, 360, 175, 480, 168); g.stroke();
    return c.toDataURL('image/png').split(',')[1];
  }

  // ---------- Data awal ----------
  function init() {
    if (DB) return Promise.resolve();
    DB = load();
    if (DB) return Promise.resolve();
    return P.loadPdfLibs().then(mkPdfs).then(function (pdfs) {
      DB = {
        seq: 8,
        pdfs: { quiz: pdfs[0], minit: pdfs[1], cir: pdfs[2], kk: pdfs[3] },
        assets: { sig: demoSignature(), stamp: null },
        docTypes: [
          { jenis: 'Kertas Kerja', kataKunci: 'Disokong Oleh|Disemak Oleh|Diluluskan Oleh', dx: 0, dy: 48, lebar: 110 },
          { jenis: 'Minit Curai', kataKunci: 'Disemak Oleh', dx: 0, dy: 48, lebar: 110 },
          { jenis: 'CIR', kataKunci: 'Verified by', dx: 55, dy: 4, lebar: 90 },
          { jenis: 'Endorsed Assessment (Quiz/Test/Assignment)', kataKunci: 'Verified by', dx: 0, dy: 48, lebar: 100 },
          { jenis: 'Lain-lain', kataKunci: 'Disemak Oleh|Verified by|Disokong Oleh|Diluluskan Oleh', dx: 0, dy: 48, lebar: 110 }
        ],
        staff: [
          { email: 'kj@demo.my', nama: 'AHMAD HAFIZI BIN AHMAD GIRAN', noStaf: 'K0001', peranan: 'hod', aktif: 'ya', pdpaAck: 'x', logMasukTerakhir: '' },
          { email: 'pensyarah@demo.my', nama: 'SITI AMINAH BINTI RAHMAN', noStaf: 'K1021', peranan: 'pensyarah', aktif: 'ya', pdpaAck: '', logMasukTerakhir: '' },
          { email: 'nurul@demo.my', nama: 'NURUL IZZATI BINTI ABDULLAH', noStaf: 'K1044', peranan: 'pensyarah', aktif: 'ya', logMasukTerakhir: '' },
          { email: 'rosli@demo.my', nama: 'ROSLI BIN OMAR', noStaf: 'K1102', peranan: 'pensyarah', aktif: 'ya', logMasukTerakhir: '' },
          { email: 'farah@demo.my', nama: 'FARAH LIYANA BINTI OSMAN', noStaf: 'K1130', peranan: 'pensyarah', aktif: 'ya', logMasukTerakhir: '' },
          { email: 'hakim@demo.my', nama: 'HAKIM BIN ZULKIFLI', noStaf: 'K1167', peranan: 'pensyarah', aktif: 'ya', logMasukTerakhir: '' }
        ],
        requests: [
          rq(1, 'pensyarah@demo.my', 'Endorsed Assessment (Quiz/Test/Assignment)', 'Quiz 1 PHR3093 – JUL2026', plusDays(1), 'quiz', 'Dihantar', 'Sila tandatangan di ruang Verified by.'),
          rq(2, 'nurul@demo.my', 'Minit Curai', 'Minit Curai Program CSR 3 Sekolah', plusDays(2), 'minit', 'Dihantar'),
          rq(3, 'rosli@demo.my', 'CIR', 'CIR PHR3173 – April 2026', plusDays(5), 'cir', 'Dihantar'),
          rq(4, 'farah@demo.my', 'Kertas Kerja', 'Kertas Kerja Hari Kerjaya 2026', plusDays(9), 'kk', 'Dihantar'),
          rq(5, 'pensyarah@demo.my', 'Endorsed Assessment (Quiz/Test/Assignment)', 'Test 1 PHR3093 – JUL2026', plusDays(4), 'quiz', 'Dihantar'),
          rq(6, 'pensyarah@demo.my', 'Minit Curai', 'Minit Mesyuarat Jabatan Bil. 3/2026', plusDays(6), 'minit', 'Dikembalikan', '', 'Lampiran tidak lengkap. Sila sertakan senarai kehadiran.'),
          rq(7, 'pensyarah@demo.my', 'CIR', 'CIR PHR3093 – Mac 2026', plusDays(-6), 'cir', 'Ditandatangani'),
          rq(8, 'pensyarah@demo.my', 'Minit Curai', 'Minit Curai Hari Terbuka 2026', plusDays(-1), 'minit', 'Ditandatangani')
        ]
      };
      var r8 = DB.requests[7]; r8.ditandatanganiPada = plusHours(-5); r8.muatTurunHingga = plusHours(43);
      save();
    });
  }
  function rq(n, email, jenis, tajuk, due, pdf, status, catatan, komen) {
    return {
      refNo: 'KPTM-' + (P.CFG.DEPT_CODE || 'JPPP') + '-2026-' + ('000' + n).slice(-4), email: email, nama: '', jenis: jenis, tajuk: tajuk,
      tarikhPerlu: due, catatan: catatan || '', status: status, versi: '1', pdf: pdf, signedPdf: status === 'Ditandatangani' ? pdf : '',
      sha256: '', komen: komen || '', dihantarPada: plusDays(-n) + ' 09:' + ('0' + (n * 7) % 60).slice(-2),
      dikemaskiniPada: plusDays(-n) + ' 10:00', ditandatanganiPada: status === 'Ditandatangani' ? plusDays(-3) + ' 08:40' : '',
      muatTurunHingga: status === 'Ditandatangani' ? plusDays(-1) + ' 08:40' : '',
      namaFail: tajuk.replace(/[^\w ]+/g, '').trim().replace(/\s+/g, '_') + '.pdf'
    };
  }
  function staffOf(email) { return DB.staff.filter(function (s) { return s.email === email; })[0]; }
  function nameOf(r) { if (!r.nama) { var s = staffOf(r.email); r.nama = s ? s.nama : r.email; } return r.nama; }
  function pub(r) {
    nameOf(r);
    // tiru pembersihan automatik: fail dipadam selepas tempoh muat turun tamat
    if (r.status === 'Ditandatangani' && !r.failDipadam && r.muatTurunHingga && P.expiryInfo(r.muatTurunHingga).expired) {
      r.failDipadam = r.muatTurunHingga; if (/^u/.test(r.signedPdf)) delete DB.pdfs[r.signedPdf]; r.signedPdf = ''; save();
    }
    return { refNo: r.refNo, nama: r.nama, jenis: r.jenis, tajuk: r.tajuk, tarikhPerlu: r.tarikhPerlu, catatan: r.catatan, status: r.status,
      versi: r.versi, komen: r.komen, dihantarPada: r.dihantarPada, dikemaskiniPada: r.dikemaskiniPada, ditandatanganiPada: r.ditandatanganiPada, namaFail: r.namaFail, muatTurunHingga: r.muatTurunHingga || '', failDipadam: r.failDipadam || '' };
  }
  function find(ref) { return DB.requests.filter(function (r) { return r.refNo === ref; })[0]; }
  function user(token) {
    var email = String(token || '').replace(/^demo:/, '');
    var s = staffOf(email);
    if (!token || !s) throw new Error('SESI_TAMAT');
    return s;
  }
  function info(s) { return { email: s.email, nama: s.nama, peranan: s.peranan, pdpaAck: !!s.pdpaAck, tukarKataLaluan: false }; }
  function pdfOf(key) { return mem[key] || DB.pdfs[key]; }
  function putPdf(b64) { var k = 'u' + (DB.seq++) + '_' + Date.now(); DB.pdfs[k] = b64; mem[k] = b64; return k; }
  function fileToPdf(p) {
    if (/\.pdf$/i.test(p.fileName || '')) return Promise.resolve(p.data);
    return P.loadPdfLibs().then(function () { return placeholderPdf(p.fileName); });
  }

  var A = {
    login: function (p) {
      var s = staffOf(String(p.email || '').toLowerCase().trim());
      if (!s || p.password !== 'demo1234') throw new Error('Emel atau kata laluan salah. (Demo: kata laluan ialah demo1234)');
      s.logMasukTerakhir = now(); save();
      return { token: 'demo:' + s.email, user: info(s) };
    },
    verify: function (p) {
      var r = find(p.ref);
      if (!r || r.status !== 'Ditandatangani') return { found: false, ref: p.ref };
      var hod = DB.staff.filter(function (s) { return s.peranan === 'hod'; })[0];
      return { found: true, ref: r.refNo, nama: nameOf(r), jenis: r.jenis, tajuk: r.tajuk, ditandatanganiPada: r.ditandatanganiPada,
        oleh: hod.nama, sha256: r.sha256, dept: P.CFG.DEPT_NAME, college: P.CFG.COLLEGE };
    },
    me: function (p, u) { return info(u); },
    logout: function () { return true; },
    changePassword: function (p) { if (String(p.newPassword || '').length < 8) throw new Error('Kata laluan baharu mesti sekurang-kurangnya 8 aksara.'); return true; },
    ackPdpa: function (p, u) { u.pdpaAck = now(); save(); return true; },
    init: function (p, u) { return { user: info(u), docTypes: DB.docTypes.map(function (d) { return d.jenis; }), maxMb: 10, dept: P.CFG.DEPT_NAME, college: P.CFG.COLLEGE }; },
    myRequests: function (p, u) { return DB.requests.filter(function (r) { return r.email === u.email; }).map(pub).reverse(); },
    submit: function (p, u) {
      if (!p.jenis || !p.tajuk) throw new Error('Sila isi jenis dokumen dan tajuk.');
      return fileToPdf(p).then(function (b64) {
        var n = DB.requests.length + 1, r = rq(n, u.email, p.jenis, p.tajuk, p.tarikhPerlu, putPdf(b64), 'Dihantar', p.catatan);
        r.dihantarPada = now(); r.dikemaskiniPada = now(); r.namaFail = p.fileName;
        DB.requests.push(r); save(); return r.refNo;
      });
    },
    resubmit: function (p, u) {
      var r = find(p.ref); if (!r || r.email !== u.email) throw new Error('Permohonan tidak dijumpai.');
      return fileToPdf(p).then(function (b64) {
        r.pdf = putPdf(b64); r.versi = String(Number(r.versi) + 1); r.status = 'Dihantar'; r.dikemaskiniPada = now(); r.namaFail = p.fileName;
        if (p.catatan) r.catatan = p.catatan; save(); return r.refNo;
      });
    },
    downloadSigned: function (p, u) {
      var r = find(p.ref); if (r && r.failDipadam) throw new Error('Fail telah dipadam dari pelayan. Gunakan salinan yang anda simpan.');
      if (!r || !r.signedPdf) throw new Error('Dokumen belum ditandatangani.');
      if (u.peranan !== 'hod' && P.expiryInfo(r.muatTurunHingga).expired) throw new Error('Tempoh muat turun telah tamat. Sila minta Ketua Jabatan membuka semula.');
      return { name: r.refNo + '_SIGNED_' + r.namaFail.replace(/\.[^.]+$/, '') + '.pdf', data: pdfOf(r.signedPdf) };
    },
    hodInit: function () {
      return { user: info(DB.staff[0]), requests: DB.requests.map(function (r) { var o = pub(r); o.email = r.email; o.fileUrl = ''; return o; }),
        docTypes: DB.docTypes, hasSignature: !!DB.assets.sig, hasStamp: !!DB.assets.stamp, dept: P.CFG.DEPT_NAME, college: P.CFG.COLLEGE };
    },
    getPdf: function (p) {
      var r = find(p.ref); if (!r) throw new Error('Permohonan tidak dijumpai.');
      if (r.failDipadam) throw new Error('Fail telah dipadam kekal.');
      if (r.status === 'Dihantar') { r.status = 'Dalam Semakan'; save(); }
      return pdfOf(r.status === 'Ditandatangani' && r.signedPdf ? r.signedPdf : r.pdf);
    },
    getAssets: function () { return { sig: DB.assets.sig, stamp: DB.assets.stamp }; },
    saveAsset: function (p) { DB.assets[p.kind === 'stamp' ? 'stamp' : 'sig'] = p.data; save(); return true; },
    sign: function (p) {
      var r = find(p.ref); if (!r) throw new Error('Permohonan tidak dijumpai.');
      if (['Dihantar', 'Dalam Semakan'].indexOf(r.status) < 0) throw new Error('Status semasa: ' + r.status);
      return sha256Hex(p.pdf).then(function (h) {
        r.signedPdf = putPdf(p.pdf); r.sha256 = h; r.status = 'Ditandatangani'; r.ditandatanganiPada = now(); r.dikemaskiniPada = now(); r.komen = ''; r.muatTurunHingga = plusHours((Number(P.CFG.DOWNLOAD_DAYS) || 7) * 24);
        if (p.pos) A.savePosition(p.pos);
        save(); return { ref: r.refNo, sha256: h };
      });
    },
    extendDownload: function (p) { var r = find(p.ref); if (r.failDipadam) throw new Error('Fail telah dipadam kekal.'); r.muatTurunHingga = plusHours((Number(P.CFG.DOWNLOAD_DAYS) || 7) * 24); save(); return { muatTurunHingga: r.muatTurunHingga }; },
    returnDoc: function (p) { var r = find(p.ref); r.status = 'Dikembalikan'; r.komen = p.komen; r.dikemaskiniPada = now(); save(); return true; },
    rejectDoc: function (p) { var r = find(p.ref); r.status = 'Ditolak'; r.komen = p.komen; r.dikemaskiniPada = now(); save(); return true; },
    savePosition: function (p) {
      var d = DB.docTypes.filter(function (x) { return x.jenis === p.jenis; })[0];
      if (d) { d.dx = Math.round(p.dx); d.dy = Math.round(p.dy); d.lebar = Math.round(p.lebar); save(); }
      return true;
    },
    saveDocType: function (p) {
      var d = DB.docTypes.filter(function (x) { return x.jenis === p.jenis; })[0], o = { jenis: p.jenis, kataKunci: p.kataKunci, dx: +p.dx || 0, dy: +p.dy || 48, lebar: +p.lebar || 110 };
      if (d) Object.assign(d, o); else DB.docTypes.push(o);
      save(); return true;
    },
    staffList: function () { return DB.staff.map(function (s) { return { email: s.email, nama: s.nama, noStaf: s.noStaf, peranan: s.peranan, aktif: s.aktif, logMasukTerakhir: s.logMasukTerakhir }; }); },
    addStaff: function (p) {
      var added = 0, updated = 0, errors = [];
      String(p.text || '').split(/\r?\n/).forEach(function (line, i) {
        if (!line.trim()) return;
        var parts = line.split(/\t|,|;/).map(function (s) { return s.trim(); });
        var email = (parts.filter(function (x) { return /@/.test(x); })[0] || '').toLowerCase();
        var others = parts.filter(function (x) { return x && !/@/.test(x); });
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errors.push('Baris ' + (i + 1) + ': emel tidak sah'); return; }
        var ex = staffOf(email);
        if (ex) { ex.nama = others[0] || ex.nama; updated++; }
        else { DB.staff.push({ email: email, nama: (others[0] || email).toUpperCase(), noStaf: others[1] || '', peranan: 'pensyarah', aktif: 'ya', logMasukTerakhir: '' }); added++; }
      });
      save(); return { added: added, updated: updated, errors: errors };
    },
    setStaffActive: function (p) { var s = staffOf(p.email); if (s) { s.aktif = p.aktif ? 'ya' : 'tidak'; save(); } return true; },
    resetPassword: function () { return true; }
  };
  var PUBLIC = { login: 1, verify: 1 };
  var HOD = { hodInit: 1, getPdf: 1, getAssets: 1, saveAsset: 1, sign: 1, returnDoc: 1, rejectDoc: 1, savePosition: 1, saveDocType: 1, extendDownload: 1, staffList: 1, addStaff: 1, setStaffActive: 1, resetPassword: 1 };

  window.DemoAPI = {
    call: function (action, params, token) {
      return init().then(function () { return sleep(action === 'getPdf' ? 350 : 180); }).then(function () {
        var fn = A[action];
        if (!fn) throw new Error('Tindakan tidak dikenali: ' + action);
        if (PUBLIC[action]) return fn(params);
        var u = user(token);
        if (HOD[action] && u.peranan !== 'hod') throw new Error('Hanya Ketua Jabatan dibenarkan.');
        return fn(params, u);
      });
    },
    reset: function () { var s = ss(); if (s) s.removeItem(KEY); DB = null; }
  };
})();
