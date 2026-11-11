import { createDemoDashboard } from "@pop/domain";
import type { PopSection } from "@pop/ui";
import { LivePop } from "./live-pop";

export function renderPop(section: PopSection) {
  return <LivePop demo={createDemoDashboard()} section={section} kingdomHome={process.env.POP_KINGDOM_HOME !== "off"} googleSignInEnabled={Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET)} />;
}
