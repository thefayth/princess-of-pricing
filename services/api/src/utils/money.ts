import { Prisma } from "@prisma/client";

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function toMoneyString(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function formatDecimal(value: Prisma.Decimal | number | string): string {
  if (typeof value === "number") {
    return toMoneyString(value);
  }

  if (typeof value === "string") {
    return Number.parseFloat(value).toFixed(2);
  }

  return value.toFixed(2);
}
