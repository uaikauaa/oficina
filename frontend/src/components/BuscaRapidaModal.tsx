'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 sm:pt-12 pb-6 px-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150 overflow-hidden">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-3rem)] sm:max-h-[calc(100vh-6rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Busca Superior */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 bg-slate-950/50">
          <Search className="w-5 h-5 text-amber-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Pesquisar cliente, equipamento, OS, peça, série..."
            className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 focus:outline-none"
          />
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mr-2" />
          ) : termo ? (
            <button
              onClick={() => setTermo('')}
              className="p-1 text-slate-400 hover:text-white mr-2"
              title="Limpar"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 rounded border border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Corpo dos Resultados */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {!termo.trim() && (
            <div className="py-8 text-center text-slate-500 text-xs space-y-2">
              <Sparkles className="w-8 h-8 text-amber-500/40 mx-auto" />
              <p className="font-semibold text-slate-300">Busca Rápida Oficina Gestão</p>
              <p className="max-w-md mx-auto text-slate-400">
                Digite um nome, razão social, CPF/CNPJ, telefone, modelo de máquina de solda, gerador, número de série, OS ou código de peça.
              </p>
            </div>
          )}

          {termo.trim() && !isLoading && resultado && resultado.totalResultados === 0 && (
            <div className="py-8 text-center text-slate-500 text-xs space-y-1">
              <Search className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-semibold text-slate-300">Nenhum resultado encontrado para &quot;{termo}&quot;</p>
              <p className="text-slate-500">Tente buscar por outro termo ou número identificador.</p>
            </div>
          )}

          {resultado && resultado.totalResultados > 0 && (
            <>
              {/* Seção Clientes */}
              {resultado.clientes && resultado.clientes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wider px-2">
                    <Users className="w-3.5 h-3.5" />
                    <span>Clientes ({resultado.clientes.length})</span>
                  </div>
                  <div className="space-y-1">
                    {resultado.clientes.map((cli) => {
                      const itemIdx = currentIndexTracker++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <div
                          key={`cli-${cli.id}`}
                          onClick={() => handleNavegarPara(cli.url)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-amber-500/15 border border-amber-500/30 text-white'
                              : 'hover:bg-slate-800/60 border border-transparent text-slate-300'
                          }`}
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white truncate">{cli.titulo}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-amber-400 border border-slate-700">
                                {cli.tag}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{cli.subtitulo}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Seção Equipamentos */}
              {resultado.maquinas && resultado.maquinas.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wider px-2">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Equipamentos ({resultado.maquinas.length})</span>
                  </div>
                  <div className="space-y-1">
                    {resultado.maquinas.map((maq) => {
                      const itemIdx = currentIndexTracker++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <div
                          key={`maq-${maq.id}`}
                          onClick={() => handleNavegarPara(maq.url)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-amber-500/15 border border-amber-500/30 text-white'
                              : 'hover:bg-slate-800/60 border border-transparent text-slate-300'
                          }`}
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white truncate">{maq.titulo}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-blue-400 border border-slate-700">
                                {maq.tag}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{maq.subtitulo}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Seção Ordens de Serviço */}
              {resultado.ordensServico && resultado.ordensServico.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wider px-2">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Ordens de Serviço ({resultado.ordensServico.length})</span>
                  </div>
                  <div className="space-y-1">
                    {resultado.ordensServico.map((os) => {
                      const itemIdx = currentIndexTracker++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <div
                          key={`os-${os.id}`}
                          onClick={() => handleNavegarPara(os.url)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-amber-500/15 border border-amber-500/30 text-white'
                              : 'hover:bg-slate-800/60 border border-transparent text-slate-300'
                          }`}
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                {os.titulo}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                {os.tag}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate mt-1">{os.subtitulo}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Seção Produtos e Peças */}
              {resultado.produtos && resultado.produtos.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wider px-2">
                    <Package className="w-3.5 h-3.5" />
                    <span>Peças & Produtos ({resultado.produtos.length})</span>
                  </div>
                  <div className="space-y-1">
                    {resultado.produtos.map((prod) => {
                      const itemIdx = currentIndexTracker++;
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <div
                          key={`prod-${prod.id}`}
                          onClick={() => handleNavegarPara(prod.url)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-amber-500/15 border border-amber-500/30 text-white'
                              : 'hover:bg-slate-800/60 border border-transparent text-slate-300'
                          }`}
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white truncate">{prod.titulo}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-emerald-400 border border-slate-700">
                                {prod.tag}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{prod.subtitulo}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé com Dicas de Atalho */}
        <div className="shrink-0 px-4 py-2.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[10px] mr-1">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[10px] mr-1">↓</kbd>
              Navegar
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[10px] mr-1">↵</kbd>
              Selecionar
            </span>
          </div>
          <span>Pressione ESC para fechar</span>
        </div>
      </div>
    </div>
  );
}
