export const toBs = (amount: number, rate: number): number => amount * rate;

export const formatDual = (amount: number, rate: number): string => {
  const bs = toBs(amount, rate);
  return `${amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} / ${bs.toLocaleString('es-VE', { style: 'currency', currency: 'VES' })}`;
};
