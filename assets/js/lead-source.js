/* WE-011 lead source capture. First touch per browser session, stored in sessionStorage
   and copied into hidden fields on every formsubmit.co form. No cookies, no network calls. */
(function(){
  var KEY='ec_lead_src_v1';
  var AI=['chatgpt.com','chat.openai.com','perplexity.ai','gemini.google.com','copilot.microsoft.com','claude.ai'];
  var MAPS_SRC=['gbp','google-maps','google_maps','googlemaps','gmb','maps'];
  function host(u){try{return new URL(u).hostname.toLowerCase().replace(/^www\./,'')}catch(e){return ''}}
  function path(u){try{return new URL(u).pathname}catch(e){return ''}}
  function inList(h,list){for(var i=0;i<list.length;i++){if(h===list[i]||h.slice(-(list[i].length+1))==='.'+list[i])return true}return false}
  function classify(d){
    var s=(d.utm_source||'').toLowerCase(), m=(d.utm_medium||'').toLowerCase(), rh=host(d.referrer);
    if(s==='lsa'||m==='lsa') return 'LSA';
    if(MAPS_SRC.indexOf(s)>-1) return 'Google Maps';
    if(/^maps\.google\./.test(rh)||(/(^|\.)google\.[a-z.]+$/.test(rh)&&path(d.referrer).indexOf('/maps')===0)) return 'Google Maps';
    if(inList(rh,AI)||inList(s.replace(/^www\./,''),AI)||['chatgpt','perplexity','gemini','copilot','claude'].indexOf(s)>-1) return 'AI search';
    return 'Website';
  }
  function current(){
    var q=new URLSearchParams(location.search), ref=document.referrer||'';
    if(host(ref)===location.hostname.replace(/^www\./,'')) ref='';
    var d={utm_source:q.get('utm_source')||'',utm_medium:q.get('utm_medium')||'',utm_campaign:q.get('utm_campaign')||'',gclid:q.get('gclid')||'',referrer:ref,landing_page:location.pathname};
    d.lead_source=classify(d); return d;
  }
  var stored=null; try{stored=JSON.parse(sessionStorage.getItem(KEY)||'null')}catch(e){}
  var now=current();
  var hasSignal=now.utm_source||now.utm_medium||now.gclid||now.referrer;
  // keep first touch for the session; a new tagged/referred arrival overrides an untagged one
  if(!stored||(hasSignal&&!(stored.utm_source||stored.gclid||stored.referrer))){stored=now;try{sessionStorage.setItem(KEY,JSON.stringify(stored))}catch(e){}}
  window.ecLeadSource=stored;
  var FIELDS=['lead_source','utm_source','utm_medium','utm_campaign','gclid','referrer'];
  function fill(){
    var forms=document.querySelectorAll('form[action*="formsubmit.co"]');
    for(var i=0;i<forms.length;i++){
      for(var j=0;j<FIELDS.length;j++){
        var n=FIELDS[j], el=forms[i].querySelector('input[name="'+n+'"]');
        if(!el){el=document.createElement('input');el.type='hidden';el.name=n;forms[i].appendChild(el)}
        el.value=stored[n]||'';
      }
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fill);else fill();
})();
