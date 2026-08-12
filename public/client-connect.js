const params=new URLSearchParams(location.search),code=String(params.get('code')||'').toUpperCase(),state=document.querySelector('#state'),login=document.querySelector('#login'),steam=document.querySelector('#steam');
document.querySelector('#code').textContent=code||'FEHLT';
steam.href=`/api/client/auth/steam/start?code=${encodeURIComponent(code)}`;
fetch('/api/me',{credentials:'same-origin'}).then(async response=>{if(!response.ok)throw new Error();const me=await response.json();state.textContent=`VTC-Konto ${me.user} ist angemeldet. Bestätige jetzt dein Steam-Konto.`;steam.hidden=false;}).catch(()=>{state.textContent='Melde dich zuerst im Webinterface mit deinem VTC-Konto an. Öffne danach diesen Geräte-Link erneut.';login.hidden=false;});
