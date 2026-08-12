# Worked examples

GENERATED FILE. Do not edit by hand. Produced by `scripts/build-skill-reference.ts`
from the committed fixtures in `test/fixtures/underwriting/`. Every paragraph and
every holding below is quoted from a real record, not reconstructed.

## CAPEXPAY

### What the author wrote

> The AI capital expenditure bill comes due, and the market stops pricing the spending as though it were already productive. The distinction that matters is not who spent the most, it is who was already selling something to the customer they now want to sell inference to. Enterprise software vendors with an existing seat licence and an existing procurement relationship convert capacity into revenue without a new sales motion. Consumer platforms and infrastructure resellers have to build that relationship first, and they are paying for capacity in the meantime.

### What the underwriter returned

**AI Capex Reckoning: Seat-Licence Advantage**, confidence medium, cleared in 1 call.

| Holding | Weight | Why it is that size |
| --- | --- | --- |
| `MSFTx` | 30% | Microsoft sells Copilot through the existing M365 seat licence and EA renewal cycle. The causal mechanism is contract structure: when a CFO renews, AI features are already in the SKU, so incremental revenue requires no new procurement motion. This is the purest expression of the seat-licence advantage in the allowlist. |
| `GOOGLx` | 20% | Alphabet sells Gemini through Google Workspace and through GCP committed-use contracts already signed by enterprise customers. The existing cloud billing relationship means AI inference can be metered against a contract the customer already manages, shortening the sales cycle relative to a pure infrastructure reseller. |
| `QQQx` | 25% | The Nasdaq 100 holds both the winners and losers of the capex reckoning. It serves as the liquid core anchor and ensures the basket participates if the thesis is wrong and the market continues to price capex as productive. It also provides diversified tech exposure without concentrating in any single capex-heavy name. |
| `SPYx` | 25% | Broad index anchor that captures the macro environment. If AI capex compression triggers a broader tech selloff, SPYx dampens the drawdown relative to a pure-tech basket. Its weight reflects that the thesis is about relative performance within tech, not a directional bet against the market. |

Core lands at 5000 bps against a 5000 bps floor. The primary expression is
`MSFTx` at 3000 bps against a 1500 bps floor.

**Falsifier**, which the underwriter wrote and the author did not:

- Claim: Enterprise software vendors with existing seat licences convert AI capacity into incremental revenue faster than consumer platforms because the procurement relationship already exists.
- Observable: Microsoft and Alphabet quarterly earnings: specifically, Copilot/AI attach revenue disclosed in each company's earnings report and management commentary on AI seat conversion rates.
- Breach: If neither Microsoft nor Alphabet reports accelerating AI-driven revenue growth (ARR or seat attach) in two consecutive quarters while capex remains flat or rising, the conversion-advantage thesis is broken.
- Horizon: 12M

Note what the author's paragraph did NOT contain: no tickers, no percentages, no
observable, no breach condition. It named a mechanism and a direction, and the
underwriter did the rest.

---

## SCRATE

### What the author wrote

> Everyone is obsessed with megacap tech but I think the interesting move over the
>    next year is small caps catching a bid as rates come down. Big tech is priced
>    for perfection. I still want some index exposure because I might be early, but
>    I want the tilt to be real.

### What the underwriter returned

**Small Cap Rate Relief with Index Hedge**, confidence high, cleared in 1 call.

| Holding | Weight | Why it is that size |
| --- | --- | --- |
| `IWMx` | 50% | The Russell 2000 is the direct expression of the small-cap rate relief thesis. Small caps carry a higher proportion of floating-rate debt than large caps, so falling rates reduce interest expense mechanically and immediately — this is a balance sheet mechanism, not a sentiment call. 5000 bps reflects genuine conviction while also satisfying the core asset floor in one position. |
| `SPYx` | 30% | Held as an explicit acknowledgment that the small-cap thesis may take longer to materialize than the 12-month horizon. The S&P 500 provides broad index exposure dominated by large caps that are less rate-sensitive, acting as a return anchor if megacap strength continues. This is a real hedge, not filler — without it, being early on IWMx means zero return. |
| `QQQx` | 20% | Nasdaq 100 exposure covers the scenario where AI-driven megacap earnings continue to surprise and dominate market returns. If the thesis is wrong and tech reprices higher rather than rotating into small caps, QQQx limits the drag. Sized at 2000 bps — meaningful but subordinate to the IWMx core bet. |

Core lands at 10000 bps against a 5000 bps floor. The primary expression is
`IWMx` at 5000 bps against a 1500 bps floor.

**Falsifier**, which the underwriter wrote and the author did not:

- Claim: Falling rates will cause small caps to outperform large caps over the next 12 months because rate relief mechanically reduces floating-rate interest expense, improving earnings for the Russell 2000 relative to the S&P 500.
- Observable: Rolling 12-month total return of IWMx versus SPYx, measurable at any month-end with publicly available ETF data.
- Breach: IWMx total return trails SPYx total return by more than 5 percentage points over the 12-month window ending at horizon.
- Horizon: 12M

Note what the author's paragraph did NOT contain: no tickers, no percentages, no
observable, no breach condition. It named a mechanism and a direction, and the
underwriter did the rest.

---

## STICKYINF

### What the author wrote

> I think we're heading into a period where inflation stays stickier than the
>    consensus expects and central banks blink before it's actually beaten. Real
>    assets should do well and long-duration growth should struggle. I want to be
>    defensive without sitting entirely in cash.

### What the underwriter returned

**Sticky Inflation, Central Bank Blink**, confidence medium, cleared in 1 call.

| Holding | Weight | Why it is that size |
| --- | --- | --- |
| `GLDx` | 35% | Gold is the direct expression of the thesis: when real rates fall because central banks blink before inflation is beaten, gold's opportunity cost drops and its store-of-value premium expands. This is a causal mechanism — gold has no cash flows to discount, so its price is driven almost entirely by real rate expectations and dollar credibility. A central bank capitulation before inflation is tamed is precisely the environment where gold outperforms most. |
| `SPYx` | 25% | Broad S&P 500 provides defensive participation across sectors including energy, materials, and financials that benefit from or are neutral to inflation. The index's earnings are shorter-duration on average than pure tech, and its dividend-paying components provide a real-economy anchor. Held here to keep core pool weight high and maintain exposure to inflation pass-through in commodity-linked and financial sectors. |
| `QQQx` | 10% | A minimum position in Nasdaq 100 acknowledges that a blanket short on growth is not the thesis — rather, that long-duration growth struggles relative to real assets. QQQx captures any scenario where the central bank blink ignites a growth rally, limiting the cost of being wrong on the growth-versus-real-assets spread. Weight is intentionally low because the thesis is structurally unfavorable to high-multiple tech. |
| `IWMx` | 10% | Small caps are domestically focused with shorter earnings duration than mega-cap tech and higher sensitivity to domestic credit conditions. If central banks blink, domestic rate relief benefits small caps more directly than multinationals. Held as a secondary inflation-resilience leg and to keep core pool weight well above the 5000 bps floor. |
| `AMZNx` | 10% | Amazon's AWS segment generates high-margin, recurring cloud revenue with pricing power, while its retail segment can pass through inflation via price increases. Unlike pure-multiple growth plays, Amazon has near-term cash flow generation that partially insulates it from duration risk. A modest tilt here captures the real-economy and cloud components of inflation pass-through. |
| `AVGOx` | 10% | Broadcom generates the majority of revenue from long-term semiconductor supply agreements with hyperscalers and enterprise, giving it contractual pricing power. Its high free cash flow yield makes it less sensitive to discount rate moves than zero-earnings growth names. Held as a tilt toward inflation-resilient tech infrastructure rather than speculative long-duration exposure. |

Core lands at 8000 bps against a 5000 bps floor. The primary expression is
`GLDx` at 3500 bps against a 1500 bps floor.

**Falsifier**, which the underwriter wrote and the author did not:

- Claim: Central banks will cut rates before CPI in their primary market returns sustainably to target, causing real rates to fall and gold to outperform long-duration growth assets.
- Observable: US Federal Reserve policy rate versus US CPI (12-month trailing). Watch Fed Funds effective rate and monthly CPI releases through the horizon.
- Breach: Fed Funds rate is cut by 50 bps or more cumulatively while 12-month US CPI remains at or above 3.0%, AND gold underperforms QQQ by more than 10% over the same window.
- Horizon: 12M

Note what the author's paragraph did NOT contain: no tickers, no percentages, no
observable, no breach condition. It named a mechanism and a direction, and the
underwriter did the rest.
