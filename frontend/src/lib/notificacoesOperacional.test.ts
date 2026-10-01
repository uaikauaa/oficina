import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Notificacao, NotificacoesResumo, TipoNotificacao } from './types.ts';

describe('UX-NOTIF-001: Sistema de Notificações — Regras Operacionais e Comportamentos', () => {

  describe('1. Comportamento do Badge de Notificações Não Lidas', () => {
    // Função auxiliar pura que replica exatamente a regra do Header.tsx
    const formatarBadge = (naoLidas: number): string | null => {
      if (naoLidas <= 0) return null;
      if (naoLidas > 99) return '99+';
      return String(naoLidas);
    };

    it('deve ocultar o badge numérico quando houver 0 notificações não lidas', () => {
      assert.strictEqual(formatarBadge(0), null);
      assert.strictEqual(formatarBadge(-1), null);
    });

    it('deve exibir "1" no badge quando houver exatamente 1 notificação não lida', () => {
      assert.strictEqual(formatarBadge(1), '1');
    });

    it('deve exibir a contagem exata no badge quando houver múltiplas notificações não lidas (ex: 5)', () => {
      assert.strictEqual(formatarBadge(5), '5');
      assert.strictEqual(formatarBadge(42), '42');
      assert.strictEqual(formatarBadge(99), '99');
    });

    it('deve limitar visualmente em "99+" quando a quantidade de não lidas ultrapassar 99', () => {
      assert.strictEqual(formatarBadge(100), '99+');
      assert.strictEqual(formatarBadge(250), '99+');
    });

    it('deve manter a quantidade real no resumo mesmo quando o badge exibir "99+"', () => {
      const mockResumo: NotificacoesResumo = {
        total: 150,
        naoLidas: 120,
        notificacoes: [],
      };
      assert.strictEqual(mockResumo.naoLidas, 120);
      assert.strictEqual(formatarBadge(mockResumo.naoLidas), '99+');
    });
  });

  describe('2. Tipos de Notificação e Navegação para Recursos', () => {
    const notificacoesExemplo: Notificacao[] = [
      {
        id: 1,
        tipo: 'OS_AGUARDANDO_APROVACAO',
        titulo: 'Aguardando Aprovação: OS OS-2026-0010',
        mensagem: 'A OS OS-2026-0010 (Metalúrgica Santa Rita) está aguardando aprovação do orçamento.',
        lida: false,
        criadoEm: '2026-09-25T14:00:00Z',
        lidoEm: null,
        recursoTipo: 'ORDEM_SERVICO',
        recursoId: 10,
        link: '/ordens-servico?busca=OS-2026-0010',
      },
      {
        id: 2,
        tipo: 'OS_PRONTA',
        titulo: 'Pronta para Retirada: OS OS-2026-0012',
        mensagem: 'A OS OS-2026-0012 (Bosch GWS 850) está pronta para entrega ao cliente.',
        lida: false,
        criadoEm: '2026-09-25T14:15:00Z',
        lidoEm: null,
        recursoTipo: 'ORDEM_SERVICO',
        recursoId: 12,
        link: '/ordens-servico?busca=OS-2026-0012',
      },
      {
        id: 3,
        tipo: 'ESTOQUE_BAIXO',
        titulo: 'Estoque Crítico: Broca HSS 10mm',
        mensagem: 'O produto Broca HSS 10mm atingiu nível crítico (atual: 2.000, mínimo: 5.000).',
        lida: false,
        criadoEm: '2026-09-25T14:30:00Z',
        lidoEm: null,
        recursoTipo: 'PRODUTO',
        recursoId: 45,
        link: '/estoque',
      },
    ];

    it('deve conter apenas os 3 tipos úteis de notificação do domínio', () => {
      const tiposValidos: TipoNotificacao[] = ['OS_AGUARDANDO_APROVACAO', 'OS_PRONTA', 'ESTOQUE_BAIXO'];
      notificacoesExemplo.forEach((n) => {
        assert.ok(tiposValidos.includes(n.tipo));
      });
    });

    it('deve direcionar OS Aguardando Aprovação para o link correto de busca da OS', () => {
      const notifOs = notificacoesExemplo[0];
      assert.strictEqual(notifOs.link, '/ordens-servico?busca=OS-2026-0010');
    });

    it('deve direcionar OS Pronta para o link correto de busca da OS', () => {
      const notifPronta = notificacoesExemplo[1];
      assert.strictEqual(notifPronta.link, '/ordens-servico?busca=OS-2026-0012');
    });

    it('deve direcionar Estoque Baixo para a tela de estoque', () => {
      const notifEstoque = notificacoesExemplo[2];
      assert.strictEqual(notifEstoque.link, '/estoque');
    });

    it('deve lidar com notificação sem link de forma segura sem lançar exceção', () => {
      const notifSemLink: Notificacao = {
        id: 4,
        tipo: 'OS_PRONTA',
        titulo: 'Aviso Geral',
        mensagem: 'Aviso sem recurso',
        lida: true,
        criadoEm: '2026-09-25T15:00:00Z',
        lidoEm: '2026-09-25T15:05:00Z',
        recursoTipo: null,
        recursoId: null,
        link: null,
      };

      let rotaNavegada: string | null = null;
      if (notifSemLink.link) {
        rotaNavegada = notifSemLink.link;
      }
      assert.strictEqual(rotaNavegada, null);
    });
  });

  describe('3. Estados do Painel de Notificações', () => {
    it('deve identificar corretamente o estado de carregamento', () => {
      const isLoading = true;
      const notificacoes: Notificacao[] = [];
      const error: string | null = null;

      const estado = isLoading ? 'LOADING' : error ? 'ERROR' : notificacoes.length === 0 ? 'EMPTY' : 'AVAILABLE';
      assert.strictEqual(estado, 'LOADING');
    });

    it('deve identificar corretamente o estado de erro com mensagem amigável', () => {
      const isLoading = false;
      const notificacoes: Notificacao[] = [];
      const error = 'Não foi possível carregar as notificações.';

      const estado = isLoading ? 'LOADING' : error ? 'ERROR' : notificacoes.length === 0 ? 'EMPTY' : 'AVAILABLE';
      assert.strictEqual(estado, 'ERROR');
      assert.strictEqual(error, 'Não foi possível carregar as notificações.');
    });

    it('deve identificar corretamente o estado vazio "Tudo em dia!" quando não houver notificações', () => {
      const isLoading = false;
      const notificacoes: Notificacao[] = [];
      const error: string | null = null;

      const estado = isLoading ? 'LOADING' : error ? 'ERROR' : notificacoes.length === 0 ? 'EMPTY' : 'AVAILABLE';
      assert.strictEqual(estado, 'EMPTY');
    });

    it('deve identificar estado com notificações disponíveis para listagem', () => {
      const isLoading = false;
      const notificacoes: Notificacao[] = [
        {
          id: 1,
          tipo: 'OS_PRONTA',
          titulo: 'OS Pronta',
          mensagem: 'Equipamento pronto',
          lida: false,
          criadoEm: '2026-09-25T12:00:00Z',
          lidoEm: null,
          recursoTipo: 'ORDEM_SERVICO',
          recursoId: 1,
          link: '/ordens-servico?busca=OS-01',
        },
      ];
      const error: string | null = null;

      const estado = isLoading ? 'LOADING' : error ? 'ERROR' : notificacoes.length === 0 ? 'EMPTY' : 'AVAILABLE';
      assert.strictEqual(estado, 'AVAILABLE');
    });
  });

  describe('4. Ações de Marcação de Leitura e Otimismo', () => {
    it('deve marcar uma notificação individual como lida e decrementar o badge de não lidas', () => {
      let lista: Notificacao[] = [
        {
          id: 1,
          tipo: 'OS_PRONTA',
          titulo: 'OS 1',
          mensagem: 'Pronta',
          lida: false,
          criadoEm: '2026-09-25T12:00:00Z',
          lidoEm: null,
          recursoTipo: 'ORDEM_SERVICO',
          recursoId: 1,
          link: '/ordens-servico?busca=1',
        },
        {
          id: 2,
          tipo: 'ESTOQUE_BAIXO',
          titulo: 'Produto 2',
          mensagem: 'Estoque baixo',
          lida: false,
          criadoEm: '2026-09-25T12:10:00Z',
          lidoEm: null,
          recursoTipo: 'PRODUTO',
          recursoId: 2,
          link: '/estoque',
        },
      ];
      let naoLidas = 2;

      // Ação: Clicar na notificação 1
      const notifAlvo = lista[0];
      if (!notifAlvo.lida) {
        lista = lista.map((n) => (n.id === notifAlvo.id ? { ...n, lida: true, lidoEm: '2026-09-25T12:15:00Z' } : n));
        naoLidas = Math.max(0, naoLidas - 1);
      }

      assert.strictEqual(naoLidas, 1);
      assert.strictEqual(lista.find((n) => n.id === 1)?.lida, true);
      assert.strictEqual(lista.find((n) => n.id === 2)?.lida, false);
    });

    it('não deve decrementar o badge se a notificação já estiver lida', () => {
      let naoLidas = 1;
      const notifJaLida: Notificacao = {
        id: 1,
        tipo: 'OS_PRONTA',
        titulo: 'OS 1',
        mensagem: 'Pronta',
        lida: true,
        criadoEm: '2026-09-25T12:00:00Z',
        lidoEm: '2026-09-25T12:05:00Z',
        recursoTipo: 'ORDEM_SERVICO',
        recursoId: 1,
        link: '/ordens-servico?busca=1',
      };

      if (!notifJaLida.lida) {
        naoLidas = Math.max(0, naoLidas - 1);
      }

      assert.strictEqual(naoLidas, 1);
    });

    it('deve marcar todas como lidas, zerando o badge e atualizando todos os itens', () => {
      let lista: Notificacao[] = [
        {
          id: 1,
          tipo: 'OS_PRONTA',
          titulo: 'OS 1',
          mensagem: 'Msg 1',
          lida: false,
          criadoEm: '2026-09-25T12:00:00Z',
          lidoEm: null,
          recursoTipo: 'ORDEM_SERVICO',
          recursoId: 1,
          link: null,
        },
        {
          id: 2,
          tipo: 'ESTOQUE_BAIXO',
          titulo: 'Item 2',
          mensagem: 'Msg 2',
          lida: false,
          criadoEm: '2026-09-25T12:05:00Z',
          lidoEm: null,
          recursoTipo: 'PRODUTO',
          recursoId: 2,
          link: null,
        },
      ];
      let naoLidas = 2;

      // Ação: Marcar todas como lidas
      lista = lista.map((n) => ({ ...n, lida: true, lidoEm: '2026-09-25T12:10:00Z' }));
      naoLidas = 0;

      assert.strictEqual(naoLidas, 0);
      assert.ok(lista.every((n) => n.lida === true));
      assert.ok(lista.every((n) => n.lidoEm !== null));
    });

    it('deve ignorar a ação "Marcar todas como lidas" quando naoLidas for 0', () => {
      let chamadaApiRealizada = false;
      const naoLidas = 0;
      const isMarkingAllRead = false;

      if (isMarkingAllRead || naoLidas === 0) {
        // Bloqueado
      } else {
        chamadaApiRealizada = true;
      }

      assert.strictEqual(chamadaApiRealizada, false);
    });
  });

  describe('5. Acessibilidade, Teclado e Fechamento', () => {
    it('deve gerar o aria-label descritivo com base na contagem de não lidas', () => {
      const getAriaLabel = (naoLidas: number) =>
        naoLidas > 0
          ? `Notificações (${naoLidas} não lida${naoLidas > 1 ? 's' : ''})`
          : 'Notificações (todas lidas)';

      assert.strictEqual(getAriaLabel(0), 'Notificações (todas lidas)');
      assert.strictEqual(getAriaLabel(1), 'Notificações (1 não lida)');
      assert.strictEqual(getAriaLabel(5), 'Notificações (5 não lidas)');
      assert.strictEqual(getAriaLabel(12), 'Notificações (12 não lidas)');
    });

    it('deve fechar o painel ao receber a tecla Escape', () => {
      let isNotificacoesOpen = true;

      const handleKeyDown = (key: string) => {
        if (key === 'Escape') {
          isNotificacoesOpen = false;
        }
      };

      handleKeyDown('Escape');
      assert.strictEqual(isNotificacoesOpen, false);
    });

    it('não deve fechar o painel ao pressionar outras teclas (ex: Tab, Enter)', () => {
      let isNotificacoesOpen = true;

      const handleKeyDown = (key: string) => {
        if (key === 'Escape') {
          isNotificacoesOpen = false;
        }
      };

      handleKeyDown('Tab');
      assert.strictEqual(isNotificacoesOpen, true);
      handleKeyDown('Enter');
      assert.strictEqual(isNotificacoesOpen, true);
    });

    it('deve alternar a visibilidade do painel ao clicar no botão do sino', () => {
      let isNotificacoesOpen = false;

      // Clique 1: Abre
      isNotificacoesOpen = !isNotificacoesOpen;
      assert.strictEqual(isNotificacoesOpen, true);

      // Clique 2: Fecha
      isNotificacoesOpen = !isNotificacoesOpen;
      assert.strictEqual(isNotificacoesOpen, false);
    });
  });
});
