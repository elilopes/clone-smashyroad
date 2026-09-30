# Smash City — Wanted District

Protótipo jogável de perseguição veicular em HTML5, TypeScript e Three.js. A cidade é gerada em blocos ao redor do carro e se estende enquanto a corrida continua.

## Executar

```bash
npm install
npm run dev
```

## Controles

- **W / ↑** acelera; **S / ↓** dá ré ou freia.
- **A / ←** vira à esquerda; **D / →** vira à direita.
- **Espaço** aciona o freio de mão.
- **C** alterna entre a câmera traseira 3D e a visão três quartos 2,5D; também há um botão no HUD.
- Em telas sensíveis ao toque, use os controles na parte inferior da tela.

## Sistemas

- `src/game/Car.ts`: modelo 3D, aceleração, direção e colisões do veículo.
- `src/game/City.ts`: ruas, quadras, edifícios e fichas gerados proceduralmente.
- `src/game/Pedestrians.ts`: pedestres em movimento, esquiva lateral com salto e colisões com o carro.
- `src/game/WantedSystem.ts` e `src/game/Pursuit.ts`: calor policial, dez níveis, patrulhas e risco de detenção.
- `src/game/Missions.ts`: contratos de distância, sobrevivência, coleta, fuga e nível de procurado.
- `src/game/Game.ts`: cena Three.js, câmera, HUD, corrida e persistência local de dinheiro e recorde.
- `src/game/Input.ts` e `src/game/Sound.ts`: controles de teclado/toque e áudio sintetizado.
