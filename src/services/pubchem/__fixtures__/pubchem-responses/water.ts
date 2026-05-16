export const waterPropertiesResponse = {
  PropertyTable: {
    Properties: [
      {
        CID: 962,
        MolecularFormula: 'H2O',
        MolecularWeight: '18.015',
        CanonicalSMILES: 'O',
        IsomericSMILES: 'O',
        InChI: 'InChI=1S/H2O/h1H2',
        InChIKey: 'XLYOFNOQVPJJNP-UHFFFAOYSA-N',
        IUPACName: 'oxidane',
        XLogP: -0.47,
        Complexity: 0,
      },
    ],
  },
};

export const waterSdfNotFound = {
  status: 404,
};

export const nameToCidResponse = {
  IdentifierList: { CID: [962] },
};

export const multiCidResponse = {
  IdentifierList: { CID: [962, 887, 1234] },
};

export const faultNotFound = {
  Fault: {
    Code: 'PUGREST.NotFound',
    Message: 'No CID found for the given CID',
    Details: [],
  },
};
