import { extractProductPage } from "./parser.mjs";
import { testPromoCodes } from "./checkout.mjs";

const button = document.querySelector("#observe");
const status = document.querySelector("#status");
const promoButton = document.querySelector("#promo");
const codes = document.querySelector("#codes");

button.addEventListener("click", async () => {
  button.disabled = true;
  status.textContent = "Reading structured product data from this tab...";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.startsWith("https://")) throw new Error("Open a secure product page first.");
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractProductPage });
    if (!result.result) throw new Error("No structured product price was found.");
    const response = await fetch("http://127.0.0.1:48731/observations", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(result.result),
    });
    if (!response.ok) throw new Error("Open the PoP desktop app and try again.");
    status.textContent = `${result.result.title} was added for review.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "The observation could not be saved.";
  } finally {
    button.disabled = false;
  }
});

promoButton.addEventListener("click", async () => {
  const candidates = codes.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).slice(0, 10);
  if (!candidates.length) { status.textContent = "Paste one or more candidate codes first."; return; }
  promoButton.disabled = true;
  status.textContent = "Testing only the visible promo field. No order will be submitted...";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.startsWith("https://")) throw new Error("Open a secure checkout page first.");
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: testPromoCodes, args: [candidates] });
    const receipt = result.result;
    if (receipt?.blocked) throw new Error(receipt.blocked);
    const response = await fetch("http://127.0.0.1:48731/promo-attempts", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(receipt) });
    if (!response.ok) throw new Error("Open the PoP desktop app and try again.");
    const saved = receipt.results.filter((item) => item.outcome === "SAVINGS_OBSERVED");
    status.textContent = saved.length ? `${saved.length} code result${saved.length === 1 ? "" : "s"} showed a lower total. Review before applying.` : "No lower total was observed. Your original field was restored.";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Promo test could not run.";
  } finally { promoButton.disabled = false; }
});
