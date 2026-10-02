# Integração do áudio pré-produzido

O carregador foi integrado ao `WorldAudio`. O catálogo
[`ArcadeAudioPack.ts`](../../src/adventure/ArcadeAudioPack.ts) está vazio porque
os arquivos gerados ainda não chegaram. Portanto, esta revisão **não troca o
som que o jogador ouve** e não faz pedidos para arquivos fictícios. O usuário
autorizou preencher esse catálogo e publicar a branch após receber o material.

## Comportamento preparado

- `WorldGame.load` informa `stage.id` ao selecionar o som. É a única linha
  alterada fora dos módulos de áudio. Seleções antigas de mapa/campanha e bosses
  sem uma cena cadastrada continuam com a trilha procedural.
- `WorldSampleAudio` busca apenas arquivos públicos locais, depois que há um
  AudioContext desbloqueado e em execução. Não há geração, chave ou SDK de provedor.
- O sequenciador atual toca durante carregamento ou falha. A música gravada só
  o substitui depois da decodificação e validação dos limites de loop. Nesse
  momento as notas antigas são encerradas para não tocar duas trilhas juntas.
- Efeito que não esteja pronto cai no som procedural imediatamente. Conclusão
  assíncrona nunca toca aquele efeito atrasado. A/B alternam deterministicamente,
  sem usar o RNG do gameplay. São no máximo seis vozes; repetição do mesmo cue
  cancela a anterior. Fades curtos evitam cortes secos nos arquivos entregues.
- Música e efeitos usam os buses e preferências existentes. Pausa congela a
  música no AudioContext; efeitos antigos são cancelados. Mute/efeitos em zero,
  mudança de cena e dispose não deixam one-shots pendentes. Dispose aborta fetches,
  limpa buffers e desconecta fontes. Uma falha de arquivo não dispara retries
  a cada frame.

Os oito testes novos em
[`world-sample-audio.test.ts`](../../tests/world-sample-audio.test.ts) cobrem
fallback, variantes, loops, atraso de rede, descarte por cena/dispose, falhas de
arquivo/decoder, mute/pausa e a ligação real com `WorldAudio`. Os buffers dos
testes são objetos simulados; nenhum áudio fictício foi colocado em `public/`.

## Preencher somente após receber os assets

1. Receber SHA exato da branch de assets e verificar cada hash do manifesto.
   Importar apenas `audio-deliveries/sfg-arcade-r2/`, preservando originais fora
   de `public`. Não aplicar pacotes de gameplay junto com a entrega sonora.
2. Medir formato, duração, pico, loudness e silêncio de ataque. Registrar audição,
   seleção e cortes. Originais MP3 continuam identificados como originais com
   perdas; conversão para WAV não cria um master lossless da geração.
3. Produzir derivados de música e efeitos, registrar hashes e edição. Cadastrar
   caminhos realmente existentes, ganho e limites de loop medidos no buffer
   decodificado. O campo `maxSeconds` pode limitar cauda de um efeito, mas não
   deve compensar ataque atrasado: corrigir o arquivo antes.
4. Selecionar cenas explícitas de Guaíra para a música. Salto, aviso, pressão e
   descarga devem seguir os eventos existentes. Água e suco são ambientes:
   aguardam fonte/estado aceito por cena e cancelamento correspondente. **Não**
   cadastrá-los como one-shots genéricos nem ligá-los globalmente por revisita.
   A intro Turbosuco e seus cues procedurais não foram alterados.
5. Calibrar ganhos sobre os multiplicadores atuais (música `.14`, efeitos `.3`).
   Confirmar em audição; esses fatores vieram do sintetizador e não garantem um
   mix adequado para gravações. Testar loops reais, mute, sliders, pausa, retorno,
   morte e dez mudanças rápidas de cena. Executar `npm run check` e size budget.

Medição e testes de código não substituem audição. A transição atual encerra a
faixa anterior e aplica fade-in curto na nova; crossfade musical longo não foi
implantado. Não há ducking adicional ou nova persistência de preferências.

## Coordenação com trabalho paralelo

Base disponível: `bc431d5`. O integrador do root foi informado como `ab942fee`,
ainda não publicado/disponível aqui. A alteração de `WorldGame` é somente a
passagem do ID de cena; os outros arquivos novos/alterados pertencem ao áudio,
testes e documentação. Conferir a mesma linha e o lifecycle de `WorldAudio`
quando o integrador disponibilizar o commit. Nenhum merge em main, deploy ou
trabalho Oracle foi feito.
