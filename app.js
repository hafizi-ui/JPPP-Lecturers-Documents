/* Portal Tandatangan – log masuk & penghala */
(function () {
  'use strict';
  var $ = P.$;
  var VIEWS = ['viewLogin', 'viewChangePw', 'viewLecturer', 'viewHod'];

  function only(id) {
    P.show('boot', false);
    VIEWS.forEach(function (v) { P.show(v, v === id); });
    var inApp = id === 'viewLecturer' || id === 'viewHod';
    P.show('topbar', inApp);
    P.show('demoRibbon', P.DEMO && inApp);
    document.body.classList.toggle('in-app', inApp);
  }

  function showLogin(msg) {
    only('viewLogin');
    P.show('demoBox', P.DEMO);
    $('loginErr').textContent = msg || '';
    setTimeout(function () { $('lgEmail').focus(); }, 50);
  }

  function showChangePw(forced) {
    only('viewChangePw');
    $('pwForm').reset(); $('pwErr').textContent = ''; $('pwMeter').style.width = '0';
    $('pwNote').textContent = forced ? 'Sila tukar kata laluan sementara anda sebelum meneruskan.' : 'Masukkan kata laluan semasa dan kata laluan baharu.';
    P.show('btnPwCancel', !forced);
  }

  function enter(user) {
    P.session.user = user;
    if (user.tukarKataLaluan) return showChangePw(true);
    $('userName').textContent = user.nama;
    $('userRole').textContent = user.peranan === 'hod' ? 'Ketua Jabatan' : 'Pensyarah';
    $('avatar').textContent = P.initials(user.nama);
    P.show('tabs', user.peranan === 'hod');
    if (user.peranan === 'hod') { only('viewHod'); window.Hod.start(user); }
    else { only('viewLecturer'); window.Lecturer.start(user); }
  }

  // ---- Log masuk ----
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('btnLogin');
    $('loginErr').textContent = '';
    P.busy(btn, true, 'Log masuk…');
    P.api('login', { email: $('lgEmail').value.trim(), password: $('lgPass').value }).then(function (r) {
      P.setSession(r.token, r.user);
      $('lgPass').value = '';
      enter(r.user);
    }).catch(function (err) {
      $('loginErr').textContent = err.message;
    }).then(function () { P.busy(btn, false); });
  });
  document.querySelectorAll('[data-demo]').forEach(function (b) {
    b.addEventListener('click', function () {
      $('lgEmail').value = b.getAttribute('data-demo'); $('lgPass').value = 'demo1234';
      $('loginForm').requestSubmit ? $('loginForm').requestSubmit() : $('btnLogin').click();
    });
  });
  document.querySelectorAll('[data-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var i = $(b.getAttribute('data-toggle')), on = i.type === 'password';
      i.type = on ? 'text' : 'password'; b.textContent = on ? 'Sorok' : 'Tunjuk';
    });
  });

  // ---- Tukar kata laluan ----
  $('pwNew').addEventListener('input', function () {
    var v = this.value, s = 0;
    if (v.length >= 8) s++; if (v.length >= 12) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
    if (/\d/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++;
    var m = $('pwMeter'); m.style.width = (s * 20) + '%'; m.className = s <= 2 ? 'weak' : s <= 3 ? 'ok' : 'strong';
  });
  $('pwForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var n1 = $('pwNew').value, n2 = $('pwNew2').value;
    if (n1 !== n2) { $('pwErr').textContent = 'Kata laluan baharu tidak sepadan.'; return; }
    var btn = $('btnPw'); P.busy(btn, true, 'Menyimpan…');
    P.api('changePassword', { oldPassword: $('pwOld').value, newPassword: n1 }).then(function () {
      P.toast('Kata laluan dikemas kini.');
      return P.api('me');
    }).then(function (u) { enter(u); })
      .catch(function (err) { $('pwErr').textContent = err.message; })
      .then(function () { P.busy(btn, false); });
  });
  $('btnPwCancel').addEventListener('click', function () { enter(P.session.user); });

  // ---- Menu pengguna ----
  $('userBtn').addEventListener('click', function (e) { e.stopPropagation(); P.show('userMenu', $('userMenu').hidden); });
  document.addEventListener('click', function () { P.show('userMenu', false); });
  $('mnPw').addEventListener('click', function () { showChangePw(false); });
  $('mnLogout').addEventListener('click', function () {
    P.api('logout').catch(function () { });
    P.clearSession();
    location.hash = '';
    location.reload();
  });

  // ---- Mula ----
  window.App = { showLogin: showLogin, enter: enter };
  function boot() {
    if (!P.session.token) return showLogin();
    P.api('me').then(enter).catch(function () { P.clearSession(); showLogin(); });
  }
  boot();
})();
