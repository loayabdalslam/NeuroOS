# Cold-outreach economics & legal constraints — Neuro OS creator lead list

Research date: **6 November 2026**. Scope: cold-emailing 10,000+ YouTube channels that cover AI tools, dev productivity, automation, self-hosting, homelab, local LLMs, privacy. Contact emails scraped from public channel descriptions and linked sites.

Labels used throughout: **[OFFICIAL]** = primary law/platform doc · **[VENDOR-TELEMETRY]** = vendor measuring its own send data (large n, instrumented, but not audited) · **[VENDOR-MARKETING]** = vendor content page selling a tool · **[SECONDARY]** = law-firm/business summary · **[MODEL]** = my arithmetic.

**Blunt verdict:** the plan as scoped — 10,000 contacts, scraped emails, one blast — is the worst-performing and highest-risk version of this idea. It yields roughly *one to three* videos, burns two or three domains, and creates GDPR/UWG/PDPC exposure in at least four jurisdictions. The same effort aimed at ~1,500 tiered contacts produces several times more coverage.

---

## 1. Benchmarks: what cold email actually returns in 2025–26

There is **no independent academic benchmark** for cold email reply rates at scale. Every large-n figure in circulation comes from a vendor with a commercial interest in the number. Treat the table as directional, not measured.

| Metric | Figure | Source (date) | n | Evidence class |
|---|---|---|---|---|
| Reply rate, all B2B, **replies ÷ sends** | **0.45%** | [Belkins 2026 study](https://belkins.io/blog/cold-email-response-rates), updated 26 Jun 2026 | 7,530,489 emails / 34,393 replies | VENDOR-TELEMETRY (agency's own campaigns) |
| Reply rate, **replies ÷ opens** (legacy method) | ~4–6% | [ColdBox](https://coldbox.io/blog/cold-email-response-rate-benchmarks-industry-2026), 11 Feb 2026 | unclear; cites "Hunter report" | VENDOR-MARKETING — **do not use** |
| Reply rate H1 vs H2 2025 | 0.50% → 0.40% | Belkins 2026 | same | VENDOR-TELEMETRY |
| Reply rate, founders / C-level / VP | 0.57% / 0.42% / 0.32% | Belkins 2026 | same | VENDOR-TELEMETRY |
| Reply rate, 0–10 staff / 10,000+ staff | 0.72% / 0.22% | Belkins 2026 | same | VENDOR-TELEMETRY |
| Reply rate, US recipients | 0.51% | Belkins 2026 | 5.6M emails | VENDOR-TELEMETRY |
| Meetings | 1,200 appointments from 7.5M emails (**1 per 6,275 sends**) | Belkins 2026 | same | VENDOR-TELEMETRY |
| Emails per meeting, average rep | **344** | [Gong Labs](https://www.gong.io/blog/does-cold-email-even-work-any-more-heres-what-the-data-says), 24 Jul 2025 | 28M+ emails | VENDOR-TELEMETRY |
| Top-decile vs average meetings | 8.1× | Gong Labs 2025 | 28M+ | VENDOR-TELEMETRY |
| Pitching the product | reply rate −57% | Gong Labs 2025 | 28M+ | VENDOR-TELEMETRY |
| Buzzwords/numbers in subject | opens −17.9% | Gong Labs 2025 | 28M+ | VENDOR-TELEMETRY |
| Best length | ≤100 words, 3–4 sentences | Gong Labs 2025 | 28M+ | VENDOR-TELEMETRY |
| Open rate, cold email | ~39–44% (unreliable; Apple MPP preloads pixels) | [ColdBox](https://coldbox.io/blog/cold-email-open-rates-average-good-improve), 6 Jul 2026 | unclear | VENDOR-MARKETING |
| Developer-tools segment | **no reliable figure found** — the "developer tools benchmark" pages checked ([PrimaryInbox](https://primaryinbox.ai/benchmarks/cold-email/developer-tools)) contain zero numbers | Nov 2026 | — | — |

**The key methodological point:** the 5–8% figures and the 0.45% figure describe the *same campaigns* with different denominators (replies÷opens vs replies÷sends). Belkins says so explicitly. ColdBox's table (5–8% SaaS, "meeting rate 25–35% from replies") is internally inconsistent with a sends-based average — it is SEO content, not a study. Plan on **sends as the denominator** or you over-forecast by ~10×.

**Open rate is not usable in 2026.** Open pixels are themselves a deliverability liability, and Apple Mail Privacy Protection inflates opens by preloading them.

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
| "opportunity" vs "collab" in subject | 1.8% vs 10.6% | PitchBrand 2026 | same | VENDOR-TELEMETRY |
| Universal influencer reply benchmark | **"There is no reliable universal percentage."** | [Janney AI](https://www.janney.ai/blog/influencer-reply-rate-benchmarks/) | — | VENDOR (refreshingly honest) |

**Critical caveat:** PitchBrand runs the *opposite direction* — creators pitching brands for paid deals, not YouTubers receiving an unpaid pitch. 4.1% is the closest large-n analogue available; the **campaign-size gradient (8.1% → 1.8%, a 4.5× swing)** is the transferable finding, because it reflects recipient attention, not who is pitching.

**DevRel/PR practitioner reports:** no audited survey exists. I found **no reliable figure** for YouTuber response rates from a DevRel survey or trade body. What the evidence supports:

- **Product access, no strings** is the highest-leverage offer for a free OSS tool, and costs nothing. Specific-idea and portfolio elements beat pricing mentions; mentioning pricing *hurt* reply rate by 7%.
- **Payment expectations are real and unmet.** Tech & Electronics is the second-worst vertical in PitchBrand's data at 2.9% (vs 6.8% beauty). Assume most mid-size AI channels price coverage; many small ones do not.
- **Realistic $0-budget expectation, no relationships or social proof:** 1–2% reply on templated outreach, 5–10% on genuinely hand-researched Tier-A pitches — and many positives are "send me a key", not "I'll make a video".

---

## 3. Deliverability mechanics

**Sending domain vs primary domain.** Never send cold mail from `neuro-os.com`. Microsoft's bulk-sender guidance says to use a separate subdomain (e.g. `m.contoso.com`) to protect the primary domain's reputation. **[OFFICIAL]** ([Microsoft Learn](https://learn.microsoft.com/en-us/defender-office-365/outbound-spam-sending-limits-troubleshoot), updated 27 May 2026)

**SPF / DKIM / DMARC** are table stakes, not differentiators. Google's guidelines require all three for bulk senders (5,000+/day to Gmail), plus one-click unsubscribe, and a spam-complaint rate **below 0.3%** (0.1% is the safer operating target). **[OFFICIAL]** ([Gmail sender guidelines](https://support.google.com/mail/answer/81126))

**Per-mailbox actual limits [OFFICIAL]:**

| Platform | Hard limit | Notes |
|---|---|---|
| Google Workspace | 2,000 recipients/day/user | [Gmail sending limits](https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace) |
| Microsoft 365 / Exchange Online | 10,000 recipients/day/user; **30 messages/minute**; 500 recipients/message; trial tenants 5,000 external recipients/day (TERRL) | Microsoft states Exchange Online "isn't designed for bulk mailing scenarios" and that exceeding limits routes mail to a **high-risk delivery pool** and then restricts the account |

Those numbers are *account bans waiting to happen*, not targets. Microsoft's own recommended ceiling is **30 messages/minute per mailbox**. Vendor convention for cold outreach is 30–50/day/mailbox on a warmed domain — roughly 40–60× below the cap, because the cap governs *throttling*, not *reputation*.

**Warm-up.** Vendors publish 4–8 week ramps ([Reply.io](https://support.reply.io/hc/reply-help-center/articles/how-to-warm-up-a-new-domain-before-sending-cold-emails)). **[VENDOR-MARKETING]** No controlled study shows any specific schedule works. What is not in dispute: a domain under ~4 weeks old sending cold mail at volume is treated as suspect, and the damage attaches to the *domain*, so a burned domain is burned for transactional mail too.

**Bounce thresholds.** No provider publishes a "block at X%" figure. Operational consensus: keep hard bounces **under 2%**, investigate above 3%, expect blocks above 5%. The one hard-sourced number is PitchBrand's verified-vs-unverified split (<2% vs 12–18%) — a list-hygiene fact, not provider policy.

**Tracking pixels.** Open pixels and click redirects are widely reported to depress placement, and Belkins attributes an industry-wide deliverability hit to open tracking. **[VENDOR-TELEMETRY]** Run this campaign with **tracking off**: you lose data you cannot trust and keep the domain.

**Why a 10k blast is catastrophic.** Three failures stack: (1) you cannot send 10k/day from one mailbox — Gmail caps at 2,000 recipients/day, so a "blast" is 5+ mailboxes or a bulk ESP, and ESPs terminate accounts for scraped lists; (2) 10k identical messages from a 3-week-old domain is the exact signature of spam — placement collapses and the domain is filtered for months; (3) scraped lists carry 10–20% invalid addresses, breaching the 2% bounce ceiling within the first 500 sends.

---

## 4. Legality

Not legal advice. Two things are true at once: **harvesting the address is usually the bigger exposure than sending to it**, and **the EU/UK/MENA picture is not one rule, it is eight**.

| Jurisdiction | Regime | Practical rule for this campaign | Source |
|---|---|---|---|
| **US** | CAN-SPAM, 15 U.S.C. §7701 et seq. | Opt-*out*, not opt-in. No consent needed; purchased/rented lists are **legal**. Required: accurate headers, non-deceptive subject, working unsubscribe honoured within 10 business days, **valid physical postal address**. Penalties per email, inflation-indexed. **But** §7704(b)(1) makes *address harvesting* an aggravated violation where the source site carries a notice that it will not give/sell/transfer addresses — scraping such sites is the real risk. | [15 U.S.C. §7704](https://www.law.cornell.edu/uscode/text/15/7704) [OFFICIAL] |
| **EU** | GDPR + ePrivacy Dir. 2002/58/EC Art. 13 | GDPR: a named person's business email is personal data; "legitimate interest" (Art. 6(1)(f)) needs a documented balancing test + immediate opt-out. ePrivacy: unsolicited commercial email needs **prior consent** unless the existing-customer exception applies; Member States set their own rules for *legal persons*, which is why B2B is lawful in some countries and not others. | [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj), [ePrivacy](https://eur-lex.europa.eu/eli/dir/2002/58/oj) [OFFICIAL] |
| **UK** | PECR reg. 22 + UK GDPR | Consent required for *individual* subscribers; **corporate subscribers (Ltd, LLP, public bodies) are exempt** — B2B cold email to a company address is lawful without consent, provided sender identity is clear and opt-out honoured (reg. 23). Sole traders/partnerships count as individuals. ICO fines to £500k. | [ICO](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/electronic-mail-marketing/) [OFFICIAL] |
| **Germany** | UWG §7 | **Prior express consent required, no B2B exception.** §7(2) no. 2 makes email advertising without prior express consent *per se* an unreasonable nuisance; §7(3) allows only a narrow existing-customer exception. Fines to €300,000. Strictest major market, and the likeliest source of a cease-and-desist (Abmahnung). | [UWG §7](https://www.gesetze-im-internet.de/uwg_2004/__7.html) [OFFICIAL] |
| **France** | CPCE art. L34-5 + GDPR | Prior consent for natural persons. CNIL doctrine tolerates B2B email to a *professional* address where the message relates to the recipient's professional activity, with opt-out — **I am not fully certain of the current CNIL position; treat as uncertain, get local review.** | eur-lex / CNIL [uncertain] |
| **UAE** | Federal Decree-Law 45/2021 (PDPL); TDRA unsolicited-communications policy | Consent-based; marketing needs prior consent and working opt-out; TDRA regulates unsolicited electronic communications. | [uaelegislation.gov.ae](https://uaelegislation.gov.ae/) [OFFICIAL, not re-verified] |
| **Saudi Arabia** | PDPL, Royal Decree M/19 (2021) + SDAIA implementing regs | Prior consent for marketing; SDAIA rules require sender identification and opt-out. | [sdaia.gov.sa](https://sdaia.gov.sa/) [OFFICIAL, secondary-checked via [CMS guide](https://cms.law/en/int/expert-guides/cms-expert-guide-to-data-protection-and-cyber-security-laws)] |
| **Egypt** | PDPL Law 151/2020 + **Executive Regulations, MCIT Decree 816/2025** | **Strictest regime on this list.** ERs in force 3 Nov 2025, compliance deadline **1 Nov 2026** (just passed). Electronic direct marketing needs a **dedicated PDPC licence/permit**, explicit prior consent, records of consent, immediate erasure on withdrawal. Foreign controllers must appoint an Egypt representative. | [Mondaq / Soliman Hashish & Partners, 15 Jan 2026](https://alpha.mondaq.com/privacy-protection/1731130/the-issuance-of-the-executive-regulations-of-the-data-protection-law-and-the-establishment-of-the-data-protection-centre) [SECONDARY — law firm, not the Gazette] |
| **YouTube ToS** | Terms of Service, eff. 5 Jan 2022 | Prohibits automated access (robots, scrapers) except search engines per robots.txt, prior written permission, or as permitted by law; separately bars collecting/using user-identifying information; bars using the service to distribute unsolicited commercial content. | [youtube.com/t/terms](https://www.youtube.com/t/terms) [OFFICIAL] |

**Practical read.** The sender's location matters more than the recipient's, but both matter. Sending from the US to a global list: US is fine with unsubscribe + postal address; UK corporate is fine; Germany, Egypt, Saudi and most of the EU are not fine without consent. Egypt is now effectively closed to unlicensed cold marketing. **Cheapest mitigation: jurisdictional segmentation — suppress DE, FR, EG, SA, AE entirely, or route them to individually-written first contact.** Not a legal opinion; the minimum defensible posture, and it overlaps with where the tool's audience is thin anyway.

---

## 5. Volume math

Assumptions **[MODEL]**, stated so you can attack them: reply rate = replies ÷ sends; placement varies by strategy; positive replies = 30% of replies; positive→published video = 15%; Tier-A = hand-researched, ≤25 per batch; "effective reach" = contacts × placement.

| Strategy | Contacts | Placement | Effective reach | Replies @1% | @3% | @8% | Planning reply rate | Replies | Positive | Likely videos |
|---|---|---|---|---|---|---|---|---|---|---|
| **A. One 10k blast** | 10,000 | 45% | 4,500 | 45 | 135 | 360 | **0.7%** | ~32 | ~10 | **1–2** |
| **B. 10k tiered, 8 wks, 3 touches** | 10,000 | 85% | 8,500 | 85 | 255 | 680 | **1.6%** | ~136 | ~41 | **5–7** |
| **C. 300 Tier-A + 3,000 templated** | 3,300 | 92% / 80% | 2,676 | 27 | 81 | 215 | **2.4%** blended | ~64 | ~19 | **3–4** |

**Why the 8% column is fiction at 10k scale.** 8% is observed only in campaigns targeting ≤25 hand-picked recipients (PitchBrand: 8.1% at ≤25 vs 1.8% at 250+). Applying it to a 10,000-contact blast assumes the *opposite* of the only large-n finding available; it is shown only to demonstrate that even the fantasy number yields 360 replies — one per 28 sends — not "thousands of creators will cover us".

**A fails on mechanics before copy.** 10,000 sends at 2,000 recipients/mailbox/day is 5 mailboxes minimum; from a new domain placement collapses to ~45% and the domain is filtered. Videos: 1–2. **B is the volume play and genuinely better**, but needs 15–20 mailboxes at 30–50/day and 6 weeks of sending — real infrastructure and daily labour — for 5–7 videos from 10,000 contacts. **C wins on efficiency, not absolute count**: roughly B's video output from one-third the contacts and a fraction of the domain risk. That gap is the argument of this brief.

**Sensitivity:** every strategy moves ~3× between the 1% and 3% scenarios, so copy and targeting dominate infrastructure decisions — but only *after* clearing the 2% bounce / 0.3% complaint gates. Below those gates, nothing else matters.

---

## 6. YouTube-specific facts

**Does the ToS prohibit scraping channel pages?** Yes, on its face: "accessing the service using any automated means (such as robots, botnets or scrapers)" is prohibited, with three carve-outs — general search engines respecting robots.txt, prior written permission, or "as permitted by applicable law". A separate clause bars collecting user-identifying information. **[OFFICIAL]** ([ToS, eff. 5 Jan 2022](https://www.youtube.com/t/terms))

**Has YouTube actioned channel-email scrapers?** **No public case found** specifically about scraping channel *emails*. The live enforcement front is *video content* scraping: in *Ted Entertainment v. ByteDance* (N.D. Cal. 3:25-cv-10933), DMCA §1201 anti-circumvention claims survived a motion to dismiss (Oct 2026). **[SECONDARY]** ([AEON Law](https://aeonlaw.com/judge-refuses-to-dismiss-bytedance-lawsuit-over-ai-scraping-of-youtube/)). The lesson is not "emails are safe" — the theory under test is anti-circumvention, and enforcement risk sits with the *scraper*, not the sender.

**Are business emails public by choice?** Yes — a creator must actively add an address to the About section or link a site. That helps a GDPR "manifestly made public" argument but **is not consent to marketing** and cures nothing under ePrivacy, UWG or the Egyptian ERs. Do not conflate "public" with "permitted".

**Legitimate API route?** No. The Data API v3 `channels` resource exposes `snippet` (title, description, customUrl, publishedAt, thumbnails), `statistics`, `contentDetails`, `topicDetails`, `brandingSettings` and `status` — **there is no email field** ([resource reference](https://developers.google.com/youtube/v3/docs/channels)). The API legitimately gets you discovery and descriptions; the email step is always a second, non-API hop to the creator's own site or About page.

**Commercial providers — pricing.** Coverage claims are marketing; treat as **[VENDOR-MARKETING]**.

| Provider | Price found | Coverage claim | Confidence |
|---|---|---|---|
| Modash | $199–$599/mo (annual), Enterprise from $14,700/yr | 350M+ profiles across IG/TikTok/YouTube, "verified creator emails" | [SECONDARY — competitor blog](https://archive.com/blog/modash-pricing), May 2026; Modash's own page gates pricing behind a demo |
| HypeAuditor | **no reliable public figure found** (quote-gated) | — | — |
| CreatorDB | **no reliable public figure found** | — | — |
| Apify YouTube email-scraper actors | **no reliable public figure found** — pricing pages render client-side and returned no numbers on fetch | actors advertise "emails + leads" extraction | — |

Two conclusions: at $199+/mo these tools are not "budget-free", and none solve the legal problem — they sell the same scraped address with a nicer UI. The one purchase worth making is **email verification**, not discovery.

---

## Recommended outreach plan

Zero-to-minimal budget, 8 weeks, aimed at coverage rather than contact count. Volumes assume you already hold 3–5 Google Workspace seats and can buy two cheap domains (~$12 each; if literally zero spend, use subdomains of a domain you own and accept slower warm-up).

**Infrastructure (week 1, before any send).** Two sending domains or subdomains, never the primary. SPF + DKIM + DMARC (`p=none`, tighten to `quarantine` by week 6). **Tracking pixels and link shorteners off** (§3). One plain-text link maximum. Automatic hard-bounce suppression. Reply-to a monitored human inbox, not `noreply@`.

**Weeks 1–2 — build and verify 2,000, not 10,000.** Rank channels by (a) a video on local LLMs / homelab / self-hosting / privacy in the last 90 days, (b) 5k–250k subs — large enough to matter, small enough to answer their own mail (Belkins: 0.57–0.72% at small firms vs 0.22% at enterprise), (c) an address that is the creator's, not a management agency. Verify every one; expect 25–35% unusable. Result: ~1,400 sendable contacts. **This step is the campaign;** the rest is arithmetic.

**Week 2 — segment by jurisdiction.** Suppress DE, FR, EG, SA, AE, or hold them for individually-written first contact. Legal requirement, not preference (§4).

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

**Channel mix.** 60% AI-tools/automation, 25% homelab/self-hosting/local-LLM, 15% privacy/dev-productivity. The last two are smaller but have the highest fit-per-subscriber for a no-telemetry, local-first app and are least saturated by vendor pitches.

**The offer carries the campaign, not the copy.** Free MIT build, no account, no telemetry, own key, plus direct maintainer access and no follow-up if they decline. Give them what no vendor can: the source, the roadmap, a say in it. Gong's finding that pitching the product cuts replies by up to 57% maps directly — lead with *their* workflow, not the product.

**Five subject-line patterns most likely to get a reply.** Evidence: specific content hooks beat generic (+63%, PitchBrand); 5–8 words outperform; `opportunity` framing underperforms (−56%); pitching language costs 57% of replies (Gong); ≤100-word bodies win.

1. **`your <exact video title> setup`** — specific-content hook, no pitch. Highest expected reply rate; only works if the title is genuinely theirs and recent.
2. **`free + MIT, no strings — want the build first?`** — leads with access and no obligation, the only offer a $0 budget makes credibly.
3. **`one question about <topic> on your channel`** — one easy-to-answer question, no meeting ask.
4. **`local-first agent, runs offline, your key`** — product truth for the homelab audience, which is allergic to marketing language.
5. **`not a sponsorship`** — disarms the paid-pitch reflex in an inbox full of `collab` mail. Pattern interrupt, not a template.

Avoid `collab`, `partnership`, `opportunity`, `sponsorship`, numbers in the subject, and anything over eight words — all measured neutral-to-negative above.

**Tell the client plainly:** 10,000 contacts is a list size, not a strategy. Reply rate falls 4.5× as campaign size rises, a single blast from a cold domain lands roughly half its mail in spam and burns the domain, and Egypt/Germany/Saudi make a chunk of the list unlawful to email at all. The 1,400-contact version is not a compromise — it is the only version with defensible expected value.
