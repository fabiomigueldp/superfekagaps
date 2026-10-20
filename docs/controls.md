# Controles

Clássico, World, Hipotético, salão da fábrica, Guaíra e Delícia usam a mesma configuração de teclado e dispositivo. Os controles preservam a física, o salto variável, o buffer de pulo e os custos/regras de cada campanha.

## Padrão Xbox / ROG Ally em Gamepad Mode

| Ação | Controle | Teclado |
| --- | --- | --- |
| Mover | Analógico esquerdo / direcional | A/D ou ←/→ |
| Pular | A | Espaço, W, Z ou ↑ |
| Correr | X ou RT, segurando | Shift ou X |
| Sentada no ar | LB, ↓ ou analógico para baixo | S ou ↓ |
| Semente na Delícia | B | J |
| Rebater na Delícia | Y ou LT | Q |
| Interagir, incluindo entrar no salão | RB | E |
| Pausar | Menu | Esc |
| Controles | View | F1 |
| Som | Opção de som existente | M |

Menus: direcional/analógico escolhe, A confirma, B volta. X abre regiões e Y alterna a visão geral no mapa World. O analógico direito rola referências e painéis DOM. As letras acima descrevem o perfil padrão; os rótulos no guia acompanham os mapeamentos atuais e a família Xbox, PlayStation ou Nintendo identificada.

Em **Controles → Ajustar controles**, escolha teclado ou um gamepad conectado para alterar ações, zona morta, limiar de gatilhos e vibração. O botão de vínculo inicia a captura. Esc cancela; em um controle padrão, Menu + View também cancela. A captura termina após 15 segundos, ao perder foco ou desconectar. Alterar um comando troca um vínculo conflitante no mesmo contexto, mantendo os comandos de menu separados dos de jogo. Restaurar padrão se aplica ao dispositivo escolhido.

## Dispositivos e interrupções

- O primeiro controle que recebe atividade assume a sessão. Um controle integrado parado não recebe prioridade sobre um externo usado pelo jogador. A seleção explícita nas configurações muda o controle ativo.
- O índice e a identidade são preservados durante a sessão, inclusive entre capítulos carregados sob demanda. Desconectar durante jogo pausa. Reconectar não continua sozinho; é necessário soltar os controles e escolher continuar.
- A reconexão em outro índice é aceita apenas se houver uma única identidade correspondente. Dois dispositivos idênticos não fornecem número de série público confiável; a seleção explícita resolve ambiguidades. Perfis são compartilhados por identidade/modelo.
- Dispositivos sem `mapping: standard` precisam configurar eixos e botões. Não presumimos um layout de Xbox. O jogo continua acessível por teclado e toque para fazer essa configuração.
- Zona morta e histerese evitam alternância perto do limiar. A sentada no analógico exige inclinação maior que o movimento lateral. O direcional prevalece sobre o analógico horizontal.
- Perda de foco, aba oculta, troca de tela e encerramento limpam os donos dos comandos. Um A segurado não confirma sucessivas telas nem salta ao fechar um menu.
- O teclado usa códigos físicos e preserva apertos breves entre passos. Atalhos do navegador e campos de edição mantêm seu funcionamento. Esc continua disponível para voltar mesmo com a pausa remapeada.
- Toque conserva donos independentes por dedo, incluindo correr + pular. Na Delícia, deslizar para outro botão troca a ação; cancelamento e rotação descartam contatos antigos.
- Vibração é curta e opcional em impactos suportados. Ausência ou recusa do atuador não afeta os comandos.

Preferências ficam em `super_feka_gaps_controls_v1`, separadas dos saves. Falha de armazenamento mantém a configuração na sessão e mostra o motivo. Não há gravação de identificadores em servidor.

## Arquitetura

- `engine/ControlPreferences.ts`: ações, perfis, rótulos e persistência.
- `engine/GamepadDevice.ts`: dispositivo ativo, amostragem, limiares, transições, repetição e vibração.
- `engine/StandardGamepad.ts`: adaptação para donos de `Input`, sem eventos de teclado simulados.
- `engine/ControlSettings.ts`: edição progressiva na ajuda existente.
- `engine/DomGamepadMenu.ts`: foco espacial, seletores, sliders, rolagem e teclado de nomes sob demanda.
- `WorldControlsHelp`: referência dos comandos atuais e configurações, compartilhada pelos hosts.
- `StandaloneControls`: adaptação das rotas antigas aos botões de pausa já existentes.

World mantém seu relógio de simulação. Delícia adapta as mesmas ações aos seus equipamentos e menus. Apenas vistas compostas exclusivamente de DOM usam um poller próprio, descartado com a vista. Laboratórios com telas finais especiais encaminham os mesmos comandos também após a conclusão.

## Limites e publicação

A API web depende do sistema, navegador e modo do controle. No ROG Ally, use Gamepad Mode no Armoury Crate; Desktop Mode emula teclado/mouse. M1/M2 seguem o mapeamento do sistema. Fullscreen, áudio e seleção de arquivos continuam sujeitos às regras de ativação do navegador. Importação de arquivos pode exigir teclado ou toque. Editores de fases não são interfaces de jogo por controle.

Referências: [Gamepad API](https://www.w3.org/TR/gamepad/), [modos de controle do ROG Ally](https://www.asus.com/br/support/faq/1050220/).

A publicação segue `AGENTS.md`: somente build Vite de produção e publicação pelo script Oracle. Não são executados suíte de testes, typecheck ou revisão em navegador. Compatibilidade implementada não significa validação física com cada modelo, USB, Bluetooth ou dispositivo portátil.
