(function () {
  'use strict';

  var TOKEN_STORAGE_KEY = 'audiencias_session_token';
  var currentConfig_ = null;
  var generationAudiences_ = [];
  var selectedGenerationAudience_ = null;
  var selectedGenerationMilitary_ = null;

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
  function getSafeMessage_(response, fallback) {
    if (!isObject_(response)) return fallback || 'Não foi possível concluir a operação.';
    var message = String(response.message || response.mensagem || '').trim();
    return message || fallback || 'Não foi possível concluir a operação.';
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
    if (el) el.hidden = !loading;
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
  var lastNameSelection_ = { start: 0, end: 0 };

  function escapeHtml_(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function updateNamePreview_() {
    var input = document.getElementById('signatario-nome');
    var hidden = document.getElementById('signatario-nome-guerra');
    var preview = document.getElementById('signatario-nome-preview');
    if (!input || !hidden || !preview) return;
    var name = input.value.trim();
    var war = hidden.value.trim();
    if (!name) { preview.textContent = '—'; return; }
    if (!war) { preview.textContent = name; return; }
    var lowerName = name.toLocaleLowerCase('pt-BR');
    var lowerWar = war.toLocaleLowerCase('pt-BR');
    var idx = lowerName.indexOf(lowerWar);
    if (idx < 0) { hidden.value = ''; preview.textContent = name; return; }
    preview.innerHTML = escapeHtml_(name.slice(0, idx)) + '<strong>' + escapeHtml_(name.slice(idx, idx + war.length)) + '</strong>' + escapeHtml_(name.slice(idx + war.length));
  }

  function rememberNameSelection_() {
    var input = document.getElementById('signatario-nome');
    if (!input) return;
    lastNameSelection_.start = Number(input.selectionStart || 0);
    lastNameSelection_.end = Number(input.selectionEnd || 0);
  }

  function markWarName_() {
    var input = document.getElementById('signatario-nome');
    var hidden = document.getElementById('signatario-nome-guerra');
    if (!input || !hidden) return;
    var start = Number(input.selectionStart);
    var end = Number(input.selectionEnd);
    if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) { start = lastNameSelection_.start; end = lastNameSelection_.end; }
    var selected = input.value.slice(start, end).trim();
    if (!selected) {
      setError_('Selecione no campo Nome o trecho que corresponde ao nome de guerra.');
      input.focus();
      return;
    }
    hidden.value = selected;
    setError_('');
    updateNamePreview_();
  }

  function clearWarName_() {
    var hidden = document.getElementById('signatario-nome-guerra');
    if (hidden) hidden.value = '';
    updateNamePreview_();
  }

  function clearSignatory_() {
    ['signatario-nome', 'signatario-posto', 'signatario-rg', 'signatario-cargo', 'signatario-nome-guerra'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    setError_(''); setSuccess_('');
    updateNamePreview_();
    var input = document.getElementById('signatario-nome');
    if (input) input.focus();
  }

  function renderSignatorySummary_(config) {
    var nameEl = document.getElementById('documentos-home-signatory');
    var detailEl = document.getElementById('documentos-home-signatory-detail');
    if (!nameEl || !detailEl) return;
    var name = String(config.signatario_nome || '').trim();
    var war = String(config.signatario_nome_guerra || '').trim();
    if (!name) {
      nameEl.textContent = '—';
    } else if (war) {
      var lowerName = name.toLocaleLowerCase('pt-BR');
      var lowerWar = war.toLocaleLowerCase('pt-BR');
      var idx = lowerName.indexOf(lowerWar);
      if (idx >= 0) {
        nameEl.innerHTML = escapeHtml_(name.slice(0, idx)) + '<strong>' + escapeHtml_(name.slice(idx, idx + war.length)) + '</strong>' + escapeHtml_(name.slice(idx + war.length));
      } else {
        nameEl.textContent = name;
      }
    } else {
      nameEl.textContent = name;
    }
    var parts = [];
    if (config.signatario_posto_graduacao) parts.push(config.signatario_posto_graduacao);
    if (config.signatario_rg) parts.push('RG ' + config.signatario_rg);
    if (config.signatario_cargo) parts.push(config.signatario_cargo);
    detailEl.textContent = parts.join(' • ') || '—';
  }

  function renderHome_(config) {
    var home = document.getElementById('documentos-home');
    var form = document.getElementById('documentos-config-form');
    var generateView = document.getElementById('documentos-generate-view');
    var subtitle = document.getElementById('documentos-view-subtitle');
    var status = document.getElementById('documentos-config-status');
    if (!config || !config.configurada) {
      if (home) home.hidden = true;
      if (generateView) generateView.hidden = true;
      if (form) form.hidden = false;
      if (subtitle) subtitle.textContent = 'Faça a configuração inicial para preparar a numeração e o signatário dos ofícios.';
      if (status) status.textContent = 'Configuração inicial';
      return;
    }
    if (form) form.hidden = true;
    if (generateView) generateView.hidden = true;
    if (home) home.hidden = false;
    if (subtitle) subtitle.textContent = 'Gerencie a emissão dos ofícios vinculados às audiências.';
    if (status) status.textContent = 'Configurado';
    var next = document.getElementById('documentos-home-next-number');
    if (next) next.textContent = String(config.oficio_proximo_numero || 0).padStart(3, '0') + '/' + config.oficio_ano;
    renderSignatorySummary_(config);
  }

  function showConfig_() {
    var home = document.getElementById('documentos-home');
    var form = document.getElementById('documentos-config-form');
    var generateView = document.getElementById('documentos-generate-view');
    var subtitle = document.getElementById('documentos-view-subtitle');
    if (home) home.hidden = true;
    if (generateView) generateView.hidden = true;
    if (form) form.hidden = false;
    if (subtitle) subtitle.textContent = 'Configuração da numeração anual e do signatário padrão.';
    setError_(''); setSuccess_('');
  }

  function showHome_() {
    if (!currentConfig_ || !currentConfig_.configurada) { showConfig_(); return; }
    var generateView = document.getElementById('documentos-generate-view');
    if (generateView) generateView.hidden = true;
    setError_(''); setSuccess_('');
    renderHome_(currentConfig_);
  }

  function fill_(config) {
    var c = config || {};
    currentConfig_ = c;
    document.getElementById('oficio-ano').value = c.oficio_ano || new Date().getFullYear();
    document.getElementById('oficio-ultimo-numero').value = c.oficio_ultimo_numero !== undefined && c.oficio_ultimo_numero !== '' ? c.oficio_ultimo_numero : 0;
    document.getElementById('signatario-nome').value = c.signatario_nome || '';
    document.getElementById('signatario-nome-guerra').value = c.signatario_nome_guerra || '';
    document.getElementById('signatario-posto').value = c.signatario_posto_graduacao || '';
    document.getElementById('signatario-rg').value = c.signatario_rg || '';
    document.getElementById('signatario-cargo').value = c.signatario_cargo || '';
    updateNextNumber_();
    updateNamePreview_();
    renderHome_(c);
  }
  function load_() {
    var token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
    if (!token) { handleExpiredSession_(); return Promise.resolve(false); }
    setLoading_(true); setError_(''); setSuccess_('');
    return window.Api.post('oficios_config_get', { token: token }).then(function (response) {
      if (!isSuccess_(response)) {
        var code = getErrorCode_(response);
        if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0) { handleExpiredSession_(); return false; }
        throw new Error(getSafeMessage_(response, 'Não foi possível carregar a configuração dos ofícios.'));
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
      signatario_nome_guerra: document.getElementById('signatario-nome-guerra').value.trim(),
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
        throw new Error(getSafeMessage_(response, 'Não foi possível salvar a configuração dos ofícios.'));
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
  function formatDateTimePt_(value) {
    if (!value) return '—';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Belem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  function todayInputValue_() {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function formatLongDate_(value) {
    if (!value) return '—';
    var parts = String(value).split('-');
    if (parts.length !== 3) return value;
    var months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    var monthIndex = Number(parts[1]) - 1;
    if (monthIndex < 0 || monthIndex > 11) return value;
    return Number(parts[2]) + ' de ' + months[monthIndex] + ' de ' + parts[0];
  }

  function setGenerateError_(message) {
    var el = document.getElementById('documentos-generate-error');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  }

  function setGenerateLoading_(loading) {
    var el = document.getElementById('documentos-generate-loading');
    if (el) el.hidden = !loading;
  }

  function setElementText_(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value || '—';
  }

  function recipientDisplay_(item) {
    var parts = [];
    if (item && item.posto_graduacao) parts.push(item.posto_graduacao);
    if (item && item.rg) parts.push('RG ' + item.rg);
    if (item && item.nome) parts.push(item.nome);
    return parts.join(' ') || 'Militar';
  }

  function renderGenerateSignatory_() {
    var target = document.getElementById('documentos-preview-signatario');
    if (!target || !currentConfig_) return;
    var name = String(currentConfig_.signatario_nome || '').trim();
    var war = String(currentConfig_.signatario_nome_guerra || '').trim();
    var prefix = [];
    if (currentConfig_.signatario_posto_graduacao) prefix.push(currentConfig_.signatario_posto_graduacao);
    if (currentConfig_.signatario_rg) prefix.push('RG ' + currentConfig_.signatario_rg);
    var prefixText = prefix.length ? ' - ' + prefix.join(' ') : '';
    if (!name) { target.textContent = '—'; return; }
    if (!war) { target.textContent = name + prefixText; return; }
    var lowerName = name.toLocaleLowerCase('pt-BR');
    var lowerWar = war.toLocaleLowerCase('pt-BR');
    var idx = lowerName.indexOf(lowerWar);
    if (idx < 0) { target.textContent = name + prefixText; return; }
    target.innerHTML = escapeHtml_(name.slice(0, idx)) + '<strong>' + escapeHtml_(name.slice(idx, idx + war.length)) + '</strong>' + escapeHtml_(name.slice(idx + war.length) + prefixText);
  }

  function updateGeneratePreview_() {
    var preview = document.getElementById('documentos-preview');
    var empty = document.getElementById('documentos-preview-empty');
    if (!selectedGenerationAudience_ || !selectedGenerationMilitary_) {
      if (preview) preview.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    if (preview) preview.hidden = false;
    if (empty) empty.hidden = true;

    var dateInput = document.getElementById('documentos-data-emissao');
    var destination = document.getElementById('documentos-destino-judicial');
    var optional = document.getElementById('documentos-trecho-opcional');
    var number = document.getElementById('documentos-numero-preview');

    setElementText_('documentos-preview-data', formatLongDate_(dateInput ? dateInput.value : ''));
    setElementText_('documentos-preview-numero', number ? number.value : '—');
    setElementText_('documentos-preview-destino', destination && destination.value.trim() ? destination.value.trim() : '[Informe o destinatário do ofício]');
    setElementText_('documentos-preview-militar', recipientDisplay_(selectedGenerationMilitary_));
    setElementText_('documentos-preview-processo', selectedGenerationAudience_.processo || '—');
    setElementText_('documentos-preview-cargo', currentConfig_ && currentConfig_.signatario_cargo ? currentConfig_.signatario_cargo : '—');
    renderGenerateSignatory_();

    var optionalEl = document.getElementById('documentos-preview-complemento');
    if (optionalEl) {
      var text = optional ? optional.value.trim() : '';
      optionalEl.textContent = text ? ' ' + text : '';
    }
  }

  function fillGenerationAudienceSummary_() {
    var summary = document.getElementById('documentos-audiencia-resumo');
    if (!selectedGenerationAudience_) {
      if (summary) summary.hidden = true;
      return;
    }
    if (summary) summary.hidden = false;
    setElementText_('documentos-resumo-processo', selectedGenerationAudience_.processo || '—');
    setElementText_('documentos-resumo-data', formatDateTimePt_(selectedGenerationAudience_.data_hora));
    setElementText_('documentos-resumo-local', selectedGenerationAudience_.local || '—');
  }

  function fillGenerationMilitarySummary_() {
    var summary = document.getElementById('documentos-militar-resumo');
    if (!selectedGenerationMilitary_) {
      if (summary) summary.hidden = true;
      return;
    }
    if (summary) summary.hidden = false;
    setElementText_('documentos-resumo-posto', selectedGenerationMilitary_.posto_graduacao || 'Não cadastrado');
    setElementText_('documentos-resumo-rg', selectedGenerationMilitary_.rg ? 'RG ' + selectedGenerationMilitary_.rg : '—');
    setElementText_('documentos-resumo-whatsapp', selectedGenerationMilitary_.telefone || 'Não informado');
  }

  function populateMilitarySelect_() {
    var select = document.getElementById('documentos-militar-select');
    if (!select) return;
    select.textContent = '';
    selectedGenerationMilitary_ = null;
    fillGenerationMilitarySummary_();
    var recipients = selectedGenerationAudience_ && Array.isArray(selectedGenerationAudience_.destinatarios) ? selectedGenerationAudience_.destinatarios : [];
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = recipients.length ? 'Selecione o militar...' : 'Esta audiência não possui militar vinculado';
    select.appendChild(placeholder);
    select.disabled = recipients.length === 0;
    recipients.forEach(function (item, index) {
      var option = document.createElement('option');
      option.value = String(index);
      option.textContent = recipientDisplay_(item);
      select.appendChild(option);
    });
    updateGeneratePreview_();
  }

  function onAudienceChange_() {
    var select = document.getElementById('documentos-audiencia-select');
    var index = select ? parseInt(select.value, 10) : NaN;
    selectedGenerationAudience_ = Number.isInteger(index) ? generationAudiences_[index] : null;
    fillGenerationAudienceSummary_();
    populateMilitarySelect_();
  }

  function onMilitaryChange_() {
    var select = document.getElementById('documentos-militar-select');
    var index = select ? parseInt(select.value, 10) : NaN;
    var recipients = selectedGenerationAudience_ && Array.isArray(selectedGenerationAudience_.destinatarios) ? selectedGenerationAudience_.destinatarios : [];
    selectedGenerationMilitary_ = Number.isInteger(index) ? recipients[index] : null;
    fillGenerationMilitarySummary_();
    updateGeneratePreview_();
  }

  function populateAudienceSelect_() {
    var select = document.getElementById('documentos-audiencia-select');
    if (!select) return;
    select.textContent = '';
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = generationAudiences_.length ? 'Selecione uma audiência...' : 'Nenhuma audiência disponível';
    select.appendChild(placeholder);
    generationAudiences_.forEach(function (item, index) {
      var option = document.createElement('option');
      option.value = String(index);
      var parts = [];
      if (item.data_hora) parts.push(formatDateTimePt_(item.data_hora));
      if (item.processo) parts.push('Processo ' + item.processo);
      if (item.assunto) parts.push(item.assunto);
      option.textContent = parts.join(' • ') || item.codigo || ('Audiência ' + (index + 1));
      select.appendChild(option);
    });
  }

  function loadGenerationAudiences_() {
    var token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
    if (!token) { handleExpiredSession_(); return Promise.resolve(false); }
    setGenerateLoading_(true);
    setGenerateError_('');
    return window.Api.post('audiencias_list', { token: token }).then(function (response) {
      if (!isSuccess_(response)) {
        var code = getErrorCode_(response);
        if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0) { handleExpiredSession_(); return false; }
        throw new Error(getSafeMessage_(response, 'Não foi possível carregar as audiências.'));
      }
      var data = getData_(response);
      updateExpiry_(data);
      generationAudiences_ = Array.isArray(data.audiencias) ? data.audiencias.slice() : [];
      populateAudienceSelect_();
      return true;
    }).catch(function (error) {
      setGenerateError_(error && error.message ? error.message : 'Não foi possível carregar as audiências.');
      return false;
    }).finally(function () { setGenerateLoading_(false); });
  }

  function showGenerate_() {
    if (!currentConfig_ || !currentConfig_.configurada) { showConfig_(); return; }
    var home = document.getElementById('documentos-home');
    var form = document.getElementById('documentos-config-form');
    var generateView = document.getElementById('documentos-generate-view');
    var subtitle = document.getElementById('documentos-view-subtitle');
    if (home) home.hidden = true;
    if (form) form.hidden = true;
    if (generateView) generateView.hidden = false;
    if (subtitle) subtitle.textContent = 'Prepare o conteúdo do ofício e revise a prévia antes da geração do PDF.';
    setError_(''); setSuccess_(''); setGenerateError_('');
    selectedGenerationAudience_ = null;
    selectedGenerationMilitary_ = null;
    var dateInput = document.getElementById('documentos-data-emissao');
    if (dateInput && !dateInput.value) dateInput.value = todayInputValue_();
    var number = document.getElementById('documentos-numero-preview');
    if (number && currentConfig_) number.value = String(currentConfig_.oficio_proximo_numero || 0).padStart(3, '0') + '/' + currentConfig_.oficio_ano;
    var destination = document.getElementById('documentos-destino-judicial');
    var optional = document.getElementById('documentos-trecho-opcional');
    if (destination) destination.value = '';
    if (optional) optional.value = '';
    fillGenerationAudienceSummary_();
    fillGenerationMilitarySummary_();
    updateGeneratePreview_();
    loadGenerationAudiences_();
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
    var name = document.getElementById('signatario-nome');
    var mark = document.getElementById('signatario-marcar-nome-guerra');
    var unmark = document.getElementById('signatario-remover-nome-guerra');
    var clear = document.getElementById('documentos-config-clear');
    var openConfig = document.getElementById('documentos-open-config');
    var closeConfig = document.getElementById('documentos-close-config');
    var generate = document.getElementById('documentos-generate');
    var generateBack = document.getElementById('documentos-generate-back');
    var audienceSelect = document.getElementById('documentos-audiencia-select');
    var militarySelect = document.getElementById('documentos-militar-select');
    var previewRefresh = document.getElementById('documentos-preview-refresh');
    var issueDate = document.getElementById('documentos-data-emissao');
    var destination = document.getElementById('documentos-destino-judicial');
    var optional = document.getElementById('documentos-trecho-opcional');
    if (backButton) backButton.addEventListener('click', back);
    if (form) form.addEventListener('submit', submit_);
    if (year) year.addEventListener('input', updateNextNumber_);
    if (last) last.addEventListener('input', updateNextNumber_);
    if (name) {
      ['select', 'keyup', 'mouseup', 'touchend'].forEach(function (eventName) { name.addEventListener(eventName, rememberNameSelection_); });
      name.addEventListener('input', updateNamePreview_);
      name.addEventListener('keydown', function (event) {
        if (event.ctrlKey && (String(event.key).toLowerCase() === 'b' || String(event.key).toLowerCase() === 'n')) {
          event.preventDefault();
          rememberNameSelection_();
          markWarName_();
        }
      });
    }
    if (mark) mark.addEventListener('click', markWarName_);
    if (unmark) unmark.addEventListener('click', clearWarName_);
    if (clear) clear.addEventListener('click', clearSignatory_);
    if (openConfig) openConfig.addEventListener('click', showConfig_);
    if (closeConfig) closeConfig.addEventListener('click', showHome_);
    if (generate) generate.addEventListener('click', showGenerate_);
    if (generateBack) generateBack.addEventListener('click', showHome_);
    if (audienceSelect) audienceSelect.addEventListener('change', onAudienceChange_);
    if (militarySelect) militarySelect.addEventListener('change', onMilitaryChange_);
    if (previewRefresh) previewRefresh.addEventListener('click', updateGeneratePreview_);
    [issueDate, destination, optional].forEach(function (element) { if (element) element.addEventListener('input', updateGeneratePreview_); });
  }
  document.addEventListener('DOMContentLoaded', bind_);
  window.Documentos = Object.freeze({ open: open, back: back, reload: load_, showConfig: showConfig_, showHome: showHome_, showGenerate: showGenerate_ });
}());
