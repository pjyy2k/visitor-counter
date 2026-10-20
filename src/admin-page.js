export const adminPage = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="정적 사이트 방문자 카운터 등록 및 삽입 코드 관리">
<title>Visitor Counter · 사이트 관리</title><link rel="stylesheet" href="/admin.css">
<script defer src="/admin.js"></script></head><body>
<header class="cluster"><a class="brand" href="/">VC <span>Visitor Counter</span></a>
<button id="logout" class="secondary" hidden>로그아웃</button></header>
<main><p class="eyebrow">YOUR SITES, COUNTED.</p><h1>작은 코드로, 방문을 기록하세요.</h1>
<p class="lead">사이트를 등록하고 생성된 코드를 붙여넣으세요.<br>각 사이트의 방문 기록을 따로 집계합니다.</p>
<p id="status" role="status" aria-live="polite"></p>
<section id="login-panel" class="panel narrow" hidden><h2>관리자 로그인</h2>
<div id="setup" hidden><h3>처음 오셨네요. 비밀번호를 설정하세요.</h3>
<p class="hint">이 서비스의 관리자 비밀번호입니다. 최초 한 번만 설정합니다.</p>
<form id="setup-form" class="stack"><label>새 관리자 비밀번호<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label>
<label>비밀번호 확인<input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="256" required></label>
<p class="hint">12자 이상으로 입력하세요. 비밀번호는 해시로 저장됩니다.</p>
<button>비밀번호 설정하고 시작하기</button></form></div>
<form id="login-form" class="stack"><label>관리자 비밀번호<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label>
<button>로그인</button></form></section>
<div id="workspace" class="workspace" hidden>
<section class="panel"><p class="eyebrow">01 / REGISTER</p><h2>사이트 등록</h2>
<form id="site-form" class="stack"><label>사이트 이름<input name="name" placeholder="예: 젝스님트 점수판" maxlength="80" required></label>
<label>사이트 주소<input name="url" placeholder="6nimmt.hellojyp.com" maxlength="2048" required inputmode="url" aria-describedby="url-hint"></label>
<p id="url-hint" class="hint">https:// 없이 입력해도 됩니다. 같은 도메인의 다른 페이지도 각각 등록할 수 있습니다.</p>
<button>등록하고 코드 만들기</button></form>
<div class="note"><strong>숫자를 읽는 기준</strong><p>오늘 방문자: 하루에 브라우저당 1회<br>누적 방문: 일별 방문자 수의 합계<br>조회수: 새로고침 포함</p></div></section>
<section aria-labelledby="sites-title"><div class="cluster"><div><p class="eyebrow">02 / INSTALL</p><h2 id="sites-title">등록된 사이트 <span id="site-count"></span></h2></div>
<button id="refresh" class="secondary">새로고침</button></div>
<p class="hint">코드를 각 페이지의 &lt;/body&gt; 앞에 한 번만 삽입하세요.</p>
<div id="sites" class="stack"></div></section></div>
<noscript><p>사이트 등록과 코드 생성에는 JavaScript가 필요합니다.</p></noscript>
</main><footer>Visitor Counter · JinYoungPark <a href="https://github.com/pjyy2k/visitor-counter" target="_blank" rel="noopener noreferrer">GitHub</a></footer>
</body></html>`;

export const adminStyles = `:root{--bg:#f6f5f4;--surface:#fff;--ink:#202020;--muted:#615d59;--border:#d9d6d2;--accent:#075fae;--hover:#064d8c;--error:#a51e28;--success:#166534;--s1:8px;--s2:12px;--s3:16px;--s4:24px;--s5:32px;--s6:48px;--radius:8px;--panel-radius:12px;--body:16px;--small:14px;--title:22px;--width:1080px}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:var(--body)/1.6 system-ui,-apple-system,sans-serif}
[hidden]{display:none!important}header,main,footer{max-width:var(--width);margin:auto;padding:var(--s4)}header{border-bottom:1px solid var(--border)}main{padding-block:var(--s6)}
a{color:var(--accent)}.brand{text-decoration:none;font-weight:800;color:var(--ink);font-size:var(--title)}.brand span{font-size:var(--small);font-weight:500;margin-left:var(--s2)}
h1,h2,h3,p{margin-top:0}h1{font-size:clamp(28px,4vw,40px);line-height:1.3;letter-spacing:-.035em;margin-bottom:var(--s3)}h1,h2,h3{word-break:keep-all;overflow-wrap:anywhere}h2{font-size:var(--title);margin-bottom:var(--s3)}h3{font-size:var(--body);margin-bottom:var(--s1)}
.lead,.hint,.eyebrow,footer{color:var(--muted)}.lead{margin-bottom:var(--s5)}.eyebrow{font-size:var(--small);font-weight:650;letter-spacing:.06em;margin-bottom:var(--s1)}.hint{font-size:var(--small);margin-bottom:var(--s3)}
.workspace{display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:var(--s5);align-items:start}.panel{border:1px solid var(--border);border-radius:var(--panel-radius);background:var(--surface);padding:var(--s4);min-width:0}.narrow{max-width:480px}
.stack{display:flex;flex-direction:column;gap:var(--s3)}.cluster{display:flex;align-items:center;justify-content:space-between;gap:var(--s3);flex-wrap:wrap}label{display:block;font-size:var(--small);font-weight:600}
input,textarea,button{font:inherit;border-radius:var(--radius)}input,textarea{display:block;width:100%;border:1px solid var(--border);padding:var(--s2);margin-top:var(--s1);background:var(--surface);color:var(--ink);min-height:44px}textarea{resize:vertical;font:var(--small)/1.6 ui-monospace,monospace;min-height:130px;overflow-wrap:anywhere;white-space:pre-wrap}
button{cursor:pointer;min-height:44px;border:1px solid transparent;padding:var(--s1) var(--s3);background:var(--accent);color:var(--surface);font-weight:600;font-size:var(--small)}button:hover{background:var(--hover)}button:active{transform:translateY(1px)}button.secondary{background:var(--surface);border-color:var(--border);color:var(--ink)}button.secondary:hover{background:var(--bg)}button:disabled{opacity:.6;cursor:wait}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.note{border-top:1px solid var(--border);margin-top:var(--s4);padding-top:var(--s4);font-size:var(--small)}.note p{color:var(--muted);margin:var(--s1) 0 0}
.site-url{overflow-wrap:anywhere;font-size:var(--small);color:var(--muted)}.metrics{display:flex;flex-wrap:wrap;gap:var(--s4);margin-block:var(--s3)}.metrics span{font-size:var(--small);color:var(--muted)}.metrics b{display:block;color:var(--ink);font-size:var(--title);font-variant-numeric:tabular-nums}.error{color:var(--error)}.success{color:var(--success)}#status:empty{display:none}details{margin-top:var(--s3)}summary{cursor:pointer;color:var(--muted);min-height:44px}footer{font-size:var(--small);border-top:1px solid var(--border)}footer a{margin-left:var(--s2)}
@media(max-width:768px){.workspace{grid-template-columns:minmax(0,1fr)}main{padding-block:var(--s5)}header,main,footer{padding-inline:var(--s3)}.panel{padding:var(--s3)}}`;
