/* WE-011/WE-016 lead source capture. First attributed touch is kept in sessionStorage and in
   localStorage for 30 days, then copied into hidden fields on every formsubmit.co form and appended
   to booking-widget links. No cookies, no network calls. */
(function(){
  var KEY='ec_lead_src_v1', LKEY='ec_lead_src_v2', TTL=30*24*3600*1000;
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
  function signal(d){return !!(d&&(d.utm_source||d.utm_medium||d.utm_campaign||d.gclid||d.referrer))}
  function current(){
    var q=new URLSearchParams(location.search), ref=document.referrer||'';
    if(host(ref)===location.hostname.replace(/^www\./,'')) ref='';
    var d={utm_source:q.get('utm_source')||'',utm_medium:q.get('utm_medium')||'',utm_campaign:q.get('utm_campaign')||'',
      gclid:q.get('gclid')||'',referrer:ref,landing_page:location.pathname+location.search,ts:Date.now()};
    d.lead_source=classify(d); return d;
  }
  function read(store,k){try{return JSON.parse(store.getItem(k)||'null')}catch(e){return null}}
  function write(d){try{sessionStorage.setItem(KEY,JSON.stringify(d))}catch(e){}try{localStorage.setItem(LKEY,JSON.stringify(d))}catch(e){}}
  var stored=read(window.sessionStorage,KEY);
  if(!stored){var l=read(window.localStorage,LKEY); if(l&&l.ts&&Date.now()-l.ts<TTL) stored=l;}
  var now=current();
  // first touch wins; a tagged/referred arrival replaces an untagged first touch
  if(!stored||(signal(now)&&!signal(stored))){stored=now;write(stored)}
  else if(!read(window.sessionStorage,KEY)){try{sessionStorage.setItem(KEY,JSON.stringify(stored))}catch(e){}}
  if(!stored.landing_page)stored.landing_page='';
  window.ecLeadSource=stored;
  var FIELDS=['lead_source','utm_source','utm_medium','utm_campaign','gclid','referrer','landing_page'];
  function fill(){
    var forms=document.querySelectorAll('form[action*="formsubmit.co"]');
    for(var i=0;i<forms.length;i++){
      for(var j=0;j<FIELDS.length;j++){
        var n=FIELDS[j], el=forms[i].querySelector('input[name="'+n+'"]');
        if(!el){el=document.createElement('input');el.type='hidden';el.name=n;forms[i].appendChild(el)}
        el.value=stored[n]||'';
      }
    }
    // booking widget links: carry stored UTMs/gclid so HighLevel records attribution
    var links=document.querySelectorAll('a[href*="leadconnectorhq.com/widget/booking"]');
    for(var k=0;k<links.length;k++){
      try{
        var u=new URL(links[k].href);
        ['utm_source','utm_medium','utm_campaign','gclid'].forEach(function(p){if(stored[p]&&!u.searchParams.get(p))u.searchParams.set(p,stored[p])});
        links[k].href=u.toString();
      }catch(e){}
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fill);else fill();
})();

/* WE-012: on submit, send the lead to /.netlify/functions/lead (-> Zapier), wait at most 1.5 s,
   then let the native FormSubmit POST proceed no matter what. Never blocks the email path. */
(function(){
  var ENDPOINT='/.netlify/functions/lead', MAX_WAIT=1500;
  function val(f,n){var el=f.querySelector('[name="'+n+'"]');return el?String(el.value||''):''}
  function payload(f){
    var src=window.ecLeadSource||{};
    return {name:val(f,'name'),email:val(f,'email'),phone:val(f,'phone'),address:val(f,'address'),
      message:val(f,'message'),_honey:val(f,'_honey'),
      lead_source:val(f,'lead_source')||src.lead_source||'',utm_source:val(f,'utm_source')||src.utm_source||'',
      utm_medium:val(f,'utm_medium')||src.utm_medium||'',utm_campaign:val(f,'utm_campaign')||src.utm_campaign||'',
      gclid:val(f,'gclid')||src.gclid||'',referrer:val(f,'referrer')||src.referrer||'',
      landing_page:val(f,'landing_page')||src.landing_page||'',page:location.href,lead_token:tok.value||'',cf_turnstile_response:tsResp(f)};
  }
  /* WE-013: signed page-load token (fetched once, refreshed hourly so an open tab never expires).
     If the fetch fails the lead is still sent; the server flags it suspect instead of dropping it. */
  var tok={value:''};
  function getToken(){try{if(!window.fetch)return;fetch(ENDPOINT,{method:'GET',credentials:'omit',cache:'no-store'})
    .then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.token)tok.value=j.token}).catch(function(){})}catch(e){}}
  if(document.querySelector('form[action*="formsubmit.co"]')){getToken();setInterval(getToken,60*60*1000)}
  /* WE-013: Cloudflare Turnstile. Empty site key = no widget, no verification (other checks still run).
     response-field:false keeps the token OUT of the FormSubmit POST, so the email is unchanged. */
  var TURNSTILE_SITE_KEY=(window.EC_CONFIG&&window.EC_CONFIG.turnstileSiteKey)||'';
  function tsResp(f){return f.__ecTs||''}
  function initTurnstile(){
    if(!TURNSTILE_SITE_KEY)return;
    var forms=document.querySelectorAll('form[action*="formsubmit.co"]');if(!forms.length)return;
    window.__ecTsLoad=function(){forms.forEach(function(f){try{var d=document.createElement('div');d.className='ec-turnstile';
      f.appendChild(d);window.turnstile.render(d,{sitekey:TURNSTILE_SITE_KEY,appearance:'interaction-only','response-field':false,
      callback:function(t){f.__ecTs=t},'expired-callback':function(){f.__ecTs=''},'error-callback':function(){f.__ecTs=''}})}catch(e){}})};
    var s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__ecTsLoad';
    s.async=true;s.defer=true;document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initTurnstile);else initTurnstile();
  function send(data){
    var body=JSON.stringify(data);
    try{
      if(window.fetch){
        return fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:body,keepalive:true,credentials:'omit'}).catch(function(){});
      }
      if(navigator.sendBeacon){navigator.sendBeacon(ENDPOINT,new Blob([body],{type:'application/json'}))}
    }catch(e){}
    return Promise.resolve();
  }
  // window-level bubbling listener: runs after the form's own validation handlers (home.js)
  window.addEventListener('submit',function(e){
    var f=e.target;
    if(!f||!f.matches||!f.matches('form[action*="formsubmit.co"]'))return;
    if(e.defaultPrevented||f.__ecSent)return;          // invalid (validation stopped it) or already sent
    var data=payload(f);
    if(data._honey)return;                              // honeypot: skip hook, native submit continues
    f.__ecSent=true;
    e.preventDefault();
    var done=false;
    function go(){if(done)return;done=true;try{HTMLFormElement.prototype.submit.call(f)}catch(err){f.submit()}}
    setTimeout(go,MAX_WAIT);
    try{send(data).then(go,go)}catch(err){go()}
  },false);
})();
