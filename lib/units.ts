export const BAGS_TO_KG = 25;

export function bagsToKg(bags: number): number {
  return bags * BAGS_TO_KG;
}

export function kgToBags(kg: number): number {
  return kg / BAGS_TO_KG;
}

export function formatBagsKg(bags: number): string {
  const kg = bagsToKg(bags);
  return `${bags} bags (${kg.toLocaleString('en-IN')} kg)`;
}
