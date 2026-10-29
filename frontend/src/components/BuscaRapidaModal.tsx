'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import DialogFocus from '@/components/ui/DialogFocus';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  Users,
  Wrench,
  FileText,
  Package,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { BuscaRapidaResultado, ItemBuscaRapida } from '@/lib/types';
import { apiFetchJson } from '@/lib/api';

interface BuscaRapidaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BuscaRapidaModal({ isOpen, onClose }: BuscaRapidaModalProps) {
  const router = useRouter();
  const [termo, setTermo] = useState('');
  const [resultado, setResultado] = useState<BuscaRapidaResultado | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-foco ao abrir
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setTermo('');
        setResultado(null);
        setSelectedIndex(0);
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Busca debounced
  useEffect(() => {
    if (!termo.trim()) {
      const emptyTimer = setTimeout(() => {
        setResultado(null);
        setIsLoading(false);
      }, 0);
      return () => clearTimeout(emptyTimer);
    }

    const startTimer = setTimeout(() => {
      setIsLoading(true);
    }, 0);
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetchJson<BuscaRapidaResultado>(
          `/api/busca/rapida?termo=${encodeURIComponent(termo.trim())}`
        );
        setResultado(data);
        setSelectedIndex(0);
      } catch {
        setResultado(null);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(timer);
    };
  }, [termo]);

  // Lista linear de todos os itens retornados para navegação por teclado
  const todosItens = useCallback((): ItemBuscaRapida[] => {
    if (!resultado) return [];
    return [
      ...(resultado.clientes || []),
      ...(resultado.maquinas || []),
      ...(resultado.ordensServico || []),
      ...(resultado.produtos || []),
    ];
  }, [resultado]);

  const handleNavegarPara = useCallback((url: string) => {
    onClose();
    router.push(url);
  }, [onClose, router]);

  // Teclado (ESC, Enter, Seta Cima/Baixo)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const itens = todosItens();
        if (itens.length > 0) {
          setSelectedIndex((prev) => (prev + 1) % itens.length);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const itens = todosItens();
        if (itens.length > 0) {
          setSelectedIndex((prev) => (prev - 1 + itens.length) % itens.length);
        }
      } else if (e.key === 'Enter') {
        const itens = todosItens();
        if (itens.length > 0 && itens[selectedIndex]) {
          e.preventDefault();
          handleNavegarPara(itens[selectedIndex].url);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, todosItens, handleNavegarPara, onClose]);

  if (!isOpen) return null;

  let currentIndexTracker = 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Busca Rápida"
      className="fixed inset-0 z-50 flex items-start justify-center pt-6 sm:pt-12 pb-6 px-4 bg-canvas/80 animate-in fade-in duration-150 overflow-hidden"
      onClick={onClose}
    >
      <DialogFocus />
      <div
        className="ui-dialog w-full max-w-2xl border border-control overflow-hidden flex flex-col max-h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-6rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Busca Superior */}
        <div className="flex items-center px-4 py-3.5 border-b border-line bg-canvas/50">
          <Search aria-hidden="true" className="w-5 h-5 text-accent mr-3 shrink-0" />
          <input aria-label="Pesquisar cliente, equipamento, OS, peça, série..."
            ref={inputRef}
            type="text"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Pesquisar cliente, equipamento, OS, peça, série..."
            className="ui-field flex-1 placeholder-subtle focus:outline-none"
          />
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin mr-2" />
          ) : termo ? (
            <button
              type="button"
              onClick={() => setTermo('')}
              className="ui-icon-btn p-1 text-muted hover:text-ink mr-2 cursor-pointer"
              title="Limpar"
              aria-label="Limpar busca"
            >
              <X aria-hidden="true" className="w-4 h-4" />
            </button>
          ) : null}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-xs font-mono text-muted bg-elevated rounded border border-control">
            ESC
          </kbd>
        </div>

        {/* Corpo dos Resultados */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {!termo.trim() && (
            <div className="py-8 text-center text-subtle text-xs space-y-2">
              <Sparkles className="w-8 h-8 text-accent mx-auto" />
              <p className="font-semibold text-ink">Busca Rápida Oficina Gestão</p>
              <p className="max-w-md mx-auto text-muted">
                Digite um nome, razão social, CPF/CNPJ, telefone, modelo de máquina de solda, gerador, número de série, OS ou código de peça.
              </p>
            </div>
          )}

          {termo.trim() && !isLoading && resultado && resultado.totalResultados === 0 && (
            <div className="py-8 text-center text-subtle text-xs space-y-1">
              <Search className="w-8 h-8 text-subtle mx-auto" />
              <p className="font-semibold text-ink">Nenhum resultado encontrado para &quot;{termo}&quot;</p>
              <p className="text-subtle">Tente buscar por outro termo ou número identificador.</p>
            </div>
          )}

          {resultado && resultado.totalResultados > 0 && (
            <>
              {/* Seção Clientes */}
              {resultado.clientes && resultado.clientes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-accent px-2">
                    <Users aria-hidden="true" className="w-4 h-4" />
                    <span>Clientes ({resultado.clientes.length})</span>
                  </div>
                  <div className="space-y-1">
                    {resultado.clientes.map((cli) => {
                      const itemIdx = currentIndexTracker++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <button
                          key={`cli-${cli.id}`}
                          type="button"
                          onClick={() => handleNavegarPara(cli.url)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          onFocus={() => setSelectedIndex(itemIdx)}
                          className={`w-full text-left flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-accent/15 border border-accent/30 text-ink'
                              : 'hover:bg-elevated/60 border border-transparent text-ink'
                          }`}
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-ink truncate">{cli.titulo}</span>
                              <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-elevated text-accent border border-control">
                                {cli.tag}
                              </span>
                            </div>
                            <p className="text-xs text-muted truncate mt-0.5">{cli.subtitulo}</p>
                          </div>
                          <ArrowRight aria-hidden="true" className="w-4 h-4 text-subtle shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Seção Equipamentos */}
              {resultado.maquinas && resultado.maquinas.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-accent px-2">
                    <Wrench aria-hidden="true" className="w-4 h-4" />
                    <span>Equipamentos ({resultado.maquinas.length})</span>
                  </div>
                  <div className="space-y-1">
                    {resultado.maquinas.map((maq) => {
                      const itemIdx = currentIndexTracker++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <button
                          key={`maq-${maq.id}`}
                          type="button"
                          onClick={() => handleNavegarPara(maq.url)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          onFocus={() => setSelectedIndex(itemIdx)}
                          className={`w-full text-left flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-accent/15 border border-accent/30 text-ink'
                              : 'hover:bg-elevated/60 border border-transparent text-ink'
                          }`}
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-ink truncate">{maq.titulo}</span>
                              <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-elevated text-ink border border-control">
                                {maq.tag}
                              </span>
                            </div>
                            <p className="text-xs text-muted truncate mt-0.5">{maq.subtitulo}</p>
                          </div>
                          <ArrowRight aria-hidden="true" className="w-4 h-4 text-subtle shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Seção Ordens de Serviço */}
              {resultado.ordensServico && resultado.ordensServico.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-accent px-2">
                    <FileText aria-hidden="true" className="w-4 h-4" />
                    <span>Ordens de Serviço ({resultado.ordensServico.length})</span>
                  </div>
                  <div className="space-y-1">
                    {resultado.ordensServico.map((os) => {
                      const itemIdx = currentIndexTracker++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <button
                          key={`os-${os.id}`}
                          type="button"
                          onClick={() => handleNavegarPara(os.url)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          onFocus={() => setSelectedIndex(itemIdx)}
                          className={`w-full text-left flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-accent/15 border border-accent/30 text-ink'
                              : 'hover:bg-elevated/60 border border-transparent text-ink'
                          }`}
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">
                                {os.titulo}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-elevated text-ink border border-control">
                                {os.tag}
                              </span>
                            </div>
                            <p className="text-xs text-muted truncate mt-1">{os.subtitulo}</p>
                          </div>
                          <ArrowRight aria-hidden="true" className="w-4 h-4 text-subtle shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Seção Produtos e Peças */}
              {resultado.produtos && resultado.produtos.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-accent px-2">
                    <Package aria-hidden="true" className="w-4 h-4" />
                    <span>Peças & Produtos ({resultado.produtos.length})</span>
                  </div>
                  <div className="space-y-1">
                    {resultado.produtos.map((prod) => {
                      const itemIdx = currentIndexTracker++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <button
                          key={`prod-${prod.id}`}
                          type="button"
                          onClick={() => handleNavegarPara(prod.url)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          onFocus={() => setSelectedIndex(itemIdx)}
                          className={`w-full text-left flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-accent/15 border border-accent/30 text-ink'
                              : 'hover:bg-elevated/60 border border-transparent text-ink'
                          }`}
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-ink truncate">{prod.titulo}</span>
                              <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-elevated text-ink border border-control">
                                {prod.tag}
                              </span>
                            </div>
                            <p className="text-xs text-muted truncate mt-0.5">{prod.subtitulo}</p>
                          </div>
                          <ArrowRight aria-hidden="true" className="w-4 h-4 text-subtle shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé com Dicas de Atalho */}
        <div className="shrink-0 px-4 py-2.5 border-t border-line bg-canvas/90 flex items-center justify-between text-xs text-subtle">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-elevated text-ink rounded border border-control text-xs mr-1">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-elevated text-ink rounded border border-control text-xs mr-1">↓</kbd>
              Navegar
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-elevated text-ink rounded border border-control text-xs mr-1">Enter</kbd>
              Selecionar
            </span>
          </div>
          <span>Pressione ESC para fechar</span>
        </div>
      </div>
    </div>
  );
}
