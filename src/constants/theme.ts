// Palette e spaziature di Cor Duls, ricavate dal logo:
// rosa orchidea (#E890D8, qui reso più intenso per la leggibilità), marrone delle linee, crema dello sfondo.
export const Colors = {
  primary: '#A9458F',
  primaryDark: '#8E3279',
  primarySoft: '#F7E4F2',
  logoPink: '#E890D8',
  background: '#FBF8F2',
  card: '#FFFFFF',
  text: '#2B1611',
  textMuted: '#76605A',
  border: '#EADFD6',
  success: '#2E8B57',
  warning: '#D48A1A',
  danger: '#C0392B',
} as const;

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
