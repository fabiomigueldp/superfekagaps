import { VoiceManifest } from './VoiceManifest';

const BASE_PATH = '/assets/audio/vo/joaozao';

export const JOAOZAO_VOICE_MANIFEST: VoiceManifest = {
  id: 'joaozao',
  voiceLines: {
    aqui_e_o_joao_namorado_da_yasmin: {
      id: 'aqui_e_o_joao_namorado_da_yasmin',
      text: 'Aqui é o João, namorado da Yasmin.',
      audioUrl: `${BASE_PATH}/aqui_e_o_joao_namorado_da_yasmin_1.92s.ogg`,
      expectedDurationSec: 1.92,
      tags: ['first_seen']
    },
    eu_sou_o_namorado_dela: {
      id: 'eu_sou_o_namorado_dela',
      text: 'Eu sou o namorado dela.',
      audioUrl: `${BASE_PATH}/eu_sou_o_namorado_dela_1.14s.ogg`,
      expectedDurationSec: 1.14,
      tags: ['ambient']
    },
    para_de_encher_o_saco: {
      id: 'para_de_encher_o_saco',
      text: 'Para de encher o saco.',
      audioUrl: `${BASE_PATH}/para_de_encher_o_saco_0.96s.ogg`,
      expectedDurationSec: 0.96,
      tags: ['hit_react']
    },
    porra_nenhuma: {
      id: 'porra_nenhuma',
      text: 'Porra nenhuma.',
      audioUrl: `${BASE_PATH}/porra_nenhuma_0.36s.ogg`,
      expectedDurationSec: 0.36,
      tags: ['hit_react']
    },
    sei_que_voce_quer: {
      id: 'sei_que_voce_quer',
      text: 'Sei que você quer',
      audioUrl: `${BASE_PATH}/sei_que_voce_quer_0.66s.ogg`,
      expectedDurationSec: 0.66,
      tags: ['ambient']
    },
    voce_nao_vai_ter: {
      id: 'voce_nao_vai_ter',
      text: 'Você não vai ter!',
      audioUrl: `${BASE_PATH}/voce_nao_vai_ter_0.66s.ogg`,
      expectedDurationSec: 0.66,
      allowImmediateRepeat: true,
      immediateRepeatChance: 0.22,
      immediateRepeatGapMs: 250,
      tags: ['ambient']
    }
  },
  sequences: {
    quer_nao_vai_ter_combo: {
      id: 'quer_nao_vai_ter_combo',
      steps: ['sei_que_voce_quer', 'voce_nao_vai_ter'],
      weight: 100,
      allowEncoreLastStep: true,
      encoreChance: 0.12,
      encoreGapMs: 220
    }
  },
  groups: {
    onFirstSeen: {
      id: 'OnFirstSeen',
      priority: 100,
      lineId: 'aqui_e_o_joao_namorado_da_yasmin',
      bypassGlobalCooldown: true
    },
    onHitReact: {
      id: 'OnHitReact',
      priority: 70,
      cooldownMs: 1400,
      chance: 0.55,
      entries: [
        { id: 'porra_nenhuma', weight: 60 },
        { id: 'para_de_encher_o_saco', weight: 40 }
      ]
    },
    ambient: {
      id: 'AmbientTaunts',
      priority: 30,
      tickMinMs: 4800,
      tickMaxMs: 8500,
      speakChance: 0.85,
      minStartCooldownMs: 3500,
      comboChance: 0.28,
      lineEntries: [
        { id: 'eu_sou_o_namorado_dela', weight: 30 },
        { id: 'sei_que_voce_quer', weight: 25 },
        { id: 'voce_nao_vai_ter', weight: 45 }
      ],
      sequenceEntries: [
        { id: 'quer_nao_vai_ter_combo', weight: 100 }
      ]
    }
  },
  config: {
    globalCooldownMs: 350,
    comboGapMs: 0,
    durationWarningThresholdSec: 0.15
  }
};
