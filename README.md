# Smash City — Wanted District

[English](#english) | [Português](#português)

---

## <a name="português"></a>Português

Jogo MOST WANTED CAR, um protótipo completo e jogável em 3D de perseguição veicular em HTML5, TypeScript e Three.js. Este jogo foi baseado no jogo Smash City 2. A cidade é gerada de forma procedural ao redor do carro e se estende indefinidamente enquanto a corrida continua.

### 🎮 Como Executar

```bash
npm install
npm run dev
```

### ⌨️ Controles

- **W / ↑**: Acelerar
- **S / ↓**: Dar ré / Frear
- **A / ←**: Virar à esquerda
- **D / →**: Virar à direita
- **Espaço**: Freio de mão
- **C**: Alternar câmera (entre traseira 3D e três quartos 2.5D)
- **E**: Entrar / Sair do veículo (perto de um carro ou avião no solo)
- *Para dispositivos móveis, utilize os controles virtuais na tela.*

---

### 🚀 Funcionalidades adicionadas

O protótipo foi  expandido com sistemas urbanos interativos de física e IA de trânsito:

#### 1. 🚦 Semáforos de Trânsito Inteligentes e Postes 3D
- **Sinalização em Esquinas Reais**: Adicionados semáforos físicos realistas em 3D em quatro esquinas centrais movimentadas da cidade (`X = -48` ou `X = 48` cruzando com `Z = 0` ou `Z = 48`).
- **Alternância Automática (Ciclo de 12s)**: Os semáforos alternam de cor automaticamente a cada 6 segundos para cada via (incluindo transição com luz Amarela brilhante e emissiva).
- **IA de Parada de Tráfego**: Os veículos civis do trânsito detectam o sinal fechado (Vermelho/Amarelo) a até 18 metros e desaceleram suavemente até parar. Graças ao sistema de car-following, os carros de trás formam filas organizadas. Quando o sinal abre, eles retomam a velocidade.
- **HUD Limpo**: Respeitando as regras visuais, não são exibidos cronômetros, contadores ou barras de tempo na tela para o jogador.

#### 2. 🚲 Condutor de Bicicleta (Stick Figure Rider)
- **Fim das Bicicletas Fantasmas**: Todas as bicicletas que andam no trânsito civil ou que o jogador utiliza possuem agora um condutor com corpo formado por boneco palito (camisa vermelha e calça azul) que pedala ativamente o veículo, tornando o ecossistema urbano muito mais animado e crível.

#### 3. 🌊 Lagoas Urbanas e Física de Flutuação
- **Água Azul-Royal Brilhante (#2563eb)**: As lagoas urbanas foram pintadas com um azul-royal opaco e vibrante, imune à mistura de cor com a grama do fundo.
- **Física de Flutuação e Travamento**: Ao entrar na água com qualquer carro ou veículo, os controles de aceleração e direção são travados e o carro flutua balançando estaticamente.
- **Ejeção Automática no Rio/Lagoa**: Quando um veículo cai na água, o jogador palito é automaticamente arremessado para fora do veículo pela lateral (esquerda ou direita) para que possa nadar livremente até a terra firme.
- **Sistema de Fôlego (30s)**: Nadar na água ativa um cronômetro visual de fôlego com contagem regressiva de 30 a 0 segundos. Se o jogador não alcançar terra firme antes do tempo esgotar, ocorre o fim de jogo por afogamento.

#### 4. 🚚 Missão do Caminhão-Tanque e Ejeção Automática
- **Design do Caminhão-Tanque**: Carroceria cilíndrica metálica com faixas de sinalização laranja e verde (altamente inflamável) e placas de diamante de risco.
- **Ejeção na Garagem (Missão 2)**: Ao concluir com sucesso a entrega da carga inflamável na garagem industrial, o personagem palito do jogador é retirado de dentro do caminhão de forma automática e segura, sendo posicionado ao lado do caminhão na calçada com velocidade zerada.

#### 5. 🦍 Prédio do King Kong & Missão Aérea com o Avião Bimotor
- **Spawn Aleatório a Cada Partida**: Todas as vezes que um novo jogo é iniciado, o computador seleciona aleatoriamente um quarteirão diferente da cidade para erguer o imponente arranha-céu Art-Deco estilo Empire State (mais de 110 metros de altura, com patamares escalonados, pilastras ornamentadas, janelas e um farol sinalizador de aviação pulsante no mastro de amarração).
- **O Gorila Gigante no Arranha-Céu**: Pendurado nas vigas e parapeito do topo do edifício está o lendário King Kong, com animações de respiração, membros móveis e ataque aéreo caso uma aeronave se aproxime.
- **Ativação da Missão por Proximidade Aérea**: Ao pilotar o **Avião Bimotor** e alcançar as redondezas do prédio (raio de 95 metros), as sirenes tocam e a missão de combate aéreo é iniciada com painel dedicado no HUD.
- **Função de Atirar do Avião Bimotor**: Ao iniciar a missão, o avião bimotor é armado com metralhadoras duplas sincronizadas nas pontas das asas. O jogador pode disparar rajadas contínuas de alta velocidade pressionando **Espaço**, **F**, **Enter** ou tocando no botão virtual de mira/tiro na tela.
- **Resistência de 50 Colisões (Boss Fight Épica)**: O King Kong possui resistência blindada de 50 impactos de disparos. A cada tiro certeiro, o modelo 3D do gorila pisca intensamente em vermelho/branco, sofre tremores mecânicos realistas e emite faíscas. A barra de resistência no HUD exibe a vida restante em tempo real (`X / 50`).
- **Queda Cinematográfica e Grande Recompensa**: Ao atingir a 50ª colisão, o King Kong se solta do parapeito e despenca com aceleração gravitacional e rotação do topo até o chão, concluindo a missão com explosões, som triunfante e premiação de **+$5.000 em dinheiro** e **+15.000 pontos**.
- **Radar & Minimapa GPS**: O arranha-céu e o gorila são sinalizados no radar e minimapa expandível com ícone dedicado `🦍 KING KONG`.

#### 6. 🛠️ Otimizações, Novas Físicas & Melhorias de Interface (UI)
- **Modo Gráfico Baixo (Culled Meshing)**: Implementado sistema de *Culled Meshing* combinado com *Instanced Mesh*. O jogo remove as faces ocultas inferiores de todos os edifícios e blocos instanciados no modo Baixo para otimização pesada e fluidez ultra-rápida.
- **Modo Gráfico Alto (Rounded & Hatchback)**: O modo de qualidade gráfica Alta agora renderiza os veículos com cantos e bordas perfeitamente arredondadas via *RoundedBoxGeometry*. Além disso, todos os veículos não-picapes possuem uma traseira esportiva na diagonal estilo *hatchback* em vez de blocos quadrados de 90 graus.
- **Física de Voo Tridimensional (Avião)**: O avião bimotor agora possui resolução de colisão sólida em 3D. Ele desliza e colide corretamente contra as paredes laterais dos prédios ao invés de passar por dentro, mas pode voar livremente por cima deles se estiver acima de seu topo.
- **Física do Personagem Palito contra Policiais**: Quando o jogador estiver a pé, as viaturas policiais colidem e o empurram fisicamente sem passar por dentro do seu modelo 3D, batendo sem infligir dano direto.
- **Gerenciamento de Modais de UI**: Modais de Perfil do Piloto (Conexão Google), Ajustes de Configurações e Ranking Diário foram reordenados e configurados com `z-index: 500`, aparecendo sempre à frente da tela de jogo pausado. O botão de Configurações também foi embutido diretamente nas opções de Pausa.
- **Modo de Perfil Simplificado**: Jogadores não conectados agora exibem o status limpo de `ANÔNIMO` no menu superior, ocultando o indicador de níveis e o texto longo "Jogador Anônimo".

---

### 📂 Estrutura de Sistemas do Jogo

- `src/game/Car.ts`: Modelos 3D, física, aceleração, direção, colisões e renderização do condutor de bicicleta.
- `src/game/City.ts`: Geração de ruas, quarteirões, calçadas, edifícios, moedas coletáveis, lagoas e semáforos físicos 3D.
- `src/game/Traffic.ts`: IA de trânsito civil, car-following, evasão de perigos e IA de parada em semáforos vermelhos.
- `src/game/Pedestrians.ts`: Pedestres ativos que se movem, esquivam de carros e interagem com o mundo.
- `src/game/Minimap.ts`: Radar e mapa expandível que indica rios, ruas, praças, lagoas e objetivos.
- `src/game/Game.ts`: Core da engine, loop de update, câmera inteligente, HUD, perseguições e sistema de missões.

---

---

## <a name="english"></a>English

Jogo MOST WANTED CAR, a complete prototype and playable 3D vehicle pursuit built using HTML5, TypeScript, and Three.js. This game is basead at game Smash City 2. The city is generated procedurally around the player's vehicle, extending infinitely as the race progresses.

### 🎮 Getting Started

```bash
npm install
npm run dev
```

### ⌨️ Controls

- **W / ↑**: Accelerate
- **S / ↓**: Reverse / Brake
- **A / ←**: Turn Left
- **D / →**: Turn Right
- **Space**: Handbrake
- **C**: Toggle camera (between 3D Chase and 2.5D top-down)
- **E**: Enter / Exit vehicle (when close to a car or grounded plane)
- *For touchscreens, use the virtual controls at the bottom of the screen.*

---

### 🚀 Features Added

This prototype has been deeply enhanced with interactive city physics and Traffic Light AI:

#### 1. 🚦 Intelligent Traffic Lights and 3D Poles
- **Real-Corner Light Signaling**: Real 3D traffic light poles were added at four major central intersections (`X = -48` or `X = 48` intersecting with `Z = 0` or `Z = 48`).
- **Automatic State Cycles (12s)**: Signal colors automatically cycle every 6s per lane (including beautiful emissive Yellow warning transition lights).
- **Traffic Stopping AI**: Civilian vehicles detect closed signals (Red/Yellow) up to 18m away and smoothly slow down to a halt. The car-following algorithm queues subsequent vehicles in neat rows. Once the light turns green, they automatically resume cruising.
- **Clean UI**: In compliance with the visual guidelines, there are no timers, progress bars, or countdowns displayed on the screen for the player.

#### 2. 🚲 Stick Figure Bicycle Rider
- **No More Ghost Bikes**: All civilian traffic bicycles and those ridden by the player feature an active stick-figure rider (red shirt, blue pants) pedaling, animating the city grid and making it feel much more organic.

#### 3. 🌊 Urban Lagoons and Water Buoyancy
- **Vibrant Royal Blue Water (#2563eb)**: Urban lagoons feature a solid, beautiful royal blue color, fully opaque to prevent the underlying grass from spoiling its color.
- **Buoyancy and Movement Freeze**: Driving any vehicle into a water body blocks accelerator/steering controls. The car floats with a gentle, static bobbing animation.
- **Auto-Ejection in Water**: Falling into rivers or lagoons automatically throws the stick-figure player out of the vehicle through the side (left or right), allowing them to swim back to dry land.
- **Breath/Drowning System (30s)**: Swimming triggers a visual oxygen progress bar counting down from 30s to 0s. If the player fails to reach dry land in time, the game ends due to drowning.

#### 4. 🚚 Inflammable Fuel Tanker Mission & Auto-Ejection
- **Tanker Truck Design**: Features a highly detailed cylindrical steel fuel tank, hazard sign diamonds, and hazard stripes.
- **Garage Auto-Ejection (Mission 2)**: Upon successfully delivering the fuel tanker to the industrial garage, the player is automatically and safely ejected from the cabin to the sidewalk alongside the truck with velocity set to zero, concluding the pursuit natively.

#### 5. 🦍 King Kong Skyscraper & Twin-Engine Plane Aerial Mission
- **Random Location on Every Match**: Every time a new run begins, the computer randomly selects a different city block to construct the massive Art-Deco Empire State skyscraper (over 110 meters tall, featuring setbacks, pillars, warm illuminated windows, and a blinking aircraft beacon atop its mooring mast).
- **The Giant Gorilla on the Tower**: Clinging to the observation deck and upper tier of the skyscraper is the colossal King Kong, featuring breathing cycles, mobile limbs, and swatting attacks when aircraft fly close.
- **Proximity-Triggered Aerial Mission**: Piloting the **Twin-Engine Plane** into the vicinity of the skyscraper (within 95 meters) sounds the alarm and triggers the King Kong aerial boss fight, displaying a dedicated boss HUD.
- **Twin-Engine Plane Shooting Mode**: Once the mission activates, the plane is armed with dual wing-mounted machine gun cannons. Players can fire rapid-fire streams of armor-piercing bullets by pressing **Space**, **F**, **Enter**, or tapping the on-screen target/shoot button.
- **50-Hit Resistance Boss Health**: King Kong boasts a durable 50-hit collision resistance. Each direct bullet impact triggers an intense red/white hit-flash on his 3D mesh, mechanical flinch tremors, and spark discharges. The boss health bar dynamically tracks remaining endurance (`X / 50`).
- **Cinematic Fall & Grand Reward**: Once 50 hits are registered, King Kong releases his grip and plummets in full gravity-driven freefall to the city streets below. Defeating him rewards the player with a celebratory explosion sequence, victory chimes, **+$5,000 cash**, and **+15,000 points**.
- **GPS Minimap & Radar Tracking**: The skyscraper and the gorilla are tracked in real-time on both the mini-radar and expanded map with a custom `🦍 KING KONG` waypoint.

#### 6. 🛠️ Optimizations, New Physics & UI Enhancements
- **Low Graphics Mode (Culled Meshing)**: Combines *Culled Meshing* with *Instanced Mesh* rendering. This optimization removes hidden bottom faces of all procedural building blocks to achieve maximum frame rates and ultra-fluid gameplay.
- **High Graphics Mode (Rounded & Hatchback)**: The High quality mode renders vehicles with smooth rounded corners using *RoundedBoxGeometry*. Additionally, all non-pickup vehicles feature a sporty slanted hatchback rear profile rather than flat vertical 90-degree boxes.
- **3D Flight Collision Resolution (Plane)**: The twin-engine plane now features robust 3D collision sliding resolution. The aircraft slides and bounces correctly against skyscraper walls instead of clipping through them, while still allowing the player to fly freely above the building rooftops.
- **Foot Physics against Cop Units**: When playing on foot as the stick figure, patrol cars physically collide and push the character away without clipping through, bumping the player with sparks and without applying direct damage.
- **UI Modal Overlay Management**: The Pilot Profile, Daily Leaderboard, and Graphics Settings modals have been properly configured with fixed views and `z-index: 500`. They now display smoothly on top of the paused screen, and a Settings button has been embedded into the Pause screen.
- **Simplified Anonymous Profile**: Guest players now see a clean `ANONYMOUS` (or `ANÔNIMO`) tag in the header bar instead of the long "Jogador Anônimo" level label.

---

### 📂 Game Systems Architecture

- `src/game/Car.ts`: 3D meshes, vehicle physics, collisions, and bicycle rider animation.
- `src/game/City.ts`: Procedural generation of avenues, blocks, sidewalks, buildings, coins, lagoons, and 3D traffic lights.
- `src/game/Traffic.ts`: Civilian traffic AI, car-following, emergency evasion, and traffic light stopping logic.
- `src/game/Pedestrians.ts`: Active wandering pedestrians that can dodge oncoming vehicles.
- `src/game/Minimap.ts`: Radar HUD showing rivers, roads, parks, lagoons, and active mission waypoints.
- `src/game/Game.ts`: Game loop coordinator, camera states, HUD overlays, active pursuits, and mission handlers.
