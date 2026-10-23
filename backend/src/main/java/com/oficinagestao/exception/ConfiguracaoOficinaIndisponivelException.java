package com.oficinagestao.exception;

/** Cadastro indisponível: exige recuperação administrativa, nunca seed automático. */
public final class ConfiguracaoOficinaIndisponivelException extends RuntimeException {
    public static final String MISSING_CODE = "OFICINA_CONFIG_MISSING";
    public static final String INTEGRITY_CODE = "OFICINA_CONFIG_INTEGRITY_ERROR";
    public static final String PUBLIC_MESSAGE = "A configuração da oficina está indisponível. Solicite a recuperação administrativa dos dados.";

    private final String code;

    public ConfiguracaoOficinaIndisponivelException() {
        this(MISSING_CODE);
    }

    private ConfiguracaoOficinaIndisponivelException(String code) {
        super(PUBLIC_MESSAGE);
        this.code = code;
    }

    public static ConfiguracaoOficinaIndisponivelException cadastroDuplicado() {
        return new ConfiguracaoOficinaIndisponivelException(INTEGRITY_CODE);
    }

    public String getCode() {
        return code;
    }
}
