package com.oficinagestao.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class CsrfController {
    @GetMapping("/api/auth/csrf")
    public ResponseEntity<Map<String, String>> token(CsrfToken csrfToken) {
        // Accessing the deferred token also writes its HttpOnly cookie.
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(Map.of("token", csrfToken.getToken()));
    }
}
