/**
 * PORTAL TANDATANGAN JABATAN – KPTM  (Backend API)
 * Frontend: GitHub Pages (HTML/CSS/JS). Backend: Google Apps Script + Sheets + Drive.
 *
 * Langkah pertama: pilih fungsi "setup" di atas, tekan Run (sekali sahaja).
 */

// ====== TETAPAN (boleh ubah) ======
const CONFIG = {
  SITE_URL: 'https://hafizi-ui.github.io/JPPP-Lecturers-Documents/',  // tukar selepas GitHub Pages aktif
  DEPT_CODE: 'JPPP',
  DEPT_NAME: 'Jabatan Pengurusan Perniagaan dan Perakaunan',
  COLLEGE: 'Kolej Poly-Tech MARA Kuantan',
  HOD_NAME: 'AHMAD HAFIZI BIN AHMAD GIRAN',
  MAX_MB: 10,
  DIGEST_HOUR: 8,
  SESSION_HOURS: 6,
  DOWNLOAD_HOURS: 168,                                 // tempoh pensyarah boleh muat turun selepas ditandatangani (jam)
                                                       // selepas tempoh ini SEMUA fail dokumen itu dipadam kekal dari Drive
  TZ: 'Asia/Kuala_Lumpur'
};

const STATUS = {
  SUBMITTED: 'Dihantar', REVIEW: 'Dalam Semakan', SIGNED: 'Ditandatangani',
  RETURNED: 'Dikembalikan', REJECTED: 'Ditolak'
};

const HEADERS = {
  Staff: ['email', 'nama', 'noStaf', 'peranan', 'aktif', 'pdpaAck', 'salt', 'hash', 'tukarKataLaluan', 'logMasukTerakhir'],
  Requests: ['refNo', 'email', 'nama', 'jenis', 'tajuk', 'tarikhPerlu', 'catatan', 'status', 'versi',
    'fileId', 'pdfId', 'signedId', 'sha256', 'komen', 'dihantarPada', 'dikemaskiniPada',
    'ditandatanganiPada', 'namaFail', 'muatTurunHingga', 'failDipadam'],
  DocTypes: ['jenis', 'kataKunci', 'dx', 'dy', 'lebar'],
  AuditLog: ['masa', 'email', 'tindakan', 'refNo', 'butiran']
};

const DEFAULT_DOCTYPES = [
  ['Kertas Kerja', 'Disokong Oleh|Disemak Oleh|Diluluskan Oleh', 0, 48, 110],
  ['Minit Curai', 'Disemak Oleh', 0, 48, 110],
  ['CIR', 'Verified by', 55, 4, 90],
  ['Endorsed Assessment (Quiz/Test/Assignment)', 'Verified by', 0, 48, 100],
  ['Lain-lain', 'Disemak Oleh|Verified by|Disokong Oleh|Diluluskan Oleh', 0, 48, 110]
];

const ALLOWED_EXT = { pdf: 'pdf', docx: 'word', doc: 'word', xlsx: 'excel', xls: 'excel' };

// ====== SETUP (jalankan sekali) ======
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SS_ID', ss.getId());

  Object.keys(HEADERS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    // tulis/kemas kini baris tajuk (selamat dijalankan semula selepas naik taraf)
    sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]).setFontWeight('bold').setBackground('#e8eef7');
    sh.setFrozenRows(1);
    sh.getRange('A:Z').setNumberFormat('@');
  });
  ['Sheet1', 'Helaian1'].forEach(function (n) {
    const d = ss.getSheetByName(n);
    if (d && ss.getSheets().length > 1 && d.getLastRow() === 0) ss.deleteSheet(d);
  });

  const dt = ss.getSheetByName('DocTypes');
  if (dt.getLastRow() < 2) dt.getRange(2, 1, DEFAULT_DOCTYPES.length, 5).setValues(DEFAULT_DOCTYPES);

  if (!props.getProperty('ROOT_ID')) {
    const root = DriveApp.createFolder('Portal Tandatangan Jabatan');
    props.setProperties({
      ROOT_ID: root.getId(),
      SUBMITTED_ID: root.createFolder('Submitted').getId(),
      SIGNED_ID: root.createFolder('Signed').getId(),
      PRIVATE_ID: root.createFolder('Private').getId()
    });
  }

  const email = Session.getActiveUser().getEmail().toLowerCase();
  if (!findStaff_(email)) {
    const temp = tempPassword_();
    const cred = hashNew_(temp);
    appendRow_('Staff', { email: email, nama: CONFIG.HOD_NAME, peranan: 'hod', aktif: 'ya', salt: cred.salt, hash: cred.hash, tukarKataLaluan: 'ya' });
    Logger.log('Akaun KJ: ' + email + '  |  Kata laluan sementara: ' + temp);
  }

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['dailyDigest', 'cleanupFiles'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyDigest').timeBased().atHour(CONFIG.DIGEST_HOUR).everyDays(1).inTimezone(CONFIG.TZ).create();
  ScriptApp.newTrigger('cleanupFiles').timeBased().everyHours(1).create();
  Logger.log('Setup siap. Seterusnya: Deploy > New deployment > Web app.');
}

/** Jika terlupa kata laluan KJ: jalankan fungsi ini dari editor Apps Script. */
function resetKataLaluanSaya() {
  const email = Session.getActiveUser().getEmail().toLowerCase();
  const s = findStaff_(email);
  if (!s) throw new Error('Akaun tidak dijumpai. Jalankan setup() dahulu.');
  const temp = tempPassword_(), cred = hashNew_(temp);
  updateRow_('Staff', s._row, { salt: cred.salt, hash: cred.hash, tukarKataLaluan: 'ya' });
  Logger.log('Kata laluan sementara baharu: ' + temp);
}

// ====== API ======
const PUBLIC_ACTIONS = { login: 1, verify: 1, ping: 1 };
const HOD_ACTIONS = {
  hodInit: 1, getPdf: 1, getAssets: 1, saveAsset: 1, sign: 1, returnDoc: 1, rejectDoc: 1,
  savePosition: 1, saveDocType: 1, extendDownload: 1, staffList: 1, addStaff: 1, setStaffActive: 1, resetPassword: 1
};

function doGet() { return json_({ ok: true, data: 'Portal API aktif' }); }

function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    out = { ok: true, data: route_(req) };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return json_(out);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function route_(req) {
  const a = String(req.action || '');
  const p = req.params || {};
  if (a === 'ping') return 'ok';
  if (a === 'login') return login_(p.email, p.password);
  if (a === 'verify') return verifyInfo_(p.ref);
  const u = auth_(req.token);
  if (HOD_ACTIONS[a] && u.peranan !== 'hod') throw new Error('Hanya Ketua Jabatan dibenarkan.');
  const fn = ACTIONS[a];
  if (!fn) throw new Error('Tindakan tidak dikenali: ' + a);
  if (u.tukarKataLaluan === 'ya' && a !== 'changePassword' && a !== 'me' && a !== 'logout') {
    throw new Error('Sila tukar kata laluan sementara anda dahulu.');
  }
  return fn(u, p, req.token);
}

const ACTIONS = {
  me: function (u) { return userInfo_(u); },
  logout: function (u, p, token) { CacheService.getScriptCache().remove('s_' + token); return true; },
  changePassword: changePassword_,
  ackPdpa: function (u) { updateRow_('Staff', u._row, { pdpaAck: now_() }); return true; },
  init: function (u) {
    return {
      user: userInfo_(u),
      docTypes: readAll_('DocTypes').map(function (d) { return d.jenis; }),
      maxMb: CONFIG.MAX_MB, dept: CONFIG.DEPT_NAME, college: CONFIG.COLLEGE
    };
  },
  submit: submit_,
  resubmit: resubmit_,
  myRequests: function (u) {
    return readAll_('Requests').filter(function (r) { return r.email === u.email; }).map(publicRow_).reverse();
  },
  downloadSigned: downloadSigned_,
  extendDownload: extendDownload_,
  // --- KJ ---
  hodInit: hodInit_,
  getPdf: getPdf_,
  getAssets: getAssets_,
  saveAsset: saveAsset_,
  sign: sign_,
  returnDoc: function (u, p) { return decide_(u, p.ref, STATUS.RETURNED, p.komen); },
  rejectDoc: function (u, p) { return decide_(u, p.ref, STATUS.REJECTED, p.komen); },
  savePosition: function (u, p) { return savePosition_(p.jenis, p.dx, p.dy, p.lebar); },
  saveDocType: saveDocType_,
  staffList: function () {
    return readAll_('Staff').map(function (s) {
      return { email: s.email, nama: s.nama, noStaf: s.noStaf, peranan: s.peranan, aktif: s.aktif, logMasukTerakhir: s.logMasukTerakhir };
    });
  },
  addStaff: addStaff_,
  setStaffActive: setStaffActive_,
  resetPassword: resetPassword_
};

// ====== AKAUN & SESI ======
function login_(email, password) {
  email = String(email || '').trim().toLowerCase();
  const cache = CacheService.getScriptCache();
  const fk = 'f_' + email;
  const fails = Number(cache.get(fk) || 0);
  if (fails >= 5) throw new Error('Terlalu banyak cubaan. Cuba lagi selepas 15 minit.');
  const s = findStaff_(email);
  if (!s || String(s.aktif).toLowerCase() === 'tidak' || !s.hash || hash_(s.salt, String(password || '')) !== s.hash) {
    cache.put(fk, String(fails + 1), 900);
    Utilities.sleep(400);
    throw new Error('Emel atau kata laluan salah.');
  }
  cache.remove(fk);
  const token = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
  cache.put('s_' + token, email, CONFIG.SESSION_HOURS * 3600);
  updateRow_('Staff', s._row, { logMasukTerakhir: now_() });
  audit_(email, 'LOG MASUK', '', '');
  return { token: token, user: userInfo_(s) };
}

function auth_(token) {
  if (!token) throw new Error('SESI_TAMAT');
  const cache = CacheService.getScriptCache();
  const email = cache.get('s_' + token);
  if (!email) throw new Error('SESI_TAMAT');
  const s = findStaff_(email);
  if (!s || String(s.aktif).toLowerCase() === 'tidak') throw new Error('SESI_TAMAT');
  cache.put('s_' + token, email, CONFIG.SESSION_HOURS * 3600); // lanjutkan sesi
  return s;
}

function userInfo_(s) {
  return { email: s.email, nama: s.nama, peranan: s.peranan, pdpaAck: !!s.pdpaAck, tukarKataLaluan: s.tukarKataLaluan === 'ya' };
}

function changePassword_(u, p) {
  if (hash_(u.salt, String(p.oldPassword || '')) !== u.hash) throw new Error('Kata laluan semasa salah.');
  const np = String(p.newPassword || '');
  if (np.length < 8) throw new Error('Kata laluan baharu mesti sekurang-kurangnya 8 aksara.');
  if (!/[A-Za-z]/.test(np) || !/[0-9]/.test(np)) throw new Error('Kata laluan mesti ada huruf dan nombor.');
  const cred = hashNew_(np);
  updateRow_('Staff', u._row, { salt: cred.salt, hash: cred.hash, tukarKataLaluan: 'tidak' });
  audit_(u.email, 'TUKAR KATA LALUAN', '', '');
  return true;
}

function hash_(salt, password) {
  let h = salt + ':' + password;
  for (let i = 0; i < 300; i++) {
    h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt)
      .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  }
  return h;
}
function hashNew_(password) { const salt = Utilities.getUuid(); return { salt: salt, hash: hash_(salt, password) }; }

function tempPassword_() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s.slice(0, 5) + Math.floor(Math.random() * 10) + s.slice(5);
}

function sendCredentials_(email, nama, temp) {
  mail_(email, '[Portal Jabatan] Akaun anda',
    '<p>Salam ' + escape_(nama) + ',</p><p>Akaun Portal Tandatangan Jabatan telah disediakan untuk anda.</p>' +
    '<table cellpadding="6" style="border:1px solid #ddd;border-collapse:collapse"><tr><td><b>Emel</b></td><td>' + escape_(email) +
    '</td></tr><tr><td><b>Kata laluan sementara</b></td><td style="font-family:monospace;font-size:16px">' + escape_(temp) + '</td></tr></table>' +
    '<p>Anda akan diminta menukar kata laluan semasa log masuk kali pertama.</p>');
}

function resetPassword_(u, p) {
  const s = findStaff_(String(p.email || '').toLowerCase());
  if (!s) throw new Error('Staf tidak dijumpai.');
  const temp = tempPassword_(), cred = hashNew_(temp);
  updateRow_('Staff', s._row, { salt: cred.salt, hash: cred.hash, tukarKataLaluan: 'ya' });
  sendCredentials_(s.email, s.nama, temp);
  audit_(u.email, 'RESET KATA LALUAN', '', s.email);
  return true;
}

// ====== PENSYARAH ======
function submit_(u, p) {
  const jenis = String(p.jenis || '').trim();
  const tajuk = String(p.tajuk || '').trim().slice(0, 300);
  if (!jenis || !tajuk) throw new Error('Sila isi jenis dokumen dan tajuk.');
  if (readAll_('DocTypes').map(function (d) { return d.jenis; }).indexOf(jenis) < 0) throw new Error('Jenis dokumen tidak sah.');
  const files = saveUpload_(p);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ref = nextRef_();
    renameFiles_(files, ref, 1);
    appendRow_('Requests', {
      refNo: ref, email: u.email, nama: u.nama, jenis: jenis, tajuk: tajuk,
      tarikhPerlu: cleanDate_(p.tarikhPerlu), catatan: String(p.catatan || '').slice(0, 1000),
      status: STATUS.SUBMITTED, versi: '1', fileId: files.fileId, pdfId: files.pdfId,
      dihantarPada: now_(), dikemaskiniPada: now_(), namaFail: files.name
    });
    audit_(u.email, 'HANTAR', ref, jenis + ' – ' + tajuk);
    urgentNotify_(ref, u.nama, tajuk, cleanDate_(p.tarikhPerlu));
    return ref;
  } finally { lock.releaseLock(); }
}

function resubmit_(u, p) {
  const r = findRequest_(p.ref);
  if (!r || r.email !== u.email) throw new Error('Permohonan tidak dijumpai.');
  if (r.status !== STATUS.RETURNED) throw new Error('Hanya permohonan yang dikembalikan boleh dihantar semula.');
  const files = saveUpload_(p);
  deleteFiles_([r.fileId, r.pdfId]); // versi lama tidak disimpan
  const versi = String(Number(r.versi || 1) + 1);
  renameFiles_(files, r.refNo, versi);
  updateRow_('Requests', r._row, {
    fileId: files.fileId, pdfId: files.pdfId, namaFail: files.name, versi: versi,
    status: STATUS.SUBMITTED, dikemaskiniPada: now_(),
    catatan: p.catatan ? String(p.catatan).slice(0, 1000) : r.catatan
  });
  audit_(u.email, 'HANTAR SEMULA', r.refNo, 'Versi ' + versi);
  urgentNotify_(r.refNo, u.nama, r.tajuk, r.tarikhPerlu);
  return r.refNo;
}

/** KJ buka semula tempoh muat turun (DOWNLOAD_HOURS dari sekarang). */
function extendDownload_(u, p) {
  const r = findRequest_(p.ref);
  if (!r || r.status !== STATUS.SIGNED) throw new Error('Dokumen belum ditandatangani.');
  if (r.failDipadam) throw new Error('Fail telah dipadam kekal pada ' + r.failDipadam + '. Pensyarah perlu hantar semula dokumen jika perlu.');
  const until = addHours_(new Date(), CONFIG.DOWNLOAD_HOURS);
  updateRow_('Requests', r._row, { muatTurunHingga: until });
  audit_(u.email, 'BUKA SEMULA MUAT TURUN', r.refNo, 'hingga ' + until);
  mail_(r.email, '[Portal Jabatan] Muat turun dibuka semula – ' + r.refNo,
    '<p>Salam ' + escape_(r.nama) + ',</p><p>Dokumen <b>' + escape_(r.tajuk) + '</b> (' + r.refNo + ') boleh dimuat turun semula sehingga <b>' + until + '</b>.</p>');
  return { muatTurunHingga: until };
}

function downloadSigned_(u, p) {
  const r = findRequest_(p.ref);
  if (!r || (r.email !== u.email && u.peranan !== 'hod')) throw new Error('Tiada akses.');
  if (r.failDipadam) throw new Error('Fail telah dipadam dari pelayan pada ' + r.failDipadam + '.');
  if (r.status !== STATUS.SIGNED || !r.signedId) throw new Error('Dokumen belum ditandatangani.');
  if (u.peranan !== 'hod' && new Date() > parseDT_(expiry_(r))) {
    throw new Error('Tempoh muat turun telah tamat pada ' + expiry_(r) + '. Sila minta Ketua Jabatan membuka semula.');
  }
  const f = DriveApp.getFileById(r.signedId);
  audit_(u.email, 'MUAT TURUN', r.refNo, '');
  return { name: f.getName(), data: Utilities.base64Encode(f.getBlob().getBytes()) };
}

// ====== KETUA JABATAN ======
function hodInit_(u) {
  const props = PropertiesService.getScriptProperties();
  return {
    user: userInfo_(u),
    requests: readAll_('Requests').map(function (r) {
      const o = publicRow_(r);
      o.email = r.email;
      o.fileUrl = r.fileId ? 'https://drive.google.com/file/d/' + r.fileId + '/view' : '';
      return o;
    }),
    docTypes: readAll_('DocTypes').map(function (d) {
      return { jenis: d.jenis, kataKunci: d.kataKunci, dx: Number(d.dx) || 0, dy: Number(d.dy) || 0, lebar: Number(d.lebar) || 110 };
    }),
    hasSignature: !!props.getProperty('SIG_ID'),
    hasStamp: !!props.getProperty('STAMP_ID'),
    dept: CONFIG.DEPT_NAME, college: CONFIG.COLLEGE
  };
}

function getPdf_(u, p) {
  const r = findRequest_(p.ref);
  if (!r) throw new Error('Permohonan tidak dijumpai.');
  if (r.failDipadam) throw new Error('Fail telah dipadam kekal pada ' + r.failDipadam + '.');
  if (r.status === STATUS.SUBMITTED) {
    updateRow_('Requests', r._row, { status: STATUS.REVIEW, dikemaskiniPada: now_() });
    audit_(u.email, 'BUKA', r.refNo, '');
  }
  const id = r.status === STATUS.SIGNED && r.signedId ? r.signedId : r.pdfId;
  return Utilities.base64Encode(DriveApp.getFileById(id).getBlob().getBytes());
}

function getAssets_() {
  const props = PropertiesService.getScriptProperties();
  function b64(key) {
    const id = props.getProperty(key);
    if (!id) return null;
    try { return Utilities.base64Encode(DriveApp.getFileById(id).getBlob().getBytes()); } catch (e) { return null; }
  }
  return { sig: b64('SIG_ID'), stamp: b64('STAMP_ID') };
}

function saveAsset_(u, p) {
  const key = p.kind === 'stamp' ? 'STAMP_ID' : 'SIG_ID';
  const props = PropertiesService.getScriptProperties();
  const folder = DriveApp.getFolderById(prop_('PRIVATE_ID'));
  const old = props.getProperty(key);
  if (old) { try { DriveApp.getFileById(old).setTrashed(true); } catch (e) { } }
  const f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(String(p.data || '')), 'image/png', (p.kind === 'stamp' ? 'stamp' : 'sig') + '.png'));
  props.setProperty(key, f.getId());
  audit_(u.email, 'KEMASKINI ' + (p.kind === 'stamp' ? 'COP' : 'TANDATANGAN'), '', '');
  return true;
}

function sign_(u, p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const r = findRequest_(p.ref);
    if (!r) throw new Error('Permohonan tidak dijumpai.');
    if ([STATUS.SUBMITTED, STATUS.REVIEW].indexOf(r.status) < 0) throw new Error('Status semasa: ' + r.status);
    const bytes = Utilities.base64Decode(String(p.pdf || ''));
    const base = String(r.namaFail || 'dokumen').replace(/\.[^.]+$/, '');
    const f = DriveApp.getFolderById(prop_('SIGNED_ID'))
      .createFile(Utilities.newBlob(bytes, 'application/pdf', r.refNo + '_SIGNED_' + base + '.pdf'));
    const hash = sha256_(bytes);
    updateRow_('Requests', r._row, {
      status: STATUS.SIGNED, signedId: f.getId(), sha256: hash,
      ditandatanganiPada: now_(), dikemaskiniPada: now_(), komen: '',
      muatTurunHingga: addHours_(new Date(), CONFIG.DOWNLOAD_HOURS)
    });
    audit_(u.email, 'TANDATANGAN', r.refNo, 'sha256=' + hash);
    if (p.pos && p.pos.jenis) savePosition_(p.pos.jenis, p.pos.dx, p.pos.dy, p.pos.lebar);
    mail_(r.email, '[Portal Jabatan] Dokumen ditandatangani – ' + r.refNo,
      '<p>Salam ' + escape_(r.nama) + ',</p><p>Dokumen anda <b>' + escape_(r.tajuk) + '</b> (' + r.refNo +
      ') telah <b style="color:#157a3c">ditandatangani</b>.</p><p>Sila log masuk ke portal dan muat turun salinan PDF <b>sebelum ' +
      addHours_(new Date(), CONFIG.DOWNLOAD_HOURS) + '</b> (' + CONFIG.DOWNLOAD_HOURS / 24 + ' hari).</p><p style="color:#a3122a"><b>Penting:</b> selepas tempoh itu fail akan <b>dipadam kekal</b> dari pelayan jabatan. Sila simpan salinan anda sendiri.</p>');
    return { ref: r.refNo, sha256: hash };
  } finally { lock.releaseLock(); }
}

function decide_(u, ref, status, komen) {
  const r = findRequest_(ref);
  if (!r) throw new Error('Permohonan tidak dijumpai.');
  if ([STATUS.SUBMITTED, STATUS.REVIEW].indexOf(r.status) < 0) throw new Error('Status semasa: ' + r.status);
  komen = String(komen || '').slice(0, 1000);
  updateRow_('Requests', r._row, { status: status, komen: komen, dikemaskiniPada: now_() });
  audit_(u.email, status.toUpperCase(), r.refNo, komen);
  const returned = status === STATUS.RETURNED;
  mail_(r.email, '[Portal Jabatan] Dokumen ' + (returned ? 'dikembalikan' : 'ditolak') + ' – ' + r.refNo,
    '<p>Salam ' + escape_(r.nama) + ',</p><p>Dokumen anda <b>' + escape_(r.tajuk) + '</b> (' + r.refNo + ') telah <b>' +
    (returned ? 'dikembalikan untuk pembetulan' : 'ditolak') + '</b>.</p><p><b>Komen:</b> ' + escape_(komen || '-') + '</p>' +
    (returned ? '<p>Sila betulkan dan klik <b>Hantar Semula</b> di portal.</p>' : ''));
  return true;
}

function savePosition_(jenis, dx, dy, lebar) {
  const d = readAll_('DocTypes').filter(function (x) { return x.jenis === jenis; })[0];
  if (!d) return false;
  updateRow_('DocTypes', d._row, { dx: String(Math.round(dx)), dy: String(Math.round(dy)), lebar: String(Math.round(lebar)) });
  return true;
}

function saveDocType_(u, o) {
  const jenis = String(o.jenis || '').trim();
  if (!jenis) throw new Error('Nama jenis diperlukan.');
  const d = readAll_('DocTypes').filter(function (x) { return x.jenis === jenis; })[0];
  const row = { jenis: jenis, kataKunci: String(o.kataKunci || ''), dx: String(Number(o.dx) || 0), dy: String(Number(o.dy) || 48), lebar: String(Number(o.lebar) || 110) };
  if (d) updateRow_('DocTypes', d._row, row); else appendRow_('DocTypes', row);
  return true;
}

/** Tampal senarai: satu baris seorang – "Nama, emel, No Staf". Kata laluan sementara diemelkan automatik. */
function addStaff_(u, p) {
  let added = 0, updated = 0;
  const errors = [];
  String(p.text || '').split(/\r?\n/).forEach(function (line, i) {
    if (!line.trim()) return;
    const parts = line.split(/\t|,|;/).map(function (s) { return s.trim(); });
    const email = (parts.filter(function (x) { return /@/.test(x); })[0] || '').toLowerCase();
    const others = parts.filter(function (x) { return x && !/@/.test(x); });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errors.push('Baris ' + (i + 1) + ': emel tidak sah'); return; }
    const ex = findStaff_(email);
    if (ex) {
      updateRow_('Staff', ex._row, { nama: others[0] || ex.nama, noStaf: others[1] || ex.noStaf, aktif: 'ya' });
      updated++;
    } else {
      const temp = tempPassword_(), cred = hashNew_(temp);
      appendRow_('Staff', { email: email, nama: others[0] || email, noStaf: others[1] || '', peranan: 'pensyarah', aktif: 'ya', salt: cred.salt, hash: cred.hash, tukarKataLaluan: 'ya' });
      sendCredentials_(email, others[0] || email, temp);
      added++;
    }
  });
  audit_(u.email, 'TAMBAH STAF', '', added + ' baru, ' + updated + ' dikemas kini');
  return { added: added, updated: updated, errors: errors };
}

function setStaffActive_(u, p) {
  const s = findStaff_(String(p.email || '').toLowerCase());
  if (!s) throw new Error('Staf tidak dijumpai.');
  if (s.email === u.email) throw new Error('Tidak boleh nyahaktif akaun sendiri.');
  updateRow_('Staff', s._row, { aktif: p.aktif ? 'ya' : 'tidak' });
  audit_(u.email, p.aktif ? 'AKTIFKAN STAF' : 'NYAHAKTIF STAF', '', s.email);
  return true;
}

// ====== SEMAKAN AWAM (QR) ======
function verifyInfo_(ref) {
  ref = String(ref || '').replace(/[^A-Za-z0-9-]/g, '');
  const r = findRequest_(ref);
  if (!r || r.status !== STATUS.SIGNED) return { found: false, ref: ref };
  const hod = readAll_('Staff').filter(function (s) { return s.peranan === 'hod'; })[0];
  return {
    found: true, ref: r.refNo, nama: r.nama, jenis: r.jenis, tajuk: r.tajuk,
    ditandatanganiPada: r.ditandatanganiPada, oleh: hod ? hod.nama : 'Ketua Jabatan',
    sha256: r.sha256, dept: CONFIG.DEPT_NAME, college: CONFIG.COLLEGE
  };
}

// ====== PADAM FAIL AUTOMATIK (trigger setiap jam) ======
/**
 * Padam KEKAL semua fail (asal, PDF, bertandatangan) bagi:
 *  - dokumen Ditandatangani yang tempoh muat turunnya sudah tamat
 *  - dokumen Ditolak, DOWNLOAD_HOURS selepas ditolak
 * Rekod dalam Sheet (no. rujukan, hash SHA-256) dikekalkan supaya semakan QR masih berfungsi.
 */
function cleanupFiles() {
  const nowD = new Date();
  readAll_('Requests').forEach(function (r) {
    if (r.failDipadam) return;
    let due = null;
    if (r.status === STATUS.SIGNED) due = parseDT_(expiry_(r));
    if (r.status === STATUS.REJECTED && r.dikemaskiniPada) due = new Date(parseDT_(r.dikemaskiniPada).getTime() + CONFIG.DOWNLOAD_HOURS * 3600000);
    if (!due || nowD < due) return;
    deleteFiles_([r.fileId, r.pdfId, r.signedId]);
    updateRow_('Requests', r._row, { fileId: '', pdfId: '', signedId: '', failDipadam: now_() });
    audit_('sistem', 'PADAM FAIL', r.refNo, 'Tempoh simpanan tamat');
  });
}

/** Padam kekal (bukan ke Trash). Jika gagal, alih ke Trash sebagai sandaran. */
function deleteFiles_(ids) {
  const seen = {};
  (ids || []).forEach(function (id) {
    if (!id || seen[id]) return;
    seen[id] = 1;
    try { Drive.Files.remove(id); }
    catch (e) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e2) { } }
  });
}

// ====== EMEL HARIAN ======
function dailyDigest() {
  const day = Number(Utilities.formatDate(new Date(), CONFIG.TZ, 'u'));
  if (day >= 6) return;
  const pending = readAll_('Requests').filter(function (r) { return r.status === STATUS.SUBMITTED || r.status === STATUS.REVIEW; });
  if (!pending.length) return;
  const today = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd');
  const urgent = pending.filter(function (r) { return r.tarikhPerlu && daysBetween_(today, r.tarikhPerlu) <= 2; });
  const rows = pending.sort(function (a, b) { return (a.tarikhPerlu || '9999') < (b.tarikhPerlu || '9999') ? -1 : 1; })
    .slice(0, 20).map(function (r) {
      return '<tr><td>' + r.refNo + '</td><td>' + escape_(r.nama) + '</td><td>' + escape_(r.jenis) + '</td><td>' +
        escape_(r.tajuk) + '</td><td>' + (r.tarikhPerlu || '-') + '</td></tr>';
    }).join('');
  hodEmails_().forEach(function (to) {
    mail_(to, '[Portal Jabatan] ' + pending.length + ' dokumen perlu tandatangan' + (urgent.length ? ' (' + urgent.length + ' segera)' : ''),
      '<p>Ringkasan pagi ini:</p><table border="1" cellpadding="6" style="border-collapse:collapse;font-size:13px">' +
      '<tr><th>Rujukan</th><th>Pensyarah</th><th>Jenis</th><th>Tajuk</th><th>Tarikh perlu</th></tr>' + rows + '</table>');
  });
}

// ====== HELPERS ======
function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}
function prop_(k) {
  const v = PropertiesService.getScriptProperties().getProperty(k);
  if (!v) throw new Error('Sila jalankan setup() dahulu.');
  return v;
}
function now_() { return Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm'); }

function readAll_(name) {
  const sh = ss_().getSheetByName(name);
  const values = sh.getDataRange().getDisplayValues();
  const head = values.shift();
  return values.map(function (row, i) {
    const o = { _row: i + 2 };
    head.forEach(function (h, j) { o[h] = row[j]; });
    return o;
  }).filter(function (o) { return o[head[0]] !== ''; });
}
function appendRow_(name, obj) {
  ss_().getSheetByName(name).appendRow(HEADERS[name].map(function (h) { return obj[h] === undefined ? '' : String(obj[h]); }));
}
function updateRow_(name, rowIndex, obj) {
  const sh = ss_().getSheetByName(name), head = HEADERS[name];
  const range = sh.getRange(rowIndex, 1, 1, head.length);
  const row = range.getValues()[0];
  head.forEach(function (h, j) { if (obj[h] !== undefined) row[j] = String(obj[h]); });
  range.setValues([row]);
}
function findStaff_(email) {
  email = String(email || '').toLowerCase();
  return readAll_('Staff').filter(function (s) { return String(s.email).toLowerCase() === email; })[0] || null;
}
function findRequest_(ref) {
  return readAll_('Requests').filter(function (r) { return r.refNo === String(ref || ''); })[0] || null;
}
function hodEmails_() {
  return readAll_('Staff').filter(function (s) { return s.peranan === 'hod' && s.aktif !== 'tidak'; }).map(function (s) { return s.email; });
}
function audit_(email, action, ref, detail) {
  appendRow_('AuditLog', { masa: now_(), email: email, tindakan: action, refNo: ref || '', butiran: detail || '' });
}
function nextRef_() {
  const prefix = 'KPTM-' + CONFIG.DEPT_CODE + '-' + Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy') + '-';
  let max = 0;
  readAll_('Requests').forEach(function (r) {
    if (r.refNo.indexOf(prefix) === 0) max = Math.max(max, Number(r.refNo.slice(prefix.length)) || 0);
  });
  return prefix + ('000' + (max + 1)).slice(-4);
}
function publicRow_(r) {
  return {
    refNo: r.refNo, nama: r.nama, jenis: r.jenis, tajuk: r.tajuk, tarikhPerlu: r.tarikhPerlu,
    catatan: r.catatan, status: r.status, versi: r.versi, komen: r.komen, dihantarPada: r.dihantarPada,
    dikemaskiniPada: r.dikemaskiniPada, ditandatanganiPada: r.ditandatanganiPada, namaFail: r.namaFail,
    muatTurunHingga: r.status === STATUS.SIGNED ? expiry_(r) : '',
    failDipadam: r.failDipadam || ''
  };
}
/** Tarikh akhir muat turun (format yyyy-MM-dd HH:mm, waktu Malaysia). */
function expiry_(r) {
  if (r.muatTurunHingga) return r.muatTurunHingga;
  return r.ditandatanganiPada ? addHours_(parseDT_(r.ditandatanganiPada), CONFIG.DOWNLOAD_HOURS) : '';
}
function parseDT_(s) { return new Date(String(s).replace(' ', 'T') + ':00+08:00'); }
function addHours_(d, h) { return Utilities.formatDate(new Date(d.getTime() + h * 3600000), CONFIG.TZ, 'yyyy-MM-dd HH:mm'); }
function cleanDate_(s) { s = String(s || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
function daysBetween_(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }

function saveUpload_(p) {
  const name = String(p.fileName || 'dokumen').replace(/[\\/:*?"<>|]/g, '_').slice(0, 150);
  const ext = ((name.match(/\.([a-z0-9]+)$/i) || [])[1] || '').toLowerCase();
  const kind = ALLOWED_EXT[ext];
  if (!kind) throw new Error('Format fail tidak disokong. Guna PDF, Word atau Excel.');
  const bytes = Utilities.base64Decode(String(p.data || ''));
  if (!bytes.length) throw new Error('Fail kosong.');
  if (bytes.length > CONFIG.MAX_MB * 1024 * 1024) throw new Error('Fail melebihi ' + CONFIG.MAX_MB + 'MB.');
  const blob = Utilities.newBlob(bytes, String(p.mimeType || 'application/octet-stream'), name);
  const folder = DriveApp.getFolderById(prop_('SUBMITTED_ID'));
  const orig = folder.createFile(blob);
  const pdf = kind === 'pdf' ? orig : folder.createFile(toPdf_(blob, kind));
  return { fileId: orig.getId(), pdfId: pdf.getId(), name: name };
}
function renameFiles_(files, ref, versi) {
  DriveApp.getFileById(files.fileId).setName(ref + '_v' + versi + '_' + files.name);
  if (files.pdfId !== files.fileId) {
    DriveApp.getFileById(files.pdfId).setName(ref + '_v' + versi + '_' + files.name.replace(/\.[^.]+$/, '') + '.pdf');
  }
}
/** Tukar Word/Excel kepada PDF (perlukan servis Drive API – lihat appsscript.json). */
function toPdf_(blob, kind) {
  const target = kind === 'word' ? MimeType.GOOGLE_DOCS : MimeType.GOOGLE_SHEETS;
  const tmp = Drive.Files.create({ name: 'tmp_' + blob.getName(), mimeType: target }, blob);
  try {
    let pdf;
    if (kind === 'excel') {
      const url = 'https://docs.google.com/spreadsheets/d/' + tmp.id + '/export?format=pdf&size=A4&portrait=false' +
        '&fitw=true&gridlines=false&printtitle=false&sheetnames=false&pagenum=UNDEFINED&fzr=false';
      pdf = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } }).getBlob();
    } else {
      pdf = DriveApp.getFileById(tmp.id).getAs(MimeType.PDF);
    }
    return pdf.setName(blob.getName().replace(/\.[^.]+$/, '') + '.pdf');
  } finally {
    deleteFiles_([tmp.id]);
  }
}
function sha256_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function urgentNotify_(ref, nama, tajuk, due) {
  if (!due) return;
  const today = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd');
  if (daysBetween_(today, due) > 1) return;
  hodEmails_().forEach(function (to) {
    mail_(to, '[Portal Jabatan] SEGERA – ' + ref,
      '<p><b>' + escape_(nama) + '</b> menghantar <b>' + escape_(tajuk) + '</b> yang perlu ditandatangani sebelum <b>' + due + '</b>.</p>');
  });
}
function mail_(to, subject, html) {
  try {
    MailApp.sendEmail({
      to: to, subject: subject, name: 'Portal Tandatangan ' + CONFIG.DEPT_CODE,
      htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px">' + html +
        '<p><a href="' + CONFIG.SITE_URL + '">Buka Portal Jabatan</a></p>' +
        '<p style="color:#888;font-size:12px">Emel automatik – ' + CONFIG.DEPT_NAME + ', ' + CONFIG.COLLEGE + '</p></div>'
    });
  } catch (e) { console.error('Emel gagal: ' + e); }
}
function escape_(s) {
  return String(s || '').replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
