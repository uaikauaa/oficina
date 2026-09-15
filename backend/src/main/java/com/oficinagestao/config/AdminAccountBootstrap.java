package com.oficinagestao.config;

import com.oficinagestao.usuario.Role;
import com.oficinagestao.usuario.Usuario;
import com.oficinagestao.usuario.RoleRepository;
import com.oficinagestao.usuario.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AdminAccountBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminAccountBootstrap.class);

    private final UsuarioRepository usuarioRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${INITIAL_ADMIN_NAME:Proprietária Oficina}")
    private String adminName;

    @Value("${INITIAL_ADMIN_EMAIL:}")
    private String adminEmail;

    @Value("${INITIAL_ADMIN_PASSWORD:}")
    private String adminPassword;

    public AdminAccountBootstrap(
            UsuarioRepository usuarioRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.usuarioRepository = usuarioRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        long userCount = usuarioRepository.count();

        if (userCount > 0) {
            log.info("Inicialização: Base de usuários já contém {} registro(s). Bootstrap ignorado.", userCount);
            return;
        }

        if (adminEmail == null || adminEmail.isBlank() || adminPassword == null || adminPassword.isBlank()) {
            log.warn("Inicialização: Nenhuma credencial inicial fornecida (INITIAL_ADMIN_EMAIL ou INITIAL_ADMIN_PASSWORD ausentes). Conta da proprietária não foi criada.");
            return;
        }

        Role roleAdmin = roleRepository.findByNome("ROLE_ADMIN")
                .orElseGet(() -> roleRepository.save(new Role("ROLE_ADMIN", "Administrador com acesso irrestrito ao sistema")));

        Usuario admin = new Usuario(
                adminName != null && !adminName.isBlank() ? adminName.trim() : "Proprietária Oficina",
                adminEmail.trim().toLowerCase(),
                passwordEncoder.encode(adminPassword),
                true
        );
        admin.addRole(roleAdmin);

        usuarioRepository.save(admin);
        log.info("Inicialização: Conta administrativa da proprietária criada com sucesso para o email: [{}] com perfil ROLE_ADMIN.", admin.getEmail());
    }
}
