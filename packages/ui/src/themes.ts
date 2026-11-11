export const POP_THEMES = [
  { id: "royal-atlas", name: "Royal Atlas", color: "#087e78", portrait: "faith-blue.png" },
  { id: "rose-ledger", name: "Rose Ledger", color: "#bb164c", portrait: "faith-pink.png" },
  { id: "emerald-arcade", name: "Emerald Arcade", color: "#067c5d", portrait: "faith-blue.png" },
] as const;
export type PopTheme = typeof POP_THEMES[number]["id"];
export const THEME_STORAGE_KEY = "pop.appearance.theme.v1";
export const AVATAR_STORAGE_KEY = "pop.appearance.avatar.v1";
export function parsePopTheme(value: unknown): PopTheme {
  return POP_THEMES.find((theme) => theme.id === value)?.id ?? "royal-atlas";
}
export function themePortrait(theme: PopTheme, base = "/assets/princess") {
  return `${base.replace(/\/$/, "")}/${POP_THEMES.find((item) => item.id === theme)!.portrait}`;
}
