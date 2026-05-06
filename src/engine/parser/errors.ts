export type ParseErrorCode =
  | 'InputEmpty'
  | 'InputTooLong'
  | 'SmilesSyntax'
  | 'InchiSyntax'
  | 'FormulaSyntax'
  | 'FormulaUnsupported'
  | 'UnknownElement'
  | 'SanitizationFailed'
  | 'RdkitNotReady'
  | 'InternalError';

export interface ParseError {
  readonly code: ParseErrorCode;
  readonly message: string;
  readonly at?: number;
  readonly rdkitDetail?: string;
}

export type ValidationIssueKind =
  | 'ChargeMismatch'
  | 'ValenceExceeded'
  | 'DisconnectedFragments'
  | 'RadicalPresent';

export interface ValidationIssue {
  readonly kind: ValidationIssueKind;
  readonly atomIdx?: number;
  readonly message: string;
  readonly severity: 'info' | 'warn' | 'error';
}
