package com.oficinagestao.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.OffsetDateTime;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiErrorResponse(
        OffsetDateTime timestamp,
        int status,
        String error,
        String message,
        String path,
        List<ValidationErrorDetail> details
) {
    public record ValidationErrorDetail(String field, String message) {}

    public static ApiErrorResponse of(int status, String error, String message, String path) {
        return new ApiErrorResponse(OffsetDateTime.now(), status, error, message, path, null);
    }

    public static ApiErrorResponse of(int status, String error, String message) {
        return new ApiErrorResponse(OffsetDateTime.now(), status, error, message, null, null);
    }

    public static ApiErrorResponse ofValidation(int status, String error, String message, String path, List<ValidationErrorDetail> details) {
        return new ApiErrorResponse(OffsetDateTime.now(), status, error, message, path, details);
    }
}
