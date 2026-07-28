import { redirect } from "next/navigation";

/**
 * /team is the legacy route — /team-management is the canonical live implementation.
 * Hard redirect so no one lands on mock data.
 */
export default function TeamLegacyRedirect() {
  redirect("/team-management");
}
