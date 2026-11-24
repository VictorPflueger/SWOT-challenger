// S3 Auental Energie: a recorded run, written by hand from the facts in DATA_SOURCES.md (brief 7). The
// company and its figures are fictional and illustrative; what the agents say about the world is real and
// dated there. Its team entered strengths and threats only, so the Completer fills the other two fields.
// Every text has its English and its German beside it; every number, id and choice is written once
// (data/scenarios/bilingual.js). The Writer's text carries no number of its own: every figure is a
// {{fact:key}} placeholder that the engine fills for whichever strategies the person chooses.

import { bilingual } from "./bilingual.js";

const TARIFFS = "https://www.bundesnetzagentur.de/DE/Vportal/Energie/Vertragsarten/DynStromtarife/start.html";
const METERS = "https://bundesnetzagentur.de/SharedDocs/Pressemitteilungen/DE/2026/20260921_Rollout.html";
const GMODG = "https://www.gmodg.bund.de/GModG/DE/Home/startseite/GModG_News/GModG_News-node.html";
const BDEW = "https://www.bdew.de/energie/gebaeudemodernisierungsgesetz-ist-beschlossen/";
const HEATPLAN = "https://www.ihk.de/hannover/hauptnavigation/innovation/energie/energiepolitik-recht/waermeplanung-6287230";
const PARTNERS = "https://www.zfk.de/unternehmen/enpal-will-luecken-in-lokaler-waermeplanung-schliessen";

const kpi = (id, en, de, unit, direction, change_low, change_high, basis) => ({ id, name: { en, de }, unit, direction, change_low, change_high, definition: "", basis });

export default bilingual({
  id: "s3",
  source: "authored",
  as_of: "2026-11-23",
  company: {
    name: "Auental Energie",
    sector: "energy_utilities",
    country: "DE",
    description: {
      en: "A town utility in Lower Saxony that supplies power, gas and water and runs the local grids",
      de: "Ein Stadtwerk in Niedersachsen, das Strom, Gas und Wasser liefert und die örtlichen Netze betreibt"
    },
    fictional: true
  },
  sources: [
    { url: TARIFFS, read_on: "2026-11-23" },
    { url: METERS, read_on: "2026-11-23" },
    { url: GMODG, read_on: "2026-11-23" },
    { url: BDEW, read_on: "2026-11-23" },
    { url: HEATPLAN, read_on: "2026-11-23" },
    { url: PARTNERS, read_on: "2026-11-23" }
  ],
  entered: {
    strengths: [
      { id: "s1", text: { en: "Customers trust us as their local supplier", de: "Kunden vertrauen uns als ihrem Versorger vor Ort" } },
      { id: "s2", text: { en: "We own and run the power and gas grids in town", de: "Uns gehören die Strom- und Gasnetze der Stadt, und wir betreiben sie" } },
      { id: "s3", text: { en: "Our own service team, ten minutes from any customer", de: "Ein eigenes Serviceteam, zehn Minuten von jedem Kunden entfernt" } }
    ],
    weaknesses: [],
    opportunities: [],
    threats: [
      { id: "t1", text: { en: "The end of gas heating takes away our gas business", de: "Das Ende der Gasheizung nimmt uns das Gasgeschäft" } },
      { id: "t2", text: { en: "National rivals with cheaper online tariffs", de: "Bundesweite Wettbewerber mit günstigeren Online-Tarifen" } },
      { id: "t3", text: { en: "Solar and heat pump firms win our customers' homes", de: "Solar- und Wärmepumpenanbieter gewinnen die Häuser unserer Kunden" } }
    ]
  },
  answers: {
    complete: {
      sector: "energy_utilities",
      items: [
        {
          quadrant: "weaknesses",
          text: { en: "Few staff to plan heat networks", de: "Wenig Personal, um Wärmenetze zu planen" },
          basis: { en: "A town utility seldom plans heat networks itself; the work comes with the town's heat plan", de: "Ein Stadtwerk plant Wärmenetze selten selbst; die Arbeit kommt mit dem Wärmeplan der Stadt" },
          confidence: "medium"
        },
        {
          quadrant: "weaknesses",
          text: { en: "Most customers still have no smart meter", de: "Die meisten Kunden haben noch keinen intelligenten Zähler" },
          basis: { en: "Many metering operators missed the first rollout quota, and the regulator opened proceedings against them", de: "Viele Messstellenbetreiber haben die erste Einbauquote verfehlt, und die Bundesnetzagentur hat Verfahren eröffnet" },
          confidence: "medium"
        },
        {
          quadrant: "weaknesses",
          text: { en: "Little experience selling anything beyond power and gas", de: "Wenig Erfahrung im Verkauf von mehr als Strom und Gas" },
          basis: { en: "A supplier that sells energy by the kilowatt hour rarely sells services such as heat pumps", de: "Ein Versorger, der Energie nach Kilowattstunden verkauft, verkauft selten Dienste wie Wärmepumpen" },
          confidence: "medium"
        },
        {
          quadrant: "opportunities",
          text: { en: "The town's heat plan, due by the end of this year", de: "Der Wärmeplan der Stadt, fällig bis Ende dieses Jahres" },
          basis: { en: "Lower Saxony asks its regional and middle-order towns to finish their heat plans first", de: "Niedersachsen verlangt von seinen Ober- und Mittelzentren, ihre Wärmepläne zuerst fertigzustellen" },
          confidence: "high"
        },
        {
          quadrant: "opportunities",
          text: { en: "Dynamic tariffs for customers with a smart meter", de: "Dynamische Tarife für Kunden mit intelligentem Zähler" },
          basis: { en: "Every supplier must offer a dynamic tariff, and customers need a smart meter to use one", de: "Jeder Lieferant muss einen dynamischen Tarif anbieten, und Kunden brauchen dafür einen intelligenten Zähler" },
          confidence: "high"
        },
        {
          quadrant: "opportunities",
          text: { en: "Heat pumps installed with a partner, sold under our name", de: "Wärmepumpen mit einem Partner eingebaut, unter unserem Namen verkauft" },
          basis: { en: "Heat pump firms now offer town utilities partnerships, and one utility in Lower Saxony already uses such an offer", de: "Wärmepumpenanbieter bieten Stadtwerken inzwischen Kooperationen an, und ein Stadtwerk in Niedersachsen nutzt ein solches Angebot schon" },
          confidence: "medium"
        }
      ],
      misfiled: []
    },
    challenge: {
      issues: [
        {
          id: "I1",
          title: { en: "Billing that cannot bill by the hour is missing from the weaknesses", de: "Eine Abrechnung, die nicht stündlich abrechnen kann, fehlt bei den Schwächen" },
          type: "missing",
          description: {
            en: "Dynamic tariffs and heat services both need billing that reads meter data by the hour. The old billing system was built for one reading a year, and nobody listed it.",
            de: "Dynamische Tarife und Wärmedienste brauchen beide eine Abrechnung, die Zählerdaten stündlich liest. Das alte Abrechnungssystem ist für eine Ablesung im Jahr gebaut, und niemand hat es genannt."
          },
          items: [],
          quadrants: ["weaknesses"],
          impact: 4,
          likelihood: 4,
          horizon: "now",
          evidence: [{ url: TARIFFS, title: { en: "Federal Network Agency: every supplier must offer a dynamic tariff from 2025; customers need a smart meter", de: "Bundesnetzagentur: Alle Lieferanten bieten ab 2025 dynamische Tarife an; Kunden brauchen ein intelligentes Messsystem" } }],
          confidence: "high",
          added_items: [
            {
              quadrant: "weaknesses",
              text: { en: "Old billing IT that cannot bill by the hour", de: "Alte Abrechnungs-IT, die nicht stündlich abrechnen kann" },
              basis: { en: "Built for one meter reading a year, while dynamic tariffs bill every hour", de: "Gebaut für eine Zählerablesung im Jahr, während dynamische Tarife jede Stunde abrechnen" }
            }
          ]
        },
        {
          id: "I2",
          title: { en: "The end of gas heating is a threat out of date", de: "Das Ende der Gasheizung ist ein veraltetes Risiko" },
          type: "outdated",
          description: {
            en: "The building law was amended and renamed this summer. It drops the rule that new heating must run mostly on renewable energy, and new gas boilers are allowed again with a rising share of bio fuels. The gas grid loses customers more slowly than the team assumes.",
            de: "Das Gebäudegesetz wurde diesen Sommer geändert und umbenannt. Es streicht die Regel, dass neue Heizungen überwiegend mit erneuerbarer Energie laufen müssen, und neue Gaskessel sind wieder erlaubt, mit wachsendem Bioanteil. Das Gasnetz verliert Kunden langsamer, als das Team annimmt."
          },
          items: ["t1"],
          quadrants: ["threats"],
          impact: 3,
          likelihood: 4,
          horizon: "now",
          evidence: [
            { url: GMODG, title: { en: "Buildings Modernisation Act: in force since 29 July 2026, new gas and oil heating allowed with a rising bio share", de: "Gebäudemodernisierungsgesetz: seit 29. Juli 2026 in Kraft, neue Gas- und Ölheizungen mit steigendem Bioanteil erlaubt" } },
            { url: BDEW, title: { en: "BDEW: the Buildings Modernisation Act is passed, and the 65 % rule for new heating ends", de: "BDEW: Das Gebäudemodernisierungsgesetz ist beschlossen, und die 65-%-Regel für neue Heizungen entfällt" } }
          ],
          confidence: "high",
          added_items: []
        },
        {
          id: "I3",
          title: { en: "The heat plan needs planners the utility does not have", de: "Der Wärmeplan braucht Planer, die das Stadtwerk nicht hat" },
          type: "contradiction",
          description: {
            en: "The town's heat plan decides where heat networks go, and the utility could run them. It has too few people to plan networks, so the plan may name another operator.",
            de: "Der Wärmeplan der Stadt entscheidet, wo Wärmenetze entstehen, und das Stadtwerk könnte sie betreiben. Es hat zu wenige Leute, um Netze zu planen, also nennt der Plan vielleicht einen anderen Betreiber."
          },
          items: ["o1", "w1"],
          quadrants: ["opportunities", "weaknesses"],
          impact: 4,
          likelihood: 3,
          horizon: "now",
          evidence: [{ url: HEATPLAN, title: { en: "IHK Hannover: about 100 regional and middle-order towns must submit heat plans by the end of 2026", de: "IHK Hannover: etwa 100 Ober- und Mittelzentren müssen ihre Wärmepläne bis Ende 2026 vorlegen" } }],
          confidence: "medium",
          added_items: []
        },
        {
          id: "I4",
          title: { en: "Heat pump firms reach customers' homes before the utility does", de: "Wärmepumpenanbieter erreichen die Häuser der Kunden vor dem Stadtwerk" },
          type: "competition",
          description: {
            en: "Solar and heat pump firms sell to homeowners directly and install quickly. Each home they equip uses less gas and may buy its power elsewhere, and some of these firms now offer town utilities partnerships.",
            de: "Solar- und Wärmepumpenanbieter verkaufen direkt an Hausbesitzer und bauen schnell ein. Jedes Haus, das sie ausstatten, braucht weniger Gas und kauft Strom vielleicht woanders, und manche dieser Anbieter bieten Stadtwerken inzwischen Kooperationen an."
          },
          items: ["t3"],
          quadrants: ["threats"],
          impact: 3,
          likelihood: 3,
          horizon: "1_to_3_years",
          evidence: [{ url: PARTNERS, title: { en: "ZfK: Enpal offers town utilities partnerships for heat pumps", de: "ZfK: Enpal bietet Stadtwerken Kooperationen bei Wärmepumpen an" } }],
          confidence: "medium",
          added_items: []
        },
        {
          id: "I5",
          title: { en: "Ten minutes from any customer is a promise nothing measures", de: "Zehn Minuten zu jedem Kunden ist ein Versprechen, das niemand misst" },
          type: "unsupported",
          description: {
            en: "No response time is tracked, and the team mostly reads meters and repairs the grids. Heat pumps and heat networks need technicians it does not have yet.",
            de: "Keine Einsatzzeit wird erfasst, und das Team liest vor allem Zähler ab und repariert die Netze. Wärmepumpen und Wärmenetze brauchen Techniker, die es noch nicht hat."
          },
          items: ["s3"],
          quadrants: ["strengths"],
          impact: 2,
          likelihood: 3,
          horizon: "now",
          evidence: [],
          confidence: "medium",
          added_items: []
        }
      ]
    },
    assess: {
      impacts: [
        {
          issue: "I1", monetisable: true, reason: "",
          kpis: [
            kpi("energy_utilities.cost_to_serve", "Cost to serve per customer", "Kosten je Kunde", "€", "up", 10, 30, { en: "Hourly bills worked out by hand", de: "Stündliche Abrechnung von Hand" }),
            kpi("energy_utilities.customer_churn", "Customer churn", "Kundenabwanderung", "%", "up", 1, 3, { en: "Customers who move to a dynamic tariff elsewhere", de: "Kunden, die zu einem dynamischen Tarif woanders wechseln" })
          ],
          eur_year_low: 600000, eur_year_high: 1600000,
          basis: { en: "Customers who leave for a dynamic tariff elsewhere, and billing done by hand", de: "Kunden, die für einen dynamischen Tarif woanders wechseln, und Abrechnung von Hand" },
          confidence: "medium"
        },
        {
          issue: "I2", monetisable: true, reason: "",
          kpis: [kpi("energy_utilities.gross_margin_per_mwh", "Gross margin per megawatt hour", "Bruttomarge je Megawattstunde", "€/MWh", "down", -3, -1, { en: "Gas customers pushed to switch sooner than they need to", de: "Gaskunden, die früher als nötig zum Wechsel gedrängt werden" })],
          eur_year_low: 400000, eur_year_high: 1200000,
          basis: { en: "Gas margin given up by moving customers off gas sooner than the law asks", de: "Gasmarge, die verloren geht, wenn Kunden früher vom Gas wechseln, als das Gesetz verlangt" },
          confidence: "medium"
        },
        {
          issue: "I3", monetisable: true, reason: "",
          kpis: [kpi("energy_utilities.heat_customers", "Heat customers connected", "Angeschlossene Wärmekunden", "#", "down", -400, -100, { en: "Customers of the new heat networks served by another operator", de: "Kunden der neuen Wärmenetze, die ein anderer Betreiber versorgt" })],
          eur_year_low: 800000, eur_year_high: 2400000,
          basis: { en: "Heat customers the town's new networks would bring, lost to another operator", de: "Wärmekunden der neuen städtischen Netze, die an einen anderen Betreiber gehen" },
          confidence: "medium"
        },
        {
          issue: "I4", monetisable: true, reason: "",
          kpis: [kpi("energy_utilities.customer_churn", "Customer churn", "Kundenabwanderung", "%", "up", 1, 2, { en: "Homes that switch to a heat pump firm's package", de: "Haushalte, die zum Paket eines Wärmepumpenanbieters wechseln" })],
          eur_year_low: 500000, eur_year_high: 1500000,
          basis: { en: "Homes that give up gas and power supply for a heat pump firm's package", de: "Haushalte, die Gas und Strom für das Paket eines Wärmepumpenanbieters aufgeben" },
          confidence: "medium"
        },
        {
          issue: "I5", monetisable: false,
          reason: { en: "A promise nobody checks costs nothing until a customer waits for it", de: "Ein Versprechen, das niemand prüft, kostet nichts, bis ein Kunde darauf wartet" },
          kpis: [], eur_year_low: 0, eur_year_high: 0, basis: "", confidence: "high"
        }
      ],
      factors: [
        { item: "s1", weight: 0.2, rating: 4, reason: { en: "The reason most customers stay", de: "Der Grund, warum die meisten Kunden bleiben" } },
        { item: "s2", weight: 0.15, rating: 4, reason: { en: "Grids are where heat and power services start", de: "Bei den Netzen beginnen Wärme- und Stromdienste" } },
        { item: "s3", weight: 0.1, rating: 3, reason: { en: "Close by, but trained for meters and grids", de: "Nah dran, aber für Zähler und Netze ausgebildet" } },
        { item: "w1", weight: 0.15, rating: 1, reason: { en: "Blocks the largest opportunity", de: "Blockiert die größte Chance" } },
        { item: "w2", weight: 0.1, rating: 2, reason: { en: "Limits dynamic tariffs for now", de: "Begrenzt dynamische Tarife vorerst" } },
        { item: "w3", weight: 0.1, rating: 2, reason: { en: "Sales knows energy contracts, not services", de: "Der Vertrieb kennt Energieverträge, keine Dienste" } },
        { item: "w4", weight: 0.2, rating: 1, reason: { en: "Every new tariff and service depends on it", de: "Jeder neue Tarif und Dienst hängt davon ab" } },
        { item: "o1", weight: 0.25, rating: 2, reason: { en: "Talks with the town have started, nothing is agreed", de: "Gespräche mit der Stadt haben begonnen, nichts ist vereinbart" } },
        { item: "o2", weight: 0.15, rating: 2, reason: { en: "The tariff exists on paper only", de: "Den Tarif gibt es nur auf dem Papier" } },
        { item: "o3", weight: 0.1, rating: 1, reason: { en: "No partner chosen yet", de: "Noch kein Partner gewählt" } },
        { item: "t1", weight: 0.15, rating: 2, reason: { en: "Plans for a threat that the law has eased", de: "Planungen für ein Risiko, das das Gesetz gemildert hat" } },
        { item: "t2", weight: 0.15, rating: 2, reason: { en: "Prices kept close to the rivals' in town", de: "Preise nah an denen der Wettbewerber in der Stadt" } },
        { item: "t3", weight: 0.2, rating: 1, reason: { en: "No heat pump offer of its own", de: "Kein eigenes Wärmepumpenangebot" } }
      ]
    },
    strategise: {
      strategies: [
        {
          id: "R1", type: "SO",
          title: { en: "Run the town's heat networks, planned together with the town", de: "Die Wärmenetze der Stadt betreiben, gemeinsam mit der Stadt geplant" },
          items: ["s1", "s2", "o1"], issue: "I3", kind: "advantage",
          ratings: [{ item: "o1", to: 3 }],
          residual: [], upside: [{ likelihood: 3, eur_year_low: 800000, eur_year_high: 2000000 }],
          effort: "L",
          time_to_impact: { en: "One to two years", de: "Ein bis zwei Jahre" },
          first_step: { en: "Offer the town to plan the first heat network area together, with a partner firm for the design", de: "Der Stadt anbieten, das erste Wärmenetzgebiet gemeinsam zu planen, mit einem Partner für die Auslegung" },
          owner: { en: "Managing director", de: "Geschäftsführung" },
          recommended: true
        },
        {
          id: "R2", type: "WT",
          title: { en: "New billing that bills by the hour, before national rivals take the customers", de: "Eine neue Abrechnung im Stundentakt, bevor bundesweite Wettbewerber die Kunden holen" },
          items: ["w4", "t2"], issue: "I1", kind: "mitigate",
          ratings: [{ item: "w4", to: 2 }, { item: "t2", to: 3 }],
          residual: [{ likelihood: 2, eur_year_low: 300000, eur_year_high: 900000 }], upside: [],
          effort: "L",
          time_to_impact: { en: "About a year", de: "Etwa ein Jahr" },
          first_step: { en: "Ask three billing providers for an offer that reads smart meter data by the hour", de: "Drei Anbieter von Abrechnungssystemen um ein Angebot bitten, das Daten intelligenter Zähler stündlich liest" },
          owner: { en: "Head of IT", de: "Leitung IT" },
          recommended: false
        },
        {
          id: "R3", type: "ST",
          title: { en: "Heat pumps with a partner, sold and serviced under the utility's name", de: "Wärmepumpen mit einem Partner, unter dem Namen des Stadtwerks verkauft und gewartet" },
          items: ["s1", "t3"], issue: "I4", kind: "mitigate",
          ratings: [{ item: "t3", to: 3 }],
          residual: [{ likelihood: 2, eur_year_low: 300000, eur_year_high: 900000 }], upside: [],
          effort: "M",
          time_to_impact: { en: "A few months", de: "Wenige Monate" },
          first_step: { en: "Choose a heat pump partner and offer it to the gas customers with the oldest boilers", de: "Einen Wärmepumpenpartner wählen und den Gaskunden mit den ältesten Kesseln anbieten" },
          owner: { en: "Head of sales", de: "Leitung Vertrieb" },
          recommended: true
        },
        {
          id: "R4", type: "ST",
          title: { en: "Keep the gas grid ready for biogas", de: "Das Gasnetz für Biogas bereithalten" },
          items: ["s2", "t1"], issue: "I2", kind: "mitigate",
          ratings: [{ item: "t1", to: 3 }],
          residual: [{ likelihood: 2, eur_year_low: 200000, eur_year_high: 600000 }], upside: [],
          effort: "M",
          time_to_impact: { en: "About a year", de: "Etwa ein Jahr" },
          first_step: { en: "Ask regional biogas producers what they can feed into the town's grid", de: "Regionale Biogaserzeuger fragen, was sie ins Netz der Stadt einspeisen können" },
          owner: { en: "Head of grids", de: "Leitung Netze" },
          recommended: false
        }
      ]
    },
    summary: {
      headline: { en: "Auental's SWOT fears a gas ban that is gone and misses its own billing", de: "Auentals SWOT fürchtet ein Gasverbot, das es nicht mehr gibt, und übersieht die eigene Abrechnung" },
      situation: {
        en: "Auental's team listed its strengths and threats and left the rest open. The challenge questions {{fact:items.challenged}} of the SWOT's {{fact:items.total}} items and adds a weakness nobody listed: billing that cannot bill by the hour. The issues found put {{fact:at_stake}} a year at stake, and the response to the market scores {{fact:efe.before}}, below the average.",
        de: "Auentals Team hat seine Stärken und Risiken genannt und den Rest offen gelassen. Die Prüfung stellt {{fact:items.challenged}} der {{fact:items.total}} Punkte der SWOT infrage und ergänzt eine Schwäche, die niemand genannt hatte: eine Abrechnung, die nicht stündlich abrechnen kann. Die gefundenen Probleme stellen jährlich {{fact:at_stake}} aufs Spiel, und die Antwort auf den Markt liegt bei {{fact:efe.before}}, unter dem Durchschnitt."
      },
      findings: [
        {
          en: "The threat the team fears most is out of date: the amended building law allows new gas boilers again, with a rising bio share.",
          de: "Das Risiko, das das Team am meisten fürchtet, ist veraltet: Das geänderte Gebäudegesetz erlaubt neue Gaskessel wieder, mit steigendem Bioanteil."
        },
        {
          en: "The town's heat plan is the largest opportunity, and it needs planners the utility does not have yet.",
          de: "Der Wärmeplan der Stadt ist die größte Chance, und er braucht Planer, die das Stadtwerk noch nicht hat."
        },
        {
          en: "Local trust is the utility's best answer to heat pump firms, as long as it sells and services heat pumps itself.",
          de: "Vertrauen vor Ort ist die beste Antwort des Stadtwerks auf Wärmepumpenanbieter, solange es Wärmepumpen selbst verkauft und wartet."
        }
      ],
      recommendation: {
        en: "Build on the trust customers already place in the utility: take the heat plan and heat pumps into its own hands, then renew billing. After the decision, {{fact:left}} a year stays at stake, against {{fact:at_stake}} before, and the response to the market stands at {{fact:efe.after}}, against {{fact:efe.before}}.",
        de: "Bauen Sie auf das Vertrauen, das Kunden dem Stadtwerk schon schenken: Nehmen Sie Wärmeplan und Wärmepumpen selbst in die Hand, danach die Abrechnung. Nach der Entscheidung bleiben jährlich {{fact:left}} auf dem Spiel, statt {{fact:at_stake}} vorher, und die Antwort auf den Markt liegt bei {{fact:efe.after}}, statt {{fact:efe.before}}."
      },
      assumptions: [
        { en: "The town names the utility as a candidate to run its heat networks.", de: "Die Stadt nennt das Stadtwerk als möglichen Betreiber ihrer Wärmenetze." },
        { en: "Gas customers leave more slowly now that new gas boilers are allowed again.", de: "Gaskunden wechseln langsamer, seit neue Gaskessel wieder erlaubt sind." },
        { en: "A heat pump firm is willing to install under the utility's name.", de: "Ein Wärmepumpenanbieter ist bereit, unter dem Namen des Stadtwerks einzubauen." },
        { en: "The euro ranges are AI estimates from the team's notes, not from Auental's accounts.", de: "Die Euro-Spannen sind KI-Schätzungen aus den Notizen des Teams, nicht aus Auentals Buchhaltung." }
      ]
    }
  },
  recorded_choice: ["R1", "R3"]
});
