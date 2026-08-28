(function () {
  'use strict';

  var deferredPrompt = null;
  var modalTimer = null;
  var autoCloseTimer = null;
  var SHOWN_KEY = 'audiencias_pwa_install_last_shown';
  var DISMISS_DAYS = 7;

  function isStandalone_() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isMobile_() {
    var ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod/i.test(ua) || window.matchMedia('(max-width: 820px)').matches;
  }

  function isIOS_() {
    var ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function recentlyShown_() {
    try {
      var raw = localStorage.getItem(SHOWN_KEY);
      if (!raw) return false;
      var last = Number(raw);
      if (!Number.isFinite(last)) return false;
      return (Date.now() - last) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch (error) {
      return false;
    }
  }

  function markShown_() {
    try {
      localStorage.setItem(SHOWN_KEY, String(Date.now()));
    } catch (error) {
      // Preferência visual apenas; falha de storage não deve impedir o sistema.
    }
  }

  function getModal_() {
    return document.getElementById('pwa-install-modal');
  }

  function closeModal_() {
    var modal = getModal_();
    if (modal) modal.hidden = true;
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
  }

  function updateModalForPlatform_() {
    var title = document.getElementById('pwa-install-title');
    var text = document.getElementById('pwa-install-text');
    var primary = document.getElementById('pwa-install-primary');
    var iosSteps = document.getElementById('pwa-install-ios-steps');

    if (!title || !text || !primary || !iosSteps) return;

    if (isIOS_()) {
      title.textContent = 'Adicionar à Tela de Início';
      text.textContent = 'Instale o Sistema de Audiências no iPhone/iPad para abrir como aplicativo e facilitar o acesso por biometria.';
      primary.textContent = 'Ver como adicionar';
      primary.hidden = false;
      iosSteps.hidden = true;
      primary.onclick = function () {
        iosSteps.hidden = false;
        primary.hidden = true;
        if (autoCloseTimer) {
          clearTimeout(autoCloseTimer);
          autoCloseTimer = null;
        }
      };
      return;
    }

    title.textContent = 'Instalar Sistema de Audiências';
    text.textContent = 'Adicione o sistema à tela inicial para abrir como aplicativo no celular.';
    iosSteps.hidden = true;

    if (deferredPrompt) {
      primary.textContent = 'Instalar aplicativo';
      primary.hidden = false;
      primary.onclick = function () {
        var promptEvent = deferredPrompt;
        deferredPrompt = null;
        promptEvent.prompt();
        promptEvent.userChoice.finally(function () {
          closeModal_();
        });
      };
    } else {
      primary.textContent = 'Adicionar à tela inicial';
      primary.hidden = false;
      primary.onclick = function () {
        text.textContent = 'Abra o menu do navegador e escolha “Instalar app” ou “Adicionar à tela inicial”.';
        primary.hidden = true;
        if (autoCloseTimer) {
          clearTimeout(autoCloseTimer);
          autoCloseTimer = null;
        }
      };
    }
  }

  function showModal_() {
    if (!isMobile_() || isStandalone_() || recentlyShown_()) return;
    var modal = getModal_();
    if (!modal) return;

    updateModalForPlatform_();
    modal.hidden = false;
    markShown_();

    autoCloseTimer = setTimeout(function () {
      closeModal_();
    }, 12000);
  }

  function afterLogin_() {
    if (!isMobile_() || isStandalone_() || recentlyShown_()) return;
    if (modalTimer) clearTimeout(modalTimer);
    modalTimer = setTimeout(showModal_, 1800);
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    closeModal_();
    try { localStorage.removeItem(SHOWN_KEY); } catch (error) {}
  });

  document.addEventListener('DOMContentLoaded', function () {
    var close = document.getElementById('pwa-install-close');
    var later = document.getElementById('pwa-install-later');
    var modal = getModal_();

    if (close) close.addEventListener('click', closeModal_);
    if (later) later.addEventListener('click', closeModal_);
    if (modal) {
      modal.addEventListener('click', function (event) {
        if (event.target === modal) closeModal_();
      });
    }
  });

  window.PwaInstall = Object.freeze({
    afterLogin: afterLogin_,
    isStandalone: isStandalone_
  });
}());
