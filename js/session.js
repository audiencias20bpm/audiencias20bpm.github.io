(function () {
  'use strict';

  var TOKEN_STORAGE_KEY = 'audiencias_session_token';
  var USER_STORAGE_KEY = 'audiencias_session_user';
  var EXPIRES_STORAGE_KEY = 'audiencias_session_expires_at';
  var ACTIVITY_THROTTLE_MS = 60000;
  var MAX_VISUAL_SESSION_MS = 30 * 60 * 1000;

  var timerId = null;
  var validating = false;
  var lastActivityValidationAt = 0;
  var activityBound = false;
  var loggingOut = false;

  function isObject_(value) {
    return value !== null && typeof value === 'object';
  }

  function getToken_() {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
  }

  function getStoredUser_() {
    var raw = sessionStorage.getItem(USER_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    try {
      var parsed = JSON.parse(raw);
      return isObject_(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function saveUser_(user) {
    if (!isObject_(user)) {
      return;
    }

    var current = getStoredUser_() || {};
    var merged = {
      id: user.id || current.id || '',
      nome: user.nome || user.name || current.nome || '',
      login: user.login || current.login || '',
      perfil: user.perfil || user.role || current.perfil || '',
      tipo_conta: user.tipo_conta || current.tipo_conta || '',
      troca_senha_pendente: user.troca_senha_pendente === true
    };

    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(merged));
  }

  function getExpiresAt_() {
    return sessionStorage.getItem(EXPIRES_STORAGE_KEY) || '';
  }

  function saveExpiresAt_(value) {
    if (value) {
      sessionStorage.setItem(EXPIRES_STORAGE_KEY, String(value));
    }
  }

  function parseExpiry_(value) {
    var timestamp = Date.parse(String(value || ''));
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function formatRemaining_(milliseconds) {
    var totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;

    return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  }

  function getSessionData_(response) {
    if (!isObject_(response)) {
      return {};
    }

    if (isObject_(response.data)) {
      return response.data;
    }
    if (isObject_(response.dados)) {
      return response.dados;
    }

    return response;
  }

  function isSuccess_(response) {
    return Boolean(
      isObject_(response) &&
      (response.success === true || response.sucesso === true || response.ok === true)
    );
  }

  function setIndicatorState_(remainingMs) {
    var visualRemainingMs = Math.min(Math.max(0, remainingMs), MAX_VISUAL_SESSION_MS);
    var indicator = document.getElementById('session-indicator');
    var timer = document.getElementById('session-timer');

    if (!indicator || !timer) {
      return;
    }

    timer.textContent = formatRemaining_(visualRemainingMs);

    indicator.classList.remove('session-warning', 'session-critical');

    if (visualRemainingMs <= 60000) {
      indicator.classList.add('session-critical');
    } else if (visualRemainingMs <= 300000) {
      indicator.classList.add('session-warning');
    }
  }

  function stopTimer_() {
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function expireLocalSession_(messageText) {
    stopTimer_();

    if (window.Auth && typeof window.Auth.clearStoredSession === 'function') {
      window.Auth.clearStoredSession();
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(USER_STORAGE_KEY);
      sessionStorage.removeItem(EXPIRES_STORAGE_KEY);
    }

    if (window.Auth && typeof window.Auth.showLogin === 'function') {
      window.Auth.showLogin(messageText || 'Sua sessão expirou. Entre novamente para continuar.');
    }
  }

  function tick_() {
    var expiry = parseExpiry_(getExpiresAt_());

    if (!expiry) {
      return;
    }

    var remaining = expiry - Date.now();
    setIndicatorState_(remaining);

    if (remaining <= 0) {
      expireLocalSession_();
    }
  }

  function startTimer_() {
    stopTimer_();
    tick_();
    timerId = window.setInterval(tick_, 1000);
  }

  function applyValidSession_(response) {
    var data = getSessionData_(response);

    if (data.usuario) {
      saveUser_(data.usuario);
    }

    if (data.expira_em) {
      saveExpiresAt_(data.expira_em);
    }

    if (window.Auth && typeof window.Auth.showAuthenticated === 'function') {
      window.Auth.showAuthenticated(getStoredUser_());
    }

    startTimer_();
  }


  function updateExpiry_(value) {
    if (!value) {
      return;
    }
    saveExpiresAt_(value);
    tick_();
  }

  function validateSession_(options) {
    var opts = options || {};
    var token = getToken_();

    if (!token) {
      return Promise.resolve(false);
    }

    if (validating) {
      return Promise.resolve(true);
    }

    validating = true;

    return window.Api.post('session', {
      token: token
    }).then(function (response) {
      if (!isSuccess_(response)) {
        expireLocalSession_();
        return false;
      }

      applyValidSession_(response);
      return true;
    }).catch(function () {
      if (opts.expireOnNetworkError === true) {
        expireLocalSession_('Não foi possível validar sua sessão agora. Entre novamente para continuar.');
      }
      return false;
    }).finally(function () {
      validating = false;
    });
  }

  function handleActivity_() {
    if (!getToken_()) {
      return;
    }

    var now = Date.now();
    if (now - lastActivityValidationAt < ACTIVITY_THROTTLE_MS) {
      return;
    }

    lastActivityValidationAt = now;
    validateSession_({ expireOnNetworkError: false });
  }

  function bindActivity_() {
    if (activityBound) {
      return;
    }

    activityBound = true;
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (eventName) {
      document.addEventListener(eventName, handleActivity_, { passive: true });
    });
  }


  function setLogoutBusy_(busy) {
    var overlay = document.getElementById('logout-overlay');
    var button = document.getElementById('logout-button');
    var message = document.getElementById('logout-message');

    loggingOut = busy;

    if (overlay) {
      overlay.hidden = !busy;
    }
    if (button) {
      button.disabled = busy;
      button.setAttribute('aria-disabled', busy ? 'true' : 'false');
    }
    if (message && busy) {
      message.hidden = true;
      message.textContent = '';
    }
  }

  function showLogoutError_() {
    var message = document.getElementById('logout-message');
    if (!message) {
      return;
    }
    message.textContent = 'Não foi possível encerrar a sessão agora. Tente novamente.';
    message.hidden = false;
  }

  function clearSessionStorage_() {
    if (window.Auth && typeof window.Auth.clearStoredSession === 'function') {
      window.Auth.clearStoredSession();
      return;
    }
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
    sessionStorage.removeItem(EXPIRES_STORAGE_KEY);
  }

  function logout_() {
    if (loggingOut) {
      return Promise.resolve(false);
    }

    var token = getToken_();
    if (!token) {
      clearSessionStorage_();
      window.location.replace('./');
      return Promise.resolve(true);
    }

    setLogoutBusy_(true);

    return window.Api.post('logout', { token: token })
      .then(function (response) {
        if (!isSuccess_(response)) {
          throw new Error('LOGOUT_RECUSADO');
        }

        stopTimer_();
        clearSessionStorage_();
        window.location.replace('./');
        return true;
      })
      .catch(function () {
        setLogoutBusy_(false);
        showLogoutError_();
        return false;
      });
  }

  function bindLogout_() {
    var button = document.getElementById('logout-button');
    if (!button || button.dataset.bound === 'true') {
      return;
    }

    button.dataset.bound = 'true';
    button.addEventListener('click', function () {
      logout_();
    });
  }

  function afterLogin_() {
    bindActivity_();
    bindLogout_();
    startTimer_();
  }

  function init_() {
    bindActivity_();
    bindLogout_();

    if (!getToken_()) {
      if (window.Auth && typeof window.Auth.showLogin === 'function') {
        window.Auth.showLogin('');
      }
      return;
    }

    if (window.Auth && typeof window.Auth.showValidating === 'function') {
      window.Auth.showValidating();
    }

    validateSession_({ expireOnNetworkError: true });
  }

  document.addEventListener('DOMContentLoaded', init_);

  window.Session = Object.freeze({
    updateExpiry: updateExpiry_,
    afterLogin: afterLogin_,
    validate: validateSession_,
    expireLocalSession: expireLocalSession_,
    logout: logout_
  });
}());
