package com.oficinagestao.service;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.oficinagestao.entity.Cliente;
import com.oficinagestao.entity.Endereco;
import com.oficinagestao.entity.Maquina;
import com.oficinagestao.entity.OrdemServico;
import com.oficinagestao.entity.OrdemServicoItem;
import com.oficinagestao.entity.StatusOrdemServico;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Serviço especializado na geração de documentos PDF oficiais para Ordens de Serviço.
 * Emite documento vetorial A4 de alta qualidade, garantindo a preservação dos preços
 * históricos congelados nas peças e a clareza do status da manutenção.
 */
@Service
public class PdfService {

    private static final Locale LOCALE_PT_BR = Locale.forLanguageTag("pt-BR");
    private static final DateTimeFormatter DATA_HORA_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", LOCALE_PT_BR);
    private static final DateTimeFormatter DATA_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy", LOCALE_PT_BR);
    private static final DecimalFormat MOEDA_FORMAT = new DecimalFormat("#,##0.00", new DecimalFormatSymbols(LOCALE_PT_BR));

    // Paleta visual profissional (Slate / Navy / Clean)
    private static final Color COLOR_PRIMARY = new Color(15, 23, 42); // slate-900
    private static final Color COLOR_TEXT_MUTED = new Color(100, 116, 139); // slate-500
    private static final Color COLOR_BG_HEADER = new Color(241, 245, 249); // slate-100
    private static final Color COLOR_BORDER = new Color(203, 213, 225); // slate-300
    private static final Color COLOR_LINE = new Color(226, 232, 240); // slate-200

    private static final Font FONT_TITLE = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, COLOR_PRIMARY);
    private static final Font FONT_SUBTITLE = FontFactory.getFont(FontFactory.HELVETICA, 8, COLOR_TEXT_MUTED);
    private static final Font FONT_SECTION_TITLE = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
    private static final Font FONT_LABEL = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, COLOR_PRIMARY);
    private static final Font FONT_VALUE = FontFactory.getFont(FontFactory.HELVETICA, 8, Color.BLACK);
    private static final Font FONT_VALUE_BOLD = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, Color.BLACK);
    private static final Font FONT_FOOTER = FontFactory.getFont(FontFactory.HELVETICA, 7, COLOR_TEXT_MUTED);

    public byte[] gerarOrdemServicoPdf(OrdemServico os, List<OrdemServicoItem> itens) {
        Document document = new Document(PageSize.A4, 24, 24, 24, 24);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            // 1. Cabeçalho Oficial da Oficina e Dados da OS
            adicionarCabecalho(document, os);

            // 2. Dados do Cliente
            adicionarDadosCliente(document, os.getCliente());

            // 3. Dados do Equipamento
            adicionarDadosEquipamento(document, os.getMaquina(), os.getHorimetroAtual());

            // 4. Seção Técnica de Serviços
            adicionarDadosServico(document, os);

            // 5. Tabela de Peças e Componentes Aplicados (Preço Histórico Congelado)
            adicionarTabelaPecas(document, itens);

            // 6. Resumo Financeiro
            adicionarResumoFinanceiro(document, os);

            // 7. Termos de Garantia e Linhas de Assinatura
            adicionarTermosEAssinaturas(document, os);

            document.close();
            return out.toByteArray();
        } catch (DocumentException e) {
            throw new RuntimeException("Erro ao gerar PDF da Ordem de Serviço: " + e.getMessage(), e);
        }
    }

    private void adicionarCabecalho(Document document, OrdemServico os) throws DocumentException {
        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{60, 40});
        table.setSpacingAfter(10);

        // Coluna Esquerda: Dados da Empresa
        PdfPCell cellEmpresa = new PdfPCell();
        cellEmpresa.setBorder(PdfPCell.NO_BORDER);
        cellEmpresa.addElement(new Paragraph("OFICINA GESTÃO", FONT_TITLE));
        cellEmpresa.addElement(new Paragraph("ASSISTÊNCIA TÉCNICA ESPECIALIZADA", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, COLOR_PRIMARY)));
        cellEmpresa.addElement(new Paragraph("Máquinas de Solda • Geradores de Energia • Manutenção Industrial", FONT_SUBTITLE));
        cellEmpresa.addElement(new Paragraph("Telefone: (31) 3333-4444 | contato@oficinagestao.com.br", FONT_SUBTITLE));
        table.addCell(cellEmpresa);

        // Coluna Direita: Box de Identificação da OS
        PdfPCell cellOs = new PdfPCell();
        cellOs.setBorder(PdfPCell.BOX);
        cellOs.setBorderColor(COLOR_BORDER);
        cellOs.setBackgroundColor(COLOR_BG_HEADER);
        cellOs.setPadding(6);

        Paragraph pNum = new Paragraph("ORDEM DE SERVIÇO", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, COLOR_TEXT_MUTED));
        pNum.setAlignment(Element.ALIGN_CENTER);
        cellOs.addElement(pNum);

        Paragraph pOs = new Paragraph(os.getNumeroOs(), FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, COLOR_PRIMARY));
        pOs.setAlignment(Element.ALIGN_CENTER);
        cellOs.addElement(pOs);

        // Status com badge visual
        Color statusColor = obterCorStatus(os.getStatus());
        String statusDescricao = os.getStatus() != null ? os.getStatus().getDescricao() : "NÃO DEFINIDO";
        Paragraph pStatus = new Paragraph("STATUS: " + statusDescricao.toUpperCase(),
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, statusColor));
        pStatus.setAlignment(Element.ALIGN_CENTER);
        cellOs.addElement(pStatus);

        Paragraph pDatas = new Paragraph("Entrada: " + formatarData(os.getDataEntrada()) +
                (os.getDataConclusao() != null ? " | Conclusão: " + formatarData(os.getDataConclusao()) : ""),
                FontFactory.getFont(FontFactory.HELVETICA, 7, COLOR_TEXT_MUTED));
        pDatas.setAlignment(Element.ALIGN_CENTER);
        cellOs.addElement(pDatas);

        table.addCell(cellOs);
        document.add(table);
    }

    private void adicionarDadosCliente(Document document, Cliente cliente) throws DocumentException {
        adicionarTituloSecao(document, "1. DADOS DO CLIENTE");

        PdfPTable table = new PdfPTable(4);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{30, 20, 25, 25});
        table.setSpacingAfter(8);

        // Linha 1
        adicionarCelulaCampo(table, "Nome / Razão Social:", cliente.getNomeRazaoSocial(), 2);
        adicionarCelulaCampo(table, "CPF / CNPJ:", formatarVazio(cliente.getCpfCnpj()), 1);
        String fone = cliente.getTelefone() != null ? cliente.getTelefone() : cliente.getCelular();
        adicionarCelulaCampo(table, "Telefone / Contato:", formatarVazio(fone), 1);

        // Linha 2
        adicionarCelulaCampo(table, "E-mail:", formatarVazio(cliente.getEmail()), 2);
        String enderecoFormatado = obterEnderecoFormatado(cliente);
        adicionarCelulaCampo(table, "Endereço:", enderecoFormatado, 2);

        document.add(table);
    }

    private void adicionarDadosEquipamento(Document document, Maquina maquina, BigDecimal horimetroAtual) throws DocumentException {
        adicionarTituloSecao(document, "2. DADOS DO EQUIPAMENTO");

        PdfPTable table = new PdfPTable(4);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{25, 25, 25, 25});
        table.setSpacingAfter(8);

        String tipoDescricao = maquina.getTipoEquipamento() != null ? maquina.getTipoEquipamento().getDescricao() : "Equipamento Técnico";
        adicionarCelulaCampo(table, "Tipo:", tipoDescricao, 1);
        adicionarCelulaCampo(table, "Marca:", formatarVazio(maquina.getMarca()), 1);
        adicionarCelulaCampo(table, "Modelo:", formatarVazio(maquina.getModelo()), 1);
        adicionarCelulaCampo(table, "Nº de Série:", formatarVazio(maquina.getNumeroSerie()), 1);

        String tensao = formatarVazio(maquina.getTensao());
        String potencia = formatarVazio(maquina.getPotencia());
        adicionarCelulaCampo(table, "Tensão:", tensao, 1);
        adicionarCelulaCampo(table, "Potência:", potencia, 1);

        String horimetroStr = horimetroAtual != null ? horimetroAtual.toPlainString() + " h" :
                (maquina.getHorimetro() != null ? maquina.getHorimetro().toPlainString() + " h" : "Não informado");
        adicionarCelulaCampo(table, "Horímetro:", horimetroStr, 2);

        document.add(table);
    }

    private void adicionarDadosServico(Document document, OrdemServico os) throws DocumentException {
        adicionarTituloSecao(document, "3. DIAGNÓSTICO E SERVIÇOS TÉCNICOS");

        PdfPTable table = new PdfPTable(1);
        table.setWidthPercentage(100);
        table.setSpacingAfter(8);

        adicionarCelulaTextoLongo(table, "Problema Relatado:", os.getProblemaRelatado());
        adicionarCelulaTextoLongo(table, "Diagnóstico Técnico:", os.getDiagnostico() != null ? os.getDiagnostico() : "Diagnóstico em elaboração.");
        adicionarCelulaTextoLongo(table, "Solução Aplicada:", os.getSolucaoAplicada() != null ? os.getSolucaoAplicada() : "Manutenção técnica em andamento.");

        if (os.getTestesRealizados() != null && !os.getTestesRealizados().isBlank()) {
            adicionarCelulaTextoLongo(table, "Testes Realizados na Bancada:", os.getTestesRealizados());
        }

        if (os.getObservacoes() != null && !os.getObservacoes().isBlank()) {
            adicionarCelulaTextoLongo(table, "Observações Adicionais:", os.getObservacoes());
        }

        document.add(table);
    }

    private void adicionarTabelaPecas(Document document, List<OrdemServicoItem> itens) throws DocumentException {
        adicionarTituloSecao(document, "4. PEÇAS E COMPONENTES APLICADOS");

        if (itens == null || itens.isEmpty()) {
            PdfPTable emptyTable = new PdfPTable(1);
            emptyTable.setWidthPercentage(100);
            emptyTable.setSpacingAfter(8);
            PdfPCell cell = new PdfPCell(new Phrase("Nenhuma peça foi aplicada nesta Ordem de Serviço.", FONT_VALUE));
            cell.setPadding(6);
            cell.setBorderColor(COLOR_BORDER);
            cell.setBackgroundColor(new Color(248, 250, 252));
            emptyTable.addCell(cell);
            document.add(emptyTable);
            return;
        }

        PdfPTable table = new PdfPTable(7);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{14, 34, 16, 8, 14, 14, 14});
        table.setSpacingAfter(8);

        // Cabeçalho da Tabela de Peças
        String[] cabecalhos = {"Código", "Peça / Descrição", "Marca", "Qtd", "Unit. (R$)", "Desc. (R$)", "Total (R$)"};
        for (String col : cabecalhos) {
            PdfPCell c = new PdfPCell(new Phrase(col, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7, COLOR_PRIMARY)));
            c.setBackgroundColor(COLOR_BG_HEADER);
            c.setBorderColor(COLOR_BORDER);
            c.setPadding(4);
            if (col.contains("R$") || col.equals("Qtd")) {
                c.setHorizontalAlignment(Element.ALIGN_RIGHT);
            }
            table.addCell(c);
        }

        // Linhas de Peças
        for (OrdemServicoItem item : itens) {
            String cod = item.getProduto() != null ? item.getProduto().getCodigo() : "-";
            String nome = item.getProduto() != null ? item.getProduto().getNome() : "Componente Técnico";
            String marca = item.getProduto() != null && item.getProduto().getMarca() != null ? item.getProduto().getMarca() : "-";

            adicionarCelulaTabela(table, cod, Element.ALIGN_LEFT);
            adicionarCelulaTabela(table, nome, Element.ALIGN_LEFT);
            adicionarCelulaTabela(table, marca, Element.ALIGN_LEFT);
            adicionarCelulaTabela(table, item.getQuantidade().stripTrailingZeros().toPlainString(), Element.ALIGN_RIGHT);
            // VALOR UNITÁRIO CONGELADO HISTÓRICO:
            adicionarCelulaTabela(table, MOEDA_FORMAT.format(item.getValorUnitario()), Element.ALIGN_RIGHT);
            adicionarCelulaTabela(table, MOEDA_FORMAT.format(item.getValorDesconto()), Element.ALIGN_RIGHT);
            adicionarCelulaTabela(table, MOEDA_FORMAT.format(item.getValorTotal()), Element.ALIGN_RIGHT);
        }

        document.add(table);
    }

    private void adicionarResumoFinanceiro(Document document, OrdemServico os) throws DocumentException {
        adicionarTituloSecao(document, "5. RESUMO FINANCEIRO");

        PdfPTable table = new PdfPTable(4);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{25, 25, 25, 25});
        table.setSpacingAfter(10);

        BigDecimal maoObra = os.getValorMaoObra() != null ? os.getValorMaoObra() : BigDecimal.ZERO;
        BigDecimal pecas = os.getValorPecas() != null ? os.getValorPecas() : BigDecimal.ZERO;
        BigDecimal desc = os.getValorDesconto() != null ? os.getValorDesconto() : BigDecimal.ZERO;
        BigDecimal total = os.getValorTotal() != null ? os.getValorTotal() : BigDecimal.ZERO;

        adicionarCelulaFinanceira(table, "Mão de Obra:", MOEDA_FORMAT.format(maoObra), false);
        adicionarCelulaFinanceira(table, "Peças e Insumos:", MOEDA_FORMAT.format(pecas), false);
        adicionarCelulaFinanceira(table, "Desconto:", MOEDA_FORMAT.format(desc), false);
        adicionarCelulaFinanceira(table, "VALOR TOTAL:", MOEDA_FORMAT.format(total), true);

        document.add(table);
    }

    private void adicionarTermosEAssinaturas(Document document, OrdemServico os) throws DocumentException {
        // Termos Legais e Condições de Garantia
        Paragraph pTermos = new Paragraph(
                "Condições de garantia conforme política da oficina sobre os serviços executados e componentes substituídos, respeitadas as condições " +
                "normais de uso e operação do equipamento. A garantia não cobre danos por sobretensão de rede, uso indevido, " +
                "quedas ou abertura por terceiros. O equipamento poderá ser retirado somente mediante a apresentação desta via ou documento oficial.",
                FONT_FOOTER
        );
        pTermos.setSpacingAfter(20);
        document.add(pTermos);

        // Tabela de Assinaturas
        PdfPTable tableAssinaturas = new PdfPTable(2);
        tableAssinaturas.setWidthPercentage(100);
        tableAssinaturas.setWidths(new float[]{50, 50});
        tableAssinaturas.setSpacingAfter(10);

        PdfPCell cCliente = new PdfPCell();
        cCliente.setBorder(PdfPCell.NO_BORDER);
        cCliente.addElement(new Paragraph("________________________________________________", FONT_VALUE));
        cCliente.addElement(new Paragraph("Assinatura do Cliente / Responsável", FONT_VALUE_BOLD));
        cCliente.addElement(new Paragraph(os.getCliente().getNomeRazaoSocial(), FONT_SUBTITLE));
        cCliente.setHorizontalAlignment(Element.ALIGN_CENTER);
        tableAssinaturas.addCell(cCliente);

        PdfPCell cTecnico = new PdfPCell();
        cTecnico.setBorder(PdfPCell.NO_BORDER);
        cTecnico.addElement(new Paragraph("________________________________________________", FONT_VALUE));
        cTecnico.addElement(new Paragraph("Técnico Responsável / Oficina Gestão", FONT_VALUE_BOLD));
        String tecNome = os.getTecnicoResponsavel() != null ? os.getTecnicoResponsavel().getNome() : "Oficina Gestão";
        cTecnico.addElement(new Paragraph(tecNome, FONT_SUBTITLE));
        cTecnico.setHorizontalAlignment(Element.ALIGN_CENTER);
        tableAssinaturas.addCell(cTecnico);

        document.add(tableAssinaturas);

        // Rodapé com data/hora de emissão
        Paragraph pEmissao = new Paragraph("Documento gerado em " + OffsetDateTime.now().format(DATA_HORA_FORMATTER) + " • Sistema Oficina Gestão v1.0", FONT_FOOTER);
        pEmissao.setAlignment(Element.ALIGN_RIGHT);
        document.add(pEmissao);
    }

    // --- Métodos Auxiliares de Construção Visual ---

    private void adicionarTituloSecao(Document document, String titulo) throws DocumentException {
        PdfPTable table = new PdfPTable(1);
        table.setWidthPercentage(100);
        table.setSpacingBefore(4);
        table.setSpacingAfter(3);

        PdfPCell cell = new PdfPCell(new Phrase(titulo, FONT_SECTION_TITLE));
        cell.setBackgroundColor(COLOR_PRIMARY);
        cell.setPadding(4);
        cell.setBorder(PdfPCell.NO_BORDER);
        table.addCell(cell);

        document.add(table);
    }

    private void adicionarCelulaCampo(PdfPTable table, String label, String valor, int colSpan) {
        PdfPCell cell = new PdfPCell();
        cell.setColspan(colSpan);
        cell.setPadding(4);
        cell.setBorderColor(COLOR_LINE);

        Paragraph p = new Paragraph();
        p.add(new Phrase(label + " ", FONT_LABEL));
        p.add(new Phrase(valor != null ? valor : "-", FONT_VALUE));
        cell.addElement(p);

        table.addCell(cell);
    }

    private void adicionarCelulaTextoLongo(PdfPTable table, String label, String texto) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(4);
        cell.setBorderColor(COLOR_LINE);

        Paragraph pLabel = new Paragraph(label, FONT_LABEL);
        cell.addElement(pLabel);

        Paragraph pTexto = new Paragraph(texto != null ? texto : "-", FONT_VALUE);
        pTexto.setSpacingBefore(2);
        cell.addElement(pTexto);

        table.addCell(cell);
    }

    private void adicionarCelulaTabela(PdfPTable table, String texto, int alignment) {
        PdfPCell cell = new PdfPCell(new Phrase(texto, FONT_VALUE));
        cell.setPadding(4);
        cell.setBorderColor(COLOR_LINE);
        cell.setHorizontalAlignment(alignment);
        table.addCell(cell);
    }

    private void adicionarCelulaFinanceira(PdfPTable table, String label, String valor, boolean destaque) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(5);
        cell.setBorderColor(COLOR_BORDER);
        if (destaque) {
            cell.setBackgroundColor(new Color(254, 243, 199)); // amber-100
        }

        Paragraph pLabel = new Paragraph(label, destaque ? FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, COLOR_PRIMARY) : FONT_LABEL);
        cell.addElement(pLabel);

        Paragraph pValor = new Paragraph("R$ " + valor, destaque ? FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, new Color(180, 83, 9)) : FONT_VALUE_BOLD);
        pValor.setAlignment(Element.ALIGN_RIGHT);
        cell.addElement(pValor);

        table.addCell(cell);
    }

    private Color obterCorStatus(StatusOrdemServico status) {
        if (status == StatusOrdemServico.CANCELADA) {
            return new Color(220, 38, 38); // red-600
        } else if (status == StatusOrdemServico.CONCLUIDA) {
            return new Color(22, 163, 74); // green-600
        } else if (status == StatusOrdemServico.PRONTA) {
            return new Color(37, 99, 235); // blue-600
        }
        return new Color(217, 119, 6); // amber-600
    }

    private String formatarData(OffsetDateTime dateTime) {
        return dateTime != null ? dateTime.format(DATA_FORMATTER) : "-";
    }

    private String formatarVazio(String texto) {
        return (texto != null && !texto.isBlank()) ? texto : "Não informado";
    }

    private String formatarDocumento(String doc) {
        if (doc == null || doc.isBlank()) return "Não informado";
        String limpo = doc.replaceAll("\\D", "");
        if (limpo.length() == 11) {
            return limpo.substring(0, 3) + "." + limpo.substring(3, 6) + "." +
                   limpo.substring(6, 9) + "-" + limpo.substring(9, 11);
        } else if (limpo.length() == 14) {
            return limpo.substring(0, 2) + "." + limpo.substring(2, 5) + "." +
                   limpo.substring(5, 8) + "/" + limpo.substring(8, 12) + "-" + limpo.substring(12, 14);
        }
        return doc;
    }

    private String formatarTelefone(String fone) {
        if (fone == null || fone.isBlank()) return "Não informado";
        String limpo = fone.replaceAll("\\D", "");
        if (limpo.length() == 11) {
            return "(" + limpo.substring(0, 2) + ") " + limpo.substring(2, 7) + "-" + limpo.substring(7, 11);
        } else if (limpo.length() == 10) {
            return "(" + limpo.substring(0, 2) + ") " + limpo.substring(2, 6) + "-" + limpo.substring(6, 10);
        }
        return fone;
    }

    private String obterEnderecoFormatado(Cliente cliente) {
        if (cliente.getEnderecos() != null && !cliente.getEnderecos().isEmpty()) {
            Endereco end = cliente.getEnderecos().get(0);
            StringBuilder sb = new StringBuilder();
            if (end.getLogradouro() != null) sb.append(end.getLogradouro());
            if (end.getNumero() != null) sb.append(", ").append(end.getNumero());
            if (end.getBairro() != null) sb.append(" - ").append(end.getBairro());
            if (end.getCidade() != null) sb.append(", ").append(end.getCidade());
            if (end.getEstado() != null) sb.append("/").append(end.getEstado());
            if (end.getCep() != null) sb.append(" (CEP: ").append(end.getCep()).append(")");
            return sb.toString();
        }
        return "Não informado";
    }

    // =========================================================================
    // DOCUMENTO DE SERVIÇO — Comprovante Comercial (sem validade fiscal)
    // =========================================================================

    private static final Color DS_COLOR_PRIMARY   = new Color(20, 83, 45);   // green-900 — diferencia visualmente do OS
    private static final Color DS_COLOR_BORDER    = new Color(187, 247, 208); // green-200
    private static final Color DS_COLOR_BG_HEADER = new Color(240, 253, 244); // green-50
    private static final Color DS_COLOR_MUTED     = new Color(100, 116, 139); // slate-500

    private static final Font DS_FONT_TITLE        = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, new Color(20, 83, 45));
    private static final Font DS_FONT_SECTION_TITLE = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
    private static final Font DS_FONT_LABEL        = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, new Color(20, 83, 45));
    private static final Font DS_FONT_VALUE        = FontFactory.getFont(FontFactory.HELVETICA, 8, Color.BLACK);
    private static final Font DS_FONT_VALUE_BOLD   = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, Color.BLACK);
    private static final Font DS_FONT_SUBTITLE     = FontFactory.getFont(FontFactory.HELVETICA, 8, new Color(100, 116, 139));
    private static final Font DS_FONT_FOOTER       = FontFactory.getFont(FontFactory.HELVETICA, 7, new Color(100, 116, 139));
    private static final Font DS_FONT_AVISO        = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7, new Color(180, 83, 9));

    /**
     * Gera o Documento de Serviço — comprovante comercial interno da prestação de serviço.
     * Este documento NÃO possui validade fiscal e NÃO é uma Nota Fiscal.
     */
    public byte[] gerarDocumentoServicoPdf(OrdemServico os, List<OrdemServicoItem> itens) {
        Document document = new Document(PageSize.A4, 24, 24, 24, 24);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            dsAdicionarCabecalho(document, os);
            dsAdicionarDadosCliente(document, os.getCliente());
            dsAdicionarDadosEquipamento(document, os.getMaquina(), os.getHorimetroAtual());
            dsAdicionarServicosRealizados(document, os);
            dsAdicionarTabelaPecas(document, itens);
            dsAdicionarResumoFinanceiro(document, os);
            dsAdicionarInformacoesOs(document, os);
            dsAdicionarAssinaturas(document, os);

            document.close();
            return out.toByteArray();
        } catch (DocumentException e) {
            throw new RuntimeException("Erro ao gerar Documento de Serviço: " + e.getMessage(), e);
        }
    }

    private void dsAdicionarCabecalho(Document document, OrdemServico os) throws DocumentException {
        // Linha superior: banner de identificação comercial
        PdfPTable bannerTable = new PdfPTable(1);
        bannerTable.setWidthPercentage(100);
        bannerTable.setSpacingAfter(6);
        PdfPCell bannerCell = new PdfPCell(new Phrase(
                "DOCUMENTO DE SERVIÇO — COMPROVANTE COMERCIAL DE PRESTAÇÃO DE SERVIÇOS  •  " +
                "Comprovante de atendimento para simples conferência. Sem valor tributário.",
                DS_FONT_AVISO));
        bannerCell.setBackgroundColor(new Color(254, 243, 199)); // amber-100
        bannerCell.setBorderColor(new Color(251, 191, 36));      // amber-400
        bannerCell.setHorizontalAlignment(Element.ALIGN_CENTER);
        bannerCell.setPadding(4);
        bannerTable.addCell(bannerCell);
        document.add(bannerTable);

        // Cabeçalho principal: empresa + identificação do documento
        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{60, 40});
        table.setSpacingAfter(10);

        // Coluna Esquerda: Dados da Empresa
        PdfPCell cellEmpresa = new PdfPCell();
        cellEmpresa.setBorder(PdfPCell.NO_BORDER);
        cellEmpresa.addElement(new Paragraph("OFICINA GESTÃO", DS_FONT_TITLE));
        cellEmpresa.addElement(new Paragraph("ASSISTÊNCIA TÉCNICA ESPECIALIZADA",
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, DS_COLOR_PRIMARY)));
        cellEmpresa.addElement(new Paragraph("Máquinas de Solda • Geradores de Energia • Manutenção Industrial",
                DS_FONT_SUBTITLE));
        cellEmpresa.addElement(new Paragraph("Telefone: (31) 3333-4444 | contato@oficinagestao.com.br",
                DS_FONT_SUBTITLE));
        cellEmpresa.addElement(new Paragraph("Data de Emissão: " + OffsetDateTime.now().format(DATA_FORMATTER),
                DS_FONT_SUBTITLE));
        table.addCell(cellEmpresa);

        // Coluna Direita: Box de Identificação
        PdfPCell cellDoc = new PdfPCell();
        cellDoc.setBorder(PdfPCell.BOX);
        cellDoc.setBorderColor(DS_COLOR_BORDER);
        cellDoc.setBackgroundColor(DS_COLOR_BG_HEADER);
        cellDoc.setPadding(6);

        Paragraph pTitulo = new Paragraph("DOCUMENTO DE SERVIÇO",
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, DS_COLOR_MUTED));
        pTitulo.setAlignment(Element.ALIGN_CENTER);
        cellDoc.addElement(pTitulo);

        String refOs = os.getNumeroOs() != null ? os.getNumeroOs() : "OS-" + os.getId();
        Paragraph pNum = new Paragraph("Ref. OS: " + refOs,
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, DS_COLOR_PRIMARY));
        pNum.setAlignment(Element.ALIGN_CENTER);
        cellDoc.addElement(pNum);

        Color statusColor = obterCorStatus(os.getStatus());
        String statusDescricao = os.getStatus() != null ? os.getStatus().getDescricao() : "NÃO DEFINIDO";
        Paragraph pStatus = new Paragraph("STATUS: " + statusDescricao.toUpperCase(),
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, statusColor));
        pStatus.setAlignment(Element.ALIGN_CENTER);
        cellDoc.addElement(pStatus);

        Paragraph pDatas = new Paragraph(
                "Abertura: " + formatarData(os.getDataEntrada()) +
                (os.getDataConclusao() != null ? " | Conclusão: " + formatarData(os.getDataConclusao()) : ""),
                FontFactory.getFont(FontFactory.HELVETICA, 7, DS_COLOR_MUTED));
        pDatas.setAlignment(Element.ALIGN_CENTER);
        cellDoc.addElement(pDatas);

        table.addCell(cellDoc);
        document.add(table);
    }

    private void dsAdicionarDadosCliente(Document document, Cliente cliente) throws DocumentException {
        dsAdicionarTituloSecao(document, "1. DADOS DO CLIENTE");

        PdfPTable table = new PdfPTable(4);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{30, 20, 25, 25});
        table.setSpacingAfter(8);

        if (cliente == null) {
            dsAdicionarCelulaCampo(table, "Nome / Razão Social:", "Não informado", 4);
            document.add(table);
            return;
        }

        String nomeCompleto = cliente.getNomeRazaoSocial();
        if (cliente.getNomeFantasia() != null && !cliente.getNomeFantasia().isBlank()) {
            nomeCompleto += " (" + cliente.getNomeFantasia() + ")";
        }
        dsAdicionarCelulaCampo(table, "Nome / Razão Social:", nomeCompleto, 2);
        dsAdicionarCelulaCampo(table, "CPF / CNPJ:", formatarDocumento(cliente.getCpfCnpj()), 1);
        String fone = cliente.getTelefone() != null ? cliente.getTelefone() : cliente.getCelular();
        dsAdicionarCelulaCampo(table, "Telefone / Contato:", formatarTelefone(fone), 1);

        dsAdicionarCelulaCampo(table, "E-mail:", formatarVazio(cliente.getEmail()), 2);
        dsAdicionarCelulaCampo(table, "Endereço:", obterEnderecoFormatado(cliente), 2);

        document.add(table);
    }

    private void dsAdicionarDadosEquipamento(Document document, Maquina maquina, BigDecimal horimetroAtual)
            throws DocumentException {
        dsAdicionarTituloSecao(document, "2. EQUIPAMENTO ATENDIDO");

        PdfPTable table = new PdfPTable(4);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{25, 25, 25, 25});
        table.setSpacingAfter(8);

        if (maquina == null) {
            dsAdicionarCelulaCampo(table, "Equipamento:", "Não informado", 4);
            document.add(table);
            return;
        }

        String tipoDescricao = maquina.getTipoEquipamento() != null
                ? maquina.getTipoEquipamento().getDescricao() : "Equipamento Técnico";
        dsAdicionarCelulaCampo(table, "Tipo:", tipoDescricao, 1);
        dsAdicionarCelulaCampo(table, "Marca:", formatarVazio(maquina.getMarca()), 1);
        dsAdicionarCelulaCampo(table, "Modelo:", formatarVazio(maquina.getModelo()), 1);
        dsAdicionarCelulaCampo(table, "Nº de Série:", formatarVazio(maquina.getNumeroSerie()), 1);

        dsAdicionarCelulaCampo(table, "Tensão:", formatarVazio(maquina.getTensao()), 1);
        dsAdicionarCelulaCampo(table, "Potência:", formatarVazio(maquina.getPotencia()), 1);
        String horimetroStr = horimetroAtual != null ? horimetroAtual.toPlainString() + " h" :
                (maquina.getHorimetro() != null ? maquina.getHorimetro().toPlainString() + " h" : "Não informado");
        dsAdicionarCelulaCampo(table, "Horímetro:", horimetroStr, 2);

        document.add(table);
    }

    private void dsAdicionarServicosRealizados(Document document, OrdemServico os) throws DocumentException {
        dsAdicionarTituloSecao(document, "3. SERVIÇOS REALIZADOS");

        PdfPTable table = new PdfPTable(1);
        table.setWidthPercentage(100);
        table.setSpacingAfter(8);

        dsAdicionarCelulaTextoLongo(table, "Problema / Defeito Relatado:", os.getProblemaRelatado());

        if (os.getDiagnostico() != null && !os.getDiagnostico().isBlank()) {
            dsAdicionarCelulaTextoLongo(table, "Diagnóstico Técnico:", os.getDiagnostico());
        }
        if (os.getSolucaoAplicada() != null && !os.getSolucaoAplicada().isBlank()) {
            dsAdicionarCelulaTextoLongo(table, "Serviços / Solução Aplicada:", os.getSolucaoAplicada());
        }
        if (os.getTestesRealizados() != null && !os.getTestesRealizados().isBlank()) {
            dsAdicionarCelulaTextoLongo(table, "Testes Técnicos Realizados:", os.getTestesRealizados());
        }
        if (os.getObservacoes() != null && !os.getObservacoes().isBlank()) {
            dsAdicionarCelulaTextoLongo(table, "Observações:", os.getObservacoes());
        }

        document.add(table);
    }

    private void dsAdicionarTabelaPecas(Document document, List<OrdemServicoItem> itens) throws DocumentException {
        dsAdicionarTituloSecao(document, "4. PEÇAS / PRODUTOS UTILIZADOS");

        if (itens == null || itens.isEmpty()) {
            PdfPTable emptyTable = new PdfPTable(1);
            emptyTable.setWidthPercentage(100);
            emptyTable.setSpacingAfter(8);
            PdfPCell cell = new PdfPCell(new Phrase(
                    "Nenhuma peça foi utilizada nesta prestação de serviço.", DS_FONT_VALUE));
            cell.setPadding(6);
            cell.setBorderColor(DS_COLOR_BORDER);
            cell.setBackgroundColor(DS_COLOR_BG_HEADER);
            emptyTable.addCell(cell);
            document.add(emptyTable);
            return;
        }

        PdfPTable table = new PdfPTable(5);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{40, 10, 18, 18, 14});
        table.setHeaderRows(1);
        table.setSpacingAfter(8);

        String[] cabecalhos = {"Descrição / Peça", "Qtd", "Valor Unit. (R$)", "Desconto (R$)", "Total (R$)"};
        for (String col : cabecalhos) {
            PdfPCell c = new PdfPCell(new Phrase(col,
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7, DS_COLOR_PRIMARY)));
            c.setBackgroundColor(DS_COLOR_BG_HEADER);
            c.setBorderColor(DS_COLOR_BORDER);
            c.setPadding(4);
            if (!col.equals("Descrição / Peça")) {
                c.setHorizontalAlignment(Element.ALIGN_RIGHT);
            }
            table.addCell(c);
        }

        for (OrdemServicoItem item : itens) {
            String nome = item.getProduto() != null ? item.getProduto().getNome() : "Componente Técnico";
            String cod  = item.getProduto() != null && item.getProduto().getCodigo() != null
                    ? " (" + item.getProduto().getCodigo() + ")" : "";
            BigDecimal qtd  = item.getQuantidade() != null ? item.getQuantidade() : BigDecimal.ZERO;
            BigDecimal unit = item.getValorUnitario() != null ? item.getValorUnitario() : BigDecimal.ZERO;
            BigDecimal desc = item.getValorDesconto() != null ? item.getValorDesconto() : BigDecimal.ZERO;
            BigDecimal tot  = item.getValorTotal() != null ? item.getValorTotal() : BigDecimal.ZERO;

            dsAdicionarCelulaTabela(table, nome + cod, Element.ALIGN_LEFT);
            dsAdicionarCelulaTabela(table, qtd.stripTrailingZeros().toPlainString(), Element.ALIGN_RIGHT);
            dsAdicionarCelulaTabela(table, MOEDA_FORMAT.format(unit), Element.ALIGN_RIGHT);
            dsAdicionarCelulaTabela(table, MOEDA_FORMAT.format(desc), Element.ALIGN_RIGHT);
            dsAdicionarCelulaTabela(table, MOEDA_FORMAT.format(tot), Element.ALIGN_RIGHT);
        }

        document.add(table);
    }

    private void dsAdicionarResumoFinanceiro(Document document, OrdemServico os) throws DocumentException {
        dsAdicionarTituloSecao(document, "5. RESUMO FINANCEIRO");

        PdfPTable table = new PdfPTable(4);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{25, 25, 25, 25});
        table.setKeepTogether(true);
        table.setSpacingAfter(10);

        BigDecimal maoObra = os.getValorMaoObra() != null ? os.getValorMaoObra() : BigDecimal.ZERO;
        BigDecimal pecas   = os.getValorPecas()   != null ? os.getValorPecas()   : BigDecimal.ZERO;
        BigDecimal desc    = os.getValorDesconto() != null ? os.getValorDesconto() : BigDecimal.ZERO;
        BigDecimal total   = os.getValorTotal()    != null ? os.getValorTotal()    : BigDecimal.ZERO;

        dsAdicionarCelulaFinanceira(table, "Mão de Obra:", MOEDA_FORMAT.format(maoObra), false);
        dsAdicionarCelulaFinanceira(table, "Peças e Insumos:", MOEDA_FORMAT.format(pecas), false);
        dsAdicionarCelulaFinanceira(table, "Desconto:", MOEDA_FORMAT.format(desc), false);
        dsAdicionarCelulaFinanceira(table, "VALOR TOTAL:", MOEDA_FORMAT.format(total), true);

        document.add(table);
    }

    private void dsAdicionarInformacoesOs(Document document, OrdemServico os) throws DocumentException {
        dsAdicionarTituloSecao(document, "6. INFORMAÇÕES DA ORDEM DE SERVIÇO");

        PdfPTable table = new PdfPTable(3);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{33, 33, 34});
        table.setKeepTogether(true);
        table.setSpacingAfter(10);

        String numOs = os.getNumeroOs() != null ? os.getNumeroOs() : "OS-" + os.getId();
        dsAdicionarCelulaCampo(table, "Número OS:", numOs, 1);
        dsAdicionarCelulaCampo(table, "Data de Abertura:", formatarData(os.getDataEntrada()), 1);
        dsAdicionarCelulaCampo(table, "Data de Conclusão:",
                os.getDataConclusao() != null ? formatarData(os.getDataConclusao()) : "Em andamento", 1);

        String statusDescricao = os.getStatus() != null ? os.getStatus().getDescricao() : "Não definido";
        dsAdicionarCelulaCampo(table, "Status da OS:", statusDescricao, 1);

        String tecnico = os.getTecnicoResponsavel() != null ? os.getTecnicoResponsavel().getNome() : "Oficina Gestão";
        dsAdicionarCelulaCampo(table, "Responsável Técnico:", tecnico, 2);

        document.add(table);
    }

    private void dsAdicionarAssinaturas(Document document, OrdemServico os) throws DocumentException {
        // Termos breves
        Paragraph pTermos = new Paragraph(
                "Declaro que os serviços descritos neste documento foram realizados e o equipamento foi recebido " +
                "em perfeitas condições de funcionamento, conforme os serviços acima especificados.",
                DS_FONT_FOOTER);
        pTermos.setSpacingAfter(20);
        document.add(pTermos);

        // Área de Assinaturas
        PdfPTable tableAssinaturas = new PdfPTable(2);
        tableAssinaturas.setWidthPercentage(100);
        tableAssinaturas.setWidths(new float[]{50, 50});
        tableAssinaturas.setKeepTogether(true);
        tableAssinaturas.setSpacingAfter(8);

        // Responsável pelo recebimento
        PdfPCell cCliente = new PdfPCell();
        cCliente.setBorder(PdfPCell.NO_BORDER);
        cCliente.setPaddingTop(30);

        Paragraph pLinhaCliente = new Paragraph("________________________________________________", DS_FONT_VALUE);
        pLinhaCliente.setAlignment(Element.ALIGN_CENTER);
        cCliente.addElement(pLinhaCliente);

        Paragraph pLabelCliente = new Paragraph("Responsável pelo Recebimento", DS_FONT_VALUE_BOLD);
        pLabelCliente.setAlignment(Element.ALIGN_CENTER);
        cCliente.addElement(pLabelCliente);

        String clienteNome = (os.getCliente() != null && os.getCliente().getNomeRazaoSocial() != null)
                ? os.getCliente().getNomeRazaoSocial() : "Cliente / Responsável";
        Paragraph pNomeCliente = new Paragraph(clienteNome, DS_FONT_SUBTITLE);
        pNomeCliente.setAlignment(Element.ALIGN_CENTER);
        cCliente.addElement(pNomeCliente);

        Paragraph pDataCliente = new Paragraph("Data: ____/____/________", DS_FONT_SUBTITLE);
        pDataCliente.setAlignment(Element.ALIGN_CENTER);
        pDataCliente.setSpacingBefore(4);
        cCliente.addElement(pDataCliente);

        tableAssinaturas.addCell(cCliente);

        // Responsável Técnico
        PdfPCell cTecnico = new PdfPCell();
        cTecnico.setBorder(PdfPCell.NO_BORDER);
        cTecnico.setPaddingTop(30);

        Paragraph pLinhaTecnico = new Paragraph("________________________________________________", DS_FONT_VALUE);
        pLinhaTecnico.setAlignment(Element.ALIGN_CENTER);
        cTecnico.addElement(pLinhaTecnico);

        Paragraph pLabelTecnico = new Paragraph("Responsável Técnico / Oficina", DS_FONT_VALUE_BOLD);
        pLabelTecnico.setAlignment(Element.ALIGN_CENTER);
        cTecnico.addElement(pLabelTecnico);

        String tecNome = os.getTecnicoResponsavel() != null ? os.getTecnicoResponsavel().getNome() : "Oficina Gestão";
        Paragraph pNomeTecnico = new Paragraph(tecNome, DS_FONT_SUBTITLE);
        pNomeTecnico.setAlignment(Element.ALIGN_CENTER);
        cTecnico.addElement(pNomeTecnico);

        Paragraph pDataTecnico = new Paragraph("Data: ____/____/________", DS_FONT_SUBTITLE);
        pDataTecnico.setAlignment(Element.ALIGN_CENTER);
        pDataTecnico.setSpacingBefore(4);
        cTecnico.addElement(pDataTecnico);

        tableAssinaturas.addCell(cTecnico);
        document.add(tableAssinaturas);

        // Rodapé de aviso comercial
        PdfPTable avisoTable = new PdfPTable(1);
        avisoTable.setWidthPercentage(100);
        avisoTable.setSpacingBefore(10);
        PdfPCell avisoCell = new PdfPCell(new Phrase(
                "Documento para fins exclusivamente comerciais e de conferência da prestação de serviços. Sem valor tributário. " +
                "Emitido em: " + OffsetDateTime.now().format(DATA_HORA_FORMATTER) + " • Sistema Oficina Gestão v1.0",
                DS_FONT_AVISO));
        avisoCell.setBackgroundColor(new Color(255, 251, 235)); // amber-50
        avisoCell.setBorderColor(new Color(251, 191, 36));
        avisoCell.setPadding(5);
        avisoCell.setHorizontalAlignment(Element.ALIGN_CENTER);
        avisoTable.addCell(avisoCell);
        document.add(avisoTable);
    }

    // --- Auxiliares DS ---

    private void dsAdicionarTituloSecao(Document document, String titulo) throws DocumentException {
        PdfPTable table = new PdfPTable(1);
        table.setWidthPercentage(100);
        table.setSpacingBefore(4);
        table.setSpacingAfter(3);
        PdfPCell cell = new PdfPCell(new Phrase(titulo, DS_FONT_SECTION_TITLE));
        cell.setBackgroundColor(DS_COLOR_PRIMARY);
        cell.setPadding(4);
        cell.setBorder(PdfPCell.NO_BORDER);
        table.addCell(cell);
        document.add(table);
    }

    private void dsAdicionarCelulaCampo(PdfPTable table, String label, String valor, int colSpan) {
        PdfPCell cell = new PdfPCell();
        cell.setColspan(colSpan);
        cell.setPadding(4);
        cell.setBorderColor(new Color(187, 247, 208));
        Paragraph p = new Paragraph();
        p.add(new Phrase(label + " ", DS_FONT_LABEL));
        p.add(new Phrase(valor != null ? valor : "-", DS_FONT_VALUE));
        cell.addElement(p);
        table.addCell(cell);
    }

    private void dsAdicionarCelulaTextoLongo(PdfPTable table, String label, String texto) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(4);
        cell.setBorderColor(new Color(187, 247, 208));
        Paragraph pLabel = new Paragraph(label, DS_FONT_LABEL);
        cell.addElement(pLabel);
        Paragraph pTexto = new Paragraph(texto != null ? texto : "-", DS_FONT_VALUE);
        pTexto.setSpacingBefore(2);
        cell.addElement(pTexto);
        table.addCell(cell);
    }

    private void dsAdicionarCelulaTabela(PdfPTable table, String texto, int alignment) {
        PdfPCell cell = new PdfPCell(new Phrase(texto, DS_FONT_VALUE));
        cell.setPadding(4);
        cell.setBorderColor(new Color(187, 247, 208));
        cell.setHorizontalAlignment(alignment);
        table.addCell(cell);
    }

    private void dsAdicionarCelulaFinanceira(PdfPTable table, String label, String valor, boolean destaque) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(5);
        cell.setBorderColor(DS_COLOR_BORDER);
        if (destaque) {
            cell.setBackgroundColor(DS_COLOR_BG_HEADER);
        }
        Font fontLabel = destaque
                ? FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, DS_COLOR_PRIMARY) : DS_FONT_LABEL;
        cell.addElement(new Paragraph(label, fontLabel));

        Paragraph pValor = new Paragraph("R$ " + valor,
                destaque ? FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, DS_COLOR_PRIMARY)
                         : DS_FONT_VALUE_BOLD);
        pValor.setAlignment(Element.ALIGN_RIGHT);
        cell.addElement(pValor);
        table.addCell(cell);
    }
}

