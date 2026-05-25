import { z } from 'zod';

// Phase 15 hotfix — PubChem 2025+ 신규 필드 (SMILES/ConnectivitySMILES) +
// legacy 필드 (CanonicalSMILES/IsomericSMILES) 동시 수용.
export const PubChemPropertyRowSchema = z.object({
  CID: z.number(),
  MolecularFormula: z.string(),
  MolecularWeight: z.union([z.string(), z.number()]),
  SMILES: z.string().optional(),
  ConnectivitySMILES: z.string().optional(),
  CanonicalSMILES: z.string().optional(),
  IsomericSMILES: z.string().optional(),
  InChI: z.string().optional(),
  InChIKey: z.string().optional(),
  IUPACName: z.string().optional(),
  XLogP: z.union([z.number(), z.string()]).optional(),
  Complexity: z.union([z.number(), z.string()]).optional(),
});

export const PropertyTableResponseSchema = z.object({
  PropertyTable: z.object({
    Properties: z.array(PubChemPropertyRowSchema).min(1),
  }),
});

export const FaultResponseSchema = z.object({
  Fault: z.object({
    Code: z.string(),
    Message: z.string().optional(),
    Details: z.array(z.string()).optional(),
  }),
});

export const IdentifierListSchema = z.object({
  IdentifierList: z.object({
    CID: z.array(z.number()).min(1),
  }),
});

export type PropertyTableResponse = z.infer<typeof PropertyTableResponseSchema>;
export type FaultResponse = z.infer<typeof FaultResponseSchema>;
export type IdentifierListResponse = z.infer<typeof IdentifierListSchema>;
