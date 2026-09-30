import './style.css'
import { Game } from './game/Game'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <main class="game-shell">
    <div id="game-root" class="game-root" aria-label="Cidade 3D do jogo"></div>

    <header class="topbar">
      <a class="brand" href="#" aria-label="Smash City home">
        <span class="brand-mark">SC</span>
        <span class="brand-copy"><strong>SMASH CITY</strong><small>WANTED // DISTRICT 01</small></span>
      </a>
      <div class="run-stats">
        <div class="stat"><span class="stat-label">DISTÂNCIA</span><strong id="distance-value">0 m</strong></div>
        <div class="stat"><span class="stat-label">TEMPO</span><strong id="time-value">00:00</strong></div>
        <div class="stat cash-stat"><span class="stat-label">DINHEIRO</span><strong id="cash-value">$ 0</strong></div>
      </div>
      <button id="camera-button" class="mode-button" type="button" aria-pressed="false" aria-label="Câmera 3D traseira ativada; alternar para visão três quartos" title="Alternar câmera (C)">3D</button>
      <button id="sound-button" class="icon-button" type="button" aria-label="Ativar ou desativar som">♪</button>
    </header>

    <section class="wanted-panel" aria-label="Nível de perseguição">
      <div class="wanted-heading"><span class="wanted-dot"></span><span>PROCURADO</span><strong id="wanted-label">NÍVEL 0 / 10</strong></div>
      <div id="wanted-meter" class="wanted-meter" aria-hidden="true"></div>
      <div class="wanted-note" id="wanted-note">Mantenha a cidade em alerta.</div>
      <div id="capture-meter" class="capture-meter"><div class="capture-heading"><span>RISCO DE DETENÇÃO</span><strong id="capture-label">0%</strong></div><div class="capture-track"><div id="capture-fill" class="capture-fill"></div></div></div>
    </section>

    <section class="mission-panel">
      <div class="panel-heading"><span class="heading-icon">◆</span><span>CONTRATOS ATIVOS</span><span class="live-tag">AO VIVO</span></div>
      <div id="mission-list" class="mission-list"></div>
    </section>

    <div class="speedometer" aria-label="Velocidade">
      <div class="speed-reading"><strong id="speed-value">000</strong><span>KM/H</span></div>
      <div class="speed-track"><div id="speed-fill" class="speed-fill"></div></div>
      <div class="speed-caption"><span>0</span><span>240</span></div>
    </div>

    <div id="toast" class="toast" role="status" aria-live="polite"></div>

    <section id="start-overlay" class="overlay">
      <div class="title-kicker"><span></span> UMA CIDADE. DEZ NÍVEIS DE CAOS.</div>
      <h1>SMASH<br><em>THE ROAD.</em></h1>
      <p class="intro-copy">Pegue a estrada, desvie dos pedestres e tente despistar a polícia. Alguns pulam para fora da pista quando o carro se aproxima.</p>
      <div class="start-details">
        <span><b>01</b> DIRIJA</span><span><b>02</b> ESCAPE</span><span><b>03</b> SOBREVIVA</span>
      </div>
      <button id="start-button" class="primary-button" type="button">INICIAR PERSEGUIÇÃO <span>↗</span></button>
      <p class="control-hint">WASD / SETAS PARA DIRIGIR E CAMINHAR <i>·</i> E ENTRAR / SAIR <i>·</i> C CÂMERA</p>
    </section>

    <section id="end-overlay" class="overlay end-overlay hidden">
      <div class="title-kicker"><span></span> FIM DE CORRIDA</div>
      <h2 id="end-title">VOCÊ FOI<br><em>ALCANÇADO.</em></h2>
      <p id="end-summary" class="intro-copy">A cidade vai lembrar dessa.</p>
      <div class="results-row"><div><small>PONTUAÇÃO</small><strong id="final-score">0</strong></div><div><small>MELHOR</small><strong id="best-score">0</strong></div></div>
      <button id="retry-button" class="primary-button" type="button">TENTAR DE NOVO <span>↗</span></button>
    </section>

    <div class="controls-hint"><span class="keycap">W</span><span class="keycap">A</span><span class="keycap">S</span><span class="keycap">D</span><span>MOVER / DIRIGIR</span><span class="keycap space-key">SPACE</span><span>FREIO</span><span class="keycap camera-key">C</span><span>CÂMERA</span><span class="keycap action-key">E</span><span>ENTRAR / SAIR</span></div>
    <div class="mobile-controls" aria-label="Controles de direção">
      <button class="mobile-control steer-left" data-control="left" type="button" aria-label="Virar à esquerda">‹</button>
      <button class="mobile-control handbrake" data-control="handbrake" type="button" aria-label="Freio de mão">⤓</button>
      <div class="mobile-right-controls"><button class="mobile-control" data-control="reverse" type="button" aria-label="Ré">−</button><button class="mobile-control accelerate" data-control="accelerate" type="button" aria-label="Acelerar">↑</button></div>
      <button class="mobile-control steer-right" data-control="right" type="button" aria-label="Virar à direita">›</button>
    </div>
    <button id="vehicle-button" class="vehicle-button hidden" type="button" aria-label="Sair do carro (E)">SAIR DO CARRO · E</button>
    <div class="corner-label">38° 31' 12.4\" N <span>·</span> EASTSIDE</div>
  </main>
`

new Game(document.querySelector<HTMLDivElement>('#game-root')!)
