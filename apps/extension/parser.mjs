export function extractProductPage() {
  const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const candidates = [];
  for (const node of nodes) {
    try {
      const raw = JSON.parse(node.textContent || "null");
      const values = Array.isArray(raw) ? raw : raw?.["@graph"] ?? [raw];
      candidates.push(...values);
    } catch {}
  }
  const product = candidates.find((item) => item?.["@type"] === "Product" || (Array.isArray(item?.["@type"]) && item["@type"].includes("Product")));
  const offer = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;
  const price = Number(offer?.price ?? offer?.lowPrice);
  if (!product || !Number.isFinite(price)) return null;
  return {
    schemaVersion: "pop-browser-observation/v1",
    title: String(product.name ?? document.title).slice(0, 240),
    merchantName: String(offer?.seller?.name ?? location.hostname).slice(0, 160),
    priceCents: Math.round(price * 100),
    currency: String(offer?.priceCurrency ?? "USD").toUpperCase(),
    url: location.href.split("#")[0],
    observedAt: new Date().toISOString(),
  };
}
