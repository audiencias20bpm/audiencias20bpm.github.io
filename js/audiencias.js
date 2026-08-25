(function () {
  'use strict';

  var TOKEN_STORAGE_KEY = 'audiencias_session_token';
  var DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Belem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  function isObject_(value) {
    return value !== null && typeof value === 'object';
  }

  function isSuccess_(response) {
    return Boolean(
      isObject_(response) &&
      (response.success === true || response.sucesso === true || response.ok === true)
    );
  }

  function getData_(response) {
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

  function getErrorCode_(response) {
    var data = getData_(response);
    return String(data.code || response.code || '').toUpperCase();
  }

  function escapeText_(value) {
    return String(value === null || value === undefined ? '' : value);
  }

  function formatDate_(value) {
    if (!value) {
      return 'Não informada';
    }

    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return escapeText_(value);
    }

    return DATE_FORMATTER.format(date);
  }

  function normalizeStatus_(value) {
    var status = String(value || '').trim().toUpperCase();
    return status || 'SEM_STATUS';
  }

  function statusLabel_(status) {
    var labels = {
      AGENDADA: 'Agendada',
      CIENCIA_CONFIRMADA: 'Ciência confirmada',
      REALIZADA: 'Realizada',
      CANCELADA: 'Cancelada',
      SEM_STATUS: 'Sem status'
    };
    return labels[status] || status.replace(/_/g, ' ');
  }

  function setView_(name) {
    var dashboard = document.getElementById('dashboard-home');
    var module = document.getElementById('audiencias-view');

    if (dashboard) {
      dashboard.hidden = name !== 'dashboard';
    }
    if (module) {
      module.hidden = name !== 'audiencias';
    }
  }

  function setState_(state, message) {
    var loading = document.getElementById('audiencias-loading');
    var error = document.getElementById('audiencias-error');
    var empty = document.getElementById('audiencias-empty');
    var content = document.getElementById('audiencias-content');

    if (loading) loading.hidden = state !== 'loading';
    if (error) {
      error.hidden = state !== 'error';
      error.textContent = state === 'error' ? (message || 'Não foi possível carregar as audiências.') : '';
    }
    if (empty) empty.hidden = state !== 'empty';
    if (content) content.hidden = state !== 'content';
  }

  function createCell_(text, className) {
    var td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = escapeText_(text);
    return td;
  }

  function renderRows_(items) {
    var tbody = document.getElementById('audiencias-table-body');
    var count = document.getElementById('audiencias-count');

    if (!tbody) {
      return;
    }

    tbody.textContent = '';

    items.forEach(function (item) {
      var tr = document.createElement('tr');
      var status = normalizeStatus_(item.status);

      tr.appendChild(createCell_(item.codigo || '-', 'audiencias-code'));
      tr.appendChild(createCell_(item.processo || '-'));
      tr.appendChild(createCell_(item.assunto || '-'));
      tr.appendChild(createCell_(formatDate_(item.data_hora)));
      tr.appendChild(createCell_(item.modalidade || '-'));
      tr.appendChild(createCell_(item.local || '-'));

      var statusCell = document.createElement('td');
      var badge = document.createElement('span');
      badge.className = 'audiencia-status status-' + status.toLowerCase().replace(/_/g, '-');
      badge.textContent = statusLabel_(status);
      statusCell.appendChild(badge);
      tr.appendChild(statusCell);

      tbody.appendChild(tr);
    });

    if (count) {
      count.textContent = items.length === 1 ? '1 audiência' : items.length + ' audiências';
    }
  }

  function load_() {
    var token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';

    if (!token) {
      if (window.Auth && typeof window.Auth.showLogin === 'function') {
        window.Auth.showLogin('Sua sessão expirou. Entre novamente para continuar.');
      }
      return Promise.resolve(false);
    }

    setState_('loading');

    return window.Api.post('audiencias_list', { token: token })
      .then(function (response) {
        if (!isSuccess_(response)) {
          var code = getErrorCode_(response);
          if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0) {
            if (window.Auth && typeof window.Auth.clearStoredSession === 'function') {
              window.Auth.clearStoredSession();
            }
            if (window.Auth && typeof window.Auth.showLogin === 'function') {
              window.Auth.showLogin('Sua sessão expirou. Entre novamente para continuar.');
            }
            return false;
          }
          throw new Error(code || 'ERRO_AO_LISTAR_AUDIENCIAS');
        }

        var data = getData_(response);
        var items = Array.isArray(data.audiencias) ? data.audiencias : [];

        if (data.expira_em && window.Session && typeof window.Session.updateExpiry === 'function') {
          window.Session.updateExpiry(data.expira_em);
        }

        if (!items.length) {
          var count = document.getElementById('audiencias-count');
          if (count) count.textContent = '0 audiências';
          setState_('empty');
          return true;
        }

        renderRows_(items);
        setState_('content');
        return true;
      })
      .catch(function () {
        setState_('error', 'Não foi possível carregar as audiências agora. Tente novamente.');
        return false;
      });
  }

  function open() {
    setView_('audiencias');
    load_();
  }

  function close() {
    setView_('dashboard');
  }

  function init() {
    var back = document.getElementById('audiencias-back');
    var retry = document.getElementById('audiencias-retry');

    if (back) back.addEventListener('click', close);
    if (retry) retry.addEventListener('click', load_);
  }

  window.Audiencias = Object.freeze({
    open: open,
    close: close,
    reload: load_
  });

  document.addEventListener('DOMContentLoaded', init);
}());
