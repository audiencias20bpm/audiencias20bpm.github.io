(function () {
  'use strict';

  var REQUEST_TIMEOUT_MS = 20000;

  function getBaseUrl() {
    return window.APP_CONFIG.API_BASE_URL;
  }

  function withTimeout_(promise, timeoutMs) {
    var controller = new AbortController();
    var timer = window.setTimeout(function () {
      controller.abort();
    }, timeoutMs);

    return {
      signal: controller.signal,
      promise: promise(controller.signal).finally(function () {
        window.clearTimeout(timer);
      })
    };
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
    var body = Object.assign({}, payload || {}, {
      action: action
    });

    var request = withTimeout_(function (signal) {
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
        signal: signal
      });
    }, REQUEST_TIMEOUT_MS);

    return request.promise.then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP_' + response.status);
      }

      return parseJsonResponse_(response);
    });
  }

  window.Api = Object.freeze({
    getBaseUrl: getBaseUrl,
    post: post
  });
}());
