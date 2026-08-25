(function () {
  'use strict';

  var NORMAL_MODULES = [
    { key: 'audiencias', title: 'Audiências', description: 'Cadastro, consulta e acompanhamento de audiências.' },
    { key: 'destinatarios', title: 'Destinatários', description: 'Cadastro e consulta dos destinatários das notificações.' },
    { key: 'documentos', title: 'Documentos', description: 'Organização dos ofícios e documentos vinculados.' },
    { key: 'notificacoes', title: 'Notificações', description: 'Acompanhamento das notificações e respectivos status.' },
    { key: 'historico', title: 'Histórico', description: 'Consulta aos eventos e movimentações registradas.' },
    { key: 'relatorios', title: 'Relatórios', description: 'Visão consolidada dos dados operacionais do sistema.' }
  ];

  var DEV_MODULES = [
    { key: 'usuarios', title: 'Usuários', description: 'Gestão de usuários, bloqueios e sessões.', devOnly: true },
    { key: 'auditoria', title: 'Auditoria', description: 'Consulta aos registros técnicos e ações administrativas.', devOnly: true },
    { key: 'seguranca', title: 'Segurança', description: 'Área reservada para configurações e controles do DEV.', devOnly: true }
  ];

  function isObject_(value) {
    return value !== null && typeof value === 'object';
  }

  function normalizeUser_(user) {
    var source = isObject_(user) ? user : {};
    return {
      id: source.id || '',
      nome: source.nome || source.name || source.login || 'Usuário',
      login: source.login || '',
      perfil: String(source.perfil || source.role || '').toUpperCase()
    };
  }

  function createModuleCard_(module) {
    var article = document.createElement('article');
    article.className = 'dashboard-module';
    article.setAttribute('data-module', module.key);

    var top = document.createElement('div');
    top.className = 'dashboard-module-top';

    var badge = document.createElement('span');
    badge.className = 'dashboard-module-badge';
    badge.textContent = module.devOnly ? 'DEV' : 'Módulo';

    var status = document.createElement('span');
    status.className = 'dashboard-module-status';
    status.textContent = 'Em implementação';

    top.appendChild(badge);
    top.appendChild(status);

    var title = document.createElement('h3');
    title.textContent = module.title;

    var description = document.createElement('p');
    description.textContent = module.description;

    article.appendChild(top);
    article.appendChild(title);
    article.appendChild(description);

    return article;
  }

  function renderModules_(container, modules) {
    if (!container) {
      return;
    }

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    modules.forEach(function (module) {
      container.appendChild(createModuleCard_(module));
    });
  }

  function render(user) {
    var normalized = normalizeUser_(user);
    var dashboard = document.getElementById('dashboard');
    var name = document.getElementById('dashboard-user-name');
    var profile = document.getElementById('dashboard-user-profile');
    var normalContainer = document.getElementById('dashboard-modules');
    var devSection = document.getElementById('dashboard-dev-section');
    var devContainer = document.getElementById('dashboard-dev-modules');

    if (!dashboard) {
      return;
    }

    if (name) {
      name.textContent = normalized.nome;
    }

    if (profile) {
      profile.textContent = normalized.perfil || 'USUÁRIO';
      profile.classList.toggle('profile-dev', normalized.perfil === 'DEV');
    }

    renderModules_(normalContainer, NORMAL_MODULES);

    if (devSection) {
      var isDev = normalized.perfil === 'DEV';
      devSection.hidden = !isDev;
      if (isDev) {
        renderModules_(devContainer, DEV_MODULES);
      } else if (devContainer) {
        devContainer.textContent = '';
      }
    }

    dashboard.hidden = false;
  }

  function hide() {
    var dashboard = document.getElementById('dashboard');
    if (dashboard) {
      dashboard.hidden = true;
    }
  }

  window.Dashboard = Object.freeze({
    render: render,
    hide: hide
  });
}());
