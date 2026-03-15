import * as fs from 'fs';
import * as path from 'path';

const PROMPTS_DIR = path.join(__dirname, '../../ml/prompts');

export function loadPromptTemplate(name: string): Record<string, any> | null {
  try {
    const filePath = path.join(PROMPTS_DIR, `${name}.json`);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function interpolatePrompt(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce(
    (acc, [key, val]) => acc.replaceAll(`{{${key}}}`, val),
    template
  );
}
