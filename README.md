# Most Wanted Car: District 01 🚗💨

[🇧🇷 Português](#-versão-em-português) | [🇺🇸 English](#-english-version)

---

## 🇧🇷 Versão em Português

**Most Wanted Car: District 01** é um jogo 3D de mundo aberto e perseguição veicular em ritmo frenético, desenvolvido com **React**, **Three.js** e **Vite**, com suporte completo a exportação nativa para **Android via Capacitor**. 

Pilote supercarros, monster trucks, ônibus, caminhões cegonha, aviões bimotores e robôs transformáveis através de uma metrópole procedural repleta de tráfego dinâmico, cerco policial implacável e missões cheias de adrenalina!

---

### 🌐 Idiomas Suportados (Game Language)
O jogo possui tradução integral e dinâmica para 4 idiomas, selecionáveis a qualquer momento no menu de **Ajustes // Settings**:
- 🇧🇷 **Português** (Padrão)
- 🇺🇸 **English**
- 🇷🇺 **Русский**
- 🇨🇳 **中文**

Todos os menus, contratos, telemetria, painel de procurado, banners de vitória e o **Modal do Perfil do Piloto** são adaptados instantaneamente ao idioma selecionado.

---

### 🎯 Missões e Contratos do Jogo

O jogo inclui um rico catálogo de contratos urbanos e missões especiais de grande escala:

1. **🏁 Corrida Contra o Tempo (Time Trial)**:
   - *Objetivo:* Um arco inicial luminoso aguarda o jogador em uma via da cidade. Ao cruzar o arco com o veículo, inicia-se um cronômetro regressivo e surge uma linha guia holográfica projetada no asfalto. O piloto deve acelerar no trânsito normal e passar por 3 arcos luminosos sequenciais antes do tempo zerar!
   - *Recompensa:* +$7.500 | +XP de Piloto.

2. **🧟 Arena de Sobrevivência (Zombie Arena - Survival Mode)**:
   - *Objetivo:* Localizada no deserto a oeste da cidade. Sobreviva a ondas brutais de zumbis, monstros mutantes e chefões titânicos em modo Fácil (4 ondas) ou Difícil (10 ondas com zumbis cuspidores de fogo e meteoros), coletando power-ups, armas (Shotgun, SMG, Plasma) e kits médicos.
   - *Recompensa:* +$8.000 a +$20.000 | Conquista de Arena.

3. **🏁 Rally das Dunas (Dune Rally - Circuito Elétrico)**:
   - *Objetivo:* Localizado no deserto a leste da cidade. Um circuito oval off-road radical com saltos gigantes e um **looping 360°**. Dispute contra competidores velozes e termine em 1º ou 2º lugar!
   - *Recompensa:* +$6.000 | Conquista de Rally.

4. **🚕 Táxi Maluco (Crazy Taxi)**:
   - *Objetivo:* Embarque 3 passageiros ansiosos pela cidade e execute manobras radicais e saltos antes de entregá-los aos seus destinos.
   - *Recompensa:* +$3.500.

5. **💣 Velocidade Máxima / Carro-Bomba (Speed Bomb)**:
   - *Objetivo:* Assuma a direção de um carro equipado com explosivos sensíveis à velocidade. Mantenha a velocidade acima de 75 km/h por 45 segundos ininterruptos para desarmar o detonador!
   - *Recompensa:* +$5.000.

6. **💥 Modo Fúria Policial (Rampage Police)**:
   - *Objetivo:* Destrua 15 viaturas policiais interceptoras em menos de 60 segundos usando colisões calculadas e a robustez do veículo.
   - *Recompensa:* +$4.000.

7. **🚛 Caminhão Cegonha & Saltos Acrobáticos (Car Hauler)**:
   - *Objetivo 1:* Use a rampa inclinada do caminhão cegonha em movimento para catapultar seu carro e realizar 3 saltos acrobáticos.
   - *Objetivo 2:* Dirija a cegonha e recolha 5 carros enguiçados espalhados pela cidade.
   - *Recompensa:* +$1.200 a +$4.000.

8. **🦍 Chefão King Kong (King Kong Boss Battle)**:
   - *Objetivo:* O lendário gorila gigante invadiu o arranha-céu da praça central! Ataque o chefão do solo ou use o avião bimotor para derrubá-lo da torre.
   - *Recompensa:* +$5.000.

9. **🚜 Monster Truck Esmagador (Monster Crush)**:
   - *Objetivo:* Suba na suspensão elevada do Monster Truck e esmague 10 carros civis ou policiais pelas avenidas.
   - *Recompensa:* +$3.500.

10. **⛽ Caminhão Tanque de Combustível (Fuel Tanker Delivery)**:
    - *Objetivo:* Transporte com máxima cautela uma carga pesada e volátil de combustível inflamável até o posto da cidade, desviando do trânsito intenso.
    - *Recompensa:* +$2.500.

11. **🚌 Ônibus Urbano (City Bus Commuters)**:
    - *Objetivo:* Estacione nos pontos de ônibus designados pela cidade e realize o embarque de 10 passageiros.
    - *Recompensa:* +$3.000.

12. **✈️ Ás dos Ares (Aerial Ace)**:
    - *Objetivo:* Decole com o avião bimotor e atravesse em sequência 7 anéis dourados flutuantes sobre os prédios da cidade.
    - *Recompensa:* +$1.000.

13. **🎯 Contratos Clássicos de Trânsito & Fuga**:
    - Distância percorrida (350m e 900m).
    - Fichas de dinheiro coletadas no asfalto (4x e 9x).
    - Sobrevivência à perseguição policial (45s e 100s).
    - Elevação do nível de procurado (Nível 3 e Nível 6).
    - Raspões em alta velocidade com viaturas (Close Calls).

---

### 👤 Perfil do Piloto & Salvamento em Nuvem (Auth Modal)
O jogo possui arquitetura resiliente com banco local (`src/db/users.ts`) e sincronização transparente com o **Firebase Firestore**:
- **Modo Anônimo / Visitante:** Jogue instantaneamente sem login com persistência local e telemetria offline.
- **Login com Google & Google Play Games:** Salva e sincroniza níveis de piloto, pontos de experiência (XP), saldo em dinheiro, recorde de distância e histórico de contratos concluídos entre diferentes dispositivos.
- **Sincronização Offline-First:** Se a internet oscilar ou o dispositivo estiver offline, todas as alterações ficam protegidas no banco local e são sincronizadas automaticamente com o Firestore assim que a conexão retornar.

---

### 🎮 Controles

#### Computador (Teclado e Mouse)
- `W` / `S` ou `Setas Cima / Baixo`: Acelerar / Marcha ré e freio
- `A` / `D` ou `Setas Esquerda / Direita`: Virar à esquerda / direita
- `Espaço`: Freio de mão
- `E`: Entrar / Sair do veículo ou avião
- `C`: Alternar modo de câmera (Perseguição / Próxima / Topo)
- `M`: Abrir / Fechar mapa tático da cidade
- `P` ou `ESC`: Pausar jogo

#### Dispositivos Móveis (Android / Touchscreen)
- **Modo Joystick Redondo:** Controle analógico virtual com indicador direcional e 4 setas.
- **Modo Sensor de Inclinação (Giroscópio):** Incline o celular para os lados para esterçar o veículo realisticamente.
- **Modo Toque Esquerda / Direita:** Zonas de toque nas laterais da tela para curvas imediatas.
- **Botão Turbo / Nitro:** Impulso de velocidade momentâneo.
- **Botão Auto-Aceleração:** Permite acelerar automaticamente sem precisar segurar o pedal.

---

### ⚙️ Opções Gráficas
Ajustável para rodar em dispositivos móveis básicos até PCs gamer com GPU dedicada:
- **Baixa (Low):** Low Poly ultra leve, sem sombras projetadas e sem névoa.
- **Média (Medium):** Greeble clássico com voxels detalhados e sombras básicas.
- **Alta (High):** Greeble High Poly com Geometry Merging, Instanced Mesh e Oclusão Ambiental (SSAO).
- **Ultra ⚡:** Iluminação PBR HD, Neon Bloom, Oclusão SSAO nos cantos dos blocos e Path Tracing em tempo real.

---

### 🛠️ Comandos de Desenvolvimento (Web)

```bash
# 1. Instalar dependências
npm install

# 2. Executar servidor de desenvolvimento (Porta 3000)
npm run dev

# 3. Compilar versão de produção
npm run build
```

---

### 📱 Compilação do APK Android via PowerShell (Sem Android Studio)

Para gerar o arquivo `.apk` diretamente pelo terminal PowerShell do Windows:

1. **Compilar os arquivos Web do projeto:**
   ```powershell
   npm run build
   ```

2. **Sincronizar os recursos compilados com a pasta nativa do Android:**
   ```powershell
   npx cap sync
   ```

3. **Gerar o APK de Instalação via Gradle:**
   - **Opção 1: APK de Release (Otimizado e Assinado para Instalação Direta):**
     ```powershell
     cd android
     .\gradlew assembleRelease
     ```
     Arquivo gerado em: `android\app\build\outputs\apk\release\MWC-v1.0-release.apk`
   
   - **Opção 2: APK de Debug (Desenvolvimento):**
     ```powershell
     cd android
     .\gradlew assembleDebug
     ```
     Arquivo gerado em: `android\app\build\outputs\apk\debug\MWC-v1.0-debug.apk`

> **Nota sobre o erro "Pacote parece inválido / Falha ao ler metadados":** 
> O Android exige que todos os APKs de release possuam assinatura digital (v1/v2/v3). O arquivo `android/app/build.gradle` já vem configurado com `signingConfig signingConfigs.debug` no bloco de release para permitir a instalação imediata em qualquer aparelho sem necessidade de criar keystores manuais para testes. Caso já tenha uma versão anterior instalada no smartphone, desinstale-a antes de instalar a nova.

---
---

## 🇺🇸 English Version

**Most Wanted Car: District 01** is a fast-paced 3D open-world vehicle pursuit game developed with **React**, **Three.js**, and **Vite**, featuring native **Android export support via Capacitor**.

Drive supercars, monster trucks, city buses, car haulers, twin-engine planes, and transforming robots across a procedural voxel city packed with dynamic traffic, relentless police pursuits, and high-stakes missions!

---

### 🌐 Supported Languages (Game Language)
The game provides full in-game translations across 4 languages, selectable anytime in **Settings**:
- 🇧🇷 **Português** (Portuguese)
- 🇺🇸 **English**
- 🇷🇺 **Русский** (Russian)
- 🇨🇳 **中文** (Chinese)

All HUD panels, contracts, telemetry, wanted level meters, victory banners, and the **Pilot Profile Modal** adapt seamlessly to the active language.

---

### 🎯 Missions & Urban Contracts

1. **🏁 Time Trial**:
   - *Objective:* A neon arch awaits on a city street. Driving through the starting arch triggers a countdown timer and a holographic route guideline on the asphalt. Speed through normal city traffic and cross all 3 sequential neon arches before time runs out!
   - *Reward:* +$7,500 | +Pilot XP.

2. **🧟 Survival Arena (Zombie Arena)**:
   - *Objective:* Located in the western desert wasteland. Survive waves of zombies, mutant fiends, and titan bosses in Easy Mode (4 waves) or Hard Mode (10 waves with fire-breathing zombies and meteor showers), picking up weapons (Shotgun, SMG, Plasma) and medkits.
   - *Reward:* +$8,000 to +$20,000 | Arena Victory.

3. **🏁 Dune Rally (Electric Circuit)**:
   - *Objective:* Located in the eastern desert. A high-speed off-road oval circuit with extreme jumps and a **360° stunt loop**. Race against skilled AI drivers and finish in 1st or 2nd place!
   - *Reward:* +$6,000 | Rally Victory.

4. **🚕 Crazy Taxi**:
   - *Objective:* Pick up 3 radical passengers around the city and perform stunt jumps to safely deliver them to their destinations.
   - *Reward:* +$3,500.

5. **💣 Speed Bomb**:
   - *Objective:* Take the wheel of a bomb-rigged vehicle. Maintain your speed strictly above 75 km/h for 45 continuous seconds to prevent detonation!
   - *Reward:* +$5,000.

6. **💥 Rampage Mode**:
   - *Objective:* Smash and destroy 15 police pursuit cars within 60 seconds using calculated high-impact rams.
   - *Reward:* +$4,000.

7. **🚛 Car Hauler Stunts & Vehicle Recovery**:
   - *Objective 1:* Hit the rear ramp of the moving car hauler truck to launch your car in 3 radical aerial jumps.
   - *Objective 2:* Drive the car hauler to collect 5 stranded cars around town.
   - *Reward:* +$1,200 to +$4,000.

8. **🦍 King Kong Boss Battle**:
   - *Objective:* The colossal ape has scaled the skyscraper in the central plaza! Attack from the ground or dogfight in the twin-engine plane to knock the boss down.
   - *Reward:* +$5,000.

9. **🚜 Monster Truck Crush**:
   - *Objective:* Pilot the massive lifted Monster Truck and crush 10 civilian and police cars beneath your giant tires.
   - *Reward:* +$3,500.

10. **⛽ Flammable Fuel Tanker Delivery**:
    - *Objective:* Safely haul a heavy, volatile fuel tank trailer through dense city traffic to the fuel depot without catastrophic impacts.
    - *Reward:* +$2,500.

11. **🚌 City Bus Commuters**:
    - *Objective:* Stop at designated bus stations and board 10 commuters along the route.
    - *Reward:* +$3,000.

12. **✈️ Aerial Ace (Flying Rings)**:
    - *Objective:* Take flight with the twin-engine plane and navigate through 7 golden rings floating in the skyline.
    - *Reward:* +$1,000.

13. **🎯 Classic Pursuit Contracts**:
    - Distance goals (350m & 900m).
    - Coin pickup challenges (4x & 9x).
    - Police evasion survival (45s & 100s).
    - Wanted level milestones (Heat 3 & Heat 6).
    - High-speed close calls with patrol cruisers.

---

### 👤 Pilot Profile & Cloud Persistence
Features an offline-first architecture powered by `src/db/users.ts` with transparent **Firebase Firestore** sync:
- **Guest / Anonymous Mode:** Instant jump-in without credentials, tracking offline stats and progression locally.
- **Google & Play Games Authentication:** Saves and synchronizes pilot level, XP, cash, high scores, and contracts across devices.
- **Offline-First Resilience:** If connectivity is lost, progress is safely cached and automatically dispatched to Firestore once reconnected.

---

### 🎮 Controls

#### Desktop (Keyboard & Mouse)
- `W` / `S` or `Up / Down Arrows`: Accelerate / Reverse & Brake
- `A` / `D` or `Left / Right Arrows`: Steer Left / Right
- `Space`: Handbrake
- `E`: Enter / Exit vehicle or airplane
- `C`: Cycle camera perspective (Chase / Near / Overhead)
- `M`: Open / Close tactical city map
- `P` or `ESC`: Pause game

#### Mobile / Touchscreen
- **Round Joystick Mode:** Virtual 4-arrow analog control pad.
- **Tilt Sensor Mode (Gyroscope):** Tilt phone to steer naturally.
- **Touch Left / Right Mode:** Tap left/right edges for instant turns.
- **Auto-Acceleration Toggle:** Enables hands-free throttling.
- **Nitro / Boost Button:** Instant speed burst.

---

### ⚙️ Graphics Modes
- **Low:** Optimized Low Poly without shadows or fog for maximum battery life.
- **Medium:** Classic Greeble voxels with standard lighting.
- **High:** High Poly Greeble with Geometry Merging, Instanced Mesh, and SSAO.
- **Ultra ⚡:** HD PBR lighting, Neon Bloom, SSAO corner occlusion, and real-time Path Tracing.

---

### 🛠️ Build & Development Commands

```bash
# 1. Install dependencies
npm install

# 2. Start local dev server (Port 3000)
npm run dev

# 3. Compile web bundle for production
npm run build
```

---

### 📱 Android APK Build via PowerShell (Without Android Studio)

To build the debug `.apk` directly from PowerShell:

1. **Build web assets:**
   ```powershell
   npm run build
   ```

2. **Sync assets into native Android container:**
   ```powershell
   npx cap sync
   ```

3. **Assemble the Installation APK with Gradle:**
   - **Option 1: Release APK (Optimized and Signed for Direct Installation):**
     ```powershell
     cd android
     .\gradlew assembleRelease
     ```
     Generated at: `android\app\build\outputs\apk\release\MWC-v1.0-release.apk`

   - **Option 2: Debug APK (Development):**
     ```powershell
     cd android
     .\gradlew assembleDebug
     ```
     Generated at: `android\app\build\outputs\apk\debug\MWC-v1.0-debug.apk`

> **Note on "Invalid Package / Failed to read metadata from base.apk" Error:**
> Android strictly requires all release APK packages to be digitally signed with v1/v2/v3 signing schemes. The project's `android/app/build.gradle` is pre-configured with `signingConfig signingConfigs.debug` on the release block to enable immediate installation on any physical device for testing without needing manual keystores. If an older version of the app is already installed on the phone, uninstall it first to avoid signature collision errors.
