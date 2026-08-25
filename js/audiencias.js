(function () {
  'use strict';

  var TOKEN_STORAGE_KEY = 'audiencias_session_token';
  var saving = false;
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

  function setListVisibility_(showList) {
    var formView = document.getElementById('audiencias-form-view');
    var ids = [
      'audiencias-loading',
      'audiencias-error',
      'audiencias-empty',
      'audiencias-content',
      'audiencias-success'
    ];
    var actions = document.querySelector('#audiencias-view > .module-actions');
    var headerActions = document.querySelector('#audiencias-view .module-header-actions');

    ids.forEach(function (id) {
      var element = document.getElementById(id);
      if (element && !showList) {
        element.hidden = true;
      }
    });

    if (actions) actions.hidden = !showList;
    if (headerActions) headerActions.hidden = !showList;
    if (formView) formView.hidden = showList;
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

  function showSuccess_(message) {
    var success = document.getElementById('audiencias-success');
    if (!success) return;
    success.textContent = message || 'Operação concluída com sucesso.';
    success.hidden = false;
  }

  function hideSuccess_() {
    var success = document.getElementById('audiencias-success');
    if (success) success.hidden = true;
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

  function handleExpiredSession_() {
    if (window.Auth && typeof window.Auth.clearStoredSession === 'function') {
      window.Auth.clearStoredSession();
    }
    if (window.Auth && typeof window.Auth.showLogin === 'function') {
      window.Auth.showLogin('Sua sessão expirou. Entre novamente para continuar.');
    }
  }

  function updateExpiry_(data) {
    if (data.expira_em && window.Session && typeof window.Session.updateExpiry === 'function') {
      window.Session.updateExpiry(data.expira_em);
    }
  }

  function load_() {
    var token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';

    if (!token) {
      handleExpiredSession_();
      return Promise.resolve(false);
    }

    setListVisibility_(true);
    setState_('loading');

    return window.Api.post('audiencias_list', { token: token })
      .then(function (response) {
        if (!isSuccess_(response)) {
          var code = getErrorCode_(response);
          if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0) {
            handleExpiredSession_();
            return false;
          }
          throw new Error(code || 'ERRO_AO_LISTAR_AUDIENCIAS');
        }

        var data = getData_(response);
        var items = Array.isArray(data.audiencias) ? data.audiencias : [];

        updateExpiry_(data);

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

  function clearFormError_() {
    var error = document.getElementById('audiencias-form-error');
    if (error) {
      error.hidden = true;
      error.textContent = '';
    }
  }

  function showFormError_(message) {
    var error = document.getElementById('audiencias-form-error');
    if (error) {
      error.textContent = message || 'Revise os dados informados.';
      error.hidden = false;
    }
  }

  function formData_() {
    return {
      codigo: document.getElementById('audiencia-codigo').value.trim(),
      processo: document.getElementById('audiencia-processo').value.trim(),
      assunto: document.getElementById('audiencia-assunto').value.trim(),
      data_hora: document.getElementById('audiencia-data-hora').value,
      modalidade: document.getElementById('audiencia-modalidade').value,
      local: document.getElementById('audiencia-local').value.trim(),
      link: document.getElementById('audiencia-link').value.trim(),
      destinatario_id: document.getElementById('audiencia-destinatario').value.trim(),
      observacoes: document.getElementById('audiencia-observacoes').value.trim()
    };
  }

  function validateForm_(data) {
    if (!data.processo || !data.assunto || !data.data_hora || !data.modalidade) {
      return 'Preencha Processo, Assunto, Data e hora e Modalidade.';
    }

    if (data.modalidade === 'PRESENCIAL' && !data.local) {
      return 'Informe o local da audiência presencial.';
    }

    if (data.link && !/^https?:\/\//i.test(data.link)) {
      return 'O link deve começar com https:// ou http://.';
    }

    return '';
  }

  function setSaving_(active) {
    var submit = document.getElementById('audiencias-form-submit');
    var cancel = document.getElementById('audiencias-form-cancel');
    saving = active;

    if (submit) {
      submit.disabled = active;
      submit.textContent = active ? 'Salvando...' : 'Salvar audiência';
    }
    if (cancel) cancel.disabled = active;
  }

  function openForm_() {
    var form = document.getElementById('audiencias-form');
    hideSuccess_();
    clearFormError_();
    if (form) form.reset();
    setListVisibility_(false);

    var processo = document.getElementById('audiencia-processo');
    if (processo) processo.focus();
  }

  function closeForm_() {
    if (saving) return;
    clearFormError_();
    setListVisibility_(true);
    load_();
  }

  function errorMessageForCode_(code) {
    var messages = {
      DADOS_INVALIDOS: 'Preencha os campos obrigatórios corretamente.',
      LOCAL_OBRIGATORIO: 'Informe o local da audiência presencial.',
      LINK_INVALIDO: 'Informe um link iniciado por https:// ou http://.',
      CODIGO_DUPLICADO: 'Já existe uma audiência com este código.'
    };
    return messages[code] || 'Não foi possível cadastrar a audiência agora. Tente novamente.';
  }

  function submitForm_(event) {
    event.preventDefault();
    if (saving) return;

    var token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
    if (!token) {
      handleExpiredSession_();
      return;
    }

    var data = formData_();
    var validationError = validateForm_(data);
    if (validationError) {
      showFormError_(validationError);
      return;
    }

    clearFormError_();
    setSaving_(true);

    window.Api.post('audiencias_create', {
      token: token,
      audiencia: data
    })
      .then(function (response) {
        if (!isSuccess_(response)) {
          var code = getErrorCode_(response);
          if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0) {
            handleExpiredSession_();
            return false;
          }

          showFormError_(errorMessageForCode_(code));
          return false;
        }

        var responseData = getData_(response);
        updateExpiry_(responseData);

        var created = responseData.audiencia || {};
        var form = document.getElementById('audiencias-form');
        if (form) form.reset();

        setListVisibility_(true);
        return load_().then(function () {
          showSuccess_(
            created.codigo
              ? 'Audiência ' + created.codigo + ' cadastrada com sucesso.'
              : 'Audiência cadastrada com sucesso.'
          );
          return true;
        });
      })
      .catch(function () {
        showFormError_('Não foi possível comunicar com o servidor. Tente novamente.');
      })
      .finally(function () {
        setSaving_(false);
      });
  }

  function open() {
    setView_('audiencias');
    setListVisibility_(true);
    hideSuccess_();
    load_();
  }

  function close() {
    if (saving) return;
    setView_('dashboard');
  }

  function init() {
    var back = document.getElementById('audiencias-back');
    var retry = document.getElementById('audiencias-retry');
    var newButton = document.getElementById('audiencias-new');
    var formBack = document.getElementById('audiencias-form-back');
    var cancel = document.getElementById('audiencias-form-cancel');
    var form = document.getElementById('audiencias-form');

    if (back) back.addEventListener('click', close);
    if (retry) retry.addEventListener('click', load_);
    if (newButton) newButton.addEventListener('click', openForm_);
    if (formBack) formBack.addEventListener('click', closeForm_);
    if (cancel) cancel.addEventListener('click', closeForm_);
    if (form) form.addEventListener('submit', submitForm_);
  }

  window.Audiencias = Object.freeze({
    open: open,
    close: close,
    reload: load_,
    newRecord: openForm_
  });

  document.addEventListener('DOMContentLoaded', init);
}());
