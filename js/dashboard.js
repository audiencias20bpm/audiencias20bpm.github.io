(function () {
  'use strict';

  var NORMAL_MODULES = [
    { key: 'audiencias', title: 'Audiências', description: 'Consulta e acompanhamento de audiências.', available: true },
    { key: 'destinatarios', title: 'Destinatários', description: 'Consulta da base cadastral dos militares.', available: true },
    { key: 'documentos', title: 'Documentos', description: 'Configuração e controle dos ofícios.', available: true },
    { key: 'notificacoes', title: 'Notificações', description: 'Ciência das audiências e lembretes automáticos.', available: true },
    { key: 'historico', title: 'Histórico', description: 'Consulta aos eventos e movimentações registradas.', available: true },
    { key: 'relatorios', title: 'Relatórios', description: 'Visão consolidada dos dados operacionais do sistema.' }
  ];

  var DEV_MODULES = [
    { key: 'usuarios', title: 'Usuários', description: 'Gestão de usuários, bloqueios e sessões.', devOnly: true, available: true },
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
      perfil: String(source.perfil || source.role || '').toUpperCase(),
      tipo_conta: String(source.tipo_conta || '').toUpperCase(),
      troca_senha_pendente: source.troca_senha_pendente === true
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
    status.textContent = module.available ? 'Disponível' : 'Em implementação';

    top.appendChild(badge);
    top.appendChild(status);

    var title = document.createElement('h3');
    title.textContent = module.title;

    var description = document.createElement('p');
    description.textContent = module.description;

    article.appendChild(top);
    article.appendChild(title);
    article.appendChild(description);

    if (module.available) {
      article.classList.add('dashboard-module-available');
      var action = document.createElement('button');
      action.className = 'module-open-button';
      action.type = 'button';
      action.textContent = 'Abrir módulo';
      action.addEventListener('click', function () {
        if (module.key === 'audiencias' && window.Audiencias) {
          window.Audiencias.open();
        } else if (module.key === 'destinatarios' && window.Destinatarios) {
          window.Destinatarios.open();
        } else if (module.key === 'documentos' && window.Documentos) {
          window.Documentos.open();
        } else if (module.key === 'notificacoes' && window.Notificacoes) {
          window.Notificacoes.open();
        } else if (module.key === 'historico' && window.Documentos) {
          window.Documentos.showHistory();
        } else if (module.key === 'usuarios' && window.Usuarios) {
          window.Usuarios.open();
        }
      });
      article.appendChild(action);
    }

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

    if (window.Biometria && typeof window.Biometria.renderDashboard === 'function') {
      window.Biometria.renderDashboard(normalized);
    }

    if (window.PwaInstall && typeof window.PwaInstall.afterLogin === 'function') {
      window.PwaInstall.afterLogin();
    }

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
