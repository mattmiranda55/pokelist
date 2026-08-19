export const GRADING_COMPANIES = ['PSA', 'BGS', 'CGC', 'SGC', 'TAG', 'ACE'];

const HALF_STEP_GRADES = [
  '10',
  '9.5',
  '9',
  '8.5',
  '8',
  '7.5',
  '7',
  '6.5',
  '6',
  '5.5',
  '5',
  '4.5',
  '4',
  '3.5',
  '3',
  '2.5',
  '2',
  '1.5',
  '1',
];

// Top-of-scale designations that only exist at some graders, listed above the numeric scale.
const COMPANY_TOP_GRADES: Record<string, string[]> = {
  PSA: ['Authentic'],
  BGS: ['Black Label 10', 'Pristine 10'],
  CGC: ['Perfect 10', 'Pristine 10'],
  SGC: ['Gold Label 10', 'Pristine 10'],
};

export function gradesForCompany(company: string): string[] {
  return [...(COMPANY_TOP_GRADES[company] ?? []), ...HALF_STEP_GRADES];
}
