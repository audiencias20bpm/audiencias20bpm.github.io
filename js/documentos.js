(function () {
  'use strict';

  var TOKEN_STORAGE_KEY = 'audiencias_session_token';
  var currentConfig_ = null;
  var generationAudiences_ = [];
  var selectedGenerationAudience_ = null;
  var selectedGenerationMilitary_ = null;
  var pendingOficioReservation_ = null;
  var generationBusy_ = false;
  var signatureRemoveRequested_ = false;

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

  function normalizeMilitaryPost_(value) {
    var post = String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
    var aliases = {
      'SD': 'SD PM', 'SD PM': 'SD PM',
      'CB': 'CB PM', 'CB PM': 'CB PM',
      '3º SGT': '3º SGT PM', '3° SGT': '3º SGT PM', '3 SGT': '3º SGT PM',
      '3º SGT PM': '3º SGT PM', '3° SGT PM': '3º SGT PM',
      '2º SGT': '2º SGT PM', '2° SGT': '2º SGT PM', '2 SGT': '2º SGT PM',
      '2º SGT PM': '2º SGT PM', '2° SGT PM': '2º SGT PM',
      '1º SGT': '1º SGT PM', '1° SGT': '1º SGT PM', '1 SGT': '1º SGT PM',
      '1º SGT PM': '1º SGT PM', '1° SGT PM': '1º SGT PM',
      'SUBTEN': 'SUB TEN PM', 'SUB TEN': 'SUB TEN PM',
      'SUBTEN PM': 'SUB TEN PM', 'SUB TEN PM': 'SUB TEN PM'
    };
    return aliases[post] || post;
  }

  function signatoryPostWithQopm_(value) {
    var post = String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (!post) return '';
    return /\bQOPM\b/.test(post) ? post : post + ' QOPM';
  }

  function setSignatureConfigPreview_(config) {
    var image = document.getElementById('signatario-assinatura-preview');
    var status = document.getElementById('signatario-assinatura-status');
    var remove = document.getElementById('signatario-assinatura-remover');
    var dataUrl = String(config && config.signatario_assinatura_data_url || '').trim();
    if (image) {
      image.src = dataUrl || '';
      image.hidden = !dataUrl;
    }
    if (status) {
      status.textContent = dataUrl
        ? 'Assinatura digitalizada cadastrada. Ela será usada automaticamente nos ofícios.'
        : 'Nenhuma assinatura digitalizada cadastrada. O ofício continuará podendo ser gerado normalmente.';
    }
    if (remove) remove.hidden = !dataUrl;
  }

  function readSignatureFile_(file) {
    return new Promise(function (resolve, reject) {
      if (!file) { resolve(null); return; }
      if (String(file.type || '').toLowerCase() !== 'image/jpeg') {
        reject(new Error('A assinatura digitalizada deve estar em formato JPG/JPEG.'));
        return;
      }
      if (file.size > 2500000) {
        reject(new Error('A imagem da assinatura deve ter no máximo 2,5 MB.'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = String(reader.result || '');
        var base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : '';
        if (!base64) { reject(new Error('Não foi possível ler a imagem da assinatura.')); return; }
        resolve({ base64: base64, mime: 'image/jpeg', nome: file.name || 'assinatura.jpg', dataUrl: dataUrl });
      };
      reader.onerror = function () { reject(new Error('Não foi possível ler a imagem da assinatura.')); };
      reader.readAsDataURL(file);
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
    var assinaturaInput = document.getElementById('signatario-assinatura-arquivo');
    if (assinaturaInput) assinaturaInput.value = '';
    signatureRemoveRequested_ = true;
    setSignatureConfigPreview_({});
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
    if (config.signatario_posto_graduacao) parts.push(signatoryPostWithQopm_(config.signatario_posto_graduacao));
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
    var assinaturaInput = document.getElementById('signatario-assinatura-arquivo');
    if (assinaturaInput) assinaturaInput.value = '';
    signatureRemoveRequested_ = false;
    setSignatureConfigPreview_(c);
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
      signatario_cargo: document.getElementById('signatario-cargo').value.trim(),
      remover_assinatura: signatureRemoveRequested_
    };
    if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(last) || last < 0 || !payload.signatario_nome || !payload.signatario_posto_graduacao || !payload.signatario_rg || !payload.signatario_cargo) {
      setError_('Preencha corretamente todos os campos obrigatórios da configuração.');
      return;
    }

    var button = document.getElementById('documentos-config-save');
    var assinaturaInput = document.getElementById('signatario-assinatura-arquivo');
    var file = assinaturaInput && assinaturaInput.files && assinaturaInput.files.length ? assinaturaInput.files[0] : null;
    if (button) { button.disabled = true; button.textContent = 'Salvando...'; }
    setError_(''); setSuccess_('');

    readSignatureFile_(file)
      .then(function (assinatura) {
        if (assinatura) {
          payload.signatario_assinatura_base64 = assinatura.base64;
          payload.signatario_assinatura_mime = assinatura.mime;
          payload.signatario_assinatura_nome = assinatura.nome;
          payload.remover_assinatura = false;
        }
        return window.Api.post('oficios_config_save', payload);
      })
      .then(function (response) {
        if (!isSuccess_(response)) {
          var code = getErrorCode_(response);
          if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0) { handleExpiredSession_(); return; }
          throw new Error(getSafeMessage_(response, 'Não foi possível salvar a configuração dos ofícios.'));
        }
        var data = getData_(response);
        updateExpiry_(data);
        fill_(data.configuracao || payload);
        setSuccess_('Configuração salva. A assinatura digitalizada é opcional e a numeração continuará a partir do valor informado.');
      })
      .catch(function (error) {
        setError_(error && error.message ? error.message : 'Não foi possível salvar a configuração dos ofícios.');
      })
      .finally(function () {
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

  function getGenerationPost_() {
    var input = document.getElementById('documentos-militar-posto');
    return input ? normalizeMilitaryPost_(input.value) : '';
  }

  function recipientDisplay_(item, postoOverride) {
    var parts = [];
    var posto = normalizeMilitaryPost_(postoOverride || (item && item.posto_graduacao) || '');
    if (posto) parts.push(posto);
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
    if (currentConfig_.signatario_posto_graduacao) prefix.push(signatoryPostWithQopm_(currentConfig_.signatario_posto_graduacao));
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
    setElementText_('documentos-preview-militar', recipientDisplay_(selectedGenerationMilitary_, getGenerationPost_()));
    setElementText_('documentos-preview-processo', selectedGenerationAudience_.processo || '—');
    setElementText_('documentos-preview-cargo', currentConfig_ && currentConfig_.signatario_cargo ? currentConfig_.signatario_cargo : '—');
    renderGenerateSignatory_();
    var assinaturaPreview = document.getElementById('documentos-preview-assinatura');
    var assinaturaData = String(currentConfig_ && currentConfig_.signatario_assinatura_data_url || '').trim();
    if (assinaturaPreview) {
      assinaturaPreview.src = assinaturaData || '';
      assinaturaPreview.hidden = !assinaturaData;
    }

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
      var postoInputVazio = document.getElementById('documentos-militar-posto');
      if (postoInputVazio) { postoInputVazio.value = ''; postoInputVazio.disabled = true; }
      return;
    }
    if (summary) summary.hidden = false;
    setElementText_('documentos-resumo-posto', normalizeMilitaryPost_(selectedGenerationMilitary_.posto_graduacao || '') || 'Não cadastrado');
    setElementText_('documentos-resumo-rg', selectedGenerationMilitary_.rg ? 'RG ' + selectedGenerationMilitary_.rg : '—');
    setElementText_('documentos-resumo-whatsapp', selectedGenerationMilitary_.telefone || 'Não informado');
    var postoInput = document.getElementById('documentos-militar-posto');
    if (postoInput) {
      postoInput.disabled = false;
      postoInput.value = normalizeMilitaryPost_(selectedGenerationMilitary_.posto_graduacao || '');
    }
  }

  function populateMilitarySelect_() {
    var select = document.getElementById('documentos-militar-select');
    if (!select) return;
    select.textContent = '';
    selectedGenerationMilitary_ = null;
    pendingOficioReservation_ = null;
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
    pendingOficioReservation_ = null;
    fillGenerationAudienceSummary_();
    populateMilitarySelect_();
  }

  function onMilitaryChange_() {
    var select = document.getElementById('documentos-militar-select');
    var index = select ? parseInt(select.value, 10) : NaN;
    var recipients = selectedGenerationAudience_ && Array.isArray(selectedGenerationAudience_.destinatarios) ? selectedGenerationAudience_.destinatarios : [];
    selectedGenerationMilitary_ = Number.isInteger(index) ? recipients[index] : null;
    pendingOficioReservation_ = null;
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

  function setGenerateBusy_(busy) {
    generationBusy_ = Boolean(busy);
    var button = document.getElementById('documentos-generate-pdf');
    if (button) {
      button.disabled = generationBusy_;
      button.setAttribute('aria-busy', generationBusy_ ? 'true' : 'false');
      button.textContent = generationBusy_ ? 'Gerando PDF...' : 'Gerar PDF';
    }
  }

  function validateGeneration_() {
    if (!selectedGenerationAudience_) return 'Selecione a audiência.';
    if (!selectedGenerationMilitary_ || !selectedGenerationMilitary_.id) return 'Selecione o militar.';
    var posto = getGenerationPost_();
    if (!posto) return 'Informe o Posto/Graduação atual do militar.';
    var data = document.getElementById('documentos-data-emissao');
    if (!data || !data.value) return 'Informe a data do ofício.';
    var destino = document.getElementById('documentos-destino-judicial');
    if (!destino || !destino.value.trim()) return 'Informe o destinatário do ofício.';
    return '';
  }

  function updateMilitaryPostIfNeeded_() {
    var posto = getGenerationPost_();
    var atual = String(selectedGenerationMilitary_ && selectedGenerationMilitary_.posto_graduacao || '').trim();
    if (!selectedGenerationMilitary_ || !selectedGenerationMilitary_.id || !posto || posto === atual) return Promise.resolve(true);
    var token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
    return window.Api.post('destinatarios_update', {
      token: token,
      id: selectedGenerationMilitary_.id,
      posto_graduacao: posto,
      telefone: selectedGenerationMilitary_.telefone || '',
      unidade: selectedGenerationMilitary_.unidade || '',
      status: selectedGenerationMilitary_.status || 'ATIVO'
    }).then(function (response) {
      if (!isSuccess_(response)) throw new Error(getSafeMessage_(response, 'Não foi possível atualizar o Posto/Graduação do militar.'));
      var data = getData_(response);
      updateExpiry_(data);
      selectedGenerationMilitary_.posto_graduacao = posto;
      setElementText_('documentos-resumo-posto', posto);
      return true;
    });
  }

  function reserveOficio_() {
    if (pendingOficioReservation_) return Promise.resolve(pendingOficioReservation_);
    var token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
    var date = document.getElementById('documentos-data-emissao');
    var destination = document.getElementById('documentos-destino-judicial');
    var optional = document.getElementById('documentos-trecho-opcional');
    return window.Api.post('oficios_reservar', {
      token: token,
      audiencia_id: selectedGenerationAudience_.id,
      destinatario_id: selectedGenerationMilitary_.id,
      data_emissao: date ? date.value : '',
      destino_judicial: destination ? destination.value.trim() : '',
      trecho_opcional: optional ? optional.value.trim() : '',
      posto_graduacao: getGenerationPost_()
    }).then(function (response) {
      if (!isSuccess_(response)) {
        var code = getErrorCode_(response);
        if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0) { handleExpiredSession_(); throw new Error('Sessão expirada.'); }
        throw new Error(getSafeMessage_(response, 'Não foi possível reservar o número do ofício.'));
      }
      var data = getData_(response);
      updateExpiry_(data);
      pendingOficioReservation_ = data.oficio || data.reserva || null;
      if (!pendingOficioReservation_ || !pendingOficioReservation_.id) throw new Error('O servidor não devolveu a reserva do ofício.');
      var number = document.getElementById('documentos-numero-preview');
      if (number && pendingOficioReservation_.numero_formatado) number.value = pendingOficioReservation_.numero_formatado;
      updateGeneratePreview_();
      return pendingOficioReservation_;
    });
  }

  function loadImage_(src) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('Não foi possível carregar os brasões do ofício.')); };
      image.src = src;
    });
  }

  function splitWords_(segments) {
    var words = [];
    segments.forEach(function (segment) {
      String(segment.text || '').trim().split(/\s+/).filter(Boolean).forEach(function (word) {
        words.push({ text: word, color: segment.color || '#111111', bold: Boolean(segment.bold) });
      });
    });
    return words;
  }

  function setCanvasFont_(ctx, size, bold) {
    ctx.font = (bold ? '700 ' : '400 ') + size + 'px Arial, Helvetica, sans-serif';
  }

  function drawCenteredText_(ctx, text, x, y, size, bold, color) {
    setCanvasFont_(ctx, size, bold);
    ctx.fillStyle = color || '#111111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(text || ''), x, y);
  }

  function drawRichCentered_(ctx, segments, centerX, y, size) {
    var widths = segments.map(function (seg) { setCanvasFont_(ctx, size, seg.bold); return ctx.measureText(seg.text).width; });
    var x = centerX - widths.reduce(function (a, b) { return a + b; }, 0) / 2;
    ctx.textAlign = 'left';
    segments.forEach(function (seg, i) {
      setCanvasFont_(ctx, size, seg.bold);
      ctx.fillStyle = seg.color || '#111111';
      ctx.fillText(seg.text, x, y);
      x += widths[i];
    });
  }

  function wrapSimpleText_(ctx, text, maxWidth, size, bold) {
    setCanvasFont_(ctx, size, bold);
    var words = String(text || '').split(/\s+/).filter(Boolean);
    var lines = [];
    var line = '';
    words.forEach(function (word) {
      var test = line ? line + ' ' + word : word;
      if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = word; }
      else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }

  function drawJustifiedSegments_(ctx, segments, x, y, maxWidth, size, lineHeight, firstIndent) {
    var words = splitWords_(segments);
    var lines = [];
    var current = [];
    var lineIndex = 0;
    words.forEach(function (word) {
      var available = maxWidth - (lineIndex === 0 ? firstIndent : 0);
      var width = 0;
      current.forEach(function (w, i) { setCanvasFont_(ctx, size, w.bold); width += ctx.measureText(w.text).width + (i ? ctx.measureText(' ').width : 0); });
      setCanvasFont_(ctx, size, word.bold);
      var add = ctx.measureText(word.text).width + (current.length ? ctx.measureText(' ').width : 0);
      if (current.length && width + add > available) { lines.push(current); current = [word]; lineIndex += 1; }
      else current.push(word);
    });
    if (current.length) lines.push(current);

    lines.forEach(function (line, idx) {
      var indent = idx === 0 ? firstIndent : 0;
      var available = maxWidth - indent;
      var widths = line.map(function (w) { setCanvasFont_(ctx, size, w.bold); return ctx.measureText(w.text).width; });
      var total = widths.reduce(function (a, b) { return a + b; }, 0);
      var gap = line.length > 1 ? ctx.measureText(' ').width : 0;
      if (idx < lines.length - 1 && line.length > 1) gap = Math.max(gap, (available - total) / (line.length - 1));
      var px = x + indent;
      ctx.textAlign = 'left';
      line.forEach(function (w, wi) {
        setCanvasFont_(ctx, size, w.bold);
        ctx.fillStyle = w.color || '#111111';
        ctx.fillText(w.text, px, y + idx * lineHeight);
        px += widths[wi] + gap;
      });
    });
    return y + Math.max(1, lines.length) * lineHeight;
  }

  function createOficioCanvas_() {
    var canvas = document.createElement('canvas');
    // Renderiza o A4 em 2x (aprox. 300 dpi) para melhorar a nitidez do PDF
    // sem alterar as medidas/logica visual ja aprovadas.
    var logicalWidth = 1240;
    var logicalHeight = 1754;
    var renderScale = 2;
    canvas.width = logicalWidth * renderScale;
    canvas.height = logicalHeight * renderScale;
    var ctx = canvas.getContext('2d');
    ctx.scale(renderScale, renderScale);
    var scale = logicalWidth / 210;
    function mm(value) { return value * scale; }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    var signatureDataUrl = String(currentConfig_ && currentConfig_.signatario_assinatura_data_url || '').trim();
    var signaturePromise = signatureDataUrl ? loadImage_(signatureDataUrl).catch(function () { return null; }) : Promise.resolve(null);
    return Promise.all([
      loadImage_('./assets/oficios/brasao-estado-para.png'),
      loadImage_('./assets/oficios/brasao-pmpa.png'),
      loadImage_('./assets/oficios/brasao-20bpm.png'),
      signaturePromise
    ]).then(function (images) {
      var left = images[0], right = images[1], footerLogo = images[2], signatureImage = images[3];
      var center = logicalWidth / 2;
      var black = '#111111';
      ctx.drawImage(left, mm(6), mm(5), mm(15), mm(22));
      ctx.drawImage(right, mm(189), mm(5), mm(15), mm(22));
      drawCenteredText_(ctx, 'GOVERNO DO ESTADO DO PARÁ', center, mm(10), 20, false, black);
      drawCenteredText_(ctx, 'SECRETARIA DE ESTADO DE SEGURANÇA PÚBLICA E DEFESA SOCIAL', center, mm(14), 19, false, black);
      drawCenteredText_(ctx, 'POLÍCIA MILITAR DO PARÁ', center, mm(18), 19, false, black);
      drawCenteredText_(ctx, '20º BATALHÃO DE POLÍCIA MILITAR – BATALHÃO COMUNITÁRIO', center, mm(22), 19, true, black);
      ctx.strokeStyle = '#111111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mm(20), mm(25)); ctx.lineTo(mm(190), mm(25)); ctx.stroke();

      var dateText = formatLongDate_(document.getElementById('documentos-data-emissao').value);
      setCanvasFont_(ctx, 20, false); ctx.fillStyle = black; ctx.textAlign = 'right'; ctx.fillText('Belém, ' + dateText + '.', mm(185), mm(35));
      ctx.textAlign = 'left'; ctx.fillText('OFÍCIO ' + document.getElementById('documentos-numero-preview').value + ' – 1ª Seção', mm(20), mm(44));

      var destination = document.getElementById('documentos-destino-judicial').value.trim();
      var destLines = wrapSimpleText_(ctx, destination, mm(170), 20, false);
      destLines.forEach(function (line, i) { ctx.fillText(line, mm(20), mm(56) + i * 28); });
      var y = mm(56) + destLines.length * 28 + mm(8);
      setCanvasFont_(ctx, 20, true); ctx.fillText('Assunto: Apresentação de Praças.', mm(20), y); y += mm(24);
      setCanvasFont_(ctx, 20, false);
      ctx.fillStyle = black;
      ctx.textAlign = 'left';
      ctx.fillText('Senhor Juiz,', mm(50), y);
      y += mm(18);

      var posto = getGenerationPost_();
      var military = recipientDisplay_(selectedGenerationMilitary_, posto);
      var proc = String(selectedGenerationAudience_.processo || '').trim();
      var optional = String(document.getElementById('documentos-trecho-opcional').value || '').trim();
      var segments = [
        { text: 'Honrado em cumprimentar V. Ex.ª apresento o policial militar ' },
        { text: military },
        { text: ', para ser ouvido na qualidade de testemunha nos autos do processo nº. ' },
        { text: proc + (optional ? ',' : '.') }
      ];
      if (optional) segments.push({ text: optional, color: '#c62828' });
      y = drawJustifiedSegments_(ctx, segments, mm(28), y, mm(154), 20, 31, mm(22));
      y += mm(18);
      drawCenteredText_(ctx, 'Respeitosamente,', center, y, 20, false, black); y += mm(42);

      var name = String(currentConfig_.signatario_nome || '').trim();
      var war = String(currentConfig_.signatario_nome_guerra || '').trim();
      var signPost = signatoryPostWithQopm_(currentConfig_.signatario_posto_graduacao || '');
      var signRg = String(currentConfig_.signatario_rg || '').trim();
      var lowerName = name.toLocaleLowerCase('pt-BR');
      var lowerWar = war.toLocaleLowerCase('pt-BR');
      var warIndex = war ? lowerName.indexOf(lowerWar) : -1;
      var signSegments = [];
      if (warIndex >= 0) {
        signSegments.push({ text: name.slice(0, warIndex), bold: false });
        signSegments.push({ text: name.slice(warIndex, warIndex + war.length), bold: true });
        signSegments.push({ text: name.slice(warIndex + war.length) + ' - ' + signPost + ' RG ' + signRg, bold: false });
      } else signSegments.push({ text: name + ' - ' + signPost + ' RG ' + signRg, bold: false });
      ctx.drawImage(footerLogo, mm(4), y - mm(8), mm(13), mm(18));
      if (signatureImage) {
        var signMaxW = mm(58);
        var signMaxH = mm(26);
        var ratio = Math.min(signMaxW / signatureImage.width, signMaxH / signatureImage.height);
        var signW = signatureImage.width * ratio;
        var signH = signatureImage.height * ratio;
        ctx.save();
        ctx.globalAlpha = 0.68;
        ctx.drawImage(signatureImage, center - signW / 2, y - signH + mm(4), signW, signH);
        ctx.restore();
      }
      drawRichCentered_(ctx, signSegments, center, y, 20);
      y += 30;
      drawCenteredText_(ctx, currentConfig_.signatario_cargo || '', center, y, 20, false, black);

      var footerY = mm(270);
      drawCenteredText_(ctx, '20º BATALHÃO DE POLÍCIA MILITAR – BATALHÃO COMUNITÁRIO', center, footerY, 17, true, black);
      drawCenteredText_(ctx, 'Tv. Pe. Eutiquio, nº 3000, Condor - Belém /PA. CEP: 66045-225. (esq. PSG. S. Antônio).', center, footerY + 23, 15, false, black);
      drawCenteredText_(ctx, 'Contato: email: oficio2024bpm@gmail.com', center, footerY + 46, 15, false, black);
      return canvas;
    });
  }

  function concatBytes_(parts) {
    var length = parts.reduce(function (sum, part) { return sum + part.length; }, 0);
    var output = new Uint8Array(length); var offset = 0;
    parts.forEach(function (part) { output.set(part, offset); offset += part.length; });
    return output;
  }

  function textBytes_(text) { return new TextEncoder().encode(text); }

  function jpegDataUrlToPdfBlob_(dataUrl, width, height) {
    var base64 = dataUrl.split(',')[1] || '';
    var binary = atob(base64); var jpg = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) jpg[i] = binary.charCodeAt(i);
    var pageW = '595.28', pageH = '841.89';
    var content = 'q\n' + pageW + ' 0 0 ' + pageH + ' 0 0 cm\n/Im0 Do\nQ\n';
    var objects = [];
    objects[1] = [textBytes_('<< /Type /Catalog /Pages 2 0 R >>')];
    objects[2] = [textBytes_('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')];
    objects[3] = [textBytes_('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>')];
    objects[4] = [textBytes_('<< /Type /XObject /Subtype /Image /Width ' + width + ' /Height ' + height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n'), jpg, textBytes_('\nendstream')];
    objects[5] = [textBytes_('<< /Length ' + textBytes_(content).length + ' >>\nstream\n' + content + 'endstream')];
    var chunks = [textBytes_('%PDF-1.4\n%âãÏÓ\n')];
    var offsets = [0]; var currentOffset = chunks[0].length;
    for (var n = 1; n <= 5; n += 1) {
      offsets[n] = currentOffset;
      var head = textBytes_(n + ' 0 obj\n'); var tail = textBytes_('\nendobj\n');
      var body = concatBytes_(objects[n]); var obj = concatBytes_([head, body, tail]);
      chunks.push(obj); currentOffset += obj.length;
    }
    var xrefOffset = currentOffset;
    var xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (var r = 1; r <= 5; r += 1) xref += String(offsets[r]).padStart(10, '0') + ' 00000 n \n';
    xref += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
    chunks.push(textBytes_(xref));
    return new Blob([concatBytes_(chunks)], { type: 'application/pdf' });
  }

  function blobToBase64_(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '').split(',')[1] || ''); };
      reader.onerror = function () { reject(new Error('Não foi possível preparar o PDF para armazenamento.')); };
      reader.readAsDataURL(blob);
    });
  }

  function downloadBlob_(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a'); link.href = url; link.download = fileName;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }

  function finalizeOficioPdf_(reservation, blob, fileName) {
    var token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
    return blobToBase64_(blob).then(function (base64) {
      return window.Api.post('oficios_pdf_finalizar', { token: token, oficio_id: reservation.id, pdf_nome: fileName, pdf_base64: base64 });
    }).then(function (response) {
      if (!isSuccess_(response)) throw new Error(getSafeMessage_(response, 'Não foi possível salvar o PDF no Drive.'));
      var data = getData_(response); updateExpiry_(data); return data;
    });
  }

  function generatePdf_() {
    if (generationBusy_) return;
    setGenerateError_(''); setSuccess_('');
    var validation = validateGeneration_();
    if (validation) { setGenerateError_(validation); return; }
    setGenerateBusy_(true);
    updateGeneratePreview_();
    updateMilitaryPostIfNeeded_()
      .then(reserveOficio_)
      .then(function (reservation) {
        return createOficioCanvas_().then(function (canvas) {
          var jpeg = canvas.toDataURL('image/jpeg', 0.96);
          var blob = jpegDataUrlToPdfBlob_(jpeg, canvas.width, canvas.height);
          var safeNumber = String(reservation.numero_formatado || 'oficio').replace(/[\\/:*?"<>|]+/g, '-');
          var rg = String(selectedGenerationMilitary_.rg || '').replace(/\D+/g, '');
          var fileName = 'OFICIO-' + safeNumber + (rg ? '-RG-' + rg : '') + '.pdf';
          return finalizeOficioPdf_(reservation, blob, fileName).then(function () {
            downloadBlob_(blob, fileName);
            setSuccess_('Ofício ' + (reservation.numero_formatado || '') + ' gerado, salvo no Drive e baixado no dispositivo.');
            pendingOficioReservation_ = null;
            if (currentConfig_) {
              currentConfig_.oficio_ultimo_numero = reservation.numero;
              currentConfig_.oficio_proximo_numero = Number(reservation.numero || 0) + 1;
            }
            return true;
          });
        });
      })
      .catch(function (error) { setGenerateError_(error && error.message ? error.message : 'Não foi possível gerar o PDF.'); })
      .finally(function () { setGenerateBusy_(false); });
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
    pendingOficioReservation_ = null;
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
    var militaryPost = document.getElementById('documentos-militar-posto');
    var generatePdf = document.getElementById('documentos-generate-pdf');
    var signatureInput = document.getElementById('signatario-assinatura-arquivo');
    var signatureRemove = document.getElementById('signatario-assinatura-remover');
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
    if (signatureInput) signatureInput.addEventListener('change', function () {
      signatureRemoveRequested_ = false;
      var file = signatureInput.files && signatureInput.files.length ? signatureInput.files[0] : null;
      if (!file) { setSignatureConfigPreview_(currentConfig_ || {}); return; }
      readSignatureFile_(file).then(function (assinatura) {
        setSignatureConfigPreview_(Object.assign({}, currentConfig_ || {}, { signatario_assinatura_data_url: assinatura.dataUrl }));
        setError_('');
      }).catch(function (error) {
        signatureInput.value = '';
        setSignatureConfigPreview_(currentConfig_ || {});
        setError_(error && error.message ? error.message : 'Não foi possível ler a assinatura.');
      });
    });
    if (signatureRemove) signatureRemove.addEventListener('click', function () {
      signatureRemoveRequested_ = true;
      if (signatureInput) signatureInput.value = '';
      setSignatureConfigPreview_({});
      setError_('');
    });
    if (openConfig) openConfig.addEventListener('click', showConfig_);
    if (closeConfig) closeConfig.addEventListener('click', showHome_);
    if (generate) generate.addEventListener('click', showGenerate_);
    if (generateBack) generateBack.addEventListener('click', showHome_);
    if (audienceSelect) audienceSelect.addEventListener('change', onAudienceChange_);
    if (militarySelect) militarySelect.addEventListener('change', onMilitaryChange_);
    if (previewRefresh) previewRefresh.addEventListener('click', updateGeneratePreview_);
    if (militaryPost) militaryPost.addEventListener('input', function () { pendingOficioReservation_ = null; updateGeneratePreview_(); });
    if (generatePdf) generatePdf.addEventListener('click', generatePdf_);
    [issueDate, destination, optional].forEach(function (element) { if (element) element.addEventListener('input', function () { pendingOficioReservation_ = null; updateGeneratePreview_(); }); });
  }
  document.addEventListener('DOMContentLoaded', bind_);
  window.Documentos = Object.freeze({ open: open, back: back, reload: load_, showConfig: showConfig_, showHome: showHome_, showGenerate: showGenerate_ });
}());
