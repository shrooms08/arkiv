/**
 * Arkiv design system.
 *
 * Import the stylesheets once at the app root, in this order:
 *
 *   import "@arkiv/design-system/tokens/tokens.css";
 *   import "@arkiv/design-system/components/arkiv.css";
 *
 * Tokens must come first: the component sheet resolves every value through
 * the custom properties the token sheet defines.
 */

export { tokens, cssVar, default as defaultTokens } from "./tokens/tokens";
export type { SemanticToken } from "./tokens/tokens";
export {
  space,
  layout,
  breakpoints,
  fonts,
  type as typeScale,
  weight,
  tracking,
  radius,
  border,
  elevation,
  motion,
  density,
  palette,
  semantic,
} from "./tokens/tokens";

export { Button, ButtonDemo } from "./components/Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./components/Button";

export { Card, CardHeader, CardBody, CardFooter, CardDemo } from "./components/Card";
export type { CardProps } from "./components/Card";

export { Badge, BadgeDemo } from "./components/Badge";
export type { BadgeProps, BadgeTone } from "./components/Badge";

export { Nav, NavDemo } from "./components/Nav";
export type { NavProps, NavLink } from "./components/Nav";

export { Footer, FooterDemo } from "./components/Footer";
export type { FooterProps, FooterColumn } from "./components/Footer";

export { Accordion, AccordionDemo } from "./components/Accordion";
export type { AccordionProps, AccordionItem } from "./components/Accordion";

export { Input, InputDemo } from "./components/Input";
export type { InputProps } from "./components/Input";

export { Textarea, TextareaDemo } from "./components/Textarea";
export type { TextareaProps } from "./components/Textarea";

export { SerialNumber, SerialNumberDemo, formatSerial } from "./components/SerialNumber";
export type { SerialNumberProps } from "./components/SerialNumber";

export { RoleLabel, RoleLabelDemo, ROLE_TEXT } from "./components/RoleLabel";
export type { RoleLabelProps, AssetRole } from "./components/RoleLabel";

export { WeightNumeral, WeightNumeralDemo, formatWeight } from "./components/WeightNumeral";
export type { WeightNumeralProps, WeightSize } from "./components/WeightNumeral";

export { AllocationRibbon, AllocationRibbonDemo } from "./components/AllocationRibbon";
export type { AllocationRibbonProps, RibbonSegment } from "./components/AllocationRibbon";

export {
  ArkivMark,
  ArkivLockup,
  ArkivMarkDemo,
  ARKIV_MARK_SMALL_BELOW,
} from "./components/ArkivMark";
export type {
  ArkivMarkProps,
  ArkivMarkVariant,
  ArkivMarkCrop,
  ArkivLockupProps,
} from "./components/ArkivMark";

export { ProceduralCover, ProceduralCoverDemo } from "./components/ProceduralCover";
export type { ProceduralCoverProps } from "./components/ProceduralCover";

export { AssetRow, AssetRowDemo, truncateAddress } from "./components/AssetRow";
export type { AssetRowProps } from "./components/AssetRow";

export { FalsifierBlock, FalsifierBlockDemo } from "./components/FalsifierBlock";
export type { FalsifierBlockProps } from "./components/FalsifierBlock";

export { BasketCard, BasketCardDemo } from "./components/BasketCard";
export type { BasketCardProps } from "./components/BasketCard";

export {
  demoTheses,
  scrate,
  aibottle,
  stickyinf,
  segmentsFor,
  driftedSegmentsFor,
} from "./fixtures/demo";
export type { DemoThesis, DemoHolding, DemoFalsifier } from "./fixtures/demo";
