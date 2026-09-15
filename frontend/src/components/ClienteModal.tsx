'use client';

import React, { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Save, AlertCircle, Building2, User, MapPin } from 'lucide-react';
import { Cliente, ClienteFormData, TipoPessoa } from '@/lib/types';
import { apiFetch } from '@/lib/api';

const clienteSchema = z.object({
  tipoPessoa: z.enum(['FISICA', 'JURIDICA']),
  nomeRazaoSocial: z.string().min(2, 'Nome ou Razão Social deve ter no mínimo 2 caracteres').max(200),
  nomeFantasia: z.string().max(200).optional(),
  cpfCnpj: z.string().max(20).optional(),
  rgIe: z.string().max(30).optional(),
  telefone: z.string().max(20).optional(),
  celular: z.string().max(20).optional(),
  email: z.string().email('E-mail inválido').max(150).or(z.literal('')).optional(),
  observacoes: z.string().optional(),
  ativo: z.boolean().optional(),
  endereco: z.object({
    cep: z.string().max(10).optional(),
    logradouro: z.string().max(200).optional(),
    numero: z.string().max(20).optional(),
    complemento: z.string().max(100).optional(),
    bairro: z.string().max(100).optional(),
    cidade: z.string().max(100).optional(),
    estado: z.string().max(2).optional(),
  }).optional(),
});

type ClienteFormValues = z.infer<typeof clienteSchema>;

interface ClienteModalProps {
  cliente?: Cliente | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (clienteSalvo: Cliente) => void;
}

export default function ClienteModal({ cliente, isOpen, onClose, onSuccess }: ClienteModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!cliente;
  const enderecoPadrao = cliente?.enderecos?.[0];

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      tipoPessoa: cliente?.tipoPessoa || 'FISICA',
      nomeRazaoSocial: cliente?.nomeRazaoSocial || '',
      nomeFantasia: cliente?.nomeFantasia || '',
      cpfCnpj: cliente?.cpfCnpj || '',
      rgIe: cliente?.rgIe || '',
      telefone: cliente?.telefone || '',
      celular: cliente?.celular || '',
      email: cliente?.email || '',
      observacoes: cliente?.observacoes || '',
      ativo: cliente?.ativo !== undefined ? cliente.ativo : true,
      endereco: {
        cep: enderecoPadrao?.cep || '',
        logradouro: enderecoPadrao?.logradouro || '',
        numero: enderecoPadrao?.numero || '',
        complemento: enderecoPadrao?.complemento || '',
        bairro: enderecoPadrao?.bairro || '',
        cidade: enderecoPadrao?.cidade || '',
        estado: enderecoPadrao?.estado || '',
      },
    },
  });

  const tipoPessoaAtual = useWatch({
    control,
    name: 'tipoPessoa',
    defaultValue: cliente?.tipoPessoa || 'FISICA',
  });

  if (!isOpen) return null;

  const onSubmit = async (values: ClienteFormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    let enderecoPayload = undefined;
    if (values.endereco && values.endereco.logradouro && values.endereco.logradouro.trim() !== '') {
      const end = values.endereco;
      const logradouroTrimmed = end.logradouro?.trim() || '';
      const numeroTrimmed = end.numero?.trim() || '';
      const bairroTrimmed = end.bairro?.trim() || '';
      const cidadeTrimmed = end.cidade?.trim() || '';
      const estadoTrimmed = end.estado?.trim().toUpperCase() || '';

      if (!numeroTrimmed) {
        setErrorMessage('Por favor, informe o número do endereço.');
        setIsSubmitting(false);
        return;
      }
      if (!bairroTrimmed) {
        setErrorMessage('Por favor, informe o bairro do endereço.');
        setIsSubmitting(false);
        return;
      }
      if (!cidadeTrimmed) {
        setErrorMessage('Por favor, informe a cidade do endereço.');
        setIsSubmitting(false);
        return;
      }
      if (estadoTrimmed.length !== 2) {
        setErrorMessage('Por favor, informe a UF do estado com 2 caracteres (ex: MG, SP).');
        setIsSubmitting(false);
        return;
      }

      enderecoPayload = {
        cep: end.cep?.trim() || undefined,
        logradouro: logradouroTrimmed,
        numero: numeroTrimmed,
        complemento: end.complemento?.trim() || undefined,
        bairro: bairroTrimmed,
        cidade: cidadeTrimmed,
        estado: estadoTrimmed,
      };
    }

    const payload: ClienteFormData = {
      tipoPessoa: values.tipoPessoa as TipoPessoa,
      nomeRazaoSocial: values.nomeRazaoSocial.trim(),
      nomeFantasia: values.nomeFantasia?.trim() || undefined,
      cpfCnpj: values.cpfCnpj?.trim() || undefined,
      rgIe: values.rgIe?.trim() || undefined,
      telefone: values.telefone?.trim() || undefined,
      celular: values.celular?.trim() || undefined,
      email: values.email?.trim() || undefined,
      observacoes: values.observacoes?.trim() || undefined,
      ativo: values.ativo,
      endereco: enderecoPayload,
    };

    try {
      const endpoint = isEditing ? `/api/clientes/${cliente.id}` : '/api/clientes';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Ocorreu um erro ao salvar o cliente.');
        return;
      }

      onSuccess(data);
      reset();
      onClose();
    } catch {
      setErrorMessage('Falha de conexão com o servidor. Verifique se o backend está ativo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              {tipoPessoaAtual === 'JURIDICA' ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <p className="text-xs text-slate-400">
                Cadastro de Pessoa Física ou Pessoa Jurídica
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem de Erro Geral */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Corpo do Formulário */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Seletor Tipo de Pessoa */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Tipo de Cliente *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setValue('tipoPessoa', 'FISICA')}
                className={`py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  tipoPessoaAtual === 'FISICA'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Pessoa Física (PF)</span>
              </button>
              <button
                type="button"
                onClick={() => setValue('tipoPessoa', 'JURIDICA')}
                className={`py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  tipoPessoaAtual === 'JURIDICA'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Pessoa Jurídica (PJ)</span>
              </button>
            </div>
          </div>

          {/* Dados Principais */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-amber-400/90 uppercase tracking-wider flex items-center gap-2">
              <span>Dados Cadastrais</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {tipoPessoaAtual === 'JURIDICA' ? 'Razão Social *' : 'Nome Completo *'}
                </label>
                <input
                  type="text"
                  {...register('nomeRazaoSocial')}
                  placeholder={tipoPessoaAtual === 'JURIDICA' ? 'Ex: Metalúrgica Aço Forte LTDA' : 'Ex: João da Silva'}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
                {errors.nomeRazaoSocial && (
                  <p className="text-[11px] text-red-400 mt-1">{errors.nomeRazaoSocial.message}</p>
                )}
              </div>

              {tipoPessoaAtual === 'JURIDICA' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nome Fantasia
                  </label>
                  <input
                    type="text"
                    {...register('nomeFantasia')}
                    placeholder="Ex: Aço Forte Geradores"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {tipoPessoaAtual === 'JURIDICA' ? 'CNPJ' : 'CPF'}
                </label>
                <input
                  type="text"
                  {...register('cpfCnpj')}
                  placeholder={tipoPessoaAtual === 'JURIDICA' ? '00.000.000/0000-00' : '000.000.000-00'}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {tipoPessoaAtual === 'JURIDICA' ? 'Inscrição Estadual' : 'RG'}
                </label>
                <input
                  type="text"
                  {...register('rgIe')}
                  placeholder={tipoPessoaAtual === 'JURIDICA' ? 'Inscrição Estadual' : 'Número do RG'}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Contatos */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-amber-400/90 uppercase tracking-wider">
              Contatos & Comunicação
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Telefone Fixo
                </label>
                <input
                  type="text"
                  {...register('telefone')}
                  placeholder="(31) 3333-0000"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Celular / WhatsApp
                </label>
                <input
                  type="text"
                  {...register('celular')}
                  placeholder="(31) 99999-0000"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  {...register('email')}
                  placeholder="cliente@email.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
                {errors.email && (
                  <p className="text-[11px] text-red-400 mt-1">{errors.email.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-amber-400/90 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>Endereço Principal</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  CEP
                </label>
                <input
                  type="text"
                  {...register('endereco.cep')}
                  placeholder="30000-000"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Logradouro (Rua / Av.)
                </label>
                <input
                  type="text"
                  {...register('endereco.logradouro')}
                  placeholder="Ex: Av. Amazonas"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Número
                </label>
                <input
                  type="text"
                  {...register('endereco.numero')}
                  placeholder="100"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Complemento
                </label>
                <input
                  type="text"
                  {...register('endereco.complemento')}
                  placeholder="Galpão 2, Sala 10"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  {...register('endereco.bairro')}
                  placeholder="Centro"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  {...register('endereco.cidade')}
                  placeholder="Belo Horizonte"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  UF
                </label>
                <input
                  type="text"
                  maxLength={2}
                  {...register('endereco.estado')}
                  placeholder="MG"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs uppercase focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Observações Técnicas / Comerciais
            </label>
            <textarea
              rows={2}
              {...register('observacoes')}
              placeholder="Informações sobre tipos de máquinas de solda utilizadas, geradores ou histórico..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          {/* Botões de Ação */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/10 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Cliente'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
