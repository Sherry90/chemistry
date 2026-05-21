// Phase 13 §4.5 — Export / Import 에러 유니온.
// io 가 chemistry 계층의 brand 타입을 의존 (CD6 — stores→io 역행 없음).
import type { MoleculeId } from '@/chemistry/compounds/ids';

export type ExportError =
  | { readonly kind: 'CanvasNotReady' }
  | { readonly kind: 'CaptureFailed'; readonly message: string }
  | {
      readonly kind: 'SdfSerializationFailed';
      readonly moleculeId: MoleculeId;
      readonly message: string;
    }
  | { readonly kind: 'JsonSerializationFailed'; readonly message: string }
  | { readonly kind: 'NothingToExport' }
  | { readonly kind: 'FileTooLarge'; readonly sizeBytes: number; readonly limitBytes: number }
  | { readonly kind: 'UserAborted' }
  | { readonly kind: 'Internal'; readonly message: string };

export type ImportError =
  | { readonly kind: 'FileTooLarge'; readonly sizeBytes: number; readonly limitBytes: number }
  | { readonly kind: 'JsonSyntax'; readonly message: string; readonly at?: number }
  | { readonly kind: 'SchemaMismatch'; readonly path: string; readonly message: string }
  | {
      readonly kind: 'IncompatibleVersion';
      readonly fileVersion: number;
      readonly supportedVersion: number;
    }
  | { readonly kind: 'EmptyFile' }
  | { readonly kind: 'NoMolecules' }
  | {
      readonly kind: 'PartiallyFailed';
      readonly imported: number;
      readonly skipped: number;
      readonly errors: ReadonlyArray<{ readonly moleculeIndex: number; readonly reason: string }>;
    }
  | { readonly kind: 'UserAborted' }
  | { readonly kind: 'Internal'; readonly message: string };
