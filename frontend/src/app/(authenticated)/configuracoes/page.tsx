'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Building2, Phone, MapPin, Shield, Save, RefreshCw, Info } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { OFICINA } from '@/lib/oficina';

interface ConfiguracaoOficina {
  id: number;
  nomeSistema: string;
  nomeFantasia: string;
  nomeEmpresarial: string | null;
  cnpj: string | null;
  responsavel: string | null;
  telefone: string | null;
  email: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
  updatedAt: string;
}

function Campo({ label, valor, muted }: { label: string; valor: string | null | undefined; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">{label}</span>
      <span className={`text-sm font-medium ${muted ? 'text-slate-500 italic' : 'text-slate-100'}`}>
        {valor || <span className="text-slate-600 italic">Não informado</span>}
      </span>
    </div>
  );
}

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<ConfiguracaoOficina | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const [form, setForm] = useState({
    nomeFantasia: '',
    nomeEmpresarial: '',
    cnpj: '',
    responsavel: '',
    telefone: '',
    email: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cep: '',
    municipio: '',
    uf: '',
  });

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/configuracao-oficina');
      if (!res.ok) throw new Error(`Erro ${res.status}: ${res.statusText}`);
      const data: ConfiguracaoOficina = await res.json();
      setConfig(data);
      setForm({
        nomeFantasia: data.nomeFantasia || '',
        nomeEmpresarial: data.nomeEmpresarial || '',
        cnpj: data.cnpj || '',
        responsavel: data.responsavel || '',
        telefone: data.telefone || '',
        email: data.email || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        bairro: data.bairro || '',
        cep: data.cep || '',
        municipio: data.municipio || '',
        uf: data.uf || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar configuração.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const res = await apiFetch('/api/configuracao-oficina', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          nomeEmpresarial: form.nomeEmpresarial || null,
          cnpj: form.cnpj || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Erro ${res.status}`);
      }
      const updated: ConfiguracaoOficina = await res.json();
      setConfig(updated);
      setSaveSuccess(true);
      setEditMode(false);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    if (config) {
      setForm({
        nomeFantasia: config.nomeFantasia || '',
        nomeEmpresarial: config.nomeEmpresarial || '',
        cnpj: config.cnpj || '',
        responsavel: config.responsavel || '',
        telefone: config.telefone || '',
        email: config.email || '',
        logradouro: config.logradouro || '',
        numero: config.numero || '',
        bairro: config.bairro || '',
        cep: config.cep || '',
        municipio: config.municipio || '',
        uf: config.uf || '',
      });
    }
    setEditMode(false);
    setSaveError(null);
  }

  const inputClass = 'w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Carregando configuração...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="p-6 bg-red-950/30 border border-red-500/30 rounded-xl text-red-400 flex items-start gap-3">
          <Info className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Erro ao carregar configuração</p>
            <p className="text-sm mt-1">{error}</p>
            <button onClick={loadConfig} className="mt-3 text-xs underline text-red-300 hover:text-red-100">
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Settings className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Configurações da Oficina</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Dados comerciais de referência — usados nos documentos da oficina
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadConfig}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-all"
            title="Recarregar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/20 transition-all"
            >
              Editar
            </button>
          )}
        </div>
      </div>

      {/* Aviso importante */}
      <div className="p-4 bg-blue-950/30 border border-blue-500/20 rounded-xl flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-300 leading-relaxed">
          <strong>Sistema:</strong> {OFICINA.nomeSistema} &nbsp;•&nbsp;
          <strong>Oficina:</strong> {config?.nomeFantasia || OFICINA.nomeFantasia}
          <br />
          Os dados abaixo são utilizados nos documentos comerciais da oficina (PDF da OS, Recibo, Documento de Serviço, mensagens do WhatsApp).
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
          <Shield className="w-4 h-4 shrink-0" />
          Configuração salva com sucesso!
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          {saveError}
        </div>
      )}

      {/* Seção 1: Identidade Comercial */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-200 font-semibold">
          <Building2 className="w-4 h-4 text-amber-400" />
          <span>Identidade Comercial</span>
        </div>

        {editMode ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Nome Fantasia / Comercial *</label>
              <input
                className={inputClass}
                value={form.nomeFantasia}
                onChange={e => setForm(f => ({ ...f, nomeFantasia: e.target.value }))}
                placeholder="Ex: Bruno Soldas"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Nome Empresarial / Razão Social</label>
              <input
                className={inputClass}
                value={form.nomeEmpresarial}
                onChange={e => setForm(f => ({ ...f, nomeEmpresarial: e.target.value }))}
                placeholder="Ex: 45.076.507 BRUNO SOARES RODRIGUES"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Responsável / Proprietário</label>
              <input
                className={inputClass}
                value={form.responsavel}
                onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))}
                placeholder="Nome do responsável"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">CNPJ</label>
              <input
                className={inputClass}
                value={form.cnpj}
                onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                placeholder="Ex: 45.076.507/0001-67"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Nome Fantasia / Comercial" valor={config?.nomeFantasia} />
            <Campo label="Nome Empresarial / Razão Social" valor={config?.nomeEmpresarial} />
            <Campo label="Responsável / Proprietário" valor={config?.responsavel} />
            <Campo label="CNPJ" valor={config?.cnpj} />
          </div>
        )}
      </div>

      {/* Seção 2: Contato */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-200 font-semibold">
          <Phone className="w-4 h-4 text-amber-400" />
          <span>Contato</span>
        </div>

        {editMode ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Telefone</label>
              <input
                className={inputClass}
                value={form.telefone}
                onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                placeholder="Ex: (14) 9886-7223"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">E-mail</label>
              <input
                className={inputClass}
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="Ex: contato@brunasoldas.com.br"
                type="email"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Telefone" valor={config?.telefone} />
            <Campo label="E-mail" valor={config?.email} />
          </div>
        )}
      </div>

      {/* Seção 3: Endereço */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-200 font-semibold">
          <MapPin className="w-4 h-4 text-amber-400" />
          <span>Endereço</span>
        </div>

        {editMode ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Logradouro</label>
              <input className={inputClass} value={form.logradouro} onChange={e => setForm(f => ({ ...f, logradouro: e.target.value }))} placeholder="Rua, Avenida, etc." />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Número</label>
              <input className={inputClass} value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="Ex: 1538" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Bairro</label>
              <input className={inputClass} value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} placeholder="Bairro" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">CEP</label>
              <input className={inputClass} value={form.cep} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))} placeholder="Ex: 19.914-080" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Município</label>
              <input className={inputClass} value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))} placeholder="Cidade" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">UF</label>
              <input className={inputClass} value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} placeholder="SP" maxLength={2} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2"><Campo label="Logradouro" valor={config?.logradouro} /></div>
            <Campo label="Número" valor={config?.numero} />
            <Campo label="Bairro" valor={config?.bairro} />
            <Campo label="CEP" valor={config?.cep} />
            <Campo label="Município" valor={config?.municipio} />
            <Campo label="UF" valor={config?.uf} />
          </div>
        )}
      </div>

      {/* Botões de ação */}
      {editMode && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !form.nomeFantasia.trim()}
            className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-900 text-sm font-bold flex items-center gap-2 hover:bg-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <><div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />Salvando...</>
            ) : (
              <><Save className="w-4 h-4" />Salvar Configuração</>
            )}
          </button>
        </div>
      )}

      {/* Rodapé informativo */}
      <div className="text-center pt-2">
        <p className="text-[11px] text-slate-600">
          Sistema: <span className="text-slate-500">{OFICINA.nomeSistema}</span>
          &nbsp;•&nbsp;
          {config?.updatedAt && (
            <>Última atualização: {new Date(config.updatedAt).toLocaleString('pt-BR')}</>
          )}
        </p>
      </div>
    </div>
  );
}
