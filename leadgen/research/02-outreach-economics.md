# Cold-outreach economics & legal constraints — Neuro OS creator lead list

Research date: **6 November 2026**. Scope: cold-emailing 10,000+ YouTube channels that cover AI tools, dev productivity, automation, self-hosting, homelab, local LLMs, privacy. Contact emails scraped from public channel descriptions and linked sites.

Labels used throughout: **[OFFICIAL]** = primary law/platform doc · **[VENDOR-TELEMETRY]** = vendor measuring its own send data (large n, instrumented, but not audited) · **[VENDOR-MARKETING]** = vendor content page selling a tool · **[SECONDARY]** = law-firm/business summary · **[MODEL]** = my arithmetic.

**Blunt verdict:** the plan as scoped — 10,000 contacts, scraped emails, one blast — is the worst-performing and highest-risk version of this idea. It yields roughly *one to three* videos, burns two or three domains, and creates GDPR/UWG/PDPC exposure in at least four jurisdictions. The same effort aimed at ~1,500 tiered contacts produces several times more coverage.

---

## 1. Benchmarks: what cold email actually returns in 2025–26

There is **no independent academic benchmark** for cold email reply rates at scale. Every large-n figure in circulation comes from a vendor with a commercial interest in the number. Treat the table as directional.

| Metric | Figure | Source (date) | n | Evidence class |
|---|---|---|---|---|
| Reply rate, all B2B, **replies ÷ sends** | **0.45%** | [Belkins 2026 study](https://belkins.io/blog/cold-email-response-rates), updated 26 Jun 2026 | 7,530,489 emails / 34,393 replies | VENDOR-TELEMETRY (agency's own campaigns) |
| Reply rate, **replies ÷ opens** (legacy method) | ~4–6% | [ColdBox](https://coldbox.io/blog/cold-email-response-rate-benchmarks-industry-2026), 11 Feb 2026 | unclear; cites "Hunter report" | VENDOR-MARKETING — **do not use** |
| Reply rate H1 vs H2 2025 | 0.50% → 0.40% | Belkins 2026 | same | VENDOR-TELEMETRY |
| Reply rate, founders/owners | 0.57% | Belkins 2026 | same | VENDOR-TELEMETRY |
| Reply rate, VP level | 0.32% | Belkins 2026 | same | VENDOR-TELEMETRY |
| Reply rate, companies 0–10 staff | 0.72% | Belkins 2026 | same | VENDOR-TELEMETRY |
| Reply rate, companies 10,000+ staff | 0.22% | Belkins 2026 | same | VENDOR-TELEMETRY |
| Reply rate, US recipients | 0.51% | Belkins 2026 | 5.6M emails | VENDOR-TELEMETRY |
| Meetings | 1,200 appointments from 7.5M emails (**1 per 6,275 sends**) | Belkins 2026 | same | VENDOR-TELEMETRY |
| Emails per meeting, average rep | **344** | [Gong Labs](https://www.gong.io/blog/does-cold-email-even-work-any-more-heres-what-the-data-says), 24 Jul 2025 | 28M+ emails | VENDOR-TELEMETRY |
| Top-decile vs average meetings | 8.1× | Gong Labs 2025 | 28M+ | VENDOR-TELEMETRY |
| Effect of pitching the product | reply rate −57% | Gong Labs 2025 | 28M+ | VENDOR-TELEMETRY |
| Effect of buzzwords/numbers in subject | opens −17.9% | Gong Labs 2025 | 28M+ | VENDOR-TELEMETRY |
| Best email length | ≤100 words, 3–4 sentences | Gong Labs 2025 | 28M+ | VENDOR-TELEMETRY |
| Open rate, cold email | ~39–44% (and unreliable; Apple MPP preloads pixels) | [ColdBox](https://coldbox.io/blog/cold-email-open-rates-average-good-improve), 6 Jul 2026 | unclear | VENDOR-MARKETING |
| Developer-tools segment | **no reliable figure found** — the "developer tools benchmark" pages I checked ([PrimaryInbox](https://primaryinbox.ai/benchmarks/cold-email/developer-tools)) contain zero numbers | Nov 2026 | — | — |

**The key methodological point:** the 5–8% figures and the 0.45% figure describe the *same campaigns* with different denominators (replies÷opens vs replies÷sends). Belkins says so explicitly. ColdBox's table (5–8% SaaS, "meeting rate 25–35% from replies") is internally inconsistent with a sends-based average and is SEO content, not a study. Plan on **sends as the denominator** or you over-forecast by ~10×.

**Open rate is not usable in 2026.** Open pixels are themselves a deliverability liability (Belkins attributes the industry's shift to sends-based measurement to pixel-driven reputation damage), and Apple Mail Privacy Protection inflates opens by preloading them.

---

## 2. Creator / influencer outreach specifically

| Metric | Figure | Source | n | Class |
|---|---|---|---|---|
| Overall reply rate, creator→brand pitches | **4.1%** | [PitchBrand, State of Pitching 2026](https://www.pitchbrand.co/statistics/state-of-pitching-2026), Mar 2026 | 29,223 pitches, 1,200+ replies, Jan 2025–Feb 2026 | VENDOR-TELEMETRY |
| Reply rate, campaigns of ≤25 targets | **8.1%** | PitchBrand 2026 | subset | VENDOR-TELEMETRY |
| Reply rate, campaigns of 250+ targets | **1.8%** | PitchBrand 2026 | subset | VENDOR-TELEMETRY |
| Share of replies from follow-ups | 26% | PitchBrand 2026 | same | VENDOR-TELEMETRY |
| Replies arriving within 1 hour | 42% | PitchBrand 2026 | same | VENDOR-TELEMETRY |
| Reply rate, verified vs unverified address | 5.2% vs 2.8% | PitchBrand 2026 | same | VENDOR-TELEMETRY |
| Bounce rate, verified vs unverified | <2% vs 12–18% | PitchBrand 2026 | same | VENDOR-TELEMETRY |
| Adding a specific content idea | +63% reply lift | PitchBrand 2026 | same | VENDOR-TELEMETRY |
| "opportunity" vs "collab" in subject | 1.8% vs 10.6% | PitchBrand 2026 | same | VENDOR-TELEMETRY |
| Universal influencer reply benchmark | **"There is no reliable universal percentage."** | [Janney AI](https://www.janney.ai/blog/influencer-reply-rate-benchmarks/) | — | VENDOR (refreshingly honest) |

**Critical caveat:** PitchBrand's dataset runs the *opposite direction* — creators pitching brands for paid deals. A YouTuber receiving an unpaid product pitch is not the same inbox as a brand's influencer-marketing manager. Direction matters: the 4.1% baseline is the closest large-n analogue available, and the **campaign-size gradient (8.1% → 1.8%, a 4.5× swing)** is the transferable finding, because it is a property of recipient attention, not of who is pitching.

**What DevRel/PR practitioners actually report:** no audited survey exists. I found **no reliable figure** for YouTuber response rates from a DevRel survey or trade body. What the evidence supports:

- **Product access, no strings** is the highest-leverage offer for a free OSS tool and costs nothing. PitchBrand's data show portfolio/specific-idea elements beat pricing mentions (pricing mention *hurt* reply rate by 7%).
- **Payment expectations are real and unmet.** Tech & Electronics is the *second-worst* vertical in PitchBrand's data at 2.9% (vs 6.8% beauty). Assume most mid-size AI channels price coverage; many small ones do not.
- **A realistic expectation for a $0 budget, no existing relationships, no social proof:** 1–2% reply on templated outreach, 5–10% on genuinely hand-researched Tier-A pitches — and a large share of positive replies will be "send me a key and I'll look at it", not "I'll make a video".

---

## 3. Deliverability mechanics

**Sending domain vs primary domain.** Never send cold mail from `neuro-os.com`. Microsoft's own bulk-sender guidance says to use a separate subdomain for bulk/marketing mail (e.g. `m.contoso.com`) to protect the primary domain's reputation. **[OFFICIAL]** ([Microsoft Learn](https://learn.microsoft.com/en-us/defender-office-365/outbound-spam-sending-limits-troubleshoot), updated 27 May 2026)

**SPF / DKIM / DMARC** are table stakes, not differentiators. Google's sender guidelines require SPF *and* DKIM *and* DMARC for bulk senders (5,000+/day to Gmail), plus one-click unsubscribe, and require spam-complaint rate **below 0.3%** (0.1% is the safer operating target). **[OFFICIAL]** ([Gmail sender guidelines](https://support.google.com/mail/answer/81126))

**Per-mailbox actual limits [OFFICIAL]:**

| Platform | Hard limit | Notes |
|---|---|---|
| Google Workspace | 2,000 recipients/day/user | [Gmail sending limits](https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace) |
| Microsoft 365 / Exchange Online | 10,000 recipients/day/user; **30 messages/minute**; 500 recipients/message; trial tenants 5,000 external recipients/day (TERRL) | Microsoft states Exchange Online "isn't designed for bulk mailing scenarios" and that exceeding limits routes mail to a **high-risk delivery pool** and then restricts the account |

Those numbers are *account bans waiting to happen*, not targets. Microsoft's own recommended ceiling is **30 messages/minute per mailbox**. Vendor convention for cold outreach is 30–50/day/mailbox on a warmed domain — roughly 40–60× below the cap, because the cap governs *throttling*, not *reputation*.

**Warm-up.** Vendors publish 4–8 week ramps ([Reply.io](https://support.reply.io/hc/reply-help-center/articles/how-to-warm-up-a-new-domain-before-sending-cold-emails)). **[VENDOR-MARKETING]** No controlled study shows any specific schedule works. What is not in dispute: a domain under ~4 weeks old sending cold mail at volume is treated as suspect, and the damage attaches to the *domain*, so a burned domain is burned for transactional mail too.

**Bounce thresholds.** No provider publishes a "block at X%" figure. Operational consensus: keep hard bounces **under 2%**, investigate above 3%, expect blocks above 5%. The one hard-sourced number is PitchBrand's verified-vs-unverified split (<2% vs 12–18%) — a list-hygiene fact, not provider policy.

**Tracking pixels.** Open pixels and click redirects are widely reported to depress placement, and Belkins attributes an industry-wide deliverability hit to open tracking. **[VENDOR-TELEMETRY]** Run this campaign with **tracking off**: you lose data you cannot trust and keep the domain.

**Why a 10k blast is catastrophic.** Three failures stack: (1) you cannot send 10k/day from one mailbox — Gmail caps at 2,000 recipients/day, so a "blast" is 5+ mailboxes or a bulk ESP, and ESPs terminate accounts for scraped lists; (2) 10k identical messages from a 3-week-old domain is the exact signature of spam, so placement collapses and the domain is filtered for months; (3) scraped lists carry 10–20% invalid addresses, breaching the 2% bounce ceiling within the first 500 sends — before the list is half-used.

---

## 4. Legality

Not legal advice. Two things are true simultaneously: **harvesting the address is usually the bigger legal exposure than sending to it**, and **the EU/UK/MENA picture is not one rule, it is eight**.

| Jurisdiction | Regime | Practical rule for this campaign | Source |
|---|---|---|---|
| **US** | CAN-SPAM, 15 U.S.C. §7701 et seq. | Opt-*out*, not opt-in. No consent needed, purchased/rented lists are **legal**. Required: accurate headers, non-deceptive subject, functioning unsubscribe honoured within 10 business days, **valid physical postal address** in every message. Civil penalties per email, inflation-indexed. **But** §7704(b)(1) makes *address harvesting* an aggravated violation where the source site carries a notice that it will not give/sell/transfer addresses — so scraping sites with an anti-harvesting notice is the real risk. | [15 U.S.C. §7704](https://www.law.cornell.edu/uscode/text/15/7704) [OFFICIAL] |
| **EU** | GDPR + ePrivacy Dir. 2002/58/EC Art. 13 | GDPR: business email of a named person is personal data; "legitimate interest" (Art. 6(1)(f)) needs a documented balancing test + immediate opt-out. ePrivacy: unsolicited commercial email needs **prior consent** unless an existing-customer exception applies; Member States set their own rules for *legal persons*, which is why B2B is legal in some countries and not others. | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj), [ePrivacy](https://eur-lex.europa.eu/eli/dir/2002/58/oj) [OFFICIAL] |
| **UK** | PECR reg. 22 + UK GDPR | Consent required for *individual* subscribers; **corporate subscribers (Ltd, LLP, public bodies) are exempt** — so B2B cold email to a company address is lawful without consent, provided sender identity is clear and opt-out honoured (reg. 23). Sole traders/partnerships count as individuals. ICO fines to £500k. | [ICO](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/electronic-mail-marketing/) [OFFICIAL] |
| **Germany** | UWG §7 | **Prior express consent required, no B2B exception.** §7(2) no. 2 makes email advertising without prior express consent *per se* an unreasonable nuisance; §7(3) allows only a narrow existing-customer exception. Fines to €300,000. This is the strictest major market and the one most likely to generate a cease-and-desist (Abmahnung). | [UWG §7](https://www.gesetze-im-internet.de/uwg_2004/__7.html) [OFFICIAL] |
| **France** | CPCE art. L34-5 + GDPR | Prior consent for natural persons. CNIL doctrine tolerates B2B email to a *professional* address where the message relates to the recipient's professional activity, with opt-out — **I am not fully certain of the current CNIL position; treat as uncertain and get local review.** | eur-lex / CNIL [uncertain] |
| **UAE** | Federal Decree-Law 45/2021 (PDPL); TDRA unsolicited-communications policy | Consent-based; marketing requires prior consent and working opt-out; TDRA regulates unsolicited electronic communications. | [uaelegislation.gov.ae](https://uaelegislation.gov.ae/) [OFFICIAL, not re-verified] |
| **Saudi Arabia** | PDPL, Royal Decree M/19 (2021) + SDAIA implementing regs | Prior consent for marketing; SDAIA rules require sender identification and opt-out. | [sdaia.gov.sa](https://sdaia.gov.sa/) [OFFICIAL, secondary-checked via [CMS guide](https://cms.law/en/int/expert-guides/cms-expert-guide-to-data-protection-and-cyber-security-laws)] |
| **Egypt** | PDPL Law 151/2020 + **Executive Regulations, MCIT Decree 816/2025** | **The strictest regime on this list.** ERs in force 3 Nov 2025, compliance deadline **1 Nov 2026** (just passed). Electronic direct marketing requires a **dedicated PDPC licence/permit**, explicit prior consent, records of consent, and immediate erasure on withdrawal. Foreign controllers must appoint an Egypt representative. | [Mondaq / Soliman Hashish & Partners, 15 Jan 2026](https://alpha.mondaq.com/privacy-protection/1731130/the-issuance-of-the-executive-regulations-of-the-data-protection-law-and-the-establishment-of-the-data-protection-centre) [SECONDARY — law firm, not the Gazette] |
| **YouTube ToS** | Terms of Service, eff. 5 Jan 2022 | Prohibits accessing the service "using any automated means (such as robots, botnets or scrapers)" except general search engines per robots.txt, prior written permission, or as permitted by law; separately prohibits **collecting or using information that can identify a user** (e.g. aggregating usernames) without permission; and prohibits using the service to distribute unsolicited commercial content. | [youtube.com/t/terms](https://www.youtube.com/t/terms) [OFFICIAL] |

**Practical read for this client.** The sending entity's location matters more than the recipient's, but the recipient's does too. If Neuro OS sends from the US to a global list: US is fine with unsubscribe + postal address; UK corporate is fine; Germany, Egypt, Saudi and most of the EU are not fine without consent. Egypt is now effectively closed to unlicensed cold marketing. **The cheapest mitigation is jurisdictional segmentation: suppress DE, FR, EG, SA, AE addresses entirely, or route them to a manual, individually-written contact rather than a sequence.** That is not a legal opinion — it is the minimum defensible posture, and it happens to overlap with where the tool's audience is *not* concentrated anyway.

---

## 5. Volume math

Assumptions **[MODEL]**, stated so you can attack them: reply rate = replies ÷ sends; inbox placement varies by strategy; positive replies = 30% of replies; positive→published video = 15%; Tier-A = hand-researched, ≤25 per batch; "effective reach" = contacts × placement.

| Strategy | Contacts | Placement | Effective reach | Replies @1% | @3% | @8% | Planning reply rate | Replies | Positive | Likely videos |
|---|---|---|---|---|---|---|---|---|---|---|
| **A. One 10k blast** | 10,000 | 45% | 4,500 | 45 | 135 | 360 | **0.7%** | ~32 | ~10 | **1–2** |
| **B. 10k tiered, 8 wks, 3 touches** | 10,000 | 85% | 8,500 | 85 | 255 | 680 | **1.6%** | ~136 | ~41 | **5–7** |
| **C. 300 Tier-A + 3,000 templated** | 3,300 | 92% / 80% | 2,676 | 27 | 81 | 215 | **2.4%** blended | ~64 | ~19 | **3–4** |

**Why the 8% column is fiction at 10k scale.** 8% is only observed in campaigns targeting ≤25 hand-picked recipients (PitchBrand: 8.1% for ≤25 vs 1.8% for 250+). Applying 8% to a 10,000-contact blast assumes the *opposite* of the only large-n finding available. It is shown above only to demonstrate that even the fantasy number yields 360 replies — about one reply per 28 sends — not the "thousands of creators will cover us" outcome the plan implicitly assumes.

**Strategy A fails on mechanics before it fails on copy.** 10,000 sends at 2,000 recipients/mailbox/day is 5 mailboxes minimum; from a new domain, placement collapses to ~45% and the domain is filtered. Videos: 1–2. Cost: two or three burned domains plus a support burden.

**Strategy B is the volume play and it is genuinely better**, but it requires 15–20 mailboxes at 30–50/day and 6 weeks of sending, i.e. real infrastructure and real daily labour. 5–7 videos from 10,000 contacts is the honest ceiling.

**Strategy C wins on efficiency, not absolute count.** It produces roughly the same videos as B from one-third the contacts and a fraction of the domain risk. The gap between B and C is the entire argument of this brief.

**Sensitivity, plainly:** every strategy moves ~3× between the 1% and 3% scenarios. That means copy and targeting decisions dominate infrastructure decisions — but only *after* deliverability clears the 2% bounce / 0.3% complaint gates. Below those gates, nothing else matters.

---

## 6. YouTube-specific facts

**Does the ToS prohibit scraping channel pages?** Yes, on its face. The prohibition on "accessing the service using any automated means (such as robots, botnets or scrapers)" is explicit, with three carve-outs: general search engines respecting robots.txt, prior written permission, or "as permitted by applicable law". There is also a separate clause against collecting user-identifying information. **[OFFICIAL]** ([ToS, eff. 5 Jan 2022](https://www.youtube.com/t/terms))

**Has YouTube taken action against channel-email scrapers?** **No public case found** specifically about scraping channel *emails*. The live enforcement front is scraping of *video content*: in *Ted Entertainment v. ByteDance* (N.D. Cal. 3:25-cv-10933), plaintiffs plead DMCA §1201 anti-circumvention claims over YouTube scraping and the court refused to dismiss (Oct 2026). **[SECONDARY]** ([AEON Law](https://aeonlaw.com/judge-refuses-to-dismiss-bytedance-lawsuit-over-ai-scraping-of-youtube/)). The lesson is not "emails are safe" — it is that the legal theory being tested is anti-circumvention, and that breakage/enforcement risk sits with the *scraper*, not the sender.

**Are business emails public by choice?** Yes — a creator must actively add an address to the About section or link a site. That is meaningful for GDPR "manifestly made public" arguments but **it is not consent to marketing**, and it does not cure the ePrivacy/UWG/PDPC problems. Do not let anyone on the team conflate "public" with "permitted".

**Is there a legitimate route via the API?** No. YouTube Data API v3's `channels` resource exposes `snippet` (title, description, customUrl, publishedAt, thumbnails), `statistics`, `contentDetails`, `topicDetails`, `brandingSettings` and `status` — **there is no email field**, confirmed against the resource reference ([developers.google.com/youtube/v3/docs/channels](https://developers.google.com/youtube/v3/docs/channels)). The API gets you channel discovery and descriptions legitimately; the email step is always a second, non-API hop to the creator's own site or About page.

**Commercial providers — pricing.** Coverage claims are marketing; treat as **[VENDOR-MARKETING]**.

| Provider | Price found | Coverage claim | Confidence |
|---|---|---|---|
| Modash | $199–$599/mo (annual), Enterprise from $14,700/yr | 350M+ profiles across IG/TikTok/YouTube, "verified creator emails" | [SECONDARY — competitor blog](https://archive.com/blog/modash-pricing), May 2026; Modash's own page gates pricing behind a demo |
| HypeAuditor | **no reliable public figure found** (quote-gated) | — | — |
| CreatorDB | **no reliable public figure found** | — | — |
| Apify YouTube email-scraper actors | **no reliable public figure found** — pricing pages render client-side and returned no numbers on fetch | actors advertise "emails + leads" extraction | — |

Two conclusions: at $199+/mo these tools are not "budget-free", and none of them solve the legal problem — they sell you the same scraped address with a nicer UI and, in Modash's case, a claimed verification step. The one genuinely useful purchase is **email verification**, not discovery.

---

## Recommended outreach plan

Zero-to-minimal budget, 8 weeks, aimed at coverage rather than contact count. Volumes assume you already hold 3–5 Google Workspace seats and can buy two cheap domains (~$12 each; if literally zero spend, use subdomains of a domain you own and accept slower warm-up).

**Infrastructure (week 1, non-negotiable before any send)**
Two sending domains or subdomains, never the primary. SPF + DKIM + DMARC (`p=none` initially, tighten to `quarantine` by week 6). **Tracking pixels and link shorteners off** — evidence above says they cost placement and buy you data you cannot trust. One plain-text link maximum per email. Hard-bounce suppression automatic. Reply-to a monitored human inbox, not `noreply@`.

**Weeks 1–2 — build and verify 2,000, not 10,000**
Rank channels by (a) published a video on local LLMs / homelab / self-hosting / privacy in the last 90 days, (b) channel size 5k–250k (large enough to matter, small enough to answer their own email — Belkins' founder/small-company effect at 0.57–0.72% vs 0.22% for enterprises), (c) an email that is actually theirs and not a management agency. Verify every address. Expect 25–35% to be unusable. Result: ~1,400 sendable contacts. **This step is the whole campaign;** everything after it is arithmetic.

**Week 2 — segment by jurisdiction before writing copy.** Suppress DE, FR, EG, SA, AE outright, or hold them for individually-written one-offs. This is a legal requirement, not a preference (§4). It also removes a segment that was never going to convert at volume.

**Weeks 2–3 — warm up.** 10 → 20 → 40 sends/day per mailbox on real conversations. No cold mail during warm-up.

**Weeks 3–8 — three touches, tiered**

| Week | Tier-A (hand-researched, ≤25/batch) | Tier-B (semi-personalized) | Follow-ups | Sends/wk |
|---|---|---|---|---|
| 3 | 100 | 100 | 0 | ~200 |
| 4 | 100 | 200 | 100 | ~400 |
| 5 | 75 | 300 | 200 | ~575 |
| 6 | 75 | 400 | 300 | ~775 |
| 7 | 50 | 450 | 400 | ~900 |
| 8 | 0 | 400 | 450 | ~850 |

Total ≈ 3,700 sends across ~1,450 unique contacts, 3 touches each, at ≤40/day/mailbox across 5 mailboxes. Touch 2 at day 3–4 (PitchBrand's optimum), touch 3 at day 8–10, then stop. Expect ~55–70 replies, ~18–22 positive, **3–5 published pieces** — plus the handful of creators who become repeat coverage, which is the actual asset.

**Channel mix.** 60% Tier-B AI-tools/automation channels, 25% homelab/self-hosting/local-LLM, 15% privacy/dev-productivity. The privacy and self-hosting segments are smaller but have the highest fit-per-subscriber for a no-telemetry, local-first app, and they are the least saturated by vendor pitches.

**The offer (this is what carries the campaign, not the copy).** Free MIT-licensed build, no account, no telemetry, bring-your-own key, plus direct access to the maintainer for questions and a promise of no follow-up if they say no. Give them something no vendor can: the source, the roadmap, and a say in it. Gong's finding that pitching the product *reduces* replies by up to 57% maps directly — lead with what it does for *their* workflow, not with the product.

**Five subject-line patterns most likely to get a reply.** Evidence: specific content hooks beat generic ones (+63%, PitchBrand); short subject lines (5–8 words) outperform; `opportunity`/`sponsorship` framing underperforms (`opportunity` −56%); pitching language costs 57% of replies (Gong); ≤100-word bodies win.

1. **`your <exact video title> setup`** — specific-content hook, no pitch. Highest expected reply rate; only works if the title is genuinely theirs and recent.
2. **`free + MIT, no strings — want the build first?`** — leads with access and absence of obligation, which is the only offer a $0 budget can make credibly.
3. **`one question about <topic> on your channel`** — one easy-to-answer question; low cognitive load, no meeting ask.
4. **`local-first agent, runs offline, your key`** — five words of product truth for the homelab/self-host audience, which is allergic to marketing language.
5. **`not a sponsorship`** — disarms the paid-pitch reflex in an inbox full of `collab`/`opportunity` mail. Use sparingly; it is a pattern interrupt, not a template.

Avoid: `collab`, `partnership`, `opportunity`, `sponsorship`, any number in the subject, and any subject longer than eight words. All of these are measured as neutral-to-negative in the sources above.

**What to tell the client plainly:** 10,000 contacts is not a strategy, it is a list size. The evidence says reply rate falls 4.5× as campaign size rises, that a single blast from a cold domain lands roughly half its mail in spam and burns the domain, and that Egypt/Germany/Saudi make a chunk of the list unlawful to email at all. The 1,400-contact version of this plan is not a compromise — it is the only version with a defensible expected value.
