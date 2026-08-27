(function () {
  'use strict';

  var TOKEN_STORAGE_KEY = 'audiencias_session_token';
  var USER_STORAGE_KEY = 'audiencias_session_user';
  var EXPIRES_STORAGE_KEY = 'audiencias_session_expires_at';

  function normalizeLogin_(value) {
    return String(value || '').trim();
  }

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
    if (isObject_(response.resultado)) {
      return response.resultado;
    }

    return response;
  }

  function getSession_(response) {
    var data = getData_(response);

    if (isObject_(data.sessao)) {
      return data.sessao;
    }
    if (isObject_(data.session)) {
      return data.session;
    }
    if (isObject_(response.sessao)) {
      return response.sessao;
    }
    if (isObject_(response.session)) {
      return response.session;
    }

    return {};
  }

  function getToken_(response) {
    var data = getData_(response);
    var session = getSession_(response);

    return String(
      session.token ||
      data.token ||
      response.token ||
      ''
    );
  }

  function getUser_(response) {
    var data = getData_(response);

    return data.usuario || data.user || response.usuario || response.user || null;
  }

  function getExpiresAt_(response) {
    var session = getSession_(response);
    return session.expira_em || session.expires_at || '';
  }

  function getErrorCode_(response) {
    var data = getData_(response);
    return String(
      data.code ||
      data.codigo ||
      response.code ||
      response.codigo ||
      ''
    );
  }

  function saveSession_(response) {
    var token = getToken_(response);
    var user = getUser_(response);
    var expiresAt = getExpiresAt_(response);

    if (!token) {
      throw new Error('TOKEN_AUSENTE');
    }

    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);

    if (expiresAt) {
      sessionStorage.setItem(EXPIRES_STORAGE_KEY, String(expiresAt));
    } else {
      sessionStorage.removeItem(EXPIRES_STORAGE_KEY);
    }

    if (user && isObject_(user)) {
      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
        id: user.id || '',
        nome: user.nome || user.name || '',
        login: user.login || '',
        perfil: user.perfil || user.role || '',
        tipo_conta: user.tipo_conta || '',
        troca_senha_pendente: user.troca_senha_pendente === true
      }));
    } else {
      sessionStorage.removeItem(USER_STORAGE_KEY);
    }

    return {
      token: token,
      user: user,
      expiresAt: expiresAt
    };
  }

  function clearStoredSession_() {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
    sessionStorage.removeItem(EXPIRES_STORAGE_KEY);
  }


  function showValidating_() {
    var form = document.getElementById('login-form');
    var successPanel = document.getElementById('login-success');
    var validatingPanel = document.getElementById('session-validating');
    var intro = document.getElementById('login-intro');

    if (form) {
      form.hidden = true;
    }
    if (successPanel) {
      successPanel.hidden = true;
    }
    if (validatingPanel) {
      validatingPanel.hidden = false;
    }
    if (intro) {
      intro.hidden = true;
    }
  }

  function showAuthenticated_(user) {
    var form = document.getElementById('login-form');
    var successPanel = document.getElementById('login-success');
    var message = document.getElementById('login-message');
    var loginInput = document.getElementById('login');
    var passwordInput = document.getElementById('senha');
    var validatingPanel = document.getElementById('session-validating');
    var intro = document.getElementById('login-intro');
    var normalizedUser = isObject_(user) ? user : {};
    var card = document.querySelector('.login-card');

    if (!form || !successPanel) {
      return;
    }

    if (message) {
      message.textContent = '';
      message.hidden = true;
    }

    if (passwordInput) {
      passwordInput.value = '';
    }

    if (validatingPanel) {
      validatingPanel.hidden = true;
    }
    if (intro) {
      intro.hidden = true;
    }

    form.hidden = true;
    successPanel.hidden = false;
    if (card) {
      card.classList.add('is-authenticated');
    }

    if (normalizedUser.troca_senha_pendente === true && window.Usuarios && typeof window.Usuarios.requirePasswordChange === 'function') {
      window.Usuarios.requirePasswordChange(normalizedUser);
    } else {
      if (window.Usuarios && typeof window.Usuarios.hidePasswordChange === 'function') {
        window.Usuarios.hidePasswordChange();
      }
      if (window.Dashboard && typeof window.Dashboard.render === 'function') {
        window.Dashboard.render(normalizedUser);
      }
    }

    if (loginInput) {
      loginInput.disabled = false;
    }
    if (passwordInput) {
      passwordInput.disabled = false;
    }
  }

  function showLogin_(messageText) {
    var form = document.getElementById('login-form');
    var successPanel = document.getElementById('login-success');
    var message = document.getElementById('login-message');
    var loginInput = document.getElementById('login');
    var passwordInput = document.getElementById('senha');
    var validatingPanel = document.getElementById('session-validating');
    var intro = document.getElementById('login-intro');
    var card = document.querySelector('.login-card');

    if (!form || !successPanel) {
      return;
    }

    if (validatingPanel) {
      validatingPanel.hidden = true;
    }
    if (intro) {
      intro.hidden = false;
    }

    successPanel.hidden = true;
    if (card) {
      card.classList.remove('is-authenticated');
    }
    if (window.Dashboard && typeof window.Dashboard.hide === 'function') {
      window.Dashboard.hide();
    }
    form.hidden = false;

    if (message) {
      message.textContent = messageText || '';
      message.hidden = !messageText;
    }

    if (passwordInput) {
      passwordInput.value = '';
    }

    window.setTimeout(function () {
      if (loginInput) {
        loginInput.focus();
      }
    }, 0);
  }

  function login(login, senha) {
    var normalizedLogin = normalizeLogin_(login);

    if (!normalizedLogin || !senha) {
      return Promise.reject(new Error('CAMPOS_OBRIGATORIOS'));
    }

    return window.Api.post('login', {
      login: normalizedLogin,
      senha: String(senha)
    }).then(function (response) {
      if (!isSuccess_(response)) {
        var error = new Error('LOGIN_RECUSADO');
        error.code = getErrorCode_(response);
        throw error;
      }

      return saveSession_(response);
    });
  }

  function initLoginPage_() {
    var form = document.getElementById('login-form');
    if (!form) {
      return;
    }

    var loginInput = document.getElementById('login');
    var passwordInput = document.getElementById('senha');
    var submitButton = document.getElementById('login-button');
    var buttonLabel = submitButton.querySelector('.button-label');
    var buttonLoading = submitButton.querySelector('.button-loading');
    var message = document.getElementById('login-message');
    var togglePassword = document.getElementById('toggle-password');
    var version = document.getElementById('app-version');
    var submitting = false;

    if (version && window.APP_CONFIG && window.APP_CONFIG.APP_VERSION) {
      version.textContent = window.APP_CONFIG.APP_VERSION;
    }

    if (sessionStorage.getItem(TOKEN_STORAGE_KEY)) {
      showValidating_();
    } else {
      showLogin_('');
    }

    function setMessage_(text) {
      message.textContent = text;
      message.hidden = !text;
    }

    function setLoading_(loading) {
      submitting = loading;
      submitButton.disabled = loading;
      loginInput.disabled = loading;
      passwordInput.disabled = loading;
      togglePassword.disabled = loading;
      buttonLabel.hidden = loading;
      buttonLoading.hidden = !loading;
      form.setAttribute('aria-busy', loading ? 'true' : 'false');
    }

    togglePassword.addEventListener('click', function () {
      var showing = passwordInput.type === 'text';
      passwordInput.type = showing ? 'password' : 'text';
      togglePassword.textContent = showing ? 'Mostrar' : 'Ocultar';
      togglePassword.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
      togglePassword.setAttribute('aria-pressed', showing ? 'false' : 'true');
      passwordInput.focus();
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      if (submitting) {
        return;
      }

      var loginValue = normalizeLogin_(loginInput.value);
      var passwordValue = passwordInput.value;

      loginInput.setAttribute('aria-invalid', loginValue ? 'false' : 'true');
      passwordInput.setAttribute('aria-invalid', passwordValue ? 'false' : 'true');

      if (!loginValue || !passwordValue) {
        setMessage_('Informe usuário e senha para continuar.');
        (!loginValue ? loginInput : passwordInput).focus();
        return;
      }

      setMessage_('');
      setLoading_(true);

      login(loginValue, passwordValue)
        .then(function (result) {
          showAuthenticated_(result.user);

          if (window.Session && typeof window.Session.afterLogin === 'function') {
            window.Session.afterLogin();
          }
        })
        .catch(function (error) {
          clearStoredSession_();
          passwordInput.value = '';

          if (error && error.name === 'AbortError') {
            setMessage_('Não foi possível concluir o acesso agora. Tente novamente.');
          } else if (error && error.message === 'LOGIN_RECUSADO') {
            if (error.code === 'ACESSO_TEMPORARIAMENTE_BLOQUEADO' || error.code === 'ACESSO_INDISPONIVEL') {
              setMessage_('Acesso temporariamente indisponível. Tente novamente mais tarde.');
            } else {
              setMessage_('Não foi possível entrar. Verifique suas credenciais e tente novamente.');
            }
          } else {
            setMessage_('Não foi possível concluir o acesso agora. Tente novamente.');
          }

          passwordInput.focus();
        })
        .finally(function () {
          setLoading_(false);
        });
    });

    loginInput.addEventListener('input', function () {
      loginInput.setAttribute('aria-invalid', 'false');
      setMessage_('');
    });

    passwordInput.addEventListener('input', function () {
      passwordInput.setAttribute('aria-invalid', 'false');
      setMessage_('');
    });

    if (!sessionStorage.getItem(TOKEN_STORAGE_KEY)) {
      window.setTimeout(function () {
        loginInput.focus();
      }, 0);
    }
  }

  document.addEventListener('DOMContentLoaded', initLoginPage_);

  window.Auth = Object.freeze({
    login: login,
    clearStoredSession: clearStoredSession_,
    showAuthenticated: showAuthenticated_,
    showLogin: showLogin_,
    showValidating: showValidating_
  });
}());
