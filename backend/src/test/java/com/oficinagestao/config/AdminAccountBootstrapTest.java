package com.oficinagestao.config;

import com.oficinagestao.entity.Role;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RoleRepository;
import com.oficinagestao.repository.UsuarioRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminAccountBootstrapTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AdminAccountBootstrap bootstrap;

    @Test
    @DisplayName("Deve provisionar a conta inicial quando não existirem usuários e credenciais forem fornecidas")
    void shouldProvisionAdminAccountWhenNoUsersExist() {
        ReflectionTestUtils.setField(bootstrap, "adminName", "Proprietária");
        ReflectionTestUtils.setField(bootstrap, "adminEmail", "admin@oficina.com");
        ReflectionTestUtils.setField(bootstrap, "adminPassword", "SenhaSegura123");

        when(usuarioRepository.count()).thenReturn(0L);
        when(roleRepository.findByNome("ROLE_ADMIN")).thenReturn(Optional.of(new Role("ROLE_ADMIN", "Admin")));
        when(passwordEncoder.encode("SenhaSegura123")).thenReturn("senha_hash_bcrypt");

        bootstrap.run(new DefaultApplicationArguments(new String[]{}));

        verify(usuarioRepository, times(1)).save(any(Usuario.class));
    }

    @Test
    @DisplayName("Não deve recriar ou duplicar a conta administrativa quando já existirem usuários")
    void shouldNotProvisionWhenUsersAlreadyExist() {
        when(usuarioRepository.count()).thenReturn(1L);

        bootstrap.run(new DefaultApplicationArguments(new String[]{}));

        verify(usuarioRepository, never()).save(any(Usuario.class));
    }

    @Test
    @DisplayName("Não deve criar conta quando as variáveis de ambiente estiverem em branco")
    void shouldNotProvisionWhenCredentialsAreBlank() {
        ReflectionTestUtils.setField(bootstrap, "adminEmail", "");
        ReflectionTestUtils.setField(bootstrap, "adminPassword", "");

        when(usuarioRepository.count()).thenReturn(0L);

        bootstrap.run(new DefaultApplicationArguments(new String[]{}));

        verify(usuarioRepository, never()).save(any(Usuario.class));
    }
}
