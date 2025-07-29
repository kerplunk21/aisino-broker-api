import { CardScheme, EMV, Merchant, TerminalProperties } from '@/types';
import fs from 'fs';

interface LoadJsonFilesResult {
  cardscheme: CardScheme | {};
  cardschemelist: CardScheme[] ;
  emvs: EMV[];
  merchants: Merchant[];
  properties: TerminalProperties | {};
}

interface FileError {
  file: string;
  error: string;
}

const loadJsonFilesRobust = (configFolder: string): LoadJsonFilesResult => {
  const fileConfigs = [
    { name: 'cardscheme', required: true },
    { name: 'cardschemelist', required: true },
    { name: 'emvs', required: false },
    { name: 'merchants', required: true },
    { name: 'properties', required: false }
  ] as const;

  const results: LoadJsonFilesResult = {
    cardscheme: {},
    cardschemelist: [],
    emvs: [],
    merchants: [],
    properties: {}
  };

  const errors: FileError[] = [];

  fileConfigs.forEach(({ name, required }) => {
    try {
      const filePath = `${configFolder}/${name}.json`;
      // Check if file exists first
      if (!fs.existsSync(filePath)) {
        if (required) {
          throw new Error(`Required file ${name}.json not found`);
        }
        if (['cardschemelist', 'emvs', 'merchants'].includes(name)) {
          results[name] = [];
        }
        //else if(['properties', 'cardscheme'].includes(name)) {
          //results[name] = {};
        //}
        return;
      }
      const fileContent = fs.readFileSync(filePath, "utf8");
      const parsedData = JSON.parse(fileContent);
      // Basic validation
      if (typeof parsedData !== 'object' || parsedData === null) {
        throw new Error(`Invalid JSON structure in ${name}.json`);
      }
      results[name] = parsedData;
    } catch(error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error loading ${name}.json:`, errorMessage);
      errors.push({ file: name, error: errorMessage });
      //results[name] = {};
    }
  });

  if (errors.length > 0) {
    console.warn('Some configuration files had errors:', errors);
  }

  return results;
};

export { loadJsonFilesRobust };