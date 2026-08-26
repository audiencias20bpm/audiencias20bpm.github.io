(function () {
  'use strict';

  var TOKEN_STORAGE_KEY = 'audiencias_session_token';

  function isObject_(value) { return value !== null && typeof value === 'object'; }
  function isSuccess_(response) {
    return Boolean(isObject_(response) && (response.success === true || response.sucesso === true || response.ok === true));
  }
  function getData_(response) {
    if (!isObject_(response)) return {};
    if (isObject_(response.data)) return response.data;
    if (isObject_(response.dados)) return response.dados;
    return response;
  }
  function getErrorCode_(response) {
    var data = getData_(response);
    return String(data.code || data.codigo || response.code || response.codigo || '').toUpperCase();
  }
  function handleExpiredSession_() {
    if (window.Auth && typeof window.Auth.clearStoredSession === 'function') window.Auth.clearStoredSession();
    if (window.Auth && typeof window.Auth.showLogin === 'function') window.Auth.showLogin('Sua sessão expirou. Entre novamente para continuar.');
  }
  function updateExpiry_(data) {
    if (data.expira_em && window.Session && typeof window.Session.updateExpiry === 'function') window.Session.updateExpiry(data.expira_em);
  }
  function setLoading_(loading) {
    var el = document.getElementById('documentos-loading');
    var form = document.getElementById('documentos-config-form');
    if (el) el.hidden = !loading;
    if (form) form.hidden = loading;
  }
  function setError_(message) {
    var el = document.getElementById('documentos-error');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  }
  function setSuccess_(message) {
    var el = document.getElementById('documentos-success');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  }
  function updateNextNumber_() {
    var year = document.getElementById('oficio-ano');
    var last = document.getElementById('oficio-ultimo-numero');
    var next = document.getElementById('oficio-proximo-numero');
    if (!year || !last || !next) return;
    var y = parseInt(year.value, 10);
    var l = parseInt(last.value, 10);
    if (!Number.isFinite(y) || !Number.isFinite(l) || l < 0) {
      next.value = '—';
      return;
    }
    next.value = String(l + 1).padStart(3, '0') + '/' + y;
  }
  function fill_(config) {
    var c = config || {};
    document.getElementById('oficio-ano').value = c.oficio_ano || new Date().getFullYear();
    document.getElementById('oficio-ultimo-numero').value = c.oficio_ultimo_numero !== undefined && c.oficio_ultimo_numero !== '' ? c.oficio_ultimo_numero : 0;
    document.getElementById('signatario-nome').value = c.signatario_nome || '';
    document.getElementById('signatario-posto').value = c.signatario_posto_graduacao || '';
    document.getElementById('signatario-rg').value = c.signatario_rg || '';
    document.getElementById('signatario-cargo').value = c.signatario_cargo || '';
    updateNextNumber_();
    var status = document.getElementById('documentos-config-status');
    if (status) status.textContent = c.configurada ? 'Configurado' : 'Configuração inicial';
  }
  function load_() {
    var token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
    if (!token) { handleExpiredSession_(); return Promise.resolve(false); }
    setLoading_(true); setError_(''); setSuccess_('');
    return window.Api.post('oficios_config_get', { token: token }).then(function (response) {
      if (!isSuccess_(response)) {
        var code = getErrorCode_(response);
        if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0) { handleExpiredSession_(); return false; }
        throw new Error('Não foi possível carregar a configuração dos ofícios.');
      }
      var data = getData_(response);
      updateExpiry_(data);
      fill_(data.configuracao || {});
      return true;
    }).catch(function (error) {
      setError_(error && error.message ? error.message : 'Não foi possível carregar a configuração dos ofícios.');
      return false;
    }).finally(function () { setLoading_(false); });
  }
  function submit_(event) {
    event.preventDefault();
    var token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
    if (!token) { handleExpiredSession_(); return; }
    var year = parseInt(document.getElementById('oficio-ano').value, 10);
    var last = parseInt(document.getElementById('oficio-ultimo-numero').value, 10);
    var payload = {
      token: token,
      oficio_ano: year,
      oficio_ultimo_numero: last,
      signatario_nome: document.getElementById('signatario-nome').value.trim(),
      signatario_posto_graduacao: document.getElementById('signatario-posto').value.trim(),
      signatario_rg: document.getElementById('signatario-rg').value.replace(/\D+/g, ''),
      signatario_cargo: document.getElementById('signatario-cargo').value.trim()
    };
    if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(last) || last < 0 || !payload.signatario_nome || !payload.signatario_posto_graduacao || !payload.signatario_rg || !payload.signatario_cargo) {
      setError_('Preencha corretamente todos os campos da configuração.');
      return;
    }
    var button = document.getElementById('documentos-config-save');
    if (button) { button.disabled = true; button.textContent = 'Salvando...'; }
    setError_(''); setSuccess_('');
    window.Api.post('oficios_config_save', payload).then(function (response) {
      if (!isSuccess_(response)) {
        var code = getErrorCode_(response);
        if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0) { handleExpiredSession_(); return; }
        throw new Error('Não foi possível salvar a configuração dos ofícios.');
      }
      var data = getData_(response);
      updateExpiry_(data);
      fill_(data.configuracao || payload);
      setSuccess_('Configuração salva. A próxima numeração continuará a partir do valor informado.');
    }).catch(function (error) {
      setError_(error && error.message ? error.message : 'Não foi possível salvar a configuração dos ofícios.');
    }).finally(function () {
      if (button) { button.disabled = false; button.textContent = 'Salvar configuração'; }
    });
  }
  function open() {
    var dashboard = document.getElementById('dashboard-home');
    var audiencias = document.getElementById('audiencias-view');
    var destinatarios = document.getElementById('destinatarios-view');
    var documentos = document.getElementById('documentos-view');
    if (dashboard) dashboard.hidden = true;
    if (audiencias) audiencias.hidden = true;
    if (destinatarios) destinatarios.hidden = true;
    if (documentos) documentos.hidden = false;
    load_();
  }
  function back() {
    var documentos = document.getElementById('documentos-view');
    var dashboard = document.getElementById('dashboard-home');
    if (documentos) documentos.hidden = true;
    if (dashboard) dashboard.hidden = false;
  }
  function bind_() {
    var backButton = document.getElementById('documentos-back');
    var form = document.getElementById('documentos-config-form');
    var year = document.getElementById('oficio-ano');
    var last = document.getElementById('oficio-ultimo-numero');
    if (backButton) backButton.addEventListener('click', back);
    if (form) form.addEventListener('submit', submit_);
    if (year) year.addEventListener('input', updateNextNumber_);
    if (last) last.addEventListener('input', updateNextNumber_);
  }
  document.addEventListener('DOMContentLoaded', bind_);
  window.Documentos = Object.freeze({ open: open, back: back, reload: load_ });
}());
