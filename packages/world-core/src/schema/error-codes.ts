/**
 * Error codes for structured operation results.
 *
 * Location: packages/world-core/src/schema/error-codes.ts
 */

export const ERROR_CODES = {
    VALIDATION_ERROR: "validation_error",
    NOT_FOUND: "not_found",
    VERSION_CONFLICT: "version_conflict",
    CONSTRAINT_VIOLATION: "constraint_violation",
    NOT_IMPLEMENTED: "not_implemented",
    INTERNAL_ERROR: "internal_error",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface OperationError {
    code: ErrorCode;
    message: string;
    details?: unknown;
}

export interface OperationResult<T = void> {
    success: boolean;
    data: T | null;
    error: OperationError | null;
}
