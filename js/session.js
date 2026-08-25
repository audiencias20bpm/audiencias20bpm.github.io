(function () {
  'use strict';

  var TOKEN_STORAGE_KEY = 'audiencias_session_token';
  var USER_STORAGE_KEY = 'audiencias_session_user';
  var EXPIRES_STORAGE_KEY = 'audiencias_session_expires_at';
  var ACTIVITY_THROTTLE_MS = 60000;

  var timerId = null;
  var validating = false;
  var lastActivityValidationAt = 0;
  var activityBound = false;

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
      perfil: user.perfil || user.role || current.perfil || ''
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
    var indicator = document.getElementById('session-indicator');
    var timer = document.getElementById('session-timer');

    if (!indicator || !timer) {
      return;
    }

    timer.textContent = formatRemaining_(remainingMs);

    indicator.classList.remove('session-warning', 'session-critical');

    if (remainingMs <= 60000) {
      indicator.classList.add('session-critical');
    } else if (remainingMs <= 300000) {
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

  function afterLogin_() {
    bindActivity_();
    startTimer_();
  }

  function init_() {
    bindActivity_();

    if (!getToken_()) {
      return;
    }

    validateSession_({ expireOnNetworkError: true });
  }

  document.addEventListener('DOMContentLoaded', init_);

  window.Session = Object.freeze({
    afterLogin: afterLogin_,
    validate: validateSession_,
    expireLocalSession: expireLocalSession_
  });
}());
