# TLS da origem

O certificado de origem da Cloudflare e sua chave privada serão instalados apenas
na VM Oracle. Certificados e chaves não devem ser versionados nem enviados no
contexto de build.

A configuração HTTP atual permanece funcional para o smoke test local. A
configuração HTTPS será adicionada no deploy real depois da emissão do
certificado, sem alterar a confiança de proxy definida em `cloudflare-realip.conf`.
