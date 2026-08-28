(function () {
  'use strict';

  var LOCAL_KEY = 'audiencias_biometria_v1';
  var TOKEN_STORAGE_KEY = 'audiencias_session_token';
  var USER_STORAGE_KEY = 'audiencias_session_user';
  var EXPIRES_STORAGE_KEY = 'audiencias_session_expires_at';

  function isObject_(value) {
    return value !== null && typeof value === 'object';
  }

  function isSuccess_(response) {
    return Boolean(isObject_(response) && (response.success === true || response.sucesso === true || response.ok === true));
  }

  function data_(response) {
    if (!isObject_(response)) return {};
    if (isObject_(response.data)) return response.data;
    if (isObject_(response.dados)) return response.dados;
    if (isObject_(response.resultado)) return response.resultado;
    return response;
  }

  function errorCode_(response) {
    var d = data_(response);
    return String(d.codigo || d.code || response.codigo || response.code || '');
  }

  function bytesToBase64Url_(input) {
    var bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    var binary = '';
    for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function base64UrlToBytes_(value) {
    var text = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    while (text.length % 4) text += '=';
    var binary = atob(text);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function randomBytes_(size) {
    var bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  function readLocal_() {
    try {
      var raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return isObject_(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function writeLocal_(record) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(record));
  }

  function clearLocal_() {
    localStorage.removeItem(LOCAL_KEY);
  }

  function supported_() {
    return Boolean(
      window.isSecureContext &&
      window.PublicKeyCredential &&
      navigator.credentials &&
      window.crypto &&
      window.crypto.subtle
    );
  }

  function getPrfResult_(credential) {
    if (!credential || typeof credential.getClientExtensionResults !== 'function') return null;
    var results = credential.getClientExtensionResults();
    return results && results.prf && results.prf.results && results.prf.results.first
      ? results.prf.results.first
      : null;
  }

  function rpId_() {
    return window.location.hostname;
  }

  function userIdBytes_(userId) {
    var encoded = new TextEncoder().encode(String(userId || ''));
    if (encoded.length <= 64) return encoded;
    return encoded.slice(0, 64);
  }

  function deviceLabel_() {
    var ua = navigator.userAgent || '';
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return 'Android';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
    if (/Windows/i.test(ua)) return 'Windows';
    return 'Dispositivo atual';
  }

  async function createCredentialAndPrf_(user) {
    var salt = randomBytes_(32);
    var publicKey = {
      challenge: randomBytes_(32),
      rp: { name: 'Sistema de Audiências', id: rpId_() },
      user: {
        id: userIdBytes_(user.id),
        name: String(user.login || user.nome || 'usuario'),
        displayName: String(user.nome || user.login || 'Usuário')
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 }
      ],
      timeout: 60000,
      attestation: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required'
      },
      extensions: {
        prf: { eval: { first: salt } }
      }
    };

    var credential = await navigator.credentials.create({ publicKey: publicKey });
    if (!credential) throw new Error('CREDENCIAL_NAO_CRIADA');

    var prfResult = getPrfResult_(credential);
    if (!prfResult) {
      var assertion = await navigator.credentials.get({
        publicKey: {
          challenge: randomBytes_(32),
          rpId: rpId_(),
          allowCredentials: [{ type: 'public-key', id: credential.rawId }],
          userVerification: 'required',
          timeout: 60000,
          extensions: { prf: { eval: { first: salt } } }
        }
      });
      prfResult = getPrfResult_(assertion);
    }

    if (!prfResult) {
      throw new Error('PRF_NAO_SUPORTADO');
    }

    return {
      credentialId: bytesToBase64Url_(credential.rawId),
      salt: salt,
      prf: new Uint8Array(prfResult)
    };
  }

  async function derivePrfForLogin_(record) {
    var credentialId = base64UrlToBytes_(record.credential_id);
    var salt = base64UrlToBytes_(record.prf_salt);
    var assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes_(32),
        rpId: rpId_(),
        allowCredentials: [{ type: 'public-key', id: credentialId }],
        userVerification: 'required',
        timeout: 60000,
        extensions: { prf: { eval: { first: salt } } }
      }
    });
    var prfResult = getPrfResult_(assertion);
    if (!prfResult) throw new Error('PRF_NAO_SUPORTADO');
    return new Uint8Array(prfResult);
  }

  async function aesKey_(prfBytes, usages) {
    return crypto.subtle.importKey('raw', prfBytes, { name: 'AES-GCM' }, false, usages);
  }

  async function encryptDeviceToken_(prfBytes, tokenBytes) {
    var iv = randomBytes_(12);
    var key = await aesKey_(prfBytes, ['encrypt']);
    var encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, tokenBytes);
    return { iv: bytesToBase64Url_(iv), ciphertext: bytesToBase64Url_(encrypted) };
  }

  async function decryptDeviceToken_(record, prfBytes) {
    var key = await aesKey_(prfBytes, ['decrypt']);
    var decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlToBytes_(record.iv) },
      key,
      base64UrlToBytes_(record.ciphertext)
    );
    return new Uint8Array(decrypted);
  }

  function currentSessionToken_() {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
  }

  function persistLoginResponse_(response) {
    var d = data_(response);
    var session = d.sessao || d.session || {};
    var user = d.usuario || d.user || {};
    var token = String(session.token || d.token || '');
    if (!token) throw new Error('TOKEN_AUSENTE');

    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    if (session.expira_em || session.expires_at) {
      sessionStorage.setItem(EXPIRES_STORAGE_KEY, String(session.expira_em || session.expires_at));
    }
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
      id: user.id || '',
      nome: user.nome || user.name || '',
      login: user.login || '',
      perfil: user.perfil || user.role || '',
      tipo_conta: user.tipo_conta || '',
      troca_senha_pendente: user.troca_senha_pendente === true
    }));
    return user;
  }

  function setLoginMessage_(text) {
    var el = document.getElementById('login-message');
    if (el) {
      el.textContent = text || '';
      el.hidden = !text;
    }
  }

  function refreshLoginButton_() {
    var box = document.getElementById('biometric-login-box');
    var button = document.getElementById('biometric-login-button');
    var hint = document.getElementById('biometric-login-hint');
    var record = readLocal_();
    var visible = supported_() && record && record.credential_id && record.ciphertext && record.iv && record.prf_salt;
    if (box) box.hidden = !visible;
    if (button) button.hidden = !visible;
    if (hint && visible) hint.textContent = record.nome ? 'Conta: ' + record.nome : 'Acesso rápido neste dispositivo';
  }

  async function loginWithBiometrics_() {
    var record = readLocal_();
    var button = document.getElementById('biometric-login-button');
    if (!record || !supported_()) return;

    try {
      if (button) button.disabled = true;
      setLoginMessage_('Confirme sua identidade no dispositivo...');
      var prf = await derivePrfForLogin_(record);
      var tokenBytes = await decryptDeviceToken_(record, prf);
      var response = await window.Api.post('biometria_login', {
        credential_id: record.credential_id,
        device_token: bytesToBase64Url_(tokenBytes)
      });

      if (!isSuccess_(response)) {
        var code = errorCode_(response);
        if (code === 'BIOMETRIA_INVALIDA' || code === 'BIOMETRIA_NAO_PERMITIDA') clearLocal_();
        throw new Error(code || 'BIOMETRIA_RECUSADA');
      }

      var user = persistLoginResponse_(response);
      setLoginMessage_('');
      if (window.Auth && typeof window.Auth.showAuthenticated === 'function') window.Auth.showAuthenticated(user);
      if (window.Session && typeof window.Session.afterLogin === 'function') window.Session.afterLogin();
    } catch (error) {
      if (error && (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
        setLoginMessage_('Autenticação biométrica cancelada.');
      } else if (String(error && error.message) === 'PRF_NAO_SUPORTADO') {
        setLoginMessage_('Este navegador não oferece o modo biométrico seguro exigido pelo sistema. Use login e senha.');
      } else {
        setLoginMessage_('Não foi possível entrar com biometria. Use login e senha e, se necessário, ative novamente neste aparelho.');
      }
      refreshLoginButton_();
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function activate_(user) {
    var button = document.getElementById('biometric-activate');
    var message = document.getElementById('biometric-panel-message');
    try {
      if (!supported_()) throw new Error('NAO_SUPORTADO');
      if (typeof PublicKeyCredential.getClientCapabilities === 'function') {
        var capabilities = await PublicKeyCredential.getClientCapabilities();
        if (capabilities && capabilities['extension:prf'] === false) throw new Error('PRF_NAO_SUPORTADO');
        if (capabilities && capabilities.userVerifyingPlatformAuthenticator === false) throw new Error('NAO_SUPORTADO');
      } else if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        var uvpaa = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (uvpaa === false) throw new Error('NAO_SUPORTADO');
      }
      if (button) button.disabled = true;
      if (message) { message.textContent = 'Aguardando confirmação no dispositivo...'; message.hidden = false; }

      var created = await createCredentialAndPrf_(user);
      var deviceTokenBytes = randomBytes_(32);
      var encrypted = await encryptDeviceToken_(created.prf, deviceTokenBytes);
      var response = await window.Api.post('biometria_register', {
        token: currentSessionToken_(),
        credential_id: created.credentialId,
        device_token: bytesToBase64Url_(deviceTokenBytes),
        dispositivo: deviceLabel_()
      });
      if (!isSuccess_(response)) throw new Error(errorCode_(response) || 'ERRO_REGISTRO');

      writeLocal_({
        version: 1,
        user_id: user.id || '',
        login: user.login || '',
        nome: user.nome || user.login || '',
        credential_id: created.credentialId,
        prf_salt: bytesToBase64Url_(created.salt),
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext,
        created_at: new Date().toISOString()
      });
      if (message) { message.textContent = 'Biometria/Passkey ativada neste dispositivo.'; message.hidden = false; }
      renderDashboard_(user);
      refreshLoginButton_();
    } catch (error) {
      var text = 'Não foi possível ativar a biometria neste dispositivo.';
      if (String(error && error.message) === 'PRF_NAO_SUPORTADO') text = 'O navegador não oferece o recurso criptográfico necessário para este acesso biométrico. Use login e senha.';
      if (error && error.name === 'NotAllowedError') text = 'Ativação cancelada no dispositivo.';
      if (message) { message.textContent = text; message.hidden = false; }
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function remove_(user) {
    var message = document.getElementById('biometric-panel-message');
    var button = document.getElementById('biometric-remove');
    if (!window.confirm('Remover o acesso biométrico deste usuário? O login por senha continuará funcionando.')) return;
    try {
      if (button) button.disabled = true;
      var response = await window.Api.post('biometria_remove', { token: currentSessionToken_() });
      if (!isSuccess_(response)) throw new Error(errorCode_(response) || 'ERRO_REMOCAO');
      clearLocal_();
      if (message) { message.textContent = 'Acesso biométrico removido.'; message.hidden = false; }
      renderDashboard_(user);
      refreshLoginButton_();
    } catch (e) {
      if (message) { message.textContent = 'Não foi possível remover o acesso biométrico agora.'; message.hidden = false; }
    } finally {
      if (button) button.disabled = false;
    }
  }

  function renderDashboard_(user) {
    var panel = document.getElementById('biometric-panel');
    var title = document.getElementById('biometric-panel-title');
    var text = document.getElementById('biometric-panel-text');
    var activate = document.getElementById('biometric-activate');
    var remove = document.getElementById('biometric-remove');
    var record = readLocal_();
    var individual = String(user && user.tipo_conta || '').toUpperCase() === 'INDIVIDUAL';

    if (!panel) return;
    if (!individual) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    var activeHere = Boolean(record && String(record.user_id || '') === String(user.id || '') && record.credential_id);
    if (!supported_()) {
      if (title) title.textContent = 'Biometria indisponível neste navegador';
      if (text) text.textContent = 'Use login e senha. O sistema não envia nem armazena seus dados biométricos.';
      if (activate) activate.hidden = true;
      if (remove) remove.hidden = true;
      return;
    }

    if (title) title.textContent = activeHere ? 'Biometria ativa neste dispositivo' : 'Acesso rápido por biometria';
    if (text) text.textContent = activeHere
      ? 'Nos próximos acessos, você poderá entrar usando a biometria/Passkey deste dispositivo.'
      : 'Ative uma Passkey protegida pela biometria ou desbloqueio do aparelho. A senha continuará disponível como alternativa.';
    if (activate) {
      activate.hidden = activeHere;
      activate.onclick = function () { activate_(user); };
    }
    if (remove) {
      remove.hidden = !activeHere;
      remove.onclick = function () { remove_(user); };
    }
  }

  function init_() {
    var button = document.getElementById('biometric-login-button');
    if (button) button.addEventListener('click', loginWithBiometrics_);
    refreshLoginButton_();
  }

  document.addEventListener('DOMContentLoaded', init_);

  window.Biometria = Object.freeze({
    renderDashboard: renderDashboard_,
    refreshLoginButton: refreshLoginButton_
  });
}());
