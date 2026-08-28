(function () {
  'use strict';

  var TOKEN_STORAGE_KEY = 'audiencias_session_token';
  var USER_STORAGE_KEY = 'audiencias_session_user';
  var allUsers_ = [];
  var resetTarget_ = null;
  var editTarget_ = null;

  function isObject_(value) { return value !== null && typeof value === 'object'; }
  function isSuccess_(response) { return Boolean(isObject_(response) && (response.success === true || response.sucesso === true || response.ok === true)); }
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
    if (!isObject_(response)) return fallback || 'Não foi possível concluir a operação.';
    return String(response.message || response.mensagem || fallback || 'Não foi possível concluir a operação.');
  }
  function token_() { return sessionStorage.getItem(TOKEN_STORAGE_KEY) || ''; }
  function storedUser_() {
    try { return JSON.parse(sessionStorage.getItem(USER_STORAGE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function handleSessionError_(response) {
    var code = getCode_(response);
    if (code === 'TOKEN_AUSENTE' || code.indexOf('SESSAO_') === 0 || code === 'ACESSO_NEGADO') {
      if (window.Auth && typeof window.Auth.clearStoredSession === 'function') window.Auth.clearStoredSession();
      if (window.Auth && typeof window.Auth.showLogin === 'function') window.Auth.showLogin('Sua sessão expirou ou não possui permissão para esta operação.');
      return true;
    }
    return false;
  }
  function updateExpiry_(data) {
    if (data && data.expira_em && window.Session && typeof window.Session.updateExpiry === 'function') {
      window.Session.updateExpiry(data.expira_em);
    }
  }
  function hideModuleViews_() {
    document.querySelectorAll('.module-view').forEach(function (view) { view.hidden = true; });
    var home = document.getElementById('dashboard-home');
    if (home) home.hidden = true;
  }
  function backToDashboard_() {
    var view = document.getElementById('usuarios-view');
    var home = document.getElementById('dashboard-home');
    if (view) view.hidden = true;
    if (home) home.hidden = false;
  }
  function setError_(message) {
    var el = document.getElementById('usuarios-error');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }
  function setSuccess_(message) {
    var el = document.getElementById('usuarios-success');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }
  function formatDate_(value) {
    if (!value) return '—';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Belem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }
  function labelTipo_(value) {
    var type = String(value || '').toUpperCase();
    if (type === 'INDIVIDUAL') return 'Individual';
    if (type === 'FUNCIONAL') return 'Funcional';
    return 'Não definido';
  }
  function createAction_(label, handler, danger) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'table-action-button' + (danger ? ' danger-action' : '');
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  }
  function render_(items) {
    var tbody = document.getElementById('usuarios-table-body');
    var count = document.getElementById('usuarios-count');
    var empty = document.getElementById('usuarios-empty');
    var content = document.getElementById('usuarios-content');
    if (!tbody) return;
    tbody.textContent = '';
    if (count) count.textContent = String(items.length);
    if (empty) empty.hidden = items.length !== 0;
    if (content) content.hidden = items.length === 0;

    var current = storedUser_();
    items.forEach(function (item) {
      var tr = document.createElement('tr');
      var name = document.createElement('td');
      name.innerHTML = '<strong></strong><br><span class="usuarios-login"></span>';
      name.querySelector('strong').textContent = item.nome || '—';
      name.querySelector('span').textContent = item.login || '—';
      tr.appendChild(name);

      var type = document.createElement('td'); type.textContent = labelTipo_(item.tipo_conta); tr.appendChild(type);
      var profile = document.createElement('td'); profile.textContent = item.perfil || '—'; tr.appendChild(profile);
      var status = document.createElement('td');
      var badge = document.createElement('span');
      badge.className = 'usuario-status ' + (String(item.status).toUpperCase() === 'ATIVO' ? 'status-active' : 'status-inactive');
      badge.textContent = String(item.status || '—').toUpperCase();
      status.appendChild(badge);
      var notes = [];
      if (item.bloqueado) notes.push('Bloqueado');
      if (item.troca_senha_pendente) notes.push('Troca de senha pendente');
      if (String(item.tipo_conta || '').toUpperCase() === 'FUNCIONAL') notes.push('Biometria desabilitada');
      var securityLine = document.createElement('div');
      securityLine.className = 'usuarios-security-note';
      securityLine.textContent = notes.length ? notes.join(' • ') : 'Normal';
      status.appendChild(securityLine);
      tr.appendChild(status);
      var access = document.createElement('td'); access.textContent = formatDate_(item.ultimo_login); tr.appendChild(access);

      var actions = document.createElement('td'); actions.className = 'usuarios-actions';
      var isSelf = String(item.id || '') === String(current.id || '');
      if (!isSelf) {
        actions.appendChild(createAction_('Editar', function () { openEdit_(item); }));
        actions.appendChild(createAction_(String(item.status).toUpperCase() === 'ATIVO' ? 'Inativar' : 'Ativar', function () {
          changeStatus_(item, String(item.status).toUpperCase() === 'ATIVO' ? 'INATIVO' : 'ATIVO');
        }, String(item.status).toUpperCase() === 'ATIVO'));
        if (item.bloqueado) actions.appendChild(createAction_('Desbloquear', function () { unlock_(item); }));
        actions.appendChild(createAction_('Redefinir senha', function () { openReset_(item); }));
        actions.appendChild(createAction_('Encerrar sessões', function () { endSessions_(item); }));
        actions.appendChild(createAction_('Excluir', function () { deleteUser_(item); }, true));
      } else {
        var self = document.createElement('span'); self.className = 'usuarios-self'; self.textContent = 'Conta atual'; actions.appendChild(self);
      }
      tr.appendChild(actions);
      tbody.appendChild(tr);
    });
  }
  function filter_() {
    var input = document.getElementById('usuarios-search');
    var q = String(input ? input.value : '').trim().toLocaleLowerCase('pt-BR');
    if (!q) { render_(allUsers_); return; }
    render_(allUsers_.filter(function (u) {
      return [u.nome, u.login, u.perfil, u.tipo_conta, u.status].join(' ').toLocaleLowerCase('pt-BR').indexOf(q) !== -1;
    }));
  }
  function load_() {
    setError_(''); setSuccess_('');
    var loading = document.getElementById('usuarios-loading'); if (loading) loading.hidden = false;
    return window.Api.post('usuarios_list', { token: token_() }).then(function (response) {
      if (!isSuccess_(response)) {
        if (handleSessionError_(response)) return;
        throw new Error(getMessage_(response, 'Não foi possível carregar os usuários.'));
      }
      var data = getData_(response); updateExpiry_(data);
      allUsers_ = Array.isArray(data.usuarios) ? data.usuarios : [];
      filter_();
    }).catch(function (error) {
      setError_(error.message || 'Não foi possível carregar os usuários.');
    }).finally(function () { if (loading) loading.hidden = true; });
  }
  function open_() {
    hideModuleViews_();
    var view = document.getElementById('usuarios-view'); if (view) view.hidden = false;
    closeCreate_(); closeEdit_(); closeReset_(); load_();
  }
  function openCreate_() {
    var panel = document.getElementById('usuarios-create-panel'); if (panel) panel.hidden = false;
    var name = document.getElementById('usuarios-create-nome'); if (name) name.focus();
  }
  function closeCreate_() {
    var panel = document.getElementById('usuarios-create-panel'); if (panel) panel.hidden = true;
    var form = document.getElementById('usuarios-create-form'); if (form) form.reset();
    var confirmDev = document.getElementById('usuarios-create-confirm-dev-wrap'); if (confirmDev) confirmDev.hidden = true;
  }
  function openEdit_(item) {
    editTarget_ = item;
    var panel = document.getElementById('usuarios-edit-panel'); if (panel) panel.hidden = false;
    document.getElementById('usuarios-edit-nome').value = item.nome || '';
    document.getElementById('usuarios-edit-login').value = item.login || '';
    document.getElementById('usuarios-edit-tipo').value = String(item.tipo_conta || 'INDIVIDUAL').toUpperCase();
    document.getElementById('usuarios-edit-perfil').value = String(item.perfil || 'ADMINISTRADOR').toUpperCase();
    var wrap = document.getElementById('usuarios-edit-confirm-dev-wrap');
    if (wrap) wrap.hidden = document.getElementById('usuarios-edit-perfil').value !== 'DEV';
    var confirmDev = document.getElementById('usuarios-edit-confirm-dev'); if (confirmDev) confirmDev.checked = false;
    var input = document.getElementById('usuarios-edit-nome'); if (input) input.focus();
  }
  function closeEdit_() {
    editTarget_ = null;
    var panel = document.getElementById('usuarios-edit-panel'); if (panel) panel.hidden = true;
    var form = document.getElementById('usuarios-edit-form'); if (form) form.reset();
  }
  function openReset_(item) {
    resetTarget_ = item;
    var panel = document.getElementById('usuarios-reset-panel'); if (panel) panel.hidden = false;
    var target = document.getElementById('usuarios-reset-target'); if (target) target.textContent = (item.nome || item.login) + ' (' + item.login + ')';
    var form = document.getElementById('usuarios-reset-form'); if (form) form.reset();
    var input = document.getElementById('usuarios-reset-senha'); if (input) input.focus();
  }
  function closeReset_() { resetTarget_ = null; var panel = document.getElementById('usuarios-reset-panel'); if (panel) panel.hidden = true; }
  function changeStatus_(item, status) {
    if (!window.confirm((status === 'INATIVO' ? 'Inativar' : 'Ativar') + ' o usuário ' + item.login + '?')) return;
    window.Api.post('usuarios_status', { token: token_(), usuario_id: item.id, status: status }).then(afterAction_('Status atualizado.'));
  }
  function unlock_(item) {
    window.Api.post('usuarios_unlock', { token: token_(), usuario_id: item.id }).then(afterAction_('Usuário desbloqueado.'));
  }
  function endSessions_(item) {
    if (!window.confirm('Encerrar todas as sessões ativas de ' + item.login + '?')) return;
    window.Api.post('usuarios_end_sessions', { token: token_(), usuario_id: item.id }).then(afterAction_('Sessões encerradas.'));
  }

  function deleteUser_(item) {
    if (!window.confirm('Excluir definitivamente o usuário ' + item.login + '? Esta ação não poderá ser desfeita.')) return;
    if (!window.confirm('Confirme novamente a exclusão de ' + item.login + '.')) return;
    window.Api.post('usuarios_delete', { token: token_(), usuario_id: item.id }).then(function (response) {
      if (!isSuccess_(response)) { if (handleSessionError_(response)) return; setError_(getMessage_(response)); return; }
      setSuccess_('Usuário excluído com sucesso.'); load_();
    }).catch(function () { setError_('Não foi possível excluir o usuário agora.'); });
  }

  function afterAction_(successMessage) {
    return function (response) {
      if (!isSuccess_(response)) {
        if (handleSessionError_(response)) return;
        setError_(getMessage_(response)); return;
      }
      setSuccess_(successMessage); load_();
    };
  }
  function requirePasswordChange_(user) {
    var dashboard = document.getElementById('dashboard'); if (dashboard) dashboard.hidden = true;
    var view = document.getElementById('password-change-view'); if (view) view.hidden = false;
    var who = document.getElementById('password-change-user'); if (who) who.textContent = (user && (user.nome || user.login)) || 'Usuário';
    var input = document.getElementById('password-change-new'); if (input) window.setTimeout(function () { input.focus(); }, 0);
  }
  function hidePasswordChange_() { var view = document.getElementById('password-change-view'); if (view) view.hidden = true; }

  function init_() {
    var back = document.getElementById('usuarios-back'); if (back) back.addEventListener('click', backToDashboard_);
    var add = document.getElementById('usuarios-new'); if (add) add.addEventListener('click', openCreate_);
    var cancel = document.getElementById('usuarios-create-cancel'); if (cancel) cancel.addEventListener('click', closeCreate_);
    var editCancel = document.getElementById('usuarios-edit-cancel'); if (editCancel) editCancel.addEventListener('click', closeEdit_);
    var resetCancel = document.getElementById('usuarios-reset-cancel'); if (resetCancel) resetCancel.addEventListener('click', closeReset_);
    var search = document.getElementById('usuarios-search'); if (search) search.addEventListener('input', filter_);
    var editProfile = document.getElementById('usuarios-edit-perfil');
    if (editProfile) editProfile.addEventListener('change', function () {
      var wrap = document.getElementById('usuarios-edit-confirm-dev-wrap'); if (wrap) wrap.hidden = editProfile.value !== 'DEV';
    });

    var profile = document.getElementById('usuarios-create-perfil');
    if (profile) profile.addEventListener('change', function () {
      var wrap = document.getElementById('usuarios-create-confirm-dev-wrap'); if (wrap) wrap.hidden = profile.value !== 'DEV';
    });

    var editForm = document.getElementById('usuarios-edit-form');
    if (editForm) editForm.addEventListener('submit', function (event) {
      event.preventDefault(); setError_('');
      if (!editTarget_) return;
      var selectedProfile = document.getElementById('usuarios-edit-perfil').value;
      var payload = {
        nome: document.getElementById('usuarios-edit-nome').value,
        login: document.getElementById('usuarios-edit-login').value,
        tipo_conta: document.getElementById('usuarios-edit-tipo').value,
        perfil: selectedProfile,
        confirmar_dev: selectedProfile !== 'DEV' || document.getElementById('usuarios-edit-confirm-dev').checked
      };
      window.Api.post('usuarios_update', { token: token_(), usuario_id: editTarget_.id, usuario: payload }).then(function (response) {
        if (!isSuccess_(response)) { if (handleSessionError_(response)) return; setError_(getMessage_(response)); return; }
        var data = getData_(response);
        closeEdit_();
        setSuccess_('Usuário atualizado com sucesso.' + (Number(data.sessoes_encerradas || 0) ? ' Sessões anteriores foram encerradas.' : ''));
        load_();
      }).catch(function () { setError_('Não foi possível editar o usuário agora.'); });
    });

    var createForm = document.getElementById('usuarios-create-form');
    if (createForm) createForm.addEventListener('submit', function (event) {
      event.preventDefault(); setError_('');
      var pass = document.getElementById('usuarios-create-senha').value;
      var confirmPass = document.getElementById('usuarios-create-senha-confirm').value;
      if (pass !== confirmPass) { setError_('As senhas informadas não coincidem.'); return; }
      var selectedProfile = document.getElementById('usuarios-create-perfil').value;
      var payload = {
        nome: document.getElementById('usuarios-create-nome').value,
        login: document.getElementById('usuarios-create-login').value,
        tipo_conta: document.getElementById('usuarios-create-tipo').value,
        perfil: selectedProfile,
        senha: pass,
        confirmar_dev: selectedProfile !== 'DEV' || document.getElementById('usuarios-create-confirm-dev').checked
      };
      window.Api.post('usuarios_create', { token: token_(), usuario: payload }).then(function (response) {
        if (!isSuccess_(response)) {
          if (handleSessionError_(response)) return;
          setError_(getMessage_(response)); return;
        }
        closeCreate_(); setSuccess_('Usuário criado. A senha é temporária e deverá ser alterada no primeiro acesso.'); load_();
      }).catch(function () { setError_('Não foi possível criar o usuário agora.'); });
    });

    var resetForm = document.getElementById('usuarios-reset-form');
    if (resetForm) resetForm.addEventListener('submit', function (event) {
      event.preventDefault(); if (!resetTarget_) return;
      var pass = document.getElementById('usuarios-reset-senha').value;
      var confirmPass = document.getElementById('usuarios-reset-senha-confirm').value;
      if (pass !== confirmPass) { setError_('As senhas informadas não coincidem.'); return; }
      window.Api.post('usuarios_reset_password', { token: token_(), usuario_id: resetTarget_.id, nova_senha: pass }).then(function (response) {
        if (!isSuccess_(response)) { if (handleSessionError_(response)) return; setError_(getMessage_(response)); return; }
        closeReset_(); setSuccess_('Senha temporária redefinida e sessões anteriores encerradas.'); load_();
      });
    });

    var passwordForm = document.getElementById('password-change-form');
    if (passwordForm) passwordForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var message = document.getElementById('password-change-message');
      var pass = document.getElementById('password-change-new').value;
      var confirmPass = document.getElementById('password-change-confirm').value;
      if (pass !== confirmPass) { message.textContent = 'As senhas informadas não coincidem.'; message.hidden = false; return; }
      message.hidden = true;
      window.Api.post('password_change_self', { token: token_(), nova_senha: pass }).then(function (response) {
        if (!isSuccess_(response)) { message.textContent = getMessage_(response); message.hidden = false; return; }
        hidePasswordChange_();
        if (window.Auth && typeof window.Auth.clearStoredSession === 'function') window.Auth.clearStoredSession();
        if (window.Auth && typeof window.Auth.showLogin === 'function') window.Auth.showLogin('Senha alterada com sucesso. Entre novamente com a nova senha.');
      }).catch(function () { message.textContent = 'Não foi possível alterar a senha agora.'; message.hidden = false; });
    });
  }

  document.addEventListener('DOMContentLoaded', init_);
  window.Usuarios = Object.freeze({ open: open_, requirePasswordChange: requirePasswordChange_, hidePasswordChange: hidePasswordChange_ });
}());
