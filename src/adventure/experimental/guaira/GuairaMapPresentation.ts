import { GUAIRA_DESTINATIONS, type GuairaMapModel } from './GuairaMapModel';

/** Visit summaries change guidance only. They never unlock or restore gameplay. */
export function guairaMapPresentation(model: GuairaMapModel) {
    if (model.selected === 'bairro') {
        return { title: 'Bairro da Vala Seca',
            description: 'A Galeria dos Remendos é um percurso opcional sob o bairro. Entre ao chegar.',
            status: model.moving ? 'Feka está a caminho do Bairro da Vala Seca.'
                : 'Feka está no bairro. Galeria inicia o percurso opcional; os destinos continuam pela estrada.',
            action: 'GALERIA', actionName: 'Entrar na Galeria dos Remendos: percurso opcional no Bairro da Vala Seca' };
    }
    if (model.selected) {
        const destination = GUAIRA_DESTINATIONS[model.selected];
        return { title: destination.title, description: model.canEnterJunction
                ? 'Travessia segue ao arrozal. Desvios oferece Pátio, um percurso opcional, e a caminhada ao bairro.' : destination.description,
            status: model.moving ? `Feka está a caminho de ${model.selected === 'subida' ? 'seu embarque no curral' : destination.title}.`
                : model.returnContext === 'bull-clear' ? 'Ossabravo descansou nesta visita. Subir leva à Casa da Vazão.'
                : model.selected === 'subida' ? 'Feka está no curral. Subir inicia a subida à Casa da Vazão.'
                : model.canEnterJunction ? 'Jogar inicia a Travessia. Desvios abre as opções de Pátio e Bairro.'
                : 'Feka chegou. Entre para jogar.',
            action: destination.action, actionName: `Entrar: ${destination.title}` };
    }
    if (model.arrival === 'rice') {
        const cleared = model.returnContext === 'traversal-clear';
        return { title: 'Passarela dos Arrozais',
            description: 'Curral segue pela estrada. Respiros testa uma passagem de água pressurizada, opcional.',
            status: model.returnContext === 'respiros-clear' ? 'Passagem dos Respiros concluída nesta visita. Curral continua pela estrada.'
                : model.returnContext === 'junction-clear' ? 'Pátio concluído. Curral pela estrada; Respiros é opcional.'
                : cleared ? 'Travessia concluída. Curral pela estrada; Respiros é opcional.'
                : 'Curral segue pela estrada. Respiros é um desvio opcional.',
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
