import {
  aconteceEm,
  dataParaIso,
  diaMes,
  diasDaTarefa,
  esteveNaEtapa,
  hojeISO,
  isoParaBR,
  isoParaData,
  rotuloDaSemana,
  rotuloDoDia,
  segundaDa,
} from './datas';

describe('datas', () => {
  // o bug que esta regra evita: new Date('2026-09-10') no Brasil vira dia 9
  it('ida e volta de aaaa-mm-dd não escorrega o dia', () => {
    for (const iso of ['2026-01-01', '2026-02-28', '2026-09-10', '2026-12-31']) {
      expect(dataParaIso(isoParaData(iso))).toBe(iso);
    }
  });

  it('acha a segunda-feira da semana, inclusive a partir do domingo', () => {
    expect(dataParaIso(segundaDa(isoParaData('2026-09-07')))).toBe('2026-09-07');
    expect(dataParaIso(segundaDa(isoParaData('2026-09-10')))).toBe('2026-09-07');
    expect(dataParaIso(segundaDa(isoParaData('2026-09-13')))).toBe('2026-09-07');
  });

  // depois das 21h no Brasil, toISOString() já devolve o dia seguinte
  it('hoje é a data local do aparelho, não a de UTC', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 8, 10, 23, 30));

    try {
      expect(hojeISO()).toBe('2026-09-10');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('rótulo da semana dentro de um mês e virando o mês', () => {
    expect(rotuloDaSemana(isoParaData('2026-09-07'), isoParaData('2026-09-13'))).toBe(
      '7 a 13 de setembro',
    );
    expect(rotuloDaSemana(isoParaData('2026-09-28'), isoParaData('2026-10-04'))).toBe(
      '28 de setembro a 4 de outubro',
    );
  });

  it('rótulo do dia por extenso', () => {
    expect(rotuloDoDia('2026-09-11')).toBe('sexta, 11 de setembro de 2026');
  });

  it('formata sem passar por Date', () => {
    expect(isoParaBR('2026-09-10')).toBe('10/09/2026');
    expect(isoParaBR('')).toBe('');
    expect(diaMes('2026-09-10')).toBe('10/09');
  });

  describe('em que dias a tarefa acontece', () => {
    const semana = { dataInicio: '2026-09-07', dataFim: '2026-09-11', diasPulados: ['2026-09-09'] };

    it('sem fim, só o dia do início', () => {
      const umDia = { dataInicio: '2026-09-07', dataFim: '', diasPulados: [] };

      expect(aconteceEm(umDia, '2026-09-07')).toBeTrue();
      expect(aconteceEm(umDia, '2026-09-08')).toBeFalse();
    });

    it('o dia pulado e o que está fora do intervalo ficam de fora', () => {
      expect(aconteceEm(semana, '2026-09-09')).toBeFalse();
      expect(aconteceEm(semana, '2026-09-06')).toBeFalse();
      expect(aconteceEm(semana, '2026-09-12')).toBeFalse();
      expect(aconteceEm(semana, '2026-09-10')).toBeTrue();
    });

    it('lista os dias em ordem, sem o pulado', () => {
      expect(diasDaTarefa(semana)).toEqual([
        '2026-09-07',
        '2026-09-08',
        '2026-09-10',
        '2026-09-11',
      ]);
    });

    it('sem início, não acontece em dia nenhum', () => {
      const semData = { dataInicio: '', dataFim: '', diasPulados: [] };

      expect(diasDaTarefa(semData)).toEqual([]);
      expect(aconteceEm(semData, '2026-09-07')).toBeFalse();
    });
  });

  describe('em que dias esteve numa etapa', () => {
    const HOJE = '2026-09-14';

    // foi para Fazendo na terça e para Feito na quinta
    const estudo = {
      historicoEtapas: [
        { etapa: 'A fazer' as const, data: '2026-09-07' },
        { etapa: 'Fazendo' as const, data: '2026-09-08' },
        { etapa: 'Feito' as const, data: '2026-09-10' },
      ],
    };

    it('conta do dia em que entrou ao dia em que saiu, os dois inclusive', () => {
      const dias = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'];

      expect(dias.map((iso) => esteveNaEtapa(estudo, 'Fazendo', iso, HOJE))).toEqual([
        false,
        true,
        true,
        true,
        false,
      ]);
    });

    it('a etapa em que está agora vale até hoje e não adiante', () => {
      const fazendo = { historicoEtapas: [{ etapa: 'Fazendo' as const, data: '2026-09-11' }] };

      expect(esteveNaEtapa(fazendo, 'Fazendo', '2026-09-10', HOJE)).toBeFalse();
      expect(esteveNaEtapa(fazendo, 'Fazendo', HOJE, HOJE)).toBeTrue();
      expect(esteveNaEtapa(fazendo, 'Fazendo', '2026-09-15', HOJE)).toBeFalse();
    });

    it('voltar para a etapa depois conta os dois períodos, e não o meio', () => {
      const idaEVolta = {
        historicoEtapas: [
          { etapa: 'Fazendo' as const, data: '2026-09-01' },
          { etapa: 'Travado' as const, data: '2026-09-02' },
          { etapa: 'Fazendo' as const, data: '2026-09-05' },
        ],
      };

      expect(esteveNaEtapa(idaEVolta, 'Fazendo', '2026-09-03', HOJE)).toBeFalse();
      expect(esteveNaEtapa(idaEVolta, 'Fazendo', '2026-09-06', HOJE)).toBeTrue();
    });

    it('sem histórico, não esteve em dia nenhum', () => {
      expect(esteveNaEtapa({ historicoEtapas: [] }, 'Fazendo', HOJE, HOJE)).toBeFalse();
    });
  });
});
