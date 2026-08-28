(function () {
  'use strict';
  var token = new URLSearchParams(window.location.search).get('token') || '';
  var data_ = null;
  function ok_(r){return r && (r.success===true||r.sucesso===true||r.ok===true);}
  function payload_(r){return r && r.data && typeof r.data==='object' ? r.data : r || {};}
  function message_(r, fallback){return String((r && (r.message||r.mensagem)) || fallback || 'Não foi possível concluir a operação.');}
  function text_(id, value){var el=document.getElementById(id);if(el)el.textContent=value||'—';}
  function error_(msg){var l=document.getElementById('confirm-loading');var e=document.getElementById('confirm-error');var c=document.getElementById('confirm-content');if(l)l.hidden=true;if(c)c.hidden=true;if(e){e.textContent=msg;e.hidden=false;}}
  function load_(){
    if(!token || token.length<40){error_('Link de confirmação inválido.');return;}
    window.Api.post('notificacoes_confirm_data',{token:token}).then(function(r){
      if(!ok_(r))throw new Error(message_(r,'Link de confirmação inválido ou expirado.'));
      data_=payload_(r).dados||{};
      text_('confirm-militar',[data_.posto_graduacao,data_.militar_nome].filter(Boolean).join(' '));
      text_('confirm-oficio',data_.numero_oficio);text_('confirm-data',data_.data);text_('confirm-hora',data_.hora);
      text_('confirm-processo',data_.processo);text_('confirm-local',data_.local);text_('confirm-modalidade',data_.modalidade);
      document.getElementById('confirm-loading').hidden=true;document.getElementById('confirm-content').hidden=false;
      if(data_.confirmada){var b=document.getElementById('confirm-button');b.disabled=true;b.textContent='Ciência já confirmada';var s=document.getElementById('confirm-success');s.textContent='Ciência já confirmada em '+(data_.confirmado_em||'data registrada pelo sistema')+'.';s.hidden=false;}
    }).catch(function(e){error_(e&&e.message?e.message:'Não foi possível carregar a audiência.');});
  }
  function confirm_(){
    var b=document.getElementById('confirm-button');if(!b||b.disabled)return;b.disabled=true;b.textContent='Confirmando...';
    window.Api.post('notificacoes_confirm',{token:token}).then(function(r){
      if(!ok_(r))throw new Error(message_(r,'Não foi possível confirmar a ciência.'));
      var d=payload_(r);var s=document.getElementById('confirm-success');s.textContent=d.ja_confirmada?'Ciência já confirmada em '+(d.confirmado_em||'data registrada pelo sistema')+'.':'Ciência confirmada com sucesso em '+(d.confirmado_em||'agora')+'.';s.hidden=false;b.textContent='Ciência confirmada';
    }).catch(function(e){b.disabled=false;b.textContent='Confirmar ciência';var er=document.getElementById('confirm-error');er.textContent=e&&e.message?e.message:'Não foi possível confirmar a ciência.';er.hidden=false;});
  }
  document.getElementById('confirm-button').addEventListener('click',confirm_);load_();
}());
