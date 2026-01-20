
export interface DigitalCompetencyItem {
  name: string;
  description: string;
  insertionPoint: string;
  evaluationSigns: string;
  originalTextProposal: string;
}

export interface AnalysisResult {
  digitalCompetencies: DigitalCompetencyItem[];
  overallSummary: string;
  fullIntegratedContent: string;
}

export enum GradeLevel {
  PRIMARY = 'Tiểu học',
  MIDDLE = 'THCS',
  HIGH = 'THPT'
}
