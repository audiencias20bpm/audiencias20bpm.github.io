(function () {
  'use strict';

  var TOKEN_STORAGE_KEY = 'audiencias_session_token';
  var saving = false;
  var lookupTimer = null;
  var lookupSerial = 0;
  var selectedRecipients = [];
  var allAudiencias = [];
  var DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Belem',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

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
  function escapeText_(value) { return String(value === null || value === undefined ? '' : value); }
  function digits_(value) { return escapeText_(value).replace(/\D+/g, ''); }
  function normalizeCpf_(value) {
    var cpf = digits_(value);
    if (!cpf) return '';
    return cpf.length <= 11 ? cpf.padStart(11, '0') : cpf;
  }
  function formatCpf_(value) {
    var cpf = normalizeCpf_(value);
    if (cpf.length !== 11) return cpf;
    return cpf.slice(0,3)+'.'+cpf.slice(3,6)+'.'+cpf.slice(6,9)+'-'+cpf.slice(9);
  }
  function formatDate_(value) {
    if (!value) return 'Não informada';
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? escapeText_(value) : DATE_FORMATTER.format(date);
  }
  function normalizeStatus_(value) { return String(value || '').trim().toUpperCase() || 'SEM_STATUS'; }
  function normalizeSearch_(value) {
    return String(value === null || value === undefined ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
  function searchTextForAudience_(item) {
    var recipients = Array.isArray(item.destinatarios) ? item.destinatarios : [];
    var parts = [item.codigo, item.processo, item.assunto, item.local, item.modalidade, item.status];
    recipients.forEach(function (recipient) {
      parts.push(recipient.nome, recipient.rg, recipient.cpf, recipient.posto_graduacao, recipient.telefone, recipient.unidade);
    });
    return normalizeSearch_(parts.filter(Boolean).join(' '));
  }
  function statusLabel_(status) {
    var labels = { AGENDADA:'Agendada', CIENCIA_CONFIRMADA:'Ciência confirmada', REALIZADA:'Realizada', CANCELADA:'Cancelada', SEM_STATUS:'Sem status' };
    return labels[status] || status.replace(/_/g, ' ');
  }

  function setView_(name) {
    var dashboard = document.getElementById('dashboard-home');
    var module = document.getElementById('audiencias-view');
    if (dashboard) dashboard.hidden = name !== 'dashboard';
    if (module) module.hidden = name !== 'audiencias';
  }

  function setListVisibility_(showList) {
    var formView = document.getElementById('audiencias-form-view');
    ['audiencias-loading','audiencias-error','audiencias-empty','audiencias-content','audiencias-success'].forEach(function (id) {
      var element = document.getElementById(id);
      if (element && !showList) element.hidden = true;
    });
    var actions = document.querySelector('#audiencias-view > .module-actions');
    var headerActions = document.querySelector('#audiencias-view .module-header-actions');
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
    if (error) { error.hidden = state !== 'error'; error.textContent = state === 'error' ? (message || 'Não foi possível carregar as audiências.') : ''; }
    if (empty) empty.hidden = state !== 'empty';
    if (content) content.hidden = state !== 'content';
  }

  function showSuccess_(message) {
    var success = document.getElementById('audiencias-success');
    if (!success) return;
    success.textContent = message || 'Operação concluída com sucesso.';
    success.hidden = false;
  }
  function hideSuccess_() { var success=document.getElementById('audiencias-success'); if(success) success.hidden=true; }
  function createCell_(text, className) { var td=document.createElement('td'); if(className) td.className=className; td.textContent=escapeText_(text); return td; }

  function recipientsLabel_(items) {
    if (!Array.isArray(items) || !items.length) return '—';
    return items.map(function (item) { return item.nome || ('RG ' + (item.rg || '')); }).join(' • ');
  }

  function addMobileField_(grid, label, value, wide) {
    var field = document.createElement('div');
    field.className = 'audiencia-mobile-field' + (wide ? ' audiencia-mobile-field-wide' : '');
    var caption = document.createElement('span');
    caption.className = 'audiencia-mobile-label';
    caption.textContent = label;
    var content = document.createElement('span');
    content.className = 'audiencia-mobile-value';
    content.textContent = value || '—';
    field.appendChild(caption);
    field.appendChild(content);
    grid.appendChild(field);
    return field;
  }

  function renderMobileCards_(items) {
    var list = document.getElementById('audiencias-mobile-list');
    if (!list) return;
    list.textContent = '';
    items.forEach(function (item) {
      var status = normalizeStatus_(item.status);
      var card = document.createElement('article');
      card.className = 'audiencia-mobile-card';

      var top = document.createElement('div');
      top.className = 'audiencia-mobile-card-top';
      var code = document.createElement('strong');
      code.className = 'audiencia-mobile-code';
      code.textContent = item.codigo || 'Audiência';
      var badge = document.createElement('span');
      badge.className = 'audiencia-status status-' + status.toLowerCase().replace(/_/g, '-');
      badge.textContent = statusLabel_(status);
      top.appendChild(code);
      top.appendChild(badge);
      card.appendChild(top);

      var grid = document.createElement('div');
      grid.className = 'audiencia-mobile-grid';
      addMobileField_(grid, 'Processo', item.processo || '—', true);
      addMobileField_(grid, 'Assunto', item.assunto || '—', true);
      addMobileField_(grid, 'Militares', recipientsLabel_(item.destinatarios), true);
      addMobileField_(grid, 'Data e hora', formatDate_(item.data_hora), false);
      addMobileField_(grid, 'Modalidade', item.modalidade || '—', false);
      addMobileField_(grid, 'Local', item.local || '—', true);
      card.appendChild(grid);

      var actions = document.createElement('div');
      actions.className = 'audiencia-mobile-actions';
      var detailButton = document.createElement('button');
      detailButton.type = 'button';
      detailButton.className = 'secondary-button compact-button';
      detailButton.textContent = 'Detalhes';
      detailButton.addEventListener('click', function () { openDetails_(item); });
      actions.appendChild(detailButton);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function renderRows_(items) {
    var tbody=document.getElementById('audiencias-table-body');
    var count=document.getElementById('audiencias-count');
    if(!tbody) return;
    tbody.textContent='';
    items.forEach(function(item){
      var tr=document.createElement('tr');
      var status=normalizeStatus_(item.status);
      tr.appendChild(createCell_(item.codigo || '-', 'audiencias-code'));
      tr.appendChild(createCell_(item.processo || '-'));
      tr.appendChild(createCell_(item.assunto || '-'));
      tr.appendChild(createCell_(recipientsLabel_(item.destinatarios), 'audiencias-recipients-cell'));
      tr.appendChild(createCell_(formatDate_(item.data_hora)));
      tr.appendChild(createCell_(item.modalidade || '-'));
      tr.appendChild(createCell_(item.local || '-'));
      var statusCell=document.createElement('td');
      var badge=document.createElement('span');
      badge.className='audiencia-status status-' + status.toLowerCase().replace(/_/g,'-');
      badge.textContent=statusLabel_(status);
      statusCell.appendChild(badge); tr.appendChild(statusCell);

      var actionsCell=document.createElement('td');
      actionsCell.className='table-actions-cell';
      var detailButton=document.createElement('button');
      detailButton.type='button';
      detailButton.className='secondary-button compact-button table-action-button';
      detailButton.textContent='Detalhes';
      detailButton.addEventListener('click',function(){openDetails_(item);});
      actionsCell.appendChild(detailButton);
      tr.appendChild(actionsCell);
      tbody.appendChild(tr);
    });
    renderMobileCards_(items);
    if(count) count.textContent=allAudiencias.length===1?'1 audiência':allAudiencias.length+' audiências';
  }


  function setText_(id,value){
    var element=document.getElementById(id);
    if(element) element.textContent=value||'—';
  }

  function renderDetailRecipients_(items){
    var list=document.getElementById('audiencias-detail-recipients-list');
    var count=document.getElementById('audiencias-detail-recipients-count');
    var recipients=Array.isArray(items)?items:[];
    if(count) count.textContent=recipients.length===1?'1 militar':recipients.length+' militares';
    if(!list) return;
    list.textContent='';
    if(!recipients.length){
      var empty=document.createElement('p');
      empty.className='detail-empty';
      empty.textContent='Nenhum militar vinculado a esta audiência.';
      list.appendChild(empty);
      return;
    }
    recipients.forEach(function(item){
      var card=document.createElement('article');
      card.className='detail-recipient-card';
      var name=document.createElement('strong');
      name.textContent=item.nome||'Militar';
      var meta=document.createElement('div');
      meta.className='detail-recipient-meta';
      var values=[];
      if(item.posto_graduacao) values.push(item.posto_graduacao);
      if(item.rg) values.push('RG '+item.rg);
      if(item.cpf) values.push('CPF '+formatCpf_(item.cpf));
      if(item.telefone) values.push('WhatsApp '+item.telefone);
      if(item.unidade) values.push(item.unidade);
      meta.textContent=values.length?values.join(' • '):'Sem dados complementares.';
      card.appendChild(name);
      card.appendChild(meta);
      list.appendChild(card);
    });
  }

  function openDetails_(item){
    if(!item) return;
    var dialog=document.getElementById('audiencias-detail-dialog');
    if(!dialog) return;
    setText_('audiencias-detail-code',item.codigo||'Audiência');
    setText_('audiencias-detail-processo',item.processo);
    setText_('audiencias-detail-status',statusLabel_(normalizeStatus_(item.status)));
    setText_('audiencias-detail-assunto',item.assunto);
    setText_('audiencias-detail-data',formatDate_(item.data_hora));
    setText_('audiencias-detail-modalidade',item.modalidade);
    setText_('audiencias-detail-local',item.local);
    setText_('audiencias-detail-observacoes',item.observacoes);

    var link=document.getElementById('audiencias-detail-link');
    var linkEmpty=document.getElementById('audiencias-detail-link-empty');
    if(link){
      if(item.link&&/^https?:\/\//i.test(item.link)){
        link.href=item.link;
        link.hidden=false;
        if(linkEmpty) linkEmpty.hidden=true;
      }else{
        link.removeAttribute('href');
        link.hidden=true;
        if(linkEmpty){linkEmpty.hidden=false;linkEmpty.textContent='—';}
      }
    }

    renderDetailRecipients_(item.destinatarios);
    dialog.hidden=false;
    document.body.classList.add('modal-open');
    var close=document.getElementById('audiencias-detail-close');
    if(close) close.focus();
  }

  function closeDetails_(){
    var dialog=document.getElementById('audiencias-detail-dialog');
    if(dialog) dialog.hidden=true;
    document.body.classList.remove('modal-open');
  }

  function applySearch_(){
    var input=document.getElementById('audiencias-search');
    var clear=document.getElementById('audiencias-search-clear');
    var summary=document.getElementById('audiencias-search-summary');
    var empty=document.getElementById('audiencias-search-empty');
    var tableWrap=document.getElementById('audiencias-table-wrap');
    var mobileList=document.getElementById('audiencias-mobile-list');
    var query=normalizeSearch_(input?input.value:'');
    var filtered=!query ? allAudiencias.slice() : allAudiencias.filter(function(item){
      return searchTextForAudience_(item).indexOf(query)!==-1;
    });
    if(clear) clear.hidden=!query;
    if(summary){
      if(!query) summary.textContent='';
      else summary.textContent=filtered.length===1?'1 audiência encontrada.':filtered.length+' audiências encontradas.';
    }
    if(empty) empty.hidden=filtered.length!==0;
    if(tableWrap) tableWrap.hidden=filtered.length===0;
    if(mobileList) mobileList.hidden=filtered.length===0;
    if(filtered.length) renderRows_(filtered);
    else {
      var tbody=document.getElementById('audiencias-table-body'); if(tbody) tbody.textContent='';
      var mobile=document.getElementById('audiencias-mobile-list'); if(mobile) mobile.textContent='';
    }
  }

  function handleExpiredSession_(){
    if(window.Auth&&typeof window.Auth.clearStoredSession==='function') window.Auth.clearStoredSession();
    if(window.Auth&&typeof window.Auth.showLogin==='function') window.Auth.showLogin('Sua sessão expirou. Entre novamente para continuar.');
  }
  function updateExpiry_(data){ if(data.expira_em&&window.Session&&typeof window.Session.updateExpiry==='function') window.Session.updateExpiry(data.expira_em); }

  function load_(){
    var token=sessionStorage.getItem(TOKEN_STORAGE_KEY)||'';
    if(!token){ handleExpiredSession_(); return Promise.resolve(false); }
    setListVisibility_(true); setState_('loading');
    return window.Api.post('audiencias_list',{token:token}).then(function(response){
      if(!isSuccess_(response)){
        var code=getErrorCode_(response);
        if(code==='TOKEN_AUSENTE'||code.indexOf('SESSAO_')===0){handleExpiredSession_();return false;}
        throw new Error(code||'ERRO_AO_LISTAR_AUDIENCIAS');
      }
      var data=getData_(response); var items=Array.isArray(data.audiencias)?data.audiencias:[]; updateExpiry_(data);
      allAudiencias=items.slice();
      if(!items.length){var count=document.getElementById('audiencias-count');if(count)count.textContent='0 audiências';setState_('empty');return true;}
      setState_('content'); applySearch_(); return true;
    }).catch(function(){setState_('error','Não foi possível carregar as audiências agora. Tente novamente.');return false;});
  }

  function clearFormError_(){var error=document.getElementById('audiencias-form-error');if(error){error.hidden=true;error.textContent='';}}
  function showFormError_(message){var error=document.getElementById('audiencias-form-error');if(error){error.textContent=message||'Revise os dados informados.';error.hidden=false;}}

  function recipientInputs_(){
    return {
      rg: document.getElementById('destinatario-rg'),
      nome: document.getElementById('destinatario-nome'),
      cpf: document.getElementById('destinatario-cpf'),
      telefone: document.getElementById('destinatario-telefone'),
      unidade: document.getElementById('destinatario-unidade'),
      posto_graduacao: document.getElementById('destinatario-posto-graduacao')
    };
  }

  function setLookupStatus_(message, kind){
    var status=document.getElementById('destinatario-lookup-status'); if(!status)return;
    status.textContent=message||''; status.className='recipient-lookup-status' + (kind?' '+kind:'');
  }

  function clearSuggestions_(){
    var box=document.getElementById('destinatario-sugestoes');
    if(!box)return;
    box.textContent='';
    box.hidden=true;
  }

  function clearRecipientEntry_(){
    var fields=recipientInputs_();
    Object.keys(fields).forEach(function(key){if(fields[key]) fields[key].value='';});
    clearSuggestions_();
    setLookupStatus_('');
  }

  function fillRecipient_(item){
    var fields=recipientInputs_();
    if(fields.rg) fields.rg.value=item.rg||'';
    if(fields.nome) fields.nome.value=item.nome||'';
    if(fields.cpf) fields.cpf.value=formatCpf_(item.cpf||'');
    if(fields.telefone) fields.telefone.value=item.telefone||'';
    if(fields.posto_graduacao) fields.posto_graduacao.value=item.posto_graduacao||'';
    if(fields.unidade) fields.unidade.value=item.unidade||'';
    clearSuggestions_();
  }

  function renderSuggestions_(items){
    var box=document.getElementById('destinatario-sugestoes');
    if(!box)return;
    box.textContent='';
    if(!Array.isArray(items)||!items.length){box.hidden=true;return;}
    items.forEach(function(item){
      var button=document.createElement('button');
      button.type='button';
      button.className='recipient-suggestion';
      button.setAttribute('role','option');
      var strong=document.createElement('strong');
      strong.textContent=item.nome||'Militar';
      var meta=document.createElement('span');
      meta.textContent=(item.rg?'RG '+item.rg:'RG não informado')+(item.cpf?' • CPF '+formatCpf_(item.cpf):'')+(item.telefone?' • WhatsApp '+item.telefone:'');
      button.appendChild(strong); button.appendChild(meta);
      button.addEventListener('click',function(){
        fillRecipient_(item);
        setLookupStatus_('Militar localizado. Dados preenchidos automaticamente.','is-found');
        var phone=recipientInputs_().telefone;
        if(phone && !phone.value) phone.focus();
      });
      box.appendChild(button);
    });
    box.hidden=false;
  }

  function lookupRecipient_(type,value){
    var token=sessionStorage.getItem(TOKEN_STORAGE_KEY)||'';
    if(!token){handleExpiredSession_();return;}
    var raw=String(value||'').trim();
    var normalized=type==='nome'?raw:digits_(raw);
    if((type==='nome'&&normalized.length<3)||(type==='rg'&&normalized.length<3)||(type==='cpf'&&normalized.length<11)){
      clearSuggestions_(); setLookupStatus_(''); return;
    }
    var serial=++lookupSerial;
    clearSuggestions_();
    setLookupStatus_('Consultando cadastro...','is-loading');
    window.Api.post('destinatarios_lookup',{token:token,tipo:type,valor:normalized}).then(function(response){
      if(serial!==lookupSerial)return;
      if(!isSuccess_(response)){
        var code=getErrorCode_(response);
        if(code==='TOKEN_AUSENTE'||code.indexOf('SESSAO_')===0){handleExpiredSession_();return;}
        setLookupStatus_('Não foi possível consultar o cadastro agora.','is-error');return;
      }
      var data=getData_(response); updateExpiry_(data);
      var items=Array.isArray(data.destinatarios)?data.destinatarios:[];
      if(!items.length){
        clearSuggestions_();
        setLookupStatus_('Militar não localizado. Complete RG e Nome; CPF e WhatsApp podem ser informados. Os dados serão gravados ao salvar a audiência.','is-new');
        return;
      }
      if(type==='nome'&&items.length>1){
        renderSuggestions_(items);
        setLookupStatus_('Selecione o militar correto na lista de sugestões.','is-found');
        return;
      }
      fillRecipient_(items[0]);
      setLookupStatus_('Militar localizado. Dados preenchidos automaticamente.','is-found');
    }).catch(function(){if(serial===lookupSerial)setLookupStatus_('Não foi possível consultar o cadastro agora.','is-error');});
  }

  function scheduleLookup_(type){
    var fields=recipientInputs_(); var field=fields[type]; if(!field)return;
    clearTimeout(lookupTimer); var value=field.value;
    lookupTimer=setTimeout(function(){lookupRecipient_(type,value);},450);
  }

  function recipientEntryData_(){
    var fields=recipientInputs_();
    return {rg:digits_(fields.rg?fields.rg.value:''),nome:(fields.nome?fields.nome.value:'').trim(),cpf:normalizeCpf_(fields.cpf?fields.cpf.value:''),posto_graduacao:(fields.posto_graduacao?fields.posto_graduacao.value:'').trim(),telefone:digits_(fields.telefone?fields.telefone.value:''),unidade:(fields.unidade?fields.unidade.value:'').trim()};
  }

  function renderSelectedRecipients_(){
    var container=document.getElementById('audiencia-destinatarios-list'); var count=document.getElementById('audiencia-destinatarios-count');
    if(count) count.textContent=selectedRecipients.length===1?'1 adicionado':selectedRecipients.length+' adicionados';
    if(!container)return; container.textContent='';
    if(!selectedRecipients.length){var empty=document.createElement('p');empty.className='recipients-empty';empty.textContent='Nenhum militar adicionado ainda.';container.appendChild(empty);return;}
    selectedRecipients.forEach(function(item,index){
      var card=document.createElement('div');card.className='recipient-chip';
      var text=document.createElement('div');text.className='recipient-chip-text';
      var strong=document.createElement('strong');strong.textContent=item.nome; text.appendChild(strong);
      var meta=document.createElement('span');meta.textContent=(item.posto_graduacao?item.posto_graduacao+' • ':'')+'RG '+item.rg+(item.cpf?' • CPF '+formatCpf_(item.cpf):'')+(item.telefone?' • WhatsApp '+item.telefone:'')+(item.unidade?' • '+item.unidade:'');text.appendChild(meta);
      var remove=document.createElement('button');remove.type='button';remove.className='recipient-remove';remove.setAttribute('aria-label','Remover '+item.nome);remove.textContent='Remover';
      remove.addEventListener('click',function(){selectedRecipients.splice(index,1);renderSelectedRecipients_();});
      card.appendChild(text);card.appendChild(remove);container.appendChild(card);
    });
  }

  function addRecipient_(){
    var data=recipientEntryData_();
    if(!data.rg||!data.nome){setLookupStatus_('Informe RG e Nome para adicionar o militar.','is-error');return;}
    if(selectedRecipients.some(function(item){return item.rg===data.rg;})){setLookupStatus_('Este RG já foi adicionado à audiência.','is-error');return;}
    selectedRecipients.push(data); renderSelectedRecipients_(); clearRecipientEntry_(false);
    var fields=recipientInputs_(); if(fields.rg)fields.rg.focus();
  }

  function formData_(){
    return {
      processo:document.getElementById('audiencia-processo').value.trim(),
      assunto:document.getElementById('audiencia-assunto').value.trim(),
      data_hora:document.getElementById('audiencia-data-hora').value,
      modalidade:document.getElementById('audiencia-modalidade').value,
      local:document.getElementById('audiencia-local').value.trim(),
      link:document.getElementById('audiencia-link').value.trim(),
      destinatarios:selectedRecipients.slice(),
      observacoes:document.getElementById('audiencia-observacoes').value.trim()
    };
  }

  function validateForm_(data){
    if(!data.processo||!data.assunto||!data.data_hora||!data.modalidade)return'Preencha Processo, Assunto, Data e hora e Modalidade.';
    if(data.modalidade==='PRESENCIAL'&&!data.local)return'Informe o local da audiência presencial.';
    if(data.link&&!/^https?:\/\//i.test(data.link))return'O link deve começar com https:// ou http://.';
    if(!Array.isArray(data.destinatarios)||!data.destinatarios.length)return'Adicione ao menos um militar convocado.';
    return'';
  }

  function setSaving_(active){var submit=document.getElementById('audiencias-form-submit');var cancel=document.getElementById('audiencias-form-cancel');saving=active;if(submit){submit.disabled=active;submit.textContent=active?'Salvando...':'Salvar audiência';}if(cancel)cancel.disabled=active;}
  function resetRecipients_(){selectedRecipients=[];clearRecipientEntry_(false);renderSelectedRecipients_();}
  function openForm_(){var form=document.getElementById('audiencias-form');hideSuccess_();clearFormError_();if(form)form.reset();resetRecipients_();setListVisibility_(false);var processo=document.getElementById('audiencia-processo');if(processo)processo.focus();}
  function closeForm_(){if(saving)return;clearFormError_();resetRecipients_();setListVisibility_(true);load_();}

  function errorMessageForCode_(code){
    var messages={DADOS_INVALIDOS:'Preencha os campos obrigatórios corretamente.',LOCAL_OBRIGATORIO:'Informe o local da audiência presencial.',LINK_INVALIDO:'Informe um link iniciado por https:// ou http://.',CODIGO_DUPLICADO:'Já existe uma audiência com este código.',DESTINATARIO_OBRIGATORIO:'Adicione ao menos um militar convocado.',DESTINATARIO_DADOS_INVALIDOS:'Revise RG e Nome dos militares adicionados.',DESTINATARIO_DUPLICADO:'O mesmo militar foi adicionado mais de uma vez.',CPF_EM_USO:'O CPF informado já está associado a outro cadastro.',ESTRUTURA_DESTINATARIOS_DESATUALIZADA:'A estrutura de destinatários precisa ser atualizada pelo DEV.'};
    return messages[code]||'Não foi possível cadastrar a audiência agora. Tente novamente.';
  }

  function submitForm_(event){
    event.preventDefault();if(saving)return;
    var token=sessionStorage.getItem(TOKEN_STORAGE_KEY)||'';if(!token){handleExpiredSession_();return;}
    var data=formData_();var validationError=validateForm_(data);if(validationError){showFormError_(validationError);return;}
    clearFormError_();setSaving_(true);
    window.Api.post('audiencias_create',{token:token,audiencia:data}).then(function(response){
      if(!isSuccess_(response)){
        var code=getErrorCode_(response);if(code==='TOKEN_AUSENTE'||code.indexOf('SESSAO_')===0){handleExpiredSession_();return false;}
        showFormError_(errorMessageForCode_(code));return false;
      }
      var responseData=getData_(response);updateExpiry_(responseData);var created=responseData.audiencia||{};var form=document.getElementById('audiencias-form');if(form)form.reset();resetRecipients_();setListVisibility_(true);
      return load_().then(function(){showSuccess_(created.codigo?'Audiência '+created.codigo+' cadastrada com sucesso.':'Audiência cadastrada com sucesso.');return true;});
    }).catch(function(){showFormError_('Não foi possível comunicar com o servidor. Tente novamente.');}).finally(function(){setSaving_(false);});
  }

  function open(){setView_('audiencias');setListVisibility_(true);hideSuccess_();load_();}
  function close(){if(saving)return;setView_('dashboard');}

  function init(){
    var back=document.getElementById('audiencias-back');
    var retry=document.getElementById('audiencias-retry');
    var newButton=document.getElementById('audiencias-new');
    var formBack=document.getElementById('audiencias-form-back');
    var cancel=document.getElementById('audiencias-form-cancel');
    var form=document.getElementById('audiencias-form');
    var clear=document.getElementById('destinatario-limpar');
    var add=document.getElementById('destinatario-adicionar');
    var fields=recipientInputs_();
    var search=document.getElementById('audiencias-search');
    var searchClear=document.getElementById('audiencias-search-clear');
    if(back)back.addEventListener('click',close);
    if(retry)retry.addEventListener('click',load_);
    if(newButton)newButton.addEventListener('click',openForm_);
    if(formBack)formBack.addEventListener('click',closeForm_);
    if(cancel)cancel.addEventListener('click',closeForm_);
    if(form)form.addEventListener('submit',submitForm_);
    if(search)search.addEventListener('input',applySearch_);
    if(searchClear)searchClear.addEventListener('click',function(){
      if(search){search.value='';search.focus();}
      applySearch_();
    });
    if(clear)clear.addEventListener('click',function(){
      clearTimeout(lookupTimer);
      lookupSerial += 1;
      clearRecipientEntry_();
      var current=recipientInputs_();
      if(current.rg) current.rg.focus();
    });
    if(add)add.addEventListener('click',addRecipient_);
    var detailClose=document.getElementById('audiencias-detail-close');
    var detailCloseBottom=document.getElementById('audiencias-detail-close-bottom');
    if(detailClose)detailClose.addEventListener('click',closeDetails_);
    if(detailCloseBottom)detailCloseBottom.addEventListener('click',closeDetails_);
    document.querySelectorAll('[data-audiencias-detail-close]').forEach(function(element){element.addEventListener('click',closeDetails_);});
    document.addEventListener('keydown',function(event){
      var dialog=document.getElementById('audiencias-detail-dialog');
      if(event.key==='Escape'&&dialog&&!dialog.hidden) closeDetails_();
    });
    ['rg','cpf','nome'].forEach(function(type){
      var field=fields[type]; if(!field)return;
      field.addEventListener('input',function(){scheduleLookup_(type);});
      if(type!=='nome'){
        field.addEventListener('blur',function(){
          var value=digits_(field.value);
          var enough=(type==='rg'&&value.length>=3)||(type==='cpf'&&value.length===11);
          if(enough) lookupRecipient_(type,field.value);
        });
      }
    });
    renderSelectedRecipients_();
  }

  window.Audiencias=Object.freeze({open:open,close:close,reload:load_,newRecord:openForm_});
  document.addEventListener('DOMContentLoaded',init);
}());
