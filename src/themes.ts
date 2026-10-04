export type ThemeId = 'observatory' | 'treasury' | 'sovereign' | 'zenith' | 'vellum' | 'meridian' | 'arcology' | 'quicksilver' | 'aurora';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  number: string;
  description: string;
  origin: string;
  palette: string[];
}

export const THEMES: ThemeDefinition[] = [
  { id: 'observatory', name: 'Observatory', number: 'VIII', description: 'An open horizon. Jade, porcelain and a living intelligence sculpture.', origin: 'A new USSI expression', palette: ['#f6f7f4', '#153d31', '#bfd6b0', '#bf926b'] },
  { id: 'treasury', name: 'Treasury', number: 'I', description: 'Obsidian instruments. Brushed platinum. Intelligence with weight.', origin: 'The original ZEN wallet', palette: ['#080d14', '#c9ced8', '#456a66', '#c2a16b'] },
  { id: 'sovereign', name: 'Sovereign', number: 'II', description: 'Engraved geometry and security foil, composed like a modern banknote.', origin: 'ZEN wallet lineage', palette: ['#0d2923', '#d5bb76', '#6da48b', '#e8ddbc'] },
  { id: 'zenith', name: 'Zenith', number: 'III', description: 'Thin-film titanium in orbit. A luminous core at the center of everything.', origin: 'ZEN wallet lineage', palette: ['#080c18', '#89cbf2', '#b0a0ff', '#efb87e'] },
  { id: 'vellum', name: 'Vellum', number: 'IV', description: 'Warm parchment, liquid glass and a prism suspended in daylight.', origin: 'ZEN wallet lineage', palette: ['#f1eddf', '#383f34', '#b27b65', '#a0b9ad'] },
  { id: 'meridian', name: 'Meridian', number: 'V', description: 'Precision steel and photon inlays. The synthesis of the first four worlds.', origin: 'ZEN wallet main series', palette: ['#06070a', '#7fe3f0', '#d9ac4b', '#a88bff'] },
  { id: 'arcology', name: 'Arcology', number: 'VI', description: 'A miniature city of possibility. Architecture becomes a language for growth.', origin: 'ZEN wallet lineage', palette: ['#eef1f3', '#263c4a', '#f2c230', '#aacac2'] },
  { id: 'quicksilver', name: 'Quicksilver', number: 'VII', description: 'Fluid metal and soft studio light. Every reflection feels alive.', origin: 'ZEN wallet lineage', palette: ['#141518', '#eceef1', '#86aeff', '#b7a2ff'] },
  { id: 'aurora', name: 'Aurora', number: 'IX', description: 'Midnight glass, spectral currents and the next frontier of intelligence.', origin: 'A new USSI expression', palette: ['#070c19', '#91e8d3', '#a69dff', '#f0b7cf'] },
];
