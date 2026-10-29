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
      <span className="text-xs text-subtle font-semibold">{label}</span>
      <span className={`text-sm font-medium ${muted ? 'text-subtle italic' : 'text-ink'}`}>
        {valor || <span className="text-subtle italic">Não informado</span>}
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
        body: JSON.stringify(form),
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

  const inputClass = 'ui-field';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-muted text-sm">Carregando configuração...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="p-6 bg-danger/10 border border-danger/30 rounded-xl text-danger flex items-start gap-3">
          <Info aria-hidden="true" className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Erro ao carregar configuração</p>
            <p className="text-sm mt-1">{error}</p>
            <button onClick={loadConfig} className="mt-3 text-xs underline text-danger hover:text-danger">
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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20 shrink-0">
            <Settings aria-hidden="true" className="w-5 h-5 text-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="ui-page-title">Configurações da Oficina</h1>
            <p className="text-sm text-muted mt-0.5">
              Dados comerciais de referência — usados nos documentos da oficina
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start">
          <button
            onClick={loadConfig}
            className="ui-icon-btn p-2 rounded-lg bg-elevated border border-control text-muted hover:text-ink transition-all"
            title="Recarregar"
          >
            <RefreshCw aria-hidden="true" className="w-4 h-4" />
          </button>
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/20 transition-all"
            >
              Editar
            </button>
          )}
        </div>
      </div>

      {/* Aviso importante */}
      <div className="p-4 bg-surface/5 border border-line rounded-xl flex items-start gap-3">
        <Info aria-hidden="true" className="w-4 h-4 text-ink mt-0.5 shrink-0" />
        <p className="text-xs text-ink leading-relaxed">
          <strong>Sistema:</strong> {OFICINA.nomeSistema} &nbsp;•&nbsp;
          <strong>Oficina:</strong> {config?.nomeFantasia || OFICINA.nomeFantasia}
          <br />
          Os dados abaixo são utilizados nos documentos comerciais da oficina (PDF da OS, Recibo, Documento de Serviço, mensagens do WhatsApp).
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-surface/5 border border-line rounded-xl text-ink text-sm flex items-center gap-2">
          <Shield aria-hidden="true" className="w-4 h-4 shrink-0" />
          Configuração salva com sucesso!
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm flex items-center gap-2">
          <Info aria-hidden="true" className="w-4 h-4 shrink-0" />
          {saveError}
        </div>
      )}

      {/* Seção 1: Identidade Comercial */}
      <div className="bg-surface/60 border border-line rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-ink font-semibold">
          <Building2 aria-hidden="true" className="w-4 h-4 text-accent" />
          <span>Identidade Comercial</span>
        </div>

        {editMode ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="field-src-app-authenticated-configuracoes-page-tsx-1" className="block text-xs text-muted mb-1.5 font-medium">Nome Fantasia / Comercial *</label>
              <input id="field-src-app-authenticated-configuracoes-page-tsx-1"
                className={inputClass}
                value={form.nomeFantasia}
                onChange={e => setForm(f => ({ ...f, nomeFantasia: e.target.value }))}
                placeholder="Ex: Bruno Soldas"
              />
            </div>
            <div>
              <label htmlFor="field-src-app-authenticated-configuracoes-page-tsx-2" className="block text-xs text-muted mb-1.5 font-medium">Nome Empresarial / Razão Social</label>
              <input id="field-src-app-authenticated-configuracoes-page-tsx-2"
                className={inputClass}
                value={form.nomeEmpresarial}
                onChange={e => setForm(f => ({ ...f, nomeEmpresarial: e.target.value }))}
                placeholder="Ex: 45.076.507 BRUNO SOARES RODRIGUES"
              />
            </div>
            <div>
              <label htmlFor="field-src-app-authenticated-configuracoes-page-tsx-3" className="block text-xs text-muted mb-1.5 font-medium">Responsável / Proprietário</label>
              <input id="field-src-app-authenticated-configuracoes-page-tsx-3"
                className={inputClass}
                value={form.responsavel}
                onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))}
                placeholder="Nome do responsável"
              />
            </div>
            <div>
              <label htmlFor="field-src-app-authenticated-configuracoes-page-tsx-4" className="block text-xs text-muted mb-1.5 font-medium">CNPJ</label>
              <input id="field-src-app-authenticated-configuracoes-page-tsx-4"
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
      <div className="bg-surface/60 border border-line rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-ink font-semibold">
          <Phone aria-hidden="true" className="w-4 h-4 text-accent" />
          <span>Contato</span>
        </div>

        {editMode ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="field-src-app-authenticated-configuracoes-page-tsx-5" className="block text-xs text-muted mb-1.5 font-medium">Telefone</label>
              <input id="field-src-app-authenticated-configuracoes-page-tsx-5"
                className={inputClass}
                value={form.telefone}
                onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                placeholder="Ex: (14) 9886-7223"
              />
            </div>
            <div>
              <label htmlFor="field-src-app-authenticated-configuracoes-page-tsx-6" className="block text-xs text-muted mb-1.5 font-medium">E-mail</label>
              <input id="field-src-app-authenticated-configuracoes-page-tsx-6"
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
      <div className="bg-surface/60 border border-line rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-ink font-semibold">
          <MapPin aria-hidden="true" className="w-4 h-4 text-accent" />
          <span>Endereço</span>
        </div>

        {editMode ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="field-src-app-authenticated-configuracoes-page-tsx-7" className="block text-xs text-muted mb-1.5 font-medium">Logradouro</label>
              <input id="field-src-app-authenticated-configuracoes-page-tsx-7" className={inputClass} value={form.logradouro} onChange={e => setForm(f => ({ ...f, logradouro: e.target.value }))} placeholder="Rua, Avenida, etc." />
            </div>
            <div>
              <label htmlFor="field-src-app-authenticated-configuracoes-page-tsx-8" className="block text-xs text-muted mb-1.5 font-medium">Número</label>
              <input id="field-src-app-authenticated-configuracoes-page-tsx-8" className={inputClass} value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="Ex: 1538" />
            </div>
            <div>
              <label htmlFor="field-src-app-authenticated-configuracoes-page-tsx-9" className="block text-xs text-muted mb-1.5 font-medium">Bairro</label>
              <input id="field-src-app-authenticated-configuracoes-page-tsx-9" className={inputClass} value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} placeholder="Bairro" />
            </div>
            <div>
              <label htmlFor="field-src-app-authenticated-configuracoes-page-tsx-10" className="block text-xs text-muted mb-1.5 font-medium">CEP</label>
              <input id="field-src-app-authenticated-configuracoes-page-tsx-10" className={inputClass} value={form.cep} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))} placeholder="Ex: 19.914-080" />
            </div>
            <div>
              <label htmlFor="field-src-app-authenticated-configuracoes-page-tsx-11" className="block text-xs text-muted mb-1.5 font-medium">Município</label>
              <input id="field-src-app-authenticated-configuracoes-page-tsx-11" className={inputClass} value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))} placeholder="Cidade" />
            </div>
            <div>
              <label htmlFor="field-src-app-authenticated-configuracoes-page-tsx-12" className="block text-xs text-muted mb-1.5 font-medium">UF</label>
              <input id="field-src-app-authenticated-configuracoes-page-tsx-12" className={inputClass} value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} placeholder="SP" maxLength={2} />
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
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-elevated border border-control text-ink text-sm font-semibold hover:bg-hover transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !form.nomeFantasia.trim()}
            className="ui-btn ui-btn-primary flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <><div className="w-4 h-4 border-2 border-line border-t-transparent rounded-full animate-spin" />Salvando...</>
            ) : (
              <><Save aria-hidden="true" className="w-4 h-4" />Salvar Configuração</>
            )}
          </button>
        </div>
      )}

      {/* Rodapé informativo */}
      <div className="text-center pt-2">
        <p className="text-xs text-subtle">
          Sistema: <span className="text-subtle">{OFICINA.nomeSistema}</span>
          &nbsp;•&nbsp;
          {config?.updatedAt && (
            <>Última atualização: {new Date(config.updatedAt).toLocaleString('pt-BR')}</>
          )}
        </p>
      </div>
    </div>
  );
}
