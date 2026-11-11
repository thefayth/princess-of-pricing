async function hash(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function totalCents() {
  const node = document.querySelector("[data-order-total], [data-testid*='total'], .order-total, .cart-total");
  const raw = node?.getAttribute("data-order-total") ?? node?.textContent ?? "";
  const value = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

export async function testPromoCodes(codes) {
  if (document.querySelector("iframe[src*='captcha'], [data-sitekey], .g-recaptcha")) return { blocked: "CAPTCHA detected. PoP did not test a code." };
  const input = document.querySelector("input[autocomplete='off'][name*='promo' i], input[name*='coupon' i], input[id*='promo' i], input[id*='coupon' i]");
  if (!(input instanceof HTMLInputElement)) return { blocked: "No supported promo field was found." };
  const apply = Array.from(document.querySelectorAll("button[type='button'], [role='button']")).find((node) => /^(apply|add)$/i.test((node.textContent ?? "").trim()) && node.closest("form")?.contains(input));
  if (!(apply instanceof HTMLElement)) return { blocked: "This checkout needs a merchant-specific adapter. PoP did not click anything." };
  const original = input.value;
  const results = [];
  const started = Date.now();
  for (const code of codes.slice(0, 10)) {
    if (Date.now() - started > 30_000) break;
    const before = totalCents();
    input.value = code;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    apply.click();
    await new Promise((resolve) => setTimeout(resolve, 900));
    const after = totalCents();
    results.push({ codeHash: await hash(code), outcome: before != null && after != null && after < before ? "SAVINGS_OBSERVED" : "NO_SAVINGS_OBSERVED", savingsCents: before != null && after != null ? Math.max(0, before - after) : null });
    input.value = original;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return { schemaVersion: "pop-promo-attempt/v1", url: location.href.split("#")[0], attemptedAt: new Date().toISOString(), results };
}
