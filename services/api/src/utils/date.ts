export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseISODate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

export function endOfISODate(dateString: string): Date {
  return new Date(`${dateString}T23:59:59.999Z`);
}
