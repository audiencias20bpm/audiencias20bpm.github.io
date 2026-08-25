(function () {
  'use strict';

  var TOKEN_STORAGE_KEY = 'audiencias_session_token';
  var allItems = [];
  var currentItems = [];

  function isObject_(value) {
    return value !== null && typeof value === 'object';
  }

  function isSuccess_(response) {
    return Boolean(isObject_(response) && (
      response.success === true || response.sucesso === true || response.ok === true
    ));
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

  function text_(value) {
    return String(value === null || value === undefined ? '' : value);
  }

  function digits_(value) {
    return text_(value).replace(/\D+/g, '');
  }

  function normalizeCpf_(value) {
    var cpf = digits_(value);
    if (!cpf) return '';
    return cpf.length <= 11 ? cpf.padStart(11, '0') : cpf;
  }

  function formatCpf_(value) {
    var cpf = normalizeCpf_(value);
    if (cpf.length !== 11) return cpf || '—';
    return cpf.slice(0, 3) + '.' + cpf.slice(3, 6) + '.' + cpf.slice(6, 9) + '-' + cpf.slice(9);
  }

  function formatPhone_(value) {
    var phone = digits_(value);
    if (!phone) return '—';
    if (phone.length === 11) {
      return '(' + phone.slice(0, 2) + ') ' + phone.slice(2, 7) + '-' + phone.slice(7);
    }
    if (phone.length === 10) {
      return '(' + phone.slice(0, 2) + ') ' + phone.slice(2, 6) + '-' + phone.slice(6);
    }
    return phone;
  }

  function createCell_(value, className) {
    var td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = text_(value || '—');
    return td;
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

  function setState_(state, message) {
    var loading = document.getElementById('destinatarios-loading');
    var error = document.getElementById('destinatarios-error');
    var empty = document.getElementById('destinatarios-empty');
    var content = document.getElementById('destinatarios-content');

    if (loading) loading.hidden = state !== 'loading';
    if (error) {
      error.hidden = state !== 'error';
      error.textContent = state === 'error' ? (message || 'Não foi possível carregar os destinatários.') : '';
    }
    if (empty) empty.hidden = state !== 'empty';
    if (content) content.hidden = state !== 'content';
  }

  function createEditButton_(item) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'table-action-button';
    button.textContent = 'Editar';
    button.addEventListener('click', function () {
      openEdit_(item);
    });
    return button;
  }

  function render_(items) {
    var tbody = document.getElementById('destinatarios-table-body');
    var count = document.getElementById('destinatarios-count');
    var resultCount = document.getElementById('destinatarios-result-count');

    if (!tbody) return;
    tbody.textContent = '';
    currentItems = items.slice();

    items.forEach(function (item) {
      var tr = document.createElement('tr');
      tr.appendChild(createCell_(item.rg || item.identificacao || '—', 'destinatarios-rg'));
      tr.appendChild(createCell_(item.nome || '—', 'destinatarios-name'));
      tr.appendChild(createCell_(formatCpf_(item.cpf), 'destinatarios-cpf'));
      tr.appendChild(createCell_(formatPhone_(item.telefone), 'destinatarios-phone'));
      tr.appendChild(createCell_(item.unidade || '—'));

      var statusCell = document.createElement('td');
      var status = document.createElement('span');
      var normalizedStatus = String(item.status || 'ATIVO').toUpperCase();
      status.className = 'recipient-status status-' + normalizedStatus.toLowerCase();
      status.textContent = normalizedStatus === 'ATIVO' ? 'Ativo' : normalizedStatus.replace(/_/g, ' ');
      statusCell.appendChild(status);
      tr.appendChild(statusCell);

      var actionCell = document.createElement('td');
      actionCell.className = 'destinatarios-actions-cell';
      actionCell.appendChild(createEditButton_(item));
      tr.appendChild(actionCell);
      tbody.appendChild(tr);
    });

    if (count) {
      count.textContent = allItems.length === 1 ? '1 militar' : allItems.length + ' militares';
    }
    if (resultCount) {
      resultCount.textContent = items.length === allItems.length
        ? 'Exibindo todos os cadastros'
        : (items.length === 1 ? '1 resultado encontrado' : items.length + ' resultados encontrados');
    }

    if (!items.length) {
      setState_('empty');
      var emptyText = document.querySelector('#destinatarios-empty span');
      if (emptyText) emptyText.textContent = 'Nenhum cadastro corresponde à pesquisa informada.';
    } else {
      setState_('content');
    }
  }

  function applyFilter_() {
    var input = document.getElementById('destinatarios-search');
    var query = text_(input ? input.value : '').trim();

    if (!query) {
      render_(allItems);
      return;
    }

    var upper = query.toLocaleUpperCase('pt-BR');
    var queryDigits = digits_(query);
    var normalizedCpf = queryDigits ? normalizeCpf_(queryDigits) : '';

    var filtered = allItems.filter(function (item) {
      var rg = digits_(item.rg || item.identificacao);
      var cpf = normalizeCpf_(item.cpf);
      var name = text_(item.nome).toLocaleUpperCase('pt-BR');
      var phone = digits_(item.telefone);

      return name.indexOf(upper) !== -1 ||
        (queryDigits && rg.indexOf(queryDigits) !== -1) ||
        (queryDigits && cpf.indexOf(normalizedCpf) !== -1) ||
        (queryDigits && phone.indexOf(queryDigits) !== -1);
    });

    render_(filtered);
  }

  function clearSearch_() {
    var input = document.getElementById('destinatarios-search');
    if (input) {
      input.value = '';
      input.focus();
    }
    render_(allItems);
  }

  function load_() {
    var token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
    if (!token) {
      handleExpiredSession_();
      return Promise.resolve(false);
    }

    setState_('loading');

    return window.Api.post('destinatarios_list', { token: token }).then(function (response) {
      if (!isSuccess_(response)) {
        var code = getErrorCode_(response);
        if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0) {
          handleExpiredSession_();
          return false;
        }
        throw new Error(code || 'ERRO_AO_LISTAR_DESTINATARIOS');
      }

      var data = getData_(response);
      allItems = Array.isArray(data.destinatarios) ? data.destinatarios : [];
      updateExpiry_(data);
      applyFilter_();
      return true;
    }).catch(function () {
      setState_('error', 'Não foi possível carregar os militares agora. Tente novamente.');
      return false;
    });
  }

  function setEditError_(message) {
    var error = document.getElementById('destinatarios-edit-error');
    if (!error) return;
    error.hidden = !message;
    error.textContent = message || '';
  }

  function openEdit_(item) {
    var dialog = document.getElementById('destinatarios-edit-dialog');
    if (!dialog) return;

    document.getElementById('destinatarios-edit-id').value = text_(item.id);
    document.getElementById('destinatarios-edit-rg').value = text_(item.rg || item.identificacao);
    document.getElementById('destinatarios-edit-cpf').value = normalizeCpf_(item.cpf);
    document.getElementById('destinatarios-edit-nome').value = text_(item.nome);
    document.getElementById('destinatarios-edit-whatsapp').value = digits_(item.telefone);
    document.getElementById('destinatarios-edit-unidade').value = text_(item.unidade);
    document.getElementById('destinatarios-edit-status').value = String(item.status || 'ATIVO').toUpperCase() === 'INATIVO' ? 'INATIVO' : 'ATIVO';
    setEditError_('');
    dialog.hidden = false;
    document.body.classList.add('modal-open');
    window.setTimeout(function () {
      var whatsapp = document.getElementById('destinatarios-edit-whatsapp');
      if (whatsapp) whatsapp.focus();
    }, 0);
  }

  function closeEdit_() {
    var dialog = document.getElementById('destinatarios-edit-dialog');
    if (dialog) dialog.hidden = true;
    document.body.classList.remove('modal-open');
    setEditError_('');
  }

  function submitEdit_(event) {
    event.preventDefault();

    var token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
    if (!token) {
      closeEdit_();
      handleExpiredSession_();
      return;
    }

    var id = text_(document.getElementById('destinatarios-edit-id').value).trim();
    var telefone = digits_(document.getElementById('destinatarios-edit-whatsapp').value);
    var unidade = text_(document.getElementById('destinatarios-edit-unidade').value).trim();
    var status = text_(document.getElementById('destinatarios-edit-status').value).toUpperCase();

    if (!id) {
      setEditError_('Cadastro inválido. Atualize a lista e tente novamente.');
      return;
    }
    if (telefone && telefone.length < 10) {
      setEditError_('Informe o WhatsApp com DDD.');
      return;
    }

    var submit = document.getElementById('destinatarios-edit-submit');
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Salvando...';
    }
    setEditError_('');

    window.Api.post('destinatarios_update', {
      token: token,
      id: id,
      telefone: telefone,
      unidade: unidade,
      status: status
    }).then(function (response) {
      if (!isSuccess_(response)) {
        var code = getErrorCode_(response);
        if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0) {
          closeEdit_();
          handleExpiredSession_();
          return false;
        }
        if (code === 'DESTINATARIO_NAO_ENCONTRADO') throw new Error('O cadastro não foi encontrado. Atualize a lista e tente novamente.');
        throw new Error('Não foi possível salvar as alterações.');
      }

      var data = getData_(response);
      updateExpiry_(data);
      closeEdit_();
      return load_();
    }).catch(function (error) {
      setEditError_(error && error.message ? error.message : 'Não foi possível salvar as alterações.');
    }).finally(function () {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Salvar alterações';
      }
    });
  }

  function open() {
    var dashboard = document.getElementById('dashboard-home');
    var audiencias = document.getElementById('audiencias-view');
    var view = document.getElementById('destinatarios-view');
    var search = document.getElementById('destinatarios-search');

    if (dashboard) dashboard.hidden = true;
    if (audiencias) audiencias.hidden = true;
    if (view) view.hidden = false;
    if (search) search.value = '';

    load_();
  }

  function back() {
    closeEdit_();
    var dashboard = document.getElementById('dashboard-home');
    var view = document.getElementById('destinatarios-view');
    if (view) view.hidden = true;
    if (dashboard) dashboard.hidden = false;
  }

  function bind_() {
    var backButton = document.getElementById('destinatarios-back');
    var retryButton = document.getElementById('destinatarios-retry');
    var search = document.getElementById('destinatarios-search');
    var clear = document.getElementById('destinatarios-clear-search');
    var editForm = document.getElementById('destinatarios-edit-form');
    var editClose = document.getElementById('destinatarios-edit-close');
    var editCancel = document.getElementById('destinatarios-edit-cancel');
    var backdrop = document.querySelector('[data-destinatarios-close]');

    if (backButton) backButton.addEventListener('click', back);
    if (retryButton) retryButton.addEventListener('click', load_);
    if (search) search.addEventListener('input', applyFilter_);
    if (clear) clear.addEventListener('click', clearSearch_);
    if (editForm) editForm.addEventListener('submit', submitEdit_);
    if (editClose) editClose.addEventListener('click', closeEdit_);
    if (editCancel) editCancel.addEventListener('click', closeEdit_);
    if (backdrop) backdrop.addEventListener('click', closeEdit_);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeEdit_();
    });
  }

  document.addEventListener('DOMContentLoaded', bind_);

  window.Destinatarios = Object.freeze({
    open: open,
    back: back,
    reload: load_
  });
}());
