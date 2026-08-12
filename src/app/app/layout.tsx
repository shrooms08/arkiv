import { NetworkBanner } from "@/components/NetworkBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * Product chrome, on every route under `/app`.
 *
 * The testnet banner is rendered here rather than per page, so there is no route
 * in the product where it can be missing. It is not dismissable and it sits
 * above the fold: a visitor must not be able to mistake a mock for a real
 * xStock, and that guarantee is worth more than the vertical space.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NetworkBanner />
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
