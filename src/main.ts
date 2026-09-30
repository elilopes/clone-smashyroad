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
      <button id="pause-button" class="icon-button pause-button" type="button" aria-label="Pausar jogo" title="Pausar jogo (P / ESC)">❚❚</button>
      <button id="sound-button" class="icon-button" type="button" aria-label="Ativar ou desativar som">♪</button>
    </header>

    <section class="wanted-panel" aria-label="Nível de perseguição">
      <div class="wanted-heading"><span class="wanted-dot"></span><span>PROCURADO</span><strong id="wanted-label">NÍVEL 0 / 10</strong></div>
      <div id="wanted-meter" class="wanted-meter" aria-hidden="true"></div>
      <div class="wanted-note" id="wanted-note">Mantenha a cidade em alerta.</div>
      <div id="capture-meter" class="capture-meter"><div class="capture-heading"><span>RISCO DE DETENÇÃO</span><strong id="capture-label">0%</strong></div><div class="capture-track"><div id="capture-fill" class="capture-fill"></div></div></div>
    </section>

    <section class="mission-panel" id="mission-panel">
      <div class="panel-heading" id="mission-panel-header">
        <div class="heading-left"><span class="heading-icon">◆</span><span>CONTRATOS ATIVOS</span></div>
        <button id="contracts-toggle-btn" class="contracts-toggle-btn" type="button" aria-label="Ocultar contratos">▲</button>
      </div>
      <div id="mission-list" class="mission-list"></div>
    </section>

    <div class="speedometer" aria-label="Velocidade e status do veículo">
      <div class="speed-reading"><strong id="speed-value">000</strong><span>KM/H</span></div>
      <div class="speed-track"><div id="speed-fill" class="speed-fill"></div></div>
      <div class="speed-caption"><span>0</span><span>240</span></div>

      <div class="vehicle-energy-section">
        <div class="energy-info">
          <span class="energy-badge" id="energy-vehicle-kind">SEDAN</span>
          <span class="energy-label">ENERGIA</span>
          <strong id="energy-value">100%</strong>
        </div>
        <div class="energy-track"><div id="energy-fill" class="energy-fill"></div></div>
        <div class="energy-caption">
          <span id="energy-hits">0 / 15 BATIDAS</span>
          <span id="energy-status" class="energy-status-safe">100%</span>
        </div>
      </div>
    </div>

    <div id="minimap-shell" class="minimap-shell" role="region" aria-label="Minimapa da cidade" title="Clique ou pressione M para expandir">
      <canvas id="minimap-canvas" class="minimap-canvas" width="296" height="296"></canvas>
      <div class="minimap-compass">N</div>
      <div class="minimap-label">RADAR // GPS</div>
      <button id="minimap-toggle" class="minimap-toggle" type="button" aria-label="Expandir mapa" title="Expandir mapa (M)">⤢</button>
      <div class="minimap-header">
        <span class="minimap-title">MAPA DA CIDADE // GPS</span>
        <span class="minimap-sub">[M] OU CLIQUE PARA FECHAR</span>
      </div>
    </div>

    <div id="tanker-mission-panel" class="tanker-mission-panel hidden" aria-label="Missão do Caminhão Tanque">
      <div class="tanker-mission-header">
        <span class="tanker-mission-badge">⛽ CARGA INFLAMÁVEL</span>
        <span id="tanker-mission-stage" class="tanker-mission-stage">MISSÃO 1</span>
      </div>
      <div class="tanker-mission-body">
        <div class="tanker-timer-row">
          <span id="tanker-timer-label" class="tanker-timer-label">CRONÔMETRO:</span>
          <strong id="tanker-timer-val" class="tanker-timer-val">60.0s</strong>
        </div>
        <div class="tanker-timer-track">
          <div id="tanker-timer-fill" class="tanker-timer-fill" style="width: 100%"></div>
        </div>
        <div class="tanker-info-row">
          <span id="tanker-durability">RESISTÊNCIA: 4 / 4 COLISÕES</span>
          <span id="tanker-instruction" class="tanker-instruction">SOBREVIVA SEM EXPLODIR!</span>
        </div>
      </div>
    </div>

    <div id="bus-mission-panel" class="bus-mission-panel hidden" aria-label="Missão do Ônibus">
      <div class="bus-mission-header">
        <span class="bus-mission-badge">🚌 LINHA DE ÔNIBUS</span>
        <span id="bus-mission-stage" class="bus-mission-stage">TRANSPORTE DE PASSAGEIROS</span>
      </div>
      <div class="bus-mission-body">
        <div class="bus-timer-row">
          <span class="bus-timer-label">PASSAGEIROS EMBARCADOS:</span>
          <strong id="bus-count-val" class="bus-timer-val">0 / 6</strong>
        </div>
        <div class="bus-timer-track">
          <div id="bus-timer-fill" class="bus-timer-fill" style="width: 0%"></div>
        </div>
        <div class="bus-info-row">
          <span id="bus-nearest-dist">PRÓXIMO PASSAGEIRO: -- m</span>
          <span id="bus-instruction" class="bus-instruction">PASSE POR CIMA DA PESSOA!</span>
        </div>
      </div>
    </div>

    <div id="toast" class="toast" role="status" aria-live="polite"></div>

    <div id="water-timer-panel" class="water-timer-panel hidden" aria-label="Tempo de fôlego na água">
      <div class="water-timer-header">
        <span class="water-timer-badge">🌊 EM ÁGUA PROFUNDA</span>
        <span class="water-timer-title">SAIA DO RIO!</span>
      </div>
      <div class="water-timer-body">
        <div class="water-timer-row">
          <span class="water-timer-label">FÔLEGO RESTANTE:</span>
          <strong id="water-timer-val" class="water-timer-val">30.0s</strong>
        </div>
        <div class="water-timer-track">
          <div id="water-timer-fill" class="water-timer-fill" style="width: 100%"></div>
        </div>
      </div>
    </div>

    <button id="cancel-auto-enter-btn" class="cancel-auto-enter-btn hidden" type="button" aria-label="Cancelar entrada automática no veículo">CANCELAR ENTRADA (10s)</button>

    <section id="start-overlay" class="overlay">
      <div class="title-kicker"><span></span> UMA CIDADE. DEZ NÍVEIS DE CAOS.</div>
      <h1>SMASH<br><em>THE ROAD.</em></h1>
      <p class="intro-copy">Pegue a estrada com carros ou decole com o <b>Avião Bimotor</b> na pista larga do aeroporto. Atravesse os círculos flutuantes nos céus e despiste a polícia!</p>
      <div class="start-details">
        <span><b>01</b> DIRIJA & VOE</span><span><b>02</b> CÍRCULOS FLUTUANTES</span><span><b>03</b> SOBREVIVA</span>
      </div>
      <button id="start-button" class="primary-button" type="button">INICIAR PERSEGUIÇÃO <span>↗</span></button>
      <p class="control-hint">WASD / SETAS DIRIGIR / PILOTAR <i>·</i> E ENTRAR NO CARRO OU AVIÃO <i>·</i> C CÂMERA <i>·</i> M MAPA <i>·</i> P PAUSA</p>
    </section>

    <section id="end-overlay" class="overlay end-overlay hidden">
      <div class="title-kicker"><span></span> FIM DE CORRIDA</div>
      <h2 id="end-title">VOCÊ FOI<br><em>ALCANÇADO.</em></h2>
      <p id="end-summary" class="intro-copy">A cidade vai lembrar dessa.</p>
      <div class="results-row end-results-row">
        <div><small>PONTUAÇÃO</small><strong id="final-score">0</strong></div>
        <div><small>MELHOR PONTUAÇÃO</small><strong id="best-score">0</strong></div>
        <div><small>TEMPO</small><strong id="final-time">00:00</strong></div>
        <div><small>MAIOR TEMPO</small><strong id="best-time">00:00</strong></div>
      </div>
      <button id="retry-button" class="primary-button" type="button">TENTAR DE NOVO <span>↗</span></button>
    </section>

    <section id="pause-overlay" class="overlay pause-overlay hidden">
      <div class="title-kicker"><span></span> PAUSA</div>
      <h2>JOGO<br><em>PAUSADO.</em></h2>
      <p class="intro-copy">A perseguição está congelada. Ajuste sua estratégia ou respire fundo antes de retomar a fuga.</p>
      <div class="results-row pause-stats">
        <div><small>DISTÂNCIA</small><strong id="pause-distance">0 m</strong></div>
        <div><small>TEMPO</small><strong id="pause-time">00:00</strong></div>
        <div><small>PROCURADO</small><strong id="pause-wanted">NÍVEL 0</strong></div>
      </div>
      <div class="pause-actions">
        <button id="resume-button" class="primary-button" type="button">CONTINUAR <span>▶</span></button>
        <button id="restart-button" class="secondary-button" type="button">REINICIAR CORRIDA <span>↻</span></button>
      </div>
      <p class="control-hint">PRESSIONE P OU ESC PARA CONTINUAR</p>
    </section>

    <div class="controls-hint"><span class="keycap">W</span><span class="keycap">A</span><span class="keycap">S</span><span class="keycap">D</span><span>MOVER / DIRIGIR</span><span class="keycap space-key">SPACE</span><span>FREIO</span><span class="keycap camera-key">C</span><span>CÂMERA</span><span class="keycap action-key">E</span><span>ENTRAR / SAIR</span><span class="keycap map-key">M</span><span>MAPA</span><span class="keycap pause-key">P</span><span>PAUSAR</span></div>
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
