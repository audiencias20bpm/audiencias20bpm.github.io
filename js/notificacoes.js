(function () {
  'use strict';

  var TOKEN_STORAGE_KEY = 'audiencias_session_token';
  var busy_ = false;
  var items_ = [];

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
  function getCode_(response) {
    var data = getData_(response);
    return String(data.code || data.codigo || response.code || response.codigo || '').toUpperCase();
  }
  function getMessage_(response, fallback) {
    return String((response && (response.message || response.mensagem)) || fallback || 'Não foi possível concluir a operação.').trim();
  }
  function token_() { return sessionStorage.getItem(TOKEN_STORAGE_KEY) || ''; }
  function updateExpiry_(data) {
    if (data && data.expira_em && window.Session && typeof window.Session.updateExpiry === 'function') {
      window.Session.updateExpiry(data.expira_em);
    }
  }
  function expired_() {
    if (window.Auth && typeof window.Auth.clearStoredSession === 'function') window.Auth.clearStoredSession();
    if (window.Auth && typeof window.Auth.showLogin === 'function') window.Auth.showLogin('Sua sessão expirou. Entre novamente para continuar.');
  }
  function setBusy_(value) {
    busy_ = Boolean(value);
    var loading = document.getElementById('notificacoes-loading');
    var refresh = document.getElementById('notificacoes-refresh');
    if (loading) loading.hidden = !busy_;
    if (refresh) refresh.disabled = busy_;
  }
  function setError_(message) {
    var el = document.getElementById('notificacoes-error');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }
  function setSuccess_(message) {
    var el = document.getElementById('notificacoes-success');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }
  function formatDateTime_(value) {
    if (!value) return '—';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Belem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }
  function formatPhone_(value) {
    var digits = String(value || '').replace(/\D+/g, '');
    if (digits.indexOf('55') === 0) digits = digits.slice(2);
    if (digits.length === 11) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
    if (digits.length === 10) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6);
    return value || 'Não cadastrado';
  }
  function statusLabel_(item) {
    var status = String(item.status || '').toUpperCase();
    if (status === 'PENDENTE') return 'Pendente';
    if (status === 'SIMULADA') return 'Simulada';
    if (status === 'ENVIADO') return 'Enviada';
    if (status === 'FALHOU') return 'Com erro';
    if (status === 'PROCESSANDO') return 'Processando';
    return status || '—';
  }
  function typeLabel_(type) { return String(type || '').toUpperCase() === 'LEMBRETE' ? 'Lembrete' : 'Ciência'; }

  function hideOtherViews_() {
    ['dashboard-home', 'audiencias-view', 'destinatarios-view', 'documentos-view', 'historico-view', 'usuarios-view'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }
  function showDashboard_() {
    var view = document.getElementById('notificacoes-view');
    var home = document.getElementById('dashboard-home');
    if (view) view.hidden = true;
    if (home) home.hidden = false;
  }

  function renderSummary_(summary, mode) {
    var values = summary || {};
    var map = {
      'notificacoes-count-pendentes': values.pendentes || 0,
      'notificacoes-count-enviadas': values.enviadas || 0,
      'notificacoes-count-confirmadas': values.confirmadas || 0,
      'notificacoes-count-erros': values.erros || 0
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = String(map[id]);
    });
    var modeEl = document.getElementById('notificacoes-mode');
    if (modeEl) modeEl.textContent = String(mode || 'TEST').toUpperCase() === 'TEST' ? 'MODO TESTE — nenhum WhatsApp real será enviado' : 'PRODUÇÃO';
  }

  function filteredItems_() {
    var search = String((document.getElementById('notificacoes-search') || {}).value || '').trim().toLocaleLowerCase('pt-BR');
    var type = String((document.getElementById('notificacoes-type') || {}).value || '').toUpperCase();
    var status = String((document.getElementById('notificacoes-status') || {}).value || '').toUpperCase();
    return items_.filter(function (item) {
      if (type && String(item.tipo || '').toUpperCase() !== type) return false;
      if (status && String(item.status || '').toUpperCase() !== status) return false;
      if (!search) return true;
      return [item.numero_oficio, item.militar_nome, item.militar_rg, item.whatsapp, item.processo]
        .join(' ').toLocaleLowerCase('pt-BR').includes(search);
    });
  }

  function button_(text, cls, handler, disabled) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = cls || 'secondary-button compact-button';
    btn.textContent = text;
    btn.disabled = Boolean(disabled);
    btn.addEventListener('click', handler);
    return btn;
  }

  function openPdf_(item, button) {
    var token = token_();
    if (!token) { expired_(); return; }
    var original = button.textContent;
    button.disabled = true;
    button.textContent = 'Abrindo...';
    setError_('');
    var popup = window.open('', '_blank');
    window.Api.post('oficios_pdf_obter', { token: token, oficio_id: item.oficio_id }).then(function (response) {
      if (!isSuccess_(response)) {
        var code = getCode_(response);
        if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0) { expired_(); return; }
        throw new Error(getMessage_(response, 'Não foi possível abrir o ofício.'));
      }
      var data = getData_(response); updateExpiry_(data);
      var arquivo = data.arquivo || {};
      if (!arquivo.base64) throw new Error('PDF indisponível.');
      var binary = atob(String(arquivo.base64));
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: arquivo.mime || 'application/pdf' }));
      if (popup && !popup.closed) popup.location.href = url;
      else window.open(url, '_blank', 'noopener');
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }).catch(function (error) {
      if (popup && !popup.closed) popup.close();
      setError_(error && error.message ? error.message : 'Não foi possível abrir o ofício.');
    }).finally(function () {
      button.disabled = false; button.textContent = original;
    });
  }

  function updateWhatsapp_(item) {
    var raw = window.prompt('Informe o WhatsApp do militar com DDD. Ex.: 91999999999', String(item.whatsapp || '').replace(/^55/, ''));
    if (raw === null) return;
    var digits = String(raw).replace(/\D+/g, '');
    if (digits.length < 10) { setError_('Informe um WhatsApp válido com DDD.'); return; }
    var token = token_();
    if (!token) { expired_(); return; }
    setBusy_(true); setError_(''); setSuccess_('');
    window.Api.post('destinatarios_update', {
      token: token,
      id: item.destinatario_id,
      telefone: digits,
      unidade: item.unidade || '',
      posto_graduacao: item.posto_graduacao || '',
      status: item.destinatario_status || 'ATIVO'
    }).then(function (response) {
      if (!isSuccess_(response)) {
        var code = getCode_(response);
        if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0) { expired_(); return; }
        throw new Error(getMessage_(response, 'Não foi possível atualizar o WhatsApp.'));
      }
      updateExpiry_(getData_(response));
      setSuccess_('WhatsApp atualizado. O número será reaproveitado nas notificações.');
      return load_();
    }).catch(function (error) {
      setError_(error && error.message ? error.message : 'Não foi possível atualizar o WhatsApp.');
    }).finally(function () { setBusy_(false); });
  }

  function send_(item, reenvio, button) {
    var token = token_();
    if (!token) { expired_(); return; }
    var original = button.textContent;
    button.disabled = true; button.textContent = 'Enviando...';
    setError_(''); setSuccess_('');
    window.Api.post('notificacoes_send', { token: token, notificacao_id: item.id, reenviar: reenvio === true }).then(function (response) {
      if (!isSuccess_(response)) {
        var code = getCode_(response);
        if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0) { expired_(); return; }
        throw new Error(getMessage_(response, 'Não foi possível processar a notificação.'));
      }
      var data = getData_(response);
      updateExpiry_(data);
      setSuccess_('Simulação concluída. Nenhuma mensagem real de WhatsApp foi enviada.');
      if (data.mensagem_teste) showMessage_({ mensagem: data.mensagem_teste }, data.test_confirmation_url || '');
      return load_();
    }).catch(function (error) {
      setError_(error && error.message ? error.message : 'Não foi possível processar a notificação.');
    }).finally(function () { button.disabled = false; button.textContent = original; });
  }

  function showMessage_(item, testUrl) {
    var dialog = document.getElementById('notificacoes-message-dialog');
    var text = document.getElementById('notificacoes-message-text');
    var link = document.getElementById('notificacoes-test-confirm-link');
    if (text) text.textContent = item.mensagem || 'Mensagem indisponível.';
    if (link) {
      link.hidden = !testUrl;
      link.href = testUrl || '#';
    }
    if (dialog) dialog.hidden = false;
  }

  function render_() {
    var body = document.getElementById('notificacoes-body');
    var cards = document.getElementById('notificacoes-mobile-list');
    var empty = document.getElementById('notificacoes-empty');
    var list = filteredItems_();
    if (body) body.textContent = '';
    if (cards) cards.textContent = '';
    if (empty) empty.hidden = list.length !== 0;

    list.forEach(function (item) {
      if (body) {
        var tr = document.createElement('tr');
        [item.numero_oficio || '—', formatDateTime_(item.audiencia_data_hora), item.militar_nome || '—', item.militar_rg || '—', formatPhone_(item.whatsapp), item.processo || '—', typeLabel_(item.tipo)].forEach(function (value) {
          var td = document.createElement('td'); td.textContent = value; tr.appendChild(td);
        });
        var statusTd = document.createElement('td');
        var badge = document.createElement('span'); badge.className = 'notification-status status-' + String(item.status || '').toLowerCase(); badge.textContent = statusLabel_(item); statusTd.appendChild(badge); tr.appendChild(statusTd);
        var confirmationTd = document.createElement('td'); confirmationTd.textContent = item.confirmado_em || '—'; tr.appendChild(confirmationTd);
        var actions = document.createElement('td'); actions.className = 'notification-actions';
        if (String(item.tipo).toUpperCase() === 'OFICIO') {
          if (!item.whatsapp_valido) actions.appendChild(button_('Cadastrar WhatsApp', 'secondary-button compact-button', function () { updateWhatsapp_(item); }));
          else if (String(item.status).toUpperCase() === 'PENDENTE' || String(item.status).toUpperCase() === 'FALHOU') actions.appendChild(button_('Enviar', 'primary-button compact-button', function () { send_(item, false, this); }));
          else actions.appendChild(button_('Reenviar', 'secondary-button compact-button', function () { send_(item, true, this); }));
        }
        actions.appendChild(button_('Mensagem', 'secondary-button compact-button', function () { showMessage_(item); }));
        actions.appendChild(button_('Ofício', 'secondary-button compact-button', function () { openPdf_(item, this); }, !item.pdf_disponivel));
        tr.appendChild(actions); body.appendChild(tr);
      }

      if (cards) {
        var card = document.createElement('article'); card.className = 'notification-card';
        var header = document.createElement('div'); header.className = 'notification-card-header';
        var title = document.createElement('strong'); title.textContent = 'Ofício ' + (item.numero_oficio || '—');
        var badgeM = document.createElement('span'); badgeM.className = 'notification-status status-' + String(item.status || '').toLowerCase(); badgeM.textContent = statusLabel_(item);
        header.appendChild(title); header.appendChild(badgeM); card.appendChild(header);
        var info = document.createElement('div'); info.className = 'notification-card-info';
        info.innerHTML = '<span class="notification-card-wide">' + (item.militar_nome || '—') + ' • RG ' + (item.militar_rg || '—') + '</span>' +
          '<span><b>Tipo</b><small>' + typeLabel_(item.tipo) + '</small></span>' +
          '<span><b>Audiência</b><small>' + formatDateTime_(item.audiencia_data_hora) + '</small></span>' +
          '<span><b>WhatsApp</b><small>' + formatPhone_(item.whatsapp) + '</small></span>' +
          '<span><b>Processo</b><small>' + (item.processo || '—') + '</small></span>' +
          (item.confirmado_em ? '<span class="notification-card-wide"><b>Ciência</b><small>' + item.confirmado_em + '</small></span>' : '');
        card.appendChild(info);
        var act = document.createElement('div'); act.className = 'notification-card-actions';
        if (String(item.tipo).toUpperCase() === 'OFICIO') {
          if (!item.whatsapp_valido) act.appendChild(button_('Cadastrar WhatsApp', 'secondary-button compact-button', function () { updateWhatsapp_(item); }));
          else if (String(item.status).toUpperCase() === 'PENDENTE' || String(item.status).toUpperCase() === 'FALHOU') act.appendChild(button_('Enviar', 'primary-button compact-button', function () { send_(item, false, this); }));
          else act.appendChild(button_('Reenviar', 'secondary-button compact-button', function () { send_(item, true, this); }));
        }
        act.appendChild(button_('Mensagem', 'secondary-button compact-button', function () { showMessage_(item); }));
        act.appendChild(button_('Ofício', 'secondary-button compact-button', function () { openPdf_(item, this); }, !item.pdf_disponivel));
        card.appendChild(act); cards.appendChild(card);
      }
    });
  }

  function load_() {
    var token = token_();
    if (!token) { expired_(); return Promise.resolve(false); }
    setBusy_(true); setError_('');
    return window.Api.post('notificacoes_list', { token: token }).then(function (response) {
      if (!isSuccess_(response)) {
        var code = getCode_(response);
        if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0) { expired_(); return false; }
        throw new Error(getMessage_(response, 'Não foi possível carregar as notificações.'));
      }
      var data = getData_(response); updateExpiry_(data);
      items_ = Array.isArray(data.itens) ? data.itens : [];
      renderSummary_(data.resumo || {}, data.modo || 'TEST');
      render_();
      return true;
    }).catch(function (error) {
      items_ = []; render_();
      setError_(error && error.message ? error.message : 'Não foi possível carregar as notificações.');
      return false;
    }).finally(function () { setBusy_(false); });
  }

  function open() {
    hideOtherViews_();
    var view = document.getElementById('notificacoes-view');
    if (view) view.hidden = false;
    load_();
  }

  function bind_() {
    var back = document.getElementById('notificacoes-back'); if (back) back.addEventListener('click', showDashboard_);
    var refresh = document.getElementById('notificacoes-refresh'); if (refresh) refresh.addEventListener('click', load_);
    ['notificacoes-search', 'notificacoes-type', 'notificacoes-status'].forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      el.addEventListener(id === 'notificacoes-search' ? 'input' : 'change', render_);
    });
    var close = document.getElementById('notificacoes-message-close'); if (close) close.addEventListener('click', function () { document.getElementById('notificacoes-message-dialog').hidden = true; });
    var backdrop = document.querySelector('[data-notificacoes-message-close]'); if (backdrop) backdrop.addEventListener('click', function () { document.getElementById('notificacoes-message-dialog').hidden = true; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind_); else bind_();

  window.Notificacoes = Object.freeze({ open: open, reload: load_ });
}());
