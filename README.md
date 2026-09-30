# Smash City — Wanted District

[English](#english) | [Português](#português)

---

## <a name="português"></a>Português

Protótipo jogável e completo de perseguição veicular em HTML5, TypeScript e Three.js. A cidade é gerada de forma procedural ao redor do carro e se estende indefinidamente enquanto a corrida continua.

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

### 🚀 Novas Funcionalidades Adicionadas pelo Google AI Studio

O protótipo foi profundamente expandido com sistemas urbanos interativos de física e IA de trânsito avançados:

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
- **Ejeção na Garagem (Missão 2)**: Ao concluir com sucesso a entrega da carga inflamável na garagem industrial, o personagem palito do jogador é ejetado de forma automática e segura para a calçada ao lado do caminhão, desativando os controles e finalizando a perseguição policial de maneira nativa.

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

A complete, playable 3D vehicle pursuit prototype built using HTML5, TypeScript, and Three.js. The city is generated procedurally around the player's vehicle, extending infinitely as the race progresses.

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

### 🚀 New Features Added by Google AI Studio

This prototype has been deeply enhanced with interactive city physics and advanced Traffic Light AI:

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
- **Garage Auto-Ejection (Mission 2)**: Upon successfully delivering the fuel tanker to the industrial garage, the player is automatically and safely ejected from the cabin to the sidewalk alongside the truck, turning off vehicle systems smoothly.

---

### 📂 Game Systems Architecture

- `src/game/Car.ts`: 3D meshes, vehicle physics, collisions, and bicycle rider animation.
- `src/game/City.ts`: Procedural generation of avenues, blocks, sidewalks, buildings, coins, lagoons, and 3D traffic lights.
- `src/game/Traffic.ts`: Civilian traffic AI, car-following, emergency evasion, and traffic light stopping logic.
- `src/game/Pedestrians.ts`: Active wandering pedestrians that can dodge oncoming vehicles.
- `src/game/Minimap.ts`: Radar HUD showing rivers, roads, parks, lagoons, and active mission waypoints.
- `src/game/Game.ts`: Game loop coordinator, camera states, HUD overlays, active pursuits, and mission handlers.
