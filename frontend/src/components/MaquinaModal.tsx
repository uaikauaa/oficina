'use client';

import React, { useEffect, useState } from 'react';
import DialogFocus from '@/components/ui/DialogFocus';
import {
  X,
  Wrench,
  Zap,
  Hash,
  Calendar,
  Gauge,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
  User,
} from 'lucide-react';
import { Cliente, Maquina, MaquinaFormData, TipoEquipamento } from '@/lib/types';
import { apiFetch, formatarDocumento, formatarTelefone } from '@/lib/api';

export interface MaquinaModalProps {
  isOpen: boolean;
  clienteId?: number;
  clienteNome?: string;
  maquina?: Maquina | null; // Se fornecido, modo edição
  onClose: () => void;
  onSuccess: (maquina: Maquina) => void;
}

const TIPO_OPTIONS: { value: TipoEquipamento; label: string; icon: string }[] = [
  { value: 'MAQUINA_SOLDA', label: 'Máquina de Solda', icon: 'zap' },
  { value: 'GERADOR_ENERGIA', label: 'Gerador de Energia', icon: 'battery' },
  { value: 'OUTRO_EQUIPAMENTO', label: 'Outro Equipamento', icon: 'wrench' },
];

const INPUT_CLASS = 'ui-field';

const LABEL_CLASS = 'ui-label';

export default function MaquinaModal({
  isOpen,
  clienteId,
  clienteNome,
  maquina,
  onClose,
  onSuccess,
}: MaquinaModalProps) {
  const isEditing = !!maquina;

  const [formData, setFormData] = useState<Partial<MaquinaFormData>>({
    clienteId: clienteId,
    tipoEquipamento: 'MAQUINA_SOLDA',
    marca: '',
    modelo: '',
    anoFabricacao: '',
    numeroSerie: '',
    horimetro: '',
    potencia: '',
    tensao: '',
    observacoes: '',
  });

  // Estado da seleção de cliente (para quando clienteId não é fornecido)
  const [selectedCliente, setSelectedCliente] = useState<{ id: number; nome: string } | null>(
    clienteId ? { id: clienteId, nome: clienteNome || '' } : null
  );
  const [termoCliente, setTermoCliente] = useState('');
  const [clientesEncontrados, setClientesEncontrados] = useState<Cliente[]>([]);
  const [isBuscandoClientes, setIsBuscandoClientes] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Popula o form ao abrir
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        if (maquina) {
          setFormData({
            clienteId: maquina.clienteId,
            tipoEquipamento: maquina.tipoEquipamento,
            marca: maquina.marca,
            modelo: maquina.modelo,
            anoFabricacao: maquina.anoFabricacao?.toString() ?? '',
            numeroSerie: maquina.numeroSerie ?? '',
            horimetro: maquina.horimetro?.toString() ?? '',
            potencia: maquina.potencia ?? '',
            tensao: maquina.tensao ?? '',
            observacoes: maquina.observacoes ?? '',
          });
          setSelectedCliente({ id: maquina.clienteId, nome: maquina.clienteNome || '' });
        } else if (clienteId) {
          setFormData({
            clienteId,
            tipoEquipamento: 'MAQUINA_SOLDA',
            marca: '',
            modelo: '',
            anoFabricacao: '',
            numeroSerie: '',
            horimetro: '',
            potencia: '',
            tensao: '',
            observacoes: '',
          });
          setSelectedCliente({ id: clienteId, nome: clienteNome || '' });
        } else {
          setFormData({
            clienteId: undefined,
            tipoEquipamento: 'MAQUINA_SOLDA',
            marca: '',
            modelo: '',
            anoFabricacao: '',
            numeroSerie: '',
            horimetro: '',
            potencia: '',
            tensao: '',
            observacoes: '',
          });
          setSelectedCliente(null);
        }
        setTermoCliente('');
        setClientesEncontrados([]);
        setErrorMessage(null);
        setFieldErrors({});
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, maquina, clienteId, clienteNome]);

  // Busca de clientes com debounce
  useEffect(() => {
    if (selectedCliente || !termoCliente.trim() || termoCliente.trim().length < 2) {
      const resetTimer = setTimeout(() => {
        setClientesEncontrados([]);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    const timer = setTimeout(async () => {
      setIsBuscandoClientes(true);
      try {
        const res = await apiFetch(`/api/clientes?termo=${encodeURIComponent(termoCliente.trim())}&size=6`);
        if (res.ok) {
          const data = await res.json();
          setClientesEncontrados(data.content || []);
        }
      } catch {
        // Silencioso
      } finally {
        setIsBuscandoClientes(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [termoCliente, selectedCliente]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const erros: Record<string, string> = {};
    if (!formData.clienteId) {
      erros.clienteId = 'Por favor, selecione o cliente proprietário do equipamento.';
    }
    if (!formData.tipoEquipamento) erros.tipoEquipamento = 'Tipo de equipamento é obrigatório.';
    if (!formData.marca?.trim()) erros.marca = 'Marca é obrigatória.';
    if (!formData.modelo?.trim()) erros.modelo = 'Modelo é obrigatório.';
    if (
      formData.anoFabricacao &&
      (isNaN(Number(formData.anoFabricacao)) ||
        Number(formData.anoFabricacao) < 1900 ||
        Number(formData.anoFabricacao) > 2100)
    ) {
      erros.anoFabricacao = 'Ano de fabricação inválido.';
    }
    setFieldErrors(erros);
    return Object.keys(erros).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setErrorMessage(null);

    const payload = {
      clienteId: formData.clienteId,
      tipoEquipamento: formData.tipoEquipamento,
      marca: formData.marca?.trim(),
      modelo: formData.modelo?.trim(),
      anoFabricacao: formData.anoFabricacao ? Number(formData.anoFabricacao) : null,
      numeroSerie: formData.numeroSerie?.trim() || null,
      horimetro: formData.horimetro ? formData.horimetro.replace(/\s+/g, '').replace(',', '.') : null,
      potencia: formData.potencia?.trim() || null,
      tensao: formData.tensao?.trim() || null,
      observacoes: formData.observacoes?.trim() || null,
    };

    try {
      const url = isEditing ? `/api/maquinas/${maquina!.id}` : '/api/maquinas';
      const method = isEditing ? 'PUT' : 'POST';

      // Para PUT, não enviar clienteId
      const body = isEditing
        ? { ...payload, clienteId: undefined }
        : payload;

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.errors && typeof err.errors === 'object') {
          setFieldErrors(err.errors);
        } else {
          throw new Error(err.message || `Erro ${res.status} ao salvar equipamento.`);
        }
        return;
      }

      const data: Maquina = await res.json();
      onSuccess(data);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar equipamento.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="maquina-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <DialogFocus />
      <div className="ui-dialog w-full max-w-2xl border border-control flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <Wrench aria-hidden="true" className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 id="maquina-modal-title" className="text-sm font-bold text-ink">
                {isEditing ? 'Editar Equipamento' : 'Novo Equipamento'}
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {selectedCliente ? (
                  <>
                    Cliente: <span className="text-ink font-medium">{selectedCliente.nome}</span>
                  </>
                ) : (
                  'Selecione o cliente e informe os dados técnicos'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ui-icon-btn h-8 w-8 rounded-lg bg-elevated hover:bg-hover flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer"
            aria-label="Fechar modal"
          >
            <X aria-hidden="true" className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Error global */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
                <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* SELEÇÃO DO CLIENTE (quando não for edição e não veio clienteId pré-definido) */}
            <div>
              <label htmlFor="field-src-components-MaquinaModal-tsx-1" className={LABEL_CLASS}>
                <User aria-hidden="true" className="inline w-4 h-4 mr-1 -mt-0.5" />
                Cliente Proprietário <span className="text-danger">*</span>
              </label>

              {selectedCliente ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-canvas border border-line">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                      <User aria-hidden="true" className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-ink block">{selectedCliente.nome}</span>
                      <span className="text-xs text-subtle block">ID: #{selectedCliente.id}</span>
                    </div>
                  </div>
                  {!clienteId && !isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCliente(null);
                        setFormData((prev) => ({ ...prev, clienteId: undefined }));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-elevated hover:bg-hover text-accent text-xs font-semibold border border-control transition-colors cursor-pointer"
                    >
                      Trocar Cliente
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search aria-hidden="true" className="w-4 h-4 text-subtle absolute left-3 top-1/2 -translate-y-1/2" />
                    <input id="field-src-components-MaquinaModal-tsx-1"
                      type="text"
                      placeholder="Pesquisar cliente por nome, CPF/CNPJ ou telefone..."
                      value={termoCliente}
                      onChange={(e) => setTermoCliente(e.target.value)}
                      className={`${INPUT_CLASS} pl-9 ${fieldErrors.clienteId ? 'border-danger/60' : ''}`}
                    />
                    {isBuscandoClientes && (
                      <Loader2 aria-hidden="true" className="w-4 h-4 text-accent absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />
                    )}
                  </div>

                  {clientesEncontrados.length > 0 && (
                    <div className="bg-canvas border border-line rounded-xl overflow-hidden divide-y divide-line/60 shadow-lg max-h-48 overflow-y-auto">
                      {clientesEncontrados.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCliente({ id: c.id, nome: c.nomeRazaoSocial });
                            setFormData((prev) => ({ ...prev, clienteId: c.id }));
                            setTermoCliente('');
                            setClientesEncontrados([]);
                            if (fieldErrors.clienteId) {
                              setFieldErrors((prev) => ({ ...prev, clienteId: '' }));
                            }
                          }}
                          className="p-2.5 hover:bg-elevated/50 cursor-pointer transition-colors flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-ink block">{c.nomeRazaoSocial}</span>
                            <span className="text-xs text-muted flex items-center gap-2 mt-0.5">
                              {c.cpfCnpj && <span>{formatarDocumento(c.cpfCnpj)}</span>}
                              {(c.celular || c.telefone) && <span>• {formatarTelefone(c.celular || c.telefone)}</span>}
                            </span>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded bg-elevated text-ink font-semibold border border-control">
                            {c.tipoPessoa === 'JURIDICA' ? 'PJ' : 'PF'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {termoCliente.trim().length >= 2 && !isBuscandoClientes && clientesEncontrados.length === 0 && (
                    <p className="text-xs text-subtle italic p-1">Nenhum cliente localizado para &quot;{termoCliente}&quot;</p>
                  )}
                </div>
              )}
              {fieldErrors.clienteId && (
                <p className="mt-1 text-xs text-danger">{fieldErrors.clienteId}</p>
              )}
            </div>

            {/* Tipo de Equipamento */}
            <div>
              <label htmlFor="field-src-components-MaquinaModal-tsx-2" className={LABEL_CLASS}>
                <Wrench aria-hidden="true" className="inline w-4 h-4 mr-1 -mt-0.5" />
                Tipo de Equipamento <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <select id="field-src-components-MaquinaModal-tsx-2"
                  name="tipoEquipamento"
                  value={formData.tipoEquipamento ?? ''}
                  onChange={handleChange}
                  className={`${INPUT_CLASS} appearance-none pr-9 ${fieldErrors.tipoEquipamento ? 'border-danger/60' : ''}`}
                >
                  {TIPO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle pointer-events-none" />
              </div>
              {fieldErrors.tipoEquipamento && (
                <p className="mt-1 text-xs text-danger">{fieldErrors.tipoEquipamento}</p>
              )}
            </div>

            {/* Marca e Modelo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="field-src-components-MaquinaModal-tsx-3" className={LABEL_CLASS}>
                  Marca <span className="text-danger">*</span>
                </label>
                <input id="field-src-components-MaquinaModal-tsx-3"
                  type="text"
                  name="marca"
                  value={formData.marca ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: ESAB, Lincoln, Toyama"
                  className={`${INPUT_CLASS} ${fieldErrors.marca ? 'border-danger/60' : ''}`}
                  maxLength={100}
                />
                {fieldErrors.marca && (
                  <p className="mt-1 text-xs text-danger">{fieldErrors.marca}</p>
                )}
              </div>
              <div>
                <label htmlFor="field-src-components-MaquinaModal-tsx-4" className={LABEL_CLASS}>
                  Modelo <span className="text-danger">*</span>
                </label>
                <input id="field-src-components-MaquinaModal-tsx-4"
                  type="text"
                  name="modelo"
                  value={formData.modelo ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: LHN 280i, TG8000"
                  className={`${INPUT_CLASS} ${fieldErrors.modelo ? 'border-danger/60' : ''}`}
                  maxLength={100}
                />
                {fieldErrors.modelo && (
                  <p className="mt-1 text-xs text-danger">{fieldErrors.modelo}</p>
                )}
              </div>
            </div>

            {/* Número de Série e Ano */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="field-src-components-MaquinaModal-tsx-5" className={LABEL_CLASS}>
                  <Hash aria-hidden="true" className="inline w-4 h-4 mr-1 -mt-0.5" />
                  Número de Série
                </label>
                <input id="field-src-components-MaquinaModal-tsx-5"
                  type="text"
                  name="numeroSerie"
                  value={formData.numeroSerie ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: SN-000123"
                  className={INPUT_CLASS}
                  maxLength={100}
                />
              </div>
              <div>
                <label htmlFor="field-src-components-MaquinaModal-tsx-6" className={LABEL_CLASS}>
                  <Calendar aria-hidden="true" className="inline w-4 h-4 mr-1 -mt-0.5" />
                  Ano de Fabricação
                </label>
                <input id="field-src-components-MaquinaModal-tsx-6"
                  type="number"
                  name="anoFabricacao"
                  value={formData.anoFabricacao ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: 2022"
                  min={1900}
                  max={2100}
                  className={`${INPUT_CLASS} ${fieldErrors.anoFabricacao ? 'border-danger/60' : ''}`}
                />
                {fieldErrors.anoFabricacao && (
                  <p className="mt-1 text-xs text-danger">{fieldErrors.anoFabricacao}</p>
                )}
              </div>
            </div>

            {/* Potência, Tensão e Horímetro */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="field-src-components-MaquinaModal-tsx-7" className={LABEL_CLASS}>
                  <Zap aria-hidden="true" className="inline w-4 h-4 mr-1 -mt-0.5" />
                  Potência
                </label>
                <input id="field-src-components-MaquinaModal-tsx-7"
                  type="text"
                  name="potencia"
                  value={formData.potencia ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: 250A, 8kVA"
                  className={INPUT_CLASS}
                  maxLength={50}
                />
              </div>
              <div>
                <label htmlFor="field-src-components-MaquinaModal-tsx-8" className={LABEL_CLASS}>
                  <Zap aria-hidden="true" className="inline w-4 h-4 mr-1 -mt-0.5" />
                  Tensão
                </label>
                <input id="field-src-components-MaquinaModal-tsx-8"
                  type="text"
                  name="tensao"
                  value={formData.tensao ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: 220V/380V"
                  className={INPUT_CLASS}
                  maxLength={50}
                />
              </div>
              <div>
                <label htmlFor="field-src-components-MaquinaModal-tsx-9" className={LABEL_CLASS}>
                  <Gauge aria-hidden="true" className="inline w-4 h-4 mr-1 -mt-0.5" />
                  Horímetro (h)
                </label>
                <input id="field-src-components-MaquinaModal-tsx-9"
                  type="text"
                  name="horimetro"
                  value={formData.horimetro ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: 120.5"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* Observações */}
            <div>
              <label htmlFor="field-src-components-MaquinaModal-tsx-10" className={LABEL_CLASS}>Observações Técnicas</label>
              <textarea id="field-src-components-MaquinaModal-tsx-10"
                name="observacoes"
                value={formData.observacoes ?? ''}
                onChange={handleChange}
                rows={3}
                placeholder="Detalhes técnicos, cabos e tochas inclusos, histórico de reparos..."
                className={`${INPUT_CLASS} resize-none leading-relaxed`}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-line flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-elevated hover:bg-hover text-ink text-xs font-semibold border border-control transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="ui-btn ui-btn-primary flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 aria-hidden="true" className="w-4 h-4" />
                  <span>{isEditing ? 'Salvar Alterações' : 'Cadastrar Equipamento'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
