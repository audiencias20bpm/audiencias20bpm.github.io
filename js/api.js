(function () {
  'use strict';

  var REQUEST_TIMEOUT_MS = 45000;

  function getBaseUrl() {
    return window.APP_CONFIG.API_BASE_URL;
  }

  function parseJsonResponse_(response) {
    return response.text().then(function (text) {
      if (!text) {
        throw new Error('RESPOSTA_VAZIA');
      }

      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error('RESPOSTA_INVALIDA');
      }
    });
  }

  function post(action, payload) {
    var controller = new AbortController();
    var timer = window.setTimeout(function () {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    var body = Object.assign({}, payload || {}, {
      action: String(action || '').trim()
    });

    return fetch(getBaseUrl(), {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP_' + response.status);
      }
      return parseJsonResponse_(response);
    }).catch(function (error) {
      if (error && (error.name === 'AbortError' || /aborted/i.test(String(error.message || '')))) {
        throw new Error('A conexão demorou mais que o esperado. Tente novamente.');
      }
      throw error;
    }).finally(function () {
      window.clearTimeout(timer);
    });
  }

  window.Api = Object.freeze({
    getBaseUrl: getBaseUrl,
    post: post
  });
}());
