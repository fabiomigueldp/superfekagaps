import { GUAIRA_DESTINATIONS, type GuairaMapModel } from './GuairaMapModel';

/** Visit summaries change guidance only. They never unlock or restore gameplay. */
export function guairaMapPresentation(model: GuairaMapModel) {
    if (model.selected) {
        const destination = GUAIRA_DESTINATIONS[model.selected];
        return { title: destination.title, description: model.canEnterJunction
                ? 'Travessia segue ao arrozal. Pátio oferece outro percurso de água, opcional.' : destination.description,
            status: model.moving ? `Feka está a caminho de ${model.selected === 'subida' ? 'seu embarque no curral' : destination.title}.`
                : model.returnContext === 'bull-clear' ? 'Ossabravo descansou nesta visita. Subir leva à Casa da Vazão.'
                : model.selected === 'subida' ? 'Feka está no curral. Subir inicia a subida à Casa da Vazão.'
                : model.canEnterJunction ? 'Jogar inicia a Travessia. Pátio testa o desvio entre dois ramais.'
                : 'Feka chegou. Entre para jogar.',
            action: destination.action, actionName: `Entrar: ${destination.title}` };
    }
    if (model.arrival === 'rice') {
        const cleared = model.returnContext === 'traversal-clear';
        return { title: 'Passarela dos Arrozais',
            description: 'O curral fica adiante. Reentrar na Travessia começa outra tentativa.',
            status: model.returnContext === 'junction-clear' ? 'Pátio concluído. Curral continua pela estrada; entre na arena ao chegar.'
                : cleared ? 'Travessia concluída. Curral continua pela estrada; entre na arena ao chegar.'
                : 'Feka está nos arrozais. Curral continua pela estrada; entre na arena ao chegar.',
            action: 'CURRAL', actionName: 'Caminhar até o Curral da Comporta' };
    }
    const released = model.returnContext === 'mayor-clear';
    return { title: 'Casa da Vazão',
        description: released ? 'A água voltou. Os gaps continuam. Repetir inicia uma nova luta.'
            : 'O ramal do bairro está fechado. Prefeito oferece o próximo encontro opcional.',
        status: released ? 'Vitória nesta visita. Voltar segue ao curral; Repetir recomeça o Prefeito.'
            : model.returnContext === 'ascent-clear' ? 'Subida concluída. Prefeito testa a reabertura da água do bairro.'
            : 'Feka está na Casa. Prefeito inicia o encontro; Voltar segue ao curral.',
        action: released ? 'REPETIR' : 'PREFEITO',
        actionName: released ? 'Repetir o encontro do Prefeito em uma nova tentativa'
            : 'Enfrentar o Prefeito: experimento opcional na Casa da Vazão' };
}
