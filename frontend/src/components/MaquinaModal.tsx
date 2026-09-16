'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { Maquina, MaquinaFormData, TipoEquipamento } from '@/lib/types';
import { apiFetch } from '@/lib/api';

interface MaquinaModalProps {
  isOpen: boolean;
  clienteId: number;
  clienteNome: string;
  maquina?: Maquina | null; // Se fornecido, modo edição
  onClose: () => void;
  onSuccess: (maquina: Maquina) => void;
}

const TIPO_OPTIONS: { value: TipoEquipamento; label: string; icon: string }[] = [
  { value: 'MAQUINA_SOLDA', label: 'Máquina de Solda', icon: '⚡' },
  { value: 'GERADOR_ENERGIA', label: 'Gerador de Energia', icon: '🔋' },
  { value: 'OUTRO_EQUIPAMENTO', label: 'Outro Equipamento', icon: '🔧' },
];

const INPUT_CLASS =
  'w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors';

const LABEL_CLASS = 'block text-xs font-semibold text-slate-400 mb-1.5';

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

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Popula o form ao abrir em modo edição
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
        } else {
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
        }
        setErrorMessage(null);
        setFieldErrors({});
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, maquina, clienteId]);

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
        // Verifica se há erros de validação por campo
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Wrench className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {isEditing ? 'Editar Equipamento' : 'Novo Equipamento'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cliente: <span className="text-slate-200 font-medium">{clienteNome}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Error global */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Tipo de Equipamento */}
            <div>
              <label className={LABEL_CLASS}>
                <Wrench className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                Tipo de Equipamento <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <select
                  name="tipoEquipamento"
                  value={formData.tipoEquipamento ?? ''}
                  onChange={handleChange}
                  className={`${INPUT_CLASS} appearance-none pr-9 ${fieldErrors.tipoEquipamento ? 'border-red-500/60' : ''}`}
                >
                  {TIPO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
              {fieldErrors.tipoEquipamento && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.tipoEquipamento}</p>
              )}
            </div>

            {/* Marca e Modelo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>
                  Marca <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="marca"
                  value={formData.marca ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: ESAB, Lincoln, Toyama"
                  className={`${INPUT_CLASS} ${fieldErrors.marca ? 'border-red-500/60' : ''}`}
                  maxLength={100}
                />
                {fieldErrors.marca && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.marca}</p>
                )}
              </div>
              <div>
                <label className={LABEL_CLASS}>
                  Modelo <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="modelo"
                  value={formData.modelo ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: LHN 280, Lider 400-N"
                  className={`${INPUT_CLASS} ${fieldErrors.modelo ? 'border-red-500/60' : ''}`}
                  maxLength={100}
                />
                {fieldErrors.modelo && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.modelo}</p>
                )}
              </div>
            </div>

            {/* Número de Série e Ano */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>
                  <Hash className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                  Número de Série
                </label>
                <input
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
                <label className={LABEL_CLASS}>
                  <Calendar className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                  Ano de Fabricação
                </label>
                <input
                  type="number"
                  name="anoFabricacao"
                  value={formData.anoFabricacao ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: 2019"
                  min={1900}
                  max={2100}
                  className={`${INPUT_CLASS} ${fieldErrors.anoFabricacao ? 'border-red-500/60' : ''}`}
                />
                {fieldErrors.anoFabricacao && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.anoFabricacao}</p>
                )}
              </div>
            </div>

            {/* Potência, Tensão e Horímetro */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={LABEL_CLASS}>
                  <Zap className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                  Potência
                </label>
                <input
                  type="text"
                  name="potencia"
                  value={formData.potencia ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: 160A, 5kVA"
                  className={INPUT_CLASS}
                  maxLength={50}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>
                  <Zap className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                  Tensão
                </label>
                <input
                  type="text"
                  name="tensao"
                  value={formData.tensao ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: 110V/220V"
                  className={INPUT_CLASS}
                  maxLength={50}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>
                  <Gauge className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                  Horímetro (h)
                </label>
                <input
                  type="text"
                  name="horimetro"
                  value={formData.horimetro ?? ''}
                  onChange={handleChange}
                  placeholder="Ex: 1200.5"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className={LABEL_CLASS}>Observações Técnicas</label>
              <textarea
                name="observacoes"
                value={formData.observacoes ?? ''}
                onChange={handleChange}
                rows={3}
                placeholder="Detalhes técnicos, histórico de problemas, configurações especiais..."
                className={`${INPUT_CLASS} resize-none leading-relaxed`}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60 shadow-lg shadow-amber-500/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
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
