'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  X,
  Save,
  AlertCircle,
  Building2,
  User,
  MapPin,
  Wrench,
  Zap,
  Hash,
  Calendar,
  Gauge,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  Cliente,
  ClienteFormData,
  TipoPessoa,
  Maquina,
  TipoEquipamento,
} from '@/lib/types';
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
  onSuccess?: (clienteSalvo: Cliente) => void;
  incluirEquipamento?: boolean;
  onSuccessComEquipamento?: (clienteSalvo: Cliente, maquinaSalva: Maquina) => void;
  nomePreDefinido?: string;
}

const TIPO_EQUIPAMENTO_OPTIONS: { value: TipoEquipamento; label: string; icon: string; desc: string }[] = [
  { value: 'MAQUINA_SOLDA', label: 'Máquina de Solda', icon: '⚡', desc: 'MIG, TIG, Inversora, Eletrodo' },
  { value: 'GERADOR_ENERGIA', label: 'Gerador de Energia', icon: '🔋', desc: 'Gasolina, Diesel, Portátil ou Estacionário' },
  { value: 'OUTRO_EQUIPAMENTO', label: 'Outro Equipamento', icon: '🔧', desc: 'Transformador, Cortadora, Compressor' },
];

const INPUT_CLASS =
  'w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors';

const LABEL_CLASS = 'block text-xs font-medium text-slate-300 mb-1';

export default function ClienteModal({
  cliente,
  isOpen,
  onClose,
  onSuccess,
  incluirEquipamento = false,
  onSuccessComEquipamento,
  nomePreDefinido,
}: ClienteModalProps) {
  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados dos Dados do Equipamento (Etapa 2)
  const [maquinaData, setMaquinaData] = useState<{
    tipoEquipamento: TipoEquipamento;
    marca: string;
    modelo: string;
    numeroSerie: string;
    anoFabricacao: string;
    potencia: string;
    tensao: string;
    horimetro: string;
    observacoes: string;
  }>({
    tipoEquipamento: 'MAQUINA_SOLDA',
    marca: '',
    modelo: '',
    numeroSerie: '',
    anoFabricacao: '',
    potencia: '',
    tensao: '',
    horimetro: '',
    observacoes: '',
  });

  const [maquinaFieldErrors, setMaquinaFieldErrors] = useState<Record<string, string>>({});

  const isEditing = !!cliente;
  const enderecoPadrao = cliente?.enderecos?.[0];

  const {
    trigger,
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    getValues,
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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        setEtapa(1);
        setErrorMessage(null);
        setMaquinaFieldErrors({});
        reset({
          tipoPessoa: cliente?.tipoPessoa || 'FISICA',
          nomeRazaoSocial: cliente?.nomeRazaoSocial || nomePreDefinido || '',
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
        });
        setMaquinaData({
          tipoEquipamento: 'MAQUINA_SOLDA',
          marca: '',
          modelo: '',
          numeroSerie: '',
          anoFabricacao: '',
          potencia: '',
          tensao: '',
          horimetro: '',
          observacoes: '',
        });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, cliente, nomePreDefinido, reset, enderecoPadrao]);

  if (!isOpen) return null;

  const validarEndereco = (values: ClienteFormValues): boolean => {
    if (values.endereco && values.endereco.logradouro && values.endereco.logradouro.trim() !== '') {
      const end = values.endereco;
      const numeroTrimmed = end.numero?.trim() || '';
      const bairroTrimmed = end.bairro?.trim() || '';
      const cidadeTrimmed = end.cidade?.trim() || '';
      const estadoTrimmed = end.estado?.trim().toUpperCase() || '';

      if (!numeroTrimmed) {
        setErrorMessage('Por favor, informe o número do endereço.');
        return false;
      }
      if (!bairroTrimmed) {
        setErrorMessage('Por favor, informe o bairro do endereço.');
        return false;
      }
      if (!cidadeTrimmed) {
        setErrorMessage('Por favor, informe a cidade do endereço.');
        return false;
      }
      if (estadoTrimmed.length !== 2) {
        setErrorMessage('Por favor, informe a UF do estado com 2 caracteres (ex: MG, SP).');
        return false;
      }
    }
    return true;
  };

  const prepararPayloadCliente = (values: ClienteFormValues): ClienteFormData => {
    let enderecoPayload = undefined;
    if (values.endereco && values.endereco.logradouro && values.endereco.logradouro.trim() !== '') {
      const end = values.endereco;
      enderecoPayload = {
        cep: end.cep?.trim() || undefined,
        logradouro: end.logradouro!.trim(),
        numero: end.numero!.trim(),
        complemento: end.complemento?.trim() || undefined,
        bairro: end.bairro!.trim(),
        cidade: end.cidade!.trim(),
        estado: end.estado!.trim().toUpperCase(),
      };
    }

    return {
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
  };

  const handleAvancarParaEquipamento = async () => {
    setErrorMessage(null);
    const isValid = await trigger();
    if (!isValid) return;

    const values = getValues();
    if (!validarEndereco(values)) return;

    setEtapa(2);
  };

  const validarCamposMaquina = (): boolean => {
    const erros: Record<string, string> = {};
    if (!maquinaData.marca?.trim()) erros.marca = 'A marca do equipamento é obrigatória.';
    if (!maquinaData.modelo?.trim()) erros.modelo = 'O modelo do equipamento é obrigatório.';
    if (
      maquinaData.anoFabricacao &&
      (isNaN(Number(maquinaData.anoFabricacao)) ||
        Number(maquinaData.anoFabricacao) < 1900 ||
        Number(maquinaData.anoFabricacao) > 2100)
    ) {
      erros.anoFabricacao = 'Ano de fabricação deve estar entre 1900 e 2100.';
    }
    setMaquinaFieldErrors(erros);
    return Object.keys(erros).length === 0;
  };

  // Submissão normal de apenas cliente (usado quando incluirEquipamento é false)
  const onSubmitApenasCliente = async (values: ClienteFormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    if (!validarEndereco(values)) {
      setIsSubmitting(false);
      return;
    }

    const payload = prepararPayloadCliente(values);

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

      if (onSuccess) {
        onSuccess(data);
      }
      reset();
      onClose();
    } catch {
      setErrorMessage('Falha de conexão com o servidor. Verifique se o backend está ativo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submissão integrada: Cliente + Equipamento
  const handleConcluirClienteEEquipamento = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validarCamposMaquina()) return;

    const values = getValues();
    if (!validarEndereco(values)) {
      setEtapa(1);
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Cadastra o Cliente
      const clientePayload = prepararPayloadCliente(values);
      const resCliente = await apiFetch('/api/clientes', {
        method: 'POST',
        body: JSON.stringify(clientePayload),
      });

      const dataCliente = await resCliente.json();

      if (!resCliente.ok) {
        setErrorMessage(dataCliente.message || 'Erro ao cadastrar cliente.');
        setEtapa(1); // Volta para a etapa 1 para correção de eventuais duplicidades (ex: CPF)
        setIsSubmitting(false);
        return;
      }

      const clienteSalvo: Cliente = dataCliente;

      // 2. Cadastra a Máquina vinculada ao Cliente recém-criado
      const maquinaPayload = {
        clienteId: clienteSalvo.id,
        tipoEquipamento: maquinaData.tipoEquipamento,
        marca: maquinaData.marca.trim(),
        modelo: maquinaData.modelo.trim(),
        anoFabricacao: maquinaData.anoFabricacao ? Number(maquinaData.anoFabricacao) : null,
        numeroSerie: maquinaData.numeroSerie.trim() || null,
        horimetro: maquinaData.horimetro
          ? maquinaData.horimetro.replace(/\s+/g, '').replace(',', '.')
          : null,
        potencia: maquinaData.potencia.trim() || null,
        tensao: maquinaData.tensao.trim() || null,
        observacoes: maquinaData.observacoes.trim() || null,
      };

      const resMaquina = await apiFetch('/api/maquinas', {
        method: 'POST',
        body: JSON.stringify(maquinaPayload),
      });

      const dataMaquina = await resMaquina.json();

      if (!resMaquina.ok) {
        setErrorMessage(
          dataMaquina.message ||
            'Cliente cadastrado, mas ocorreu um erro ao salvar o equipamento. Por favor, verifique os campos do equipamento.'
        );
        setIsSubmitting(false);
        return;
      }

      const maquinaSalva: Maquina = dataMaquina;

      if (onSuccessComEquipamento) {
        onSuccessComEquipamento(clienteSalvo, maquinaSalva);
      } else if (onSuccess) {
        onSuccess(clienteSalvo);
      }

      reset();
      setEtapa(1);
      onClose();
    } catch {
      setErrorMessage('Falha de comunicação com o servidor ao processar o cadastro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setErrorMessage(null);
    setEtapa(1);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCloseModal();
      }}
    >
      <div className="relative w-full max-w-3xl my-4 sm:my-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              {incluirEquipamento ? (
                etapa === 1 ? (
                  tipoPessoaAtual === 'JURIDICA' ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />
                ) : (
                  <Wrench className="w-5 h-5" />
                )
              ) : isEditing ? (
                <User className="w-5 h-5" />
              ) : tipoPessoaAtual === 'JURIDICA' ? (
                <Building2 className="w-5 h-5" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  {incluirEquipamento
                    ? 'Nova Ordem de Serviço — Cadastro'
                    : isEditing
                    ? 'Editar Cliente'
                    : 'Novo Cliente'}
                </h2>
                {incluirEquipamento && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Etapa {etapa} de 2
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {incluirEquipamento
                  ? etapa === 1
                    ? 'Passo 1: Informe os dados cadastrais do cliente proprietário'
                    : 'Passo 2: Cadastre o equipamento que dará entrada na oficina'
                  : 'Cadastro de Pessoa Física ou Pessoa Jurídica'}
              </p>
            </div>
          </div>

          <button
            onClick={handleCloseModal}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Visual (quando em modo com equipamento) */}
        {incluirEquipamento && (
          <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800 flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setEtapa(1)}
              className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                etapa === 1
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                1
              </div>
              <span>Dados do cliente</span>
            </button>

            <span className="text-slate-600 text-xs">→</span>

            <button
              type="button"
              onClick={handleAvancarParaEquipamento}
              className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                etapa === 2
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-slate-700 text-white text-[10px] font-black flex items-center justify-center">
                2
              </div>
              <span>Dados do equipamento</span>
            </button>
          </div>
        )}

        {/* Mensagem de Erro Geral */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            {(errorMessage.includes('Já existe') ||
              errorMessage.includes('duplicad') ||
              errorMessage.includes('CPF/CNPJ')) && (
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold text-[11px] transition-colors self-start sm:self-auto cursor-pointer"
              >
                Voltar para pesquisar cliente existente
              </button>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ETAPA 1: DADOS DO CLIENTE */}
        {/* ========================================================================= */}
        {etapa === 1 && (
          <form
            onSubmit={
              incluirEquipamento
                ? (e) => {
                    e.preventDefault();
                    handleAvancarParaEquipamento();
                  }
                : handleSubmit(onSubmitApenasCliente)
            }
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
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
                    <label className={LABEL_CLASS}>
                      {tipoPessoaAtual === 'JURIDICA' ? 'Razão Social *' : 'Nome Completo *'}
                    </label>
                    <input
                      type="text"
                      {...register('nomeRazaoSocial')}
                      placeholder={tipoPessoaAtual === 'JURIDICA' ? 'Ex: Metalúrgica Aço Forte LTDA' : 'Ex: João da Silva'}
                      className={INPUT_CLASS}
                    />
                    {errors.nomeRazaoSocial && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.nomeRazaoSocial.message}</p>
                    )}
                  </div>

                  {tipoPessoaAtual === 'JURIDICA' && (
                    <div>
                      <label className={LABEL_CLASS}>Nome Fantasia</label>
                      <input
                        type="text"
                        {...register('nomeFantasia')}
                        placeholder="Ex: Aço Forte Geradores"
                        className={INPUT_CLASS}
                      />
                    </div>
                  )}

                  <div>
                    <label className={LABEL_CLASS}>
                      {tipoPessoaAtual === 'JURIDICA' ? 'CNPJ' : 'CPF'}
                    </label>
                    <input
                      type="text"
                      {...register('cpfCnpj')}
                      placeholder={tipoPessoaAtual === 'JURIDICA' ? '00.000.000/0000-00' : '000.000.000-00'}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
                      {tipoPessoaAtual === 'JURIDICA' ? 'Inscrição Estadual' : 'RG'}
                    </label>
                    <input
                      type="text"
                      {...register('rgIe')}
                      placeholder={tipoPessoaAtual === 'JURIDICA' ? 'Inscrição Estadual' : 'Número do RG'}
                      className={INPUT_CLASS}
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
                    <label className={LABEL_CLASS}>Telefone Fixo</label>
                    <input
                      type="text"
                      {...register('telefone')}
                      placeholder="(31) 3333-0000"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>Celular / WhatsApp</label>
                    <input
                      type="text"
                      {...register('celular')}
                      placeholder="(31) 99999-0000"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>E-mail</label>
                    <input
                      type="email"
                      {...register('email')}
                      placeholder="cliente@email.com"
                      className={INPUT_CLASS}
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
                    <label className={LABEL_CLASS}>CEP</label>
                    <input
                      type="text"
                      {...register('endereco.cep')}
                      placeholder="30000-000"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={LABEL_CLASS}>Logradouro (Rua / Av.)</label>
                    <input
                      type="text"
                      {...register('endereco.logradouro')}
                      placeholder="Ex: Av. Amazonas"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>Número</label>
                    <input
                      type="text"
                      {...register('endereco.numero')}
                      placeholder="100"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>Complemento</label>
                    <input
                      type="text"
                      {...register('endereco.complemento')}
                      placeholder="Galpão 2, Sala 10"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>Bairro</label>
                    <input
                      type="text"
                      {...register('endereco.bairro')}
                      placeholder="Centro"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>Cidade</label>
                    <input
                      type="text"
                      {...register('endereco.cidade')}
                      placeholder="Belo Horizonte"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>UF</label>
                    <input
                      type="text"
                      maxLength={2}
                      {...register('endereco.estado')}
                      placeholder="MG"
                      className={`${INPUT_CLASS} uppercase`}
                    />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className={LABEL_CLASS}>Observações Técnicas / Comerciais</label>
                <textarea
                  rows={2}
                  {...register('observacoes')}
                  placeholder="Informações sobre preferências do cliente ou observações gerais..."
                  className={`${INPUT_CLASS} resize-none`}
                />
              </div>
            </div>

            {/* Botões de Ação da Etapa 1 */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              {incluirEquipamento ? (
                <button
                  type="button"
                  onClick={handleAvancarParaEquipamento}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
                >
                  <span>Avançar para dados do equipamento</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/10 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSubmitting ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Cliente'}</span>
                </button>
              )}
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* ETAPA 2: DADOS DO EQUIPAMENTO (MODO INTEGRADO) */}
        {/* ========================================================================= */}
        {etapa === 2 && (
          <form onSubmit={handleConcluirClienteEEquipamento} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Resumo do Cliente Selecionado nesta etapa */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 uppercase font-semibold">Cliente em Cadastro</p>
                    <p className="text-xs font-bold text-white">
                      {getValues('nomeRazaoSocial') || 'Cliente Proprietário'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEtapa(1)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
                >
                  Editar dados do cliente
                </button>
              </div>

              {/* Seletor do Tipo de Equipamento */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Tipo de Equipamento da Oficina *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {TIPO_EQUIPAMENTO_OPTIONS.map((opt) => {
                    const isSelected = maquinaData.tipoEquipamento === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setMaquinaData((prev) => ({ ...prev, tipoEquipamento: opt.value }))
                        }
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-lg">{opt.icon}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                        </div>
                        <div className="mt-2">
                          <p className={`text-xs font-bold ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                            {opt.label}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Marca e Modelo */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-amber-400/90 uppercase tracking-wider">
                  Identificação do Equipamento
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_CLASS}>
                      Marca <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={maquinaData.marca}
                      onChange={(e) => {
                        setMaquinaData({ ...maquinaData, marca: e.target.value });
                        if (maquinaFieldErrors.marca) {
                          setMaquinaFieldErrors((prev) => ({ ...prev, marca: '' }));
                        }
                      }}
                      placeholder={
                        maquinaData.tipoEquipamento === 'MAQUINA_SOLDA'
                          ? 'Ex: ESAB, Balmer, Lincoln, Boxer'
                          : maquinaData.tipoEquipamento === 'GERADOR_ENERGIA'
                          ? 'Ex: Toyama, Branco, Buffalo, Cummins'
                          : 'Ex: Schulz, Makita, Bosch'
                      }
                      className={`${INPUT_CLASS} ${maquinaFieldErrors.marca ? 'border-red-500/60' : ''}`}
                    />
                    {maquinaFieldErrors.marca && (
                      <p className="mt-1 text-[11px] text-red-400">{maquinaFieldErrors.marca}</p>
                    )}
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
                      Modelo <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={maquinaData.modelo}
                      onChange={(e) => {
                        setMaquinaData({ ...maquinaData, modelo: e.target.value });
                        if (maquinaFieldErrors.modelo) {
                          setMaquinaFieldErrors((prev) => ({ ...prev, modelo: '' }));
                        }
                      }}
                      placeholder={
                        maquinaData.tipoEquipamento === 'MAQUINA_SOLDA'
                          ? 'Ex: LHN 280i Plus, Smashweld 450'
                          : maquinaData.tipoEquipamento === 'GERADOR_ENERGIA'
                          ? 'Ex: TG8000CXR, B4T-6500'
                          : 'Ex: Modelo do equipamento'
                      }
                      className={`${INPUT_CLASS} ${maquinaFieldErrors.modelo ? 'border-red-500/60' : ''}`}
                    />
                    {maquinaFieldErrors.modelo && (
                      <p className="mt-1 text-[11px] text-red-400">{maquinaFieldErrors.modelo}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Série e Ano */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASS}>
                    <Hash className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-slate-500" />
                    Número de Série
                  </label>
                  <input
                    type="text"
                    value={maquinaData.numeroSerie}
                    onChange={(e) => setMaquinaData({ ...maquinaData, numeroSerie: e.target.value })}
                    placeholder="Ex: SN-2024-9988"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS}>
                    <Calendar className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-slate-500" />
                    Ano de Fabricação
                  </label>
                  <input
                    type="number"
                    value={maquinaData.anoFabricacao}
                    onChange={(e) => {
                      setMaquinaData({ ...maquinaData, anoFabricacao: e.target.value });
                      if (maquinaFieldErrors.anoFabricacao) {
                        setMaquinaFieldErrors((prev) => ({ ...prev, anoFabricacao: '' }));
                      }
                    }}
                    placeholder="Ex: 2022"
                    min={1900}
                    max={2100}
                    className={`${INPUT_CLASS} ${maquinaFieldErrors.anoFabricacao ? 'border-red-500/60' : ''}`}
                  />
                  {maquinaFieldErrors.anoFabricacao && (
                    <p className="mt-1 text-[11px] text-red-400">{maquinaFieldErrors.anoFabricacao}</p>
                  )}
                </div>
              </div>

              {/* Potência, Tensão e Horímetro */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={LABEL_CLASS}>
                    <Zap className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-slate-500" />
                    Potência
                  </label>
                  <input
                    type="text"
                    value={maquinaData.potencia}
                    onChange={(e) => setMaquinaData({ ...maquinaData, potencia: e.target.value })}
                    placeholder={
                      maquinaData.tipoEquipamento === 'MAQUINA_SOLDA'
                        ? 'Ex: 200A, 250A'
                        : maquinaData.tipoEquipamento === 'GERADOR_ENERGIA'
                        ? 'Ex: 5.5 kVA, 10 kVA'
                        : 'Ex: 3 HP'
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS}>
                    <Zap className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-slate-500" />
                    Tensão
                  </label>
                  <input
                    type="text"
                    value={maquinaData.tensao}
                    onChange={(e) => setMaquinaData({ ...maquinaData, tensao: e.target.value })}
                    placeholder={
                      maquinaData.tipoEquipamento === 'MAQUINA_SOLDA'
                        ? 'Ex: 220V Monofásico / 380V Trifásico'
                        : 'Ex: 110V/220V Bivolt'
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS}>
                    <Gauge className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-slate-500" />
                    Horímetro (Horas de Uso)
                  </label>
                  <input
                    type="text"
                    value={maquinaData.horimetro}
                    onChange={(e) => setMaquinaData({ ...maquinaData, horimetro: e.target.value })}
                    placeholder={
                      maquinaData.tipoEquipamento === 'GERADOR_ENERGIA'
                        ? 'Ex: 1250.5 h'
                        : 'Ex: 120 h (se houver)'
                    }
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Observações Técnicas e Especificações */}
              <div>
                <label className={LABEL_CLASS}>
                  Observações Técnicas & Especificações
                </label>
                <textarea
                  rows={2}
                  value={maquinaData.observacoes}
                  onChange={(e) => setMaquinaData({ ...maquinaData, observacoes: e.target.value })}
                  placeholder={
                    maquinaData.tipoEquipamento === 'MAQUINA_SOLDA'
                      ? 'Ex: Processo MIG/MAG e Eletrodo, tocha Euro-conector 3m inclusa...'
                      : maquinaData.tipoEquipamento === 'GERADOR_ENERGIA'
                      ? 'Ex: Motor 4 tempos diesel, partida elétrica e manual...'
                      : 'Ex: Informações técnicas ou acessórios deixados...'
                  }
                  className={`${INPUT_CLASS} resize-none`}
                />
              </div>
            </div>

            {/* Botões de Ação da Etapa 2 */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEtapa(1)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar para Dados do Cliente</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando Cliente e Equipamento...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Continuar para Ordem de Serviço</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

