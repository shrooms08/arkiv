const SAFE = "0x49754062E35f7591B93cc4F9915965be89643a65";

/**
 * R1, inline. Not a modal, not a link to a doc — it sits in the mint flow above
 * the button, because burying it somewhere a user can dismiss or never open gets
 * no credit for the honesty.
 */
export function WrapperDisclosure() {
  return (
    <aside className="disclosure disclosure-upgradeable">
      <span className="app-label">Wrapper upgrade authority · 2-of-3 multisig</span>{" "}
      <strong>The underlying tokens are upgradeable.</strong>{" "}
      Every xStocks wrapper this basket holds is a proxy, and all of them share one
      admin owned by a <strong>2-of-3 multisig</strong>. Two of three keyholders can
      replace the implementation of every token in the vault — which could freeze
      balances or zero the holdings. Arkiv&rsquo;s accounting would stay correct and
      would faithfully report holdings that were no longer worth anything. This is
      the standing condition of holding any Backed xStock, on any chain; it is not
      something Arkiv can engineer away.{" "}
      <a
        className="disclosure-safe-link"
        href={`https://www.oklink.com/xlayer/address/${SAFE}`}
        target="_blank"
        rel="noreferrer"
      >
        {SAFE}
      </a>
    </aside>
  );
}
