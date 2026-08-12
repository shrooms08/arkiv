import type { AssetRole as DsAssetRole } from "@ds";
import type { AssetRole } from "@/config/assets";

/**
 * The app's asset config and the design system name the same two roles
 * differently: the config says `tilt`, the design system says `satellite`.
 * Both render as "Thesis expression".
 *
 * The config's vocabulary is contract-adjacent — it mirrors how assets were
 * allowlisted — so neither side is changed to match the other. The translation
 * lives here instead, in one place, so a third spelling cannot appear later.
 */
export function dsRole(role: AssetRole | undefined): DsAssetRole {
  return role === "tilt" ? "satellite" : "core";
}
