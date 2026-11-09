package com.oficinagestao.testsupport;

import com.oficinagestao.security.OperationalPermissionCatalog;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.test.context.support.WithSecurityContext;
import org.springframework.security.test.context.support.WithSecurityContextFactory;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.util.ArrayList;

@Retention(RetentionPolicy.RUNTIME)
@WithSecurityContext(factory = WithOperationalUser.Factory.class)
public @interface WithOperationalUser {
    String username() default "admin@oficina.com";

    final class Factory implements WithSecurityContextFactory<WithOperationalUser> {
        @Override
        public SecurityContext createSecurityContext(WithOperationalUser annotation) {
            var authorities = new ArrayList<SimpleGrantedAuthority>();
            authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
            OperationalPermissionCatalog.RULES.stream().map(OperationalPermissionCatalog.Rule::permission)
                    .distinct().map(code -> new SimpleGrantedAuthority("PERM_" + code))
                    .forEach(authorities::add);
            var principal = new User(annotation.username(), "unused-synthetic", authorities);
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, authorities));
            return context;
        }
    }
}
