/** Standalone email destination: no app/session bundle or third-party scripts. */
export function passwordPage(loginUrl: URL, nonce: string): string {
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character]!,
    );
  const assets = escape(loginUrl.origin);
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<title>Установить пароль — DARYADARCY</title>
<style>
@font-face{font-family:Garamond;src:url("${assets}/assets/fonts/EBGaramond-Regular.ttf") format("truetype");font-display:swap}
@font-face{font-family:Playfair;src:url("${assets}/assets/fonts/PlayfairDisplay-Regular.ttf") format("truetype");font-display:swap}
@font-face{font-family:Woolen;src:url("${assets}/assets/fonts/Woolen-Regular.woff") format("woff");font-display:swap}
:root{--paper:#fdf8f0;--brown:#5c4033;--muted:#75624d;--olive:#59694f;--error:#8b3a3a;color-scheme:light}
*{box-sizing:border-box}
[hidden]{display:none!important}
body{margin:0;background:#cbbbA5;color:var(--brown);font:20px/1.4 Garamond,Georgia,serif}
::selection{background:#d8dfcf;color:var(--brown)}
.sheet{max-width:480px;min-height:100vh;min-height:100svh;margin:auto;display:flex;flex-direction:column;padding:32px 28px max(28px,env(safe-area-inset-bottom));background:var(--paper) url("${assets}/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.fe3ce71852fa6634.webp") center/cover}
.brand{font:28px/1.4 Woolen,Georgia,serif;text-align:center;margin:0}
main{flex:1;display:flex;flex-direction:column;justify-content:center;padding:64px 0}
h1{font:400 34px/1.2 Playfair,Georgia,serif;margin:0;text-align:center;text-wrap:balance}
.intro{margin:16px 0 32px;text-align:center;color:var(--muted);text-wrap:pretty}
label{display:block;margin-bottom:8px}
.field{position:relative}
input{width:100%;min-height:54px;padding:13px 94px 13px 14px;border:1px solid #ab9b84;border-radius:8px;background:rgba(255,255,255,.8);font:inherit;font-size:20px;color:var(--brown);caret-color:var(--brown)}
button,a{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
button{font:inherit;cursor:pointer}
.reveal{position:absolute;right:4px;top:4px;min-width:80px;min-height:46px;padding:4px 8px;border:0;border-radius:4px;color:var(--brown);background:transparent;font-size:17px;text-decoration:underline;text-underline-offset:4px}
.hint{font-size:16px;color:var(--muted);margin:8px 0 24px}
.primary{display:block;width:100%;min-height:52px;padding:12px 16px;border:0;border-radius:8px;background:var(--olive);color:var(--paper);font-size:20px;text-align:center;text-decoration:none}
.primary:hover:not(:disabled){background:#4b5942}
.reveal:hover{background:#ebe4d8}
button:disabled{opacity:.65;cursor:wait}
:focus-visible{outline:2px solid var(--brown);outline-offset:4px}
input:focus-visible{outline-offset:2px}
#result{margin:16px 0 0;font-size:18px;line-height:1.4;color:var(--error);text-align:center;overflow-wrap:anywhere}
#result:empty{display:none}
.back{display:block;width:fit-content;margin:28px auto 0;padding:10px 4px;min-height:44px;color:var(--brown);text-underline-offset:5px;text-decoration-thickness:1px;text-align:center}
.back:hover{text-decoration-thickness:2px}
footer{font-size:16px;color:var(--muted);text-align:center}
footer p{margin:0}
@media(max-width:350px){.sheet{padding-left:22px;padding-right:22px}h1{font-size:30px}}
@media(max-height:600px){.sheet{padding-top:20px}main{padding:32px 0}}
</style>
</head>
<body>
<div class="sheet">
<header><p class="brand">DARYADARCY</p></header>
<main aria-labelledby="title">
<h1 id="title">Установить пароль</h1>
<p class="intro" id="intro">Придумайте новый пароль<br>для входа в Darcy.</p>
<form id="form" hidden>
<label for="password">Новый пароль</label>
<div class="field">
<input id="password" name="password" type="password" autocomplete="new-password" minlength="8" maxlength="200" aria-describedby="hint result" required>
<button class="reveal" id="reveal" type="button" aria-label="Показать пароль" aria-pressed="false">Показать</button>
</div>
<p class="hint" id="hint">От 8 до 200 символов.</p>
<button class="primary" id="submit" type="submit">Сохранить пароль</button>
</form>
<p id="result" role="status" aria-live="polite" aria-atomic="true"></p>
<noscript><p>Для установки пароля включите JavaScript в браузере и снова откройте ссылку из письма.</p></noscript>
<a class="back" id="login" href="${escape(loginUrl.toString())}">Перейти ко входу</a>
</main>
<footer><p>Место для вдохновения и уютной жизни</p></footer>
</div>
<script nonce="${nonce}">
const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
history.replaceState(null,'',location.pathname);
const form=document.getElementById('form'),input=document.getElementById('password'),button=document.getElementById('submit'),reveal=document.getElementById('reveal'),result=document.getElementById('result'),title=document.getElementById('title'),intro=document.getElementById('intro'),login=document.getElementById('login');
const usable=/^[A-Za-z0-9_-]{43}$/.test(token);
let pending=false;
if(usable){form.hidden=false;}else{title.textContent='Откройте ссылку из письма';intro.textContent='Для установки пароля нужна полная одноразовая ссылка. Откройте последнее письмо или запросите новую ссылку на странице входа.';}
reveal.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';reveal.textContent=show?'Скрыть':'Показать';reveal.setAttribute('aria-label',show?'Скрыть пароль':'Показать пароль');reveal.setAttribute('aria-pressed',String(show));});
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(pending||!usable||!form.reportValidity())return;
  pending=true;button.disabled=true;reveal.disabled=true;button.textContent='Сохраняем…';form.setAttribute('aria-busy','true');result.textContent='';
  try{
    const response=await fetch('/api/auth/password/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password:input.value})});
    const data=await response.json().catch(()=>null);
    if(response.ok&&data&&data.ok===true){
      input.value='';form.hidden=true;title.textContent='Пароль сохранён';intro.textContent='Теперь вы можете войти в аккаунт с новым паролем.';login.className='primary';login.focus();
    }else{result.textContent=data&&typeof data.error==='string'?data.error:'Не удалось сохранить пароль. Попробуйте позже.';}
  }catch{result.textContent='Нет соединения. Проверьте интернет и попробуйте ещё раз.';}
  finally{pending=false;button.disabled=false;reveal.disabled=false;button.textContent='Сохранить пароль';form.removeAttribute('aria-busy');}
});
</script>
</body>
</html>`;
}
