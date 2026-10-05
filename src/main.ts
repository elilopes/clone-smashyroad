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
        <div class="stat level-stat"><span class="stat-label">NÍVEL</span><strong id="level-value">NV 1</strong></div>
        <div class="stat xp-stat">
          <span class="stat-label">XP</span>
          <strong id="xp-value">0 / 150</strong>
          <div class="xp-bar-mini"><div id="xp-bar-fill" class="xp-bar-fill" style="width: 0%"></div></div>
        </div>
        <div class="stat"><span class="stat-label">DISTÂNCIA</span><strong id="distance-value">0 m</strong></div>
        <div class="stat"><span class="stat-label">TEMPO</span><strong id="time-value">00:00</strong></div>
        <div class="stat cash-stat"><span class="stat-label">DINHEIRO</span><strong id="cash-value">$ 0</strong></div>
      </div>
      <button id="shop-btn" class="mode-button shop-btn" type="button" title="Abrir Loja de Veículos, Upgrades e Garagem">🏪 LOJA & GARAGEM</button>
      <button id="leaderboard-btn" class="mode-button leaderboard-btn" type="button" title="Ver Ranking Diário de XP e Dinheiro">🏆 RANKING</button>
      <button id="auth-button" class="mode-button auth-btn" type="button" title="Login com Google / Play Games">👤 CONECTAR</button>
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
        <div class="heading-left"><span class="heading-icon">◆</span><span>CONTRATOS</span></div>
        <div class="contracts-tabs">
          <button id="contracts-tab-active" class="contracts-tab-btn active" type="button" title="Ver contratos ativos">ATIVAS (<span id="active-contracts-count">0</span>)</button>
          <button id="contracts-tab-completed" class="contracts-tab-btn" type="button" title="Ver missões concluídas">CONCLUÍDAS (<span id="completed-contracts-count">0</span>)</button>
        </div>
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

    <div id="kingkong-mission-panel" class="kingkong-mission-panel hidden" aria-label="Missões do Avião Bimotor">
      <div class="kingkong-mission-header">
        <span class="kingkong-mission-badge">🛩️ AVIÃO BIMOTOR</span>
        <span id="kingkong-mission-stage" class="kingkong-mission-stage">NO ARRANHA-CÉU</span>
      </div>
      <div class="kingkong-mission-body">
        <div class="kingkong-mission-item">
          <div class="kingkong-timer-row">
            <span class="kingkong-timer-label">⭕ MISSÃO 1: CÍRCULOS FLUTUANTES (CÉUS)</span>
            <strong id="plane-rings-val" class="kingkong-timer-val" style="color: #38bdf8; font-size: 13px;">0 / 7</strong>
          </div>
          <div class="kingkong-timer-track">
            <div id="plane-rings-fill" class="kingkong-timer-fill" style="width: 0%; background: linear-gradient(90deg, #0284c7, #38bdf8); box-shadow: 0 0 8px rgba(56, 189, 248, 0.5);"></div>
          </div>
        </div>
        <div class="kingkong-mission-item">
          <div class="kingkong-timer-row">
            <span class="kingkong-timer-label">🦍 MISSÃO 2: CHEFÃO KING KONG (PRÉDIO)</span>
            <strong id="kingkong-hp-val" class="kingkong-timer-val" style="font-size: 13px;">50 / 50 HP</strong>
          </div>
          <div class="kingkong-timer-track">
            <div id="kingkong-timer-fill" class="kingkong-timer-fill" style="width: 100%;"></div>
          </div>
        </div>
        <div class="kingkong-info-row">
          <span id="kingkong-dist-info">DISTÂNCIA KONG: -- m</span>
          <span id="kingkong-instruction" class="kingkong-instruction">PASSE PELOS CÍRCULOS OU ATIRE NO KONG! [F]</span>
        </div>
      </div>
    </div>

    <div id="monster-mission-panel" class="monster-mission-panel hidden" aria-label="Missões do Monster Truck Cyber">
      <div class="monster-mission-header">
        <div class="monster-header-left">
          <span class="monster-mission-badge">🛻 MONSTER TRUCK</span>
          <span id="monster-mode-label" class="monster-mode-label">MODO 4X4</span>
        </div>
        <button id="monster-panel-transform-btn" class="monster-quick-transform-btn" type="button" title="Transformar [T]">🤖 TRANSFORMAR [T]</button>
      </div>
      <div class="monster-mission-body">
        <div class="monster-mission-item">
          <div class="monster-row">
            <span class="monster-label">🚗 MISSÃO 1: ESMAGAR 10 CARROS</span>
            <strong id="monster-crush-val" class="monster-val">0 / 10</strong>
          </div>
          <div class="monster-track">
            <div id="monster-crush-fill" class="monster-fill crush" style="width: 0%"></div>
          </div>
        </div>
        <div class="monster-mission-item">
          <div class="monster-row">
            <span class="monster-label">🦍 MISSÃO 2: ATIRAR NO KING KONG (ARRANHA-CÉU)</span>
            <strong id="monster-kong-val" class="monster-val">50 / 50 HP</strong>
          </div>
          <div class="monster-track">
            <div id="monster-kong-fill" class="monster-fill kong" style="width: 100%"></div>
          </div>
        </div>
        <div class="monster-info-row">
          <span id="monster-dist-info">DISTÂNCIA DO KONG: -- m</span>
          <span id="monster-instruction" class="monster-instruction">ESMAGUE CARROS OU TRANSFORME EM ROBÔ! [T]</span>
        </div>
      </div>
    </div>

    <div id="hauler-mission-panel" class="hauler-mission-panel hidden" aria-label="Missão do Caminhão Cegonha">
      <div class="hauler-mission-header">
        <div class="hauler-header-left">
          <span class="hauler-mission-badge">🚚 CAMINHÃO CEGONHA</span>
          <span class="hauler-mode-label">RESGATE</span>
        </div>
      </div>
      <div class="hauler-mission-body">
        <div class="hauler-mission-item">
          <div class="hauler-row">
            <span class="hauler-label">🚗 RECOLHER CARROS PARADOS:</span>
            <strong id="hauler-collected-val" class="hauler-val">0 / 5</strong>
          </div>
          <div class="hauler-track">
            <div id="hauler-collected-fill" class="hauler-fill" style="width: 0%"></div>
          </div>
        </div>
        <div class="hauler-info-row">
          <span id="hauler-dist-info">PRÓXIMO CARRO: -- m</span>
          <span id="hauler-instruction" class="hauler-instruction">APROXIME-SE DO CARRO COM A RAMPA!</span>
        </div>
      </div>
    </div>

    <!-- MISSÃO DE TÁXI / CORRIDA MALUCA (GTA VICE CITY / SAN ANDREAS) -->
    <div id="taxi-mission-panel" class="taxi-mission-panel hidden" aria-label="Missão de Táxi">
      <div class="taxi-mission-header">
        <div class="taxi-header-left">
          <span class="taxi-mission-badge">🚕 TÁXI // CORRIDA MALUCA</span>
          <span id="taxi-stage-label" class="taxi-stage-label">PROCURANDO PASSAGEIRO</span>
        </div>
      </div>
      <div class="taxi-mission-body">
        <div class="taxi-mission-item">
          <div class="taxi-row">
            <span class="taxi-label" id="taxi-dest-label">📍 DESTINO: AGUARDANDO</span>
            <strong id="taxi-timer-val" class="taxi-val">50.0s</strong>
          </div>
          <div class="taxi-track">
            <div id="taxi-timer-fill" class="taxi-fill" style="width: 100%"></div>
          </div>
        </div>
        <div class="taxi-info-row">
          <span id="taxi-tip-val">💰 GORJETA: $ 1.000</span>
          <span id="taxi-dist-val">DISTÂNCIA: -- m</span>
        </div>
        <div class="taxi-instruction" id="taxi-instruction">PARE JUNTO AO PASSAGEIRO NA CALÇADA!</div>
      </div>
    </div>

    <!-- CARRO-BOMBA / VELOCIDADE MÁXIMA (GTA III MIKE LIPS / SPEED) -->
    <div id="bomb-mission-panel" class="bomb-mission-panel hidden" aria-label="Missão Carro-Bomba">
      <div class="bomb-mission-header">
        <span class="bomb-mission-badge">💣 CARRO-BOMBA</span>
        <span class="bomb-speed-target">MIN: 75 KM/H</span>
      </div>
      <div class="bomb-mission-body">
        <div class="bomb-row">
          <span class="bomb-label">VELOCIDADE:</span>
          <strong id="bomb-speed-val" class="bomb-val">0 KM/H</strong>
        </div>
        <div class="bomb-track">
          <div id="bomb-speed-fill" class="bomb-fill" style="width: 0%"></div>
        </div>
        <div class="bomb-timer-row">
          <span>TEMPO SOBREVIVÊNCIA:</span>
          <strong id="bomb-countdown-val">45.0s</strong>
        </div>
        <div id="bomb-warning-box" class="bomb-warning-box hidden">
          ⚠️ VELOCIDADE BAIXA! DETONAÇÃO EM <span id="bomb-grace-val">3.0s</span>!
        </div>
      </div>
    </div>

    <!-- MODO FÚRIA / RAMPAGE (GTA 2 / GTA VICE CITY) -->
    <div id="rampage-mission-panel" class="rampage-mission-panel hidden" aria-label="Modo Fúria Rampage">
      <div class="rampage-mission-header">
        <span class="rampage-mission-badge">💀 MODO FÚRIA // RAMPAGE</span>
        <strong id="rampage-timer-val" class="rampage-timer">60s</strong>
      </div>
      <div class="rampage-mission-body">
        <div class="rampage-row">
          <span class="rampage-label">🚓 VIATURAS DESTRUÍDAS:</span>
          <strong id="rampage-count-val" class="rampage-val">0 / 15</strong>
        </div>
        <div class="rampage-track">
          <div id="rampage-fill" class="rampage-fill" style="width: 0%"></div>
        </div>
        <div class="rampage-hint">ESMAGUE 15 VIATURAS POLICIAIS EM 60 SEGUNDOS!</div>
      </div>
    </div>

    <!-- AUTH MODAL (LOGIN COM GOOGLE & PLAY GAMES & BANCO USERS.TS) -->
    <div id="auth-modal" class="auth-modal overlay hidden" role="dialog" aria-modal="true" aria-label="Login de Jogador">
      <div class="auth-card">
        <div class="title-kicker"><span></span> CONEXÃO DE JOGADOR & NUVEM</div>
        <h2 id="auth-modal-title">PERFIL DO PILOTO</h2>
        
        <div id="profile-card-section" class="profile-card-section">
          <div class="profile-header-row">
            <span class="profile-user-name" id="profile-user-name">Jogador Anônimo</span>
            <span class="sync-badge sync-badge-guest" id="profile-sync-badge">⚪ Anônimo</span>
          </div>
          <div class="profile-stats-grid">
            <div class="profile-stat-box"><span>NÍVEL ATUAL</span><strong id="profile-level-val">Nível 1</strong></div>
            <div class="profile-stat-box"><span>XP TOTAL</span><strong id="profile-xp-val">0 XP</strong></div>
            <div class="profile-stat-box"><span>SALDO EM NUVEM</span><strong id="profile-cash-val">$ 0</strong></div>
            <div class="profile-stat-box"><span>RECORDE DISTÂNCIA</span><strong id="profile-highscore-val">0 m</strong></div>
          </div>
        </div>

        <div id="guest-warning-banner" class="guest-warning-banner">
          ⚠️ <b>Modo Anônimo:</b> Seus níveis, XP, dinheiro e missões só são salvos na nuvem quando você se autenticar com o <b>Google</b> ou <b>Play Games</b>. Conecte-se abaixo para salvar e sincronizar seu progresso entre dispositivos!
        </div>
        
        <div class="auth-buttons-list" id="auth-buttons-list">
          <button id="google-sign-in-btn" class="auth-provider-btn google-btn" type="button">
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.92 0 12s.45 3.85 1.24 5.42l4.04-3.15z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/></svg>
            Entrar com Google
          </button>
          
          <button id="playgames-sign-in-btn" class="auth-provider-btn playgames-btn" type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#00C853"><path d="M21.58 16.09l-1.09-7.66C20.25 6.64 18.72 5 16.89 5H7.11C5.28 5 3.75 6.64 3.51 8.43l-1.09 7.66C2.18 17.84 3.57 19 5.1 19c.77 0 1.51-.31 2.05-.85L9.4 16h5.2l2.25 2.15c.54.54 1.28.85 2.05.85 1.53 0 2.92-1.16 2.68-2.91zM9 13H8v1c0 .55-.45 1-1 1s-1-.45-1-1v-1H5c-.55 0-1-.45-1-1s.45-1 1-1h1V9c0-.55.45-1 1-1s1 .45 1 1v1h1c.55 0 1 .45 1 1s-.45 1-1 1zm6-1.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm2.5 3c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
            Login com Google Play Games
          </button>
        </div>

        <div id="auth-status-msg" class="auth-status-msg">Conecte-se para salvar contratos e ranking no Firebase Firestore.</div>

        <button id="sync-now-btn" class="secondary-button sync-now-btn hidden" type="button">🔄 SINCRONIZAR COM FIRESTORE AGORA</button>
        <button id="sign-out-btn" class="secondary-button signout-btn hidden" type="button">🚪 DESCONECTAR DA CONTA</button>
        <button id="close-auth-modal-btn" class="secondary-button" type="button" style="margin-top: 10px;">FECHAR PAINEL</button>
      </div>
    </div>

    <!-- DAILY LEADERBOARD MODAL (RANKING DIÁRIO DE XP & DINHEIRO) -->
    <div id="leaderboard-modal" class="leaderboard-modal overlay hidden" role="dialog" aria-modal="true" aria-label="Ranking Diário">
      <div class="leaderboard-card">
        <div class="title-kicker"><span></span> CLASSIFICAÇÃO // TEMPORADA DIÁRIA</div>
        <h2>🏆 RANKING DIÁRIO</h2>
        <p class="intro-copy" id="leaderboard-date-label">Top pilotos de hoje</p>

        <div class="leaderboard-tabs">
          <button id="lb-tab-xp" class="lb-tab-btn active" type="button">⭐ MAIS XP HOJE</button>
          <button id="lb-tab-cash" class="lb-tab-btn" type="button">💰 MAIS DINHEIRO HOJE</button>
        </div>

        <div id="leaderboard-my-rank-box" class="leaderboard-my-rank-box">
          <span class="my-rank-label">SUA PONTUAÇÃO HOJE:</span>
          <strong id="leaderboard-my-stat-val">0 XP</strong>
        </div>

        <div class="leaderboard-table-header">
          <span>POS</span>
          <span>PILOTO</span>
          <span>NÍVEL</span>
          <span id="lb-col-score">XP HOJE</span>
        </div>

        <div id="leaderboard-list" class="leaderboard-list">
          <div class="leaderboard-loading">Carregando pilotos do Firestore...</div>
        </div>

        <div class="leaderboard-actions">
          <button id="refresh-leaderboard-btn" class="secondary-button" type="button" style="width: auto;">↻ ATUALIZAR</button>
          <button id="close-leaderboard-btn" class="primary-button" type="button" style="margin-top: 0; width: auto; flex: 1;">FECHAR RANKING ✕</button>
        </div>
      </div>
    </div>

    <!-- GARAGE & CUSTOMIZATION SHOP MODAL (LOJA DE CARROS & UPGRADES) -->
    <div id="shop-modal" class="shop-modal overlay hidden" role="dialog" aria-modal="true" aria-label="Loja e Garagem de Carros">
      <div class="shop-card">
        <div class="shop-header">
          <div>
            <div class="title-kicker"><span></span> GARAGEM & OFICINA ESPECIALIZADA</div>
            <h2>🏪 LOJA SMASH MOTORSPORT</h2>
          </div>
          <div class="shop-cash-badge">
            <span class="shop-cash-label">SEU SALDO</span>
            <strong id="shop-user-cash">$ 0</strong>
          </div>
        </div>

        <div class="shop-tabs">
          <button id="shop-tab-vehicles" class="shop-tab-btn active" type="button">🏎️ VEÍCULOS</button>
          <button id="shop-tab-engine" class="shop-tab-btn" type="button">⚡ MOTOR</button>
          <button id="shop-tab-armor" class="shop-tab-btn" type="button">🛡️ BLINDAGEM</button>
          <button id="shop-tab-paints" class="shop-tab-btn" type="button">🎨 PINTURAS</button>
          <button id="shop-tab-decals" class="shop-tab-btn" type="button">🏷️ ADESIVOS</button>
          <button id="shop-tab-parts" class="shop-tab-btn" type="button">🔧 PEÇAS EXCLUSIVAS</button>
        </div>

        <div id="shop-content-area" class="shop-content-area">
          <!-- Conteúdo dinâmico renderizado via TypeScript -->
        </div>

        <div class="shop-footer">
          <div id="shop-feedback-msg" class="shop-feedback-msg">Escolha melhorias e novos bólides com o dinheiro conquistado em missões.</div>
          <button id="close-shop-btn" class="primary-button" type="button" style="margin-top: 0; width: auto; min-width: 180px;">SAIR DA LOJA ✕</button>
        </div>
      </div>
    </div>

    <div id="slow-motion-banner" class="slow-motion-banner hidden" aria-live="polite">⚡ SALTO ACROBÁTICO // CÂMERA LENTA ⚡</div>

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
    <button id="hydraulic-jump-btn" class="hydraulic-jump-btn hidden" type="button" aria-label="Salto com Suspensão Hidráulica (ESPAÇO)">🦘 SALTO HIDRÁULICO · ESPAÇO</button>
    <button id="plane-shoot-btn" class="plane-shoot-btn hidden" data-control="shoot" type="button" aria-label="Disparar metralhadoras do avião bimotor">🎯 ATIRAR · F</button>
    <button id="monster-transform-btn" class="monster-transform-btn hidden" type="button" aria-label="Transformar veículo em robô Transformers (T)">🤖 TRANSFORMAR · T</button>
    <button id="monster-thrust-btn" class="monster-thrust-btn hidden" data-control="thrust" type="button" aria-label="Ativar propulsão a jato para voar e mirar no King Kong (ESPAÇO / SHIFT)">🚀 PROPULSÃO · ESPAÇO</button>
    <button id="monster-shoot-btn" class="monster-shoot-btn hidden" data-control="shoot" type="button" aria-label="Usar Espada Transformers e Canhão Blaster (F)">⚔️ ESPADA & CANHÃO · F</button>
    <div class="corner-label">38° 31' 12.4" N <span>·</span> EASTSIDE</div>
  </main>
`

new Game(document.querySelector<HTMLDivElement>('#game-root')!)
