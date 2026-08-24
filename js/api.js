(function () {
  'use strict';

  window.Api = Object.freeze({
    getBaseUrl: function () {
      return window.APP_CONFIG.API_BASE_URL;
    }
  });
}());
