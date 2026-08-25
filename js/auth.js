(function () {
  'use strict';

  var TOKEN_STORAGE_KEY = 'audiencias_session_token';
  var USER_STORAGE_KEY = 'audiencias_session_user';

  function normalizeLogin_(value) {
    return String(value || '').trim();
  }

  function isSuccess_(response) {
    return Boolean(
      response &&
      (response.ok === true || response.sucesso === true || response.success === true)
    );
  }

  function getData_(response) {
    if (!response || typeof response !== 'object') {
      return {};
    }

    return response.dados || response.data || response.resultado || response;
  }

  function getToken_(response) {
    var data = getData_(response);
    return data.token || response.token || '';
  }

  function getUser_(response) {
    var data = getData_(response);
    return data.usuario || data.user || response.usuario || response.user || null;
  }

  function saveSession_(token, user) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);

    if (user && typeof user === 'object') {
      var safeUser = {
        id: user.id || '',
        nome: user.nome || user.name || '',
        login: user.login || '',
        perfil: user.perfil || user.role || ''
      };

      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(safeUser));
    } else {
      sessionStorage.removeItem(USER_STORAGE_KEY);
    }
  }

  function clearStoredSession_() {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
  }

  function login(login, senha) {
    var normalizedLogin = normalizeLogin_(login);

    if (!normalizedLogin || !senha) {
      return Promise.reject(new Error('CAMPOS_OBRIGATORIOS'));
    }

    return window.Api.post('login', {
      login: normalizedLogin,
      senha: senha
    }).then(function (response) {
      if (!isSuccess_(response)) {
        var error = new Error('LOGIN_RECUSADO');
        error.code = response && (response.codigo || response.code) ? (response.codigo || response.code) : '';
        throw error;
      }

      var token = getToken_(response);
      if (!token) {
        throw new Error('TOKEN_AUSENTE');
      }

      var user = getUser_(response);
      saveSession_(token, user);

      return {
        token: token,
        user: user
      };
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
    var successPanel = document.getElementById('login-success');
    var successUser = document.getElementById('success-user');
    var version = document.getElementById('app-version');
    var submitting = false;

    if (version && window.APP_CONFIG && window.APP_CONFIG.APP_VERSION) {
      version.textContent = window.APP_CONFIG.APP_VERSION;
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

    function showSuccess_(result) {
      var user = result.user || {};
      var label = user.nome || user.name || user.login || '';
      var profile = user.perfil || user.role || '';

      if (label && profile) {
        successUser.textContent = label + ' — ' + profile;
      } else if (label) {
        successUser.textContent = label;
      } else {
        successUser.textContent = 'Autenticação concluída com sucesso.';
      }

      form.hidden = true;
      successPanel.hidden = false;
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
          passwordInput.value = '';
          showSuccess_(result);
        })
        .catch(function (error) {
          clearStoredSession_();
          passwordInput.value = '';

          if (error && error.name === 'AbortError') {
            setMessage_('Não foi possível concluir o acesso agora. Tente novamente.');
          } else if (error && (error.message === 'RESPOSTA_INVALIDA' || error.message === 'RESPOSTA_VAZIA' || error.message === 'TOKEN_AUSENTE')) {
            setMessage_('Não foi possível concluir o acesso agora. Tente novamente.');
          } else {
            setMessage_('Não foi possível entrar. Verifique suas credenciais e tente novamente.');
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

    window.setTimeout(function () {
      loginInput.focus();
    }, 0);
  }

  document.addEventListener('DOMContentLoaded', initLoginPage_);

  window.Auth = Object.freeze({
    login: login,
    clearStoredSession: clearStoredSession_
  });
}());
