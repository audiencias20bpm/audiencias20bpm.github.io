(function () {
  'use strict';
  var token = new URLSearchParams(window.location.search).get('token') || '';
  var data_ = null;
  function ok_(r){return r && (r.success===true||r.sucesso===true||r.ok===true);}
  function payload_(r){return r && r.data && typeof r.data==='object' ? r.data : r || {};}
  function message_(r,fallback){return String((r&&(r.message||r.mensagem))||fallback||'Não foi possível concluir a operação.');}
  function text_(id,value){var el=document.getElementById(id);if(el)el.textContent=value||'—';}
  function error_(msg){var l=document.getElementById('confirm-loading');var e=document.getElementById('confirm-error');var c=document.getElementById('confirm-content');if(l)l.hidden=true;if(c)c.hidden=true;if(e){e.textContent=msg;e.hidden=false;}}
  function abrirBlob_(arquivo,popup){
    if(!arquivo||!arquivo.base64)throw new Error('Documento indisponível.');
    var binary=atob(String(arquivo.base64));var bytes=new Uint8Array(binary.length);
    for(var i=0;i<binary.length;i+=1)bytes[i]=binary.charCodeAt(i);
    var url=URL.createObjectURL(new Blob([bytes],{type:arquivo.mime||'application/pdf'}));
    if(popup&&!popup.closed)popup.location.href=url;else window.open(url,'_blank','noopener');
    window.setTimeout(function(){URL.revokeObjectURL(url);},60000);
  }
  function abrirDocumento_(tipo,button){
    var popup=window.open('','_blank');var original=button.textContent;button.disabled=true;button.textContent='Abrindo...';
    window.Api.post('notificacoes_documento_obter',{token:token,tipo:tipo}).then(function(r){
      if(!ok_(r))throw new Error(message_(r,'Não foi possível carregar o documento.'));
      abrirBlob_(payload_(r).arquivo||{},popup);
    }).catch(function(e){if(popup&&!popup.closed)popup.close();var er=document.getElementById('confirm-error');er.textContent=e&&e.message?e.message:'Não foi possível carregar o documento.';er.hidden=false;})
      .finally(function(){button.disabled=false;button.textContent=original;});
  }
  function renderDocumentos_(docs){
    var sec=document.getElementById('confirm-documents');var list=document.getElementById('confirm-doc-list');
    if(!sec||!list)return;list.textContent='';var itens=Array.isArray(docs)?docs:[];sec.hidden=itens.length===0;
    itens.forEach(function(doc){var item=document.createElement('div');item.className='confirm-doc-item';var name=document.createElement('span');name.textContent=doc.nome||'Documento.pdf';var btn=document.createElement('button');btn.type='button';btn.className='secondary-button compact-button';btn.textContent='Visualizar';btn.addEventListener('click',function(){abrirDocumento_(doc.tipo,btn);});item.appendChild(name);item.appendChild(btn);list.appendChild(item);});
  }
  function load_(){
    if(!token||token.length<40){error_('Link de confirmação inválido.');return;}
    window.Api.post('notificacoes_confirm_data',{token:token}).then(function(r){
      if(!ok_(r))throw new Error(message_(r,'Link de confirmação inválido ou expirado.'));
      data_=payload_(r).dados||{};text_('confirm-militar',[data_.posto_graduacao,data_.militar_nome].filter(Boolean).join(' '));text_('confirm-oficio',data_.numero_oficio);text_('confirm-data',data_.data);text_('confirm-hora',data_.hora);text_('confirm-processo',data_.processo);text_('confirm-local',data_.local);text_('confirm-modalidade',data_.modalidade);renderDocumentos_(data_.documentos||[]);
      document.getElementById('confirm-loading').hidden=true;document.getElementById('confirm-content').hidden=false;
      if(data_.confirmada){var b=document.getElementById('confirm-button');b.disabled=true;b.textContent='Ciência já confirmada';var s=document.getElementById('confirm-success');s.textContent='Ciência já confirmada em '+(data_.confirmado_em||'data registrada pelo sistema')+'.';s.hidden=false;}
    }).catch(function(e){error_(e&&e.message?e.message:'Não foi possível carregar a audiência.');});
  }
  function confirm_(){var b=document.getElementById('confirm-button');if(!b||b.disabled)return;b.disabled=true;b.textContent='Confirmando...';window.Api.post('notificacoes_confirm',{token:token}).then(function(r){if(!ok_(r))throw new Error(message_(r,'Não foi possível confirmar a ciência.'));var d=payload_(r);var s=document.getElementById('confirm-success');s.textContent=d.ja_confirmada?'Ciência já confirmada em '+(d.confirmado_em||'data registrada pelo sistema')+'.':'Ciência confirmada com sucesso em '+(d.confirmado_em||'agora')+'.';s.hidden=false;b.textContent='Ciência confirmada';}).catch(function(e){b.disabled=false;b.textContent='Confirmar ciência';var er=document.getElementById('confirm-error');er.textContent=e&&e.message?e.message:'Não foi possível confirmar a ciência.';er.hidden=false;});}
  document.getElementById('confirm-button').addEventListener('click',confirm_);load_();
}());
