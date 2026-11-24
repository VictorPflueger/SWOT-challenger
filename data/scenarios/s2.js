// S2 Arvento Drives: a recorded run, written by hand from the facts in DATA_SOURCES.md (brief 7). The
// company and its figures are fictional and illustrative; what the agents say about the world is real and
// dated there. Every text has its English and its German beside it; every number, id and choice is
// written once (data/scenarios/bilingual.js). The Writer's text carries no number of its own: every
// figure is a {{fact:key}} placeholder that the engine fills for whichever strategies the person chooses.

import { bilingual } from "./bilingual.js";

const DATA_ACT = "https://digital-strategy.ec.europa.eu/en/policies/data-act";
const CRA = "https://digital-strategy.ec.europa.eu/en/policies/cra-reporting";
const SKILLS = "https://www.kfw.de/PDF/Download-Center/Konzernthemen/Research/PDF-Dokumente-KfW-ifo-Fachkräftebarometer/KfW-ifo-Fachkraeftebarometer_2026-06.pdf";

const kpi = (id, en, de, unit, direction, change_low, change_high, basis) => ({ id, name: { en, de }, unit, direction, change_low, change_high, definition: "", basis });

export default bilingual({
  id: "s2",
  source: "authored",
  as_of: "2026-11-23",
  company: {
    name: "Arvento Drives",
    sector: "industrial_manufacturing",
    country: "DE",
    description: {
      en: "A family-owned maker of industrial drives and gearboxes in Baden-Württemberg that wants to sell drives as a service",
      de: "Ein Familienunternehmen aus Baden-Württemberg, das Industrieantriebe und Getriebe baut und Antriebe als Dienstleistung verkaufen will"
    },
    fictional: true
  },
  sources: [
    { url: DATA_ACT, read_on: "2026-11-23" },
    { url: CRA, read_on: "2026-11-23" },
    { url: SKILLS, read_on: "2026-11-23" }
  ],
  entered: {
    strengths: [
      { id: "s1", text: { en: "Quality", de: "Qualität" } },
      { id: "s2", text: { en: "Drives built to order for packaging and food lines", de: "Antriebe nach Maß für Verpackungs- und Lebensmittellinien" } },
      { id: "s3", text: { en: "Long relationships with machine builders in the region", de: "Lange Beziehungen zu Maschinenbauern in der Region" } }
    ],
    weaknesses: [
      { id: "w1", text: { en: "Too few service technicians", de: "Zu wenige Servicetechniker" } },
      { id: "w2", text: { en: "Service software that cannot read machine data", de: "Service-Software, die keine Maschinendaten lesen kann" } },
      { id: "w3", text: { en: "Little experience selling contracts rather than products", de: "Wenig Erfahrung im Verkauf von Verträgen statt Produkten" } }
    ],
    opportunities: [
      { id: "o1", text: { en: "Drives as a service: customers pay for operating hours", de: "Antriebe als Dienstleistung: Kunden zahlen für Betriebsstunden" } },
      { id: "o2", text: { en: "Customers want lines that use less energy", de: "Kunden wollen Linien, die weniger Energie verbrauchen" } }
    ],
    threats: [
      { id: "t1", text: { en: "Low-cost rivals with standard gearboxes", de: "Günstige Wettbewerber mit Standardgetrieben" } },
      { id: "t2", text: { en: "US tariffs on machinery", de: "US-Zölle auf Maschinen" } }
    ]
  },
  answers: {
    complete: {
      sector: "industrial_manufacturing",
      items: [
        {
          quadrant: "strengths",
          text: { en: "A large base of our drives already running in customers' plants", de: "Viele unserer Antriebe laufen bereits in den Werken der Kunden" },
          basis: { en: "Drives built to order and long relationships mean many units in the field, each a starting point for service", de: "Antriebe nach Maß und lange Kundenbeziehungen bedeuten viele Geräte im Feld, jedes ein Ansatz für Service" },
          confidence: "medium"
        },
        {
          quadrant: "opportunities",
          text: { en: "Remote monitoring that sells uptime instead of spare parts", de: "Fernüberwachung, die Verfügbarkeit statt Ersatzteile verkauft" },
          basis: { en: "Follows from drives as a service, which pays for hours of running, not for parts", de: "Folgt aus Antrieben als Dienstleistung, die Laufstunden bezahlt, nicht Teile" },
          confidence: "medium"
        },
        {
          quadrant: "threats",
          text: { en: "Machine builders compete for the same service technicians", de: "Maschinenbauer werben um dieselben Servicetechniker" },
          basis: { en: "Firms still report that a lack of skilled staff holds back their business", de: "Betriebe berichten weiter, dass fehlende Fachkräfte ihr Geschäft bremsen" },
          confidence: "medium"
        },
        {
          quadrant: "threats",
          text: { en: "A duty to report security flaws in drives with software", de: "Eine Pflicht, Sicherheitslücken in Antrieben mit Software zu melden" },
          basis: { en: "The Cyber Resilience Act's reporting duties bind makers of products with software", de: "Die Meldepflichten des Cyber Resilience Act gelten für Hersteller von Produkten mit Software" },
          confidence: "high"
        }
      ],
      misfiled: [
        { item: "w1", belongs_in: "threats", reason: { en: "The labour market sets how many technicians can be hired; that comes from outside the company", de: "Der Arbeitsmarkt bestimmt, wie viele Techniker sich einstellen lassen; das kommt von außen" } }
      ]
    },
    challenge: {
      issues: [
        {
          id: "I1",
          title: { en: "The shortage of technicians is a threat, filed as a weakness", de: "Der Technikermangel ist ein Risiko, als Schwäche einsortiert" },
          type: "misfiled",
          description: {
            en: "The shortage eases, but the labour market still decides how many technicians Arvento can hire. Filed as a weakness, it looks like something to fix inside, while every operating-hour contract depends on it.",
            de: "Der Mangel lässt nach, doch der Arbeitsmarkt entscheidet weiter, wie viele Techniker Arvento einstellen kann. Als Schwäche wirkt er wie etwas, das sich intern beheben lässt, dabei hängt jeder Vertrag über Betriebsstunden daran."
          },
          items: ["w1"],
          quadrants: ["weaknesses", "threats"],
          impact: 3,
          likelihood: 4,
          horizon: "now",
          evidence: [{ url: SKILLS, title: { en: "KfW-ifo skilled-labour barometer: the shortage eases, many firms still affected", de: "KfW-ifo-Fachkräftebarometer: Fachkräftemangel nimmt weiter ab, weiterhin viele Betriebe betroffen" } }],
          confidence: "high",
          added_items: []
        },
        {
          id: "I2",
          title: { en: "Quality is claimed, not shown", de: "Qualität wird behauptet, nicht belegt" },
          type: "unsupported",
          description: {
            en: "Nothing measures it: no failure rate, no warranty cost, no customer score. Rivals claim quality too, so as it stands it wins no order.",
            de: "Nichts misst sie: keine Ausfallrate, keine Gewährleistungskosten, keine Kundenbewertung. Auch die Konkurrenz behauptet Qualität, so gewinnt die Behauptung allein keinen Auftrag."
          },
          items: ["s1"],
          quadrants: ["strengths"],
          impact: 2,
          likelihood: 3,
          horizon: "now",
          evidence: [],
          confidence: "high",
          added_items: []
        },
        {
          id: "I3",
          title: { en: "Customers' data rights are missing from the threats", de: "Die Datenrechte der Kunden fehlen bei den Risiken" },
          type: "missing",
          description: {
            en: "Under the EU Data Act customers may share their drives' data with any service firm. Drives as a service would then compete with independent service firms for Arvento's own drives in the field.",
            de: "Nach dem EU Data Act dürfen Kunden die Daten ihrer Antriebe mit jeder Servicefirma teilen. Antriebe als Dienstleistung konkurrieren dann mit freien Servicefirmen um Arventos eigene Geräte im Feld."
          },
          items: [],
          quadrants: ["threats"],
          impact: 4,
          likelihood: 4,
          horizon: "1_to_3_years",
          evidence: [{ url: DATA_ACT, title: { en: "Data Act: users of connected products may share their data with third parties", de: "Data Act: Nutzer vernetzter Produkte dürfen ihre Daten mit Dritten teilen" } }],
          confidence: "medium",
          added_items: [
            {
              quadrant: "threats",
              text: { en: "Customers can share their drives' data with any service firm", de: "Kunden können die Daten ihrer Antriebe mit jeder Servicefirma teilen" },
              basis: { en: "EU Data Act: users of connected products may pass their data to repair and service firms", de: "EU Data Act: Nutzer vernetzter Produkte dürfen ihre Daten an Reparatur- und Servicefirmen geben" }
            }
          ]
        },
        {
          id: "I4",
          title: { en: "Low-cost rivals are rated far too low", de: "Günstige Wettbewerber werden weit unterschätzt" },
          type: "misjudged",
          description: {
            en: "Standard gearboxes now cover much of what packaging lines need, and machine builders buy on price. The SWOT names the threat, but nothing in it answers it.",
            de: "Standardgetriebe decken inzwischen vieles ab, was Verpackungslinien brauchen, und Maschinenbauer kaufen über den Preis. Die SWOT nennt das Risiko, aber nichts in ihr antwortet darauf."
          },
          items: ["t1"],
          quadrants: ["threats"],
          impact: 4,
          likelihood: 3,
          horizon: "1_to_3_years",
          evidence: [],
          confidence: "medium",
          added_items: []
        },
        {
          id: "I5",
          title: { en: "Reporting security flaws needs a process the company lacks", de: "Sicherheitslücken zu melden braucht einen Prozess, der fehlt" },
          type: "regulation",
          description: {
            en: "Makers of products with software now report actively exploited flaws and severe incidents, with an early warning within a day. Arvento's drives with firmware fall under the duty.",
            de: "Hersteller von Produkten mit Software melden nun aktiv ausgenutzte Lücken und schwere Vorfälle, mit einer Frühwarnung binnen eines Tages. Arventos Antriebe mit Firmware fallen unter die Pflicht."
          },
          items: ["t4"],
          quadrants: ["threats"],
          impact: 3,
          likelihood: 3,
          horizon: "now",
          evidence: [{ url: CRA, title: { en: "Cyber Resilience Act: reporting obligations", de: "Cyber Resilience Act: Meldepflichten" } }],
          confidence: "high",
          added_items: []
        },
        {
          id: "I6",
          title: { en: "Drives as a service needs data the old software cannot read", de: "Antriebe als Dienstleistung brauchen Daten, die die alte Software nicht liest" },
          type: "contradiction",
          description: {
            en: "Billing for operating hours needs every drive's running data, and the service software cannot read it. The opportunity depends on exactly what the weakness lacks.",
            de: "Abrechnung nach Betriebsstunden braucht die Laufdaten jedes Antriebs, und die Service-Software kann sie nicht lesen. Die Chance hängt genau an dem, was der Schwäche fehlt."
          },
          items: ["o1", "w2"],
          quadrants: ["opportunities", "weaknesses"],
          impact: 4,
          likelihood: 4,
          horizon: "now",
          evidence: [],
          confidence: "high",
          added_items: []
        }
      ]
    },
    assess: {
      impacts: [
        {
          issue: "I1", monetisable: true, reason: "",
          kpis: [kpi("industrial_manufacturing.service_revenue_share", "Share of service revenue", "Anteil des Serviceumsatzes", "%", "down", -2, -1, { en: "Contracts nobody can staff are not signed", de: "Verträge ohne Techniker werden nicht geschlossen" })],
          eur_year_low: 600000, eur_year_high: 1800000,
          basis: { en: "Operating-hour contracts the service team cannot staff in the first year", de: "Verträge über Betriebsstunden, die das Serviceteam im ersten Jahr nicht besetzen kann" },
          confidence: "medium"
        },
        {
          issue: "I2", monetisable: false,
          reason: { en: "A claim without evidence costs nothing until a customer asks for proof", de: "Eine Behauptung ohne Beleg kostet nichts, bis ein Kunde einen Nachweis verlangt" },
          kpis: [], eur_year_low: 0, eur_year_high: 0, basis: "", confidence: "high"
        },
        {
          issue: "I3", monetisable: true, reason: "",
          kpis: [
            kpi("industrial_manufacturing.recurring_revenue_share", "Share of recurring revenue", "Anteil wiederkehrender Umsätze", "%", "down", -6, -2, { en: "Service contracts go to independent firms", de: "Serviceverträge gehen an freie Firmen" }),
            kpi("industrial_manufacturing.service_revenue_share", "Share of service revenue", "Anteil des Serviceumsatzes", "%", "down", -4, -1, { en: "Fewer drives serviced by Arvento itself", de: "Weniger Antriebe, die Arvento selbst betreut" })
          ],
          eur_year_low: 1500000, eur_year_high: 4000000,
          basis: { en: "Service revenue lost when independent firms serve part of the drives in the field", de: "Serviceumsatz, der verloren geht, wenn freie Firmen einen Teil der Geräte im Feld betreuen" },
          confidence: "medium"
        },
        {
          issue: "I4", monetisable: true, reason: "",
          kpis: [
            kpi("industrial_manufacturing.order_intake", "Order intake", "Auftragseingang", "€", "down", -3000000, -1000000, { en: "Orders for standard drives lost on price", de: "Aufträge für Standardantriebe, die über den Preis verloren gehen" }),
            kpi("general.gross_margin", "Gross margin", "Bruttomarge", "%", "down", -2, -1, { en: "Discounts to keep the rest", de: "Rabatte, um den Rest zu halten" })
          ],
          eur_year_low: 1000000, eur_year_high: 3000000,
          basis: { en: "Orders for standard drives that go to cheaper gearboxes", de: "Aufträge für Standardantriebe, die an günstigere Getriebe gehen" },
          confidence: "medium"
        },
        {
          issue: "I5", monetisable: true, reason: "",
          kpis: [kpi("general.ebit_margin", "EBIT margin", "EBIT-Marge", "%", "down", -1, 0, { en: "A security role, a reporting route and audits", de: "Eine Rolle für Sicherheit, ein Meldeweg und Audits" })],
          eur_year_low: 200000, eur_year_high: 600000,
          basis: { en: "A process for security flaws, product security staff and audits", de: "Ein Prozess für Sicherheitslücken, Personal für Produktsicherheit und Audits" },
          confidence: "medium"
        },
        {
          issue: "I6", monetisable: true, reason: "",
          kpis: [kpi("industrial_manufacturing.recurring_revenue_share", "Share of recurring revenue", "Anteil wiederkehrender Umsätze", "%", "down", -3, -1, { en: "Operating-hour contracts wait for the software", de: "Verträge über Betriebsstunden warten auf die Software" })],
          eur_year_low: 800000, eur_year_high: 2000000,
          basis: { en: "Service revenue delayed until the software reads the drives", de: "Serviceumsatz, der sich verzögert, bis die Software die Antriebe liest" },
          confidence: "medium"
        }
      ],
      factors: [
        { item: "s1", weight: 0.1, rating: 3, reason: { en: "A minor strength until something measures it", de: "Eine kleine Stärke, bis etwas sie misst" } },
        { item: "s2", weight: 0.2, rating: 4, reason: { en: "What customers name when they choose Arvento", de: "Das, was Kunden nennen, wenn sie Arvento wählen" } },
        { item: "s3", weight: 0.15, rating: 3, reason: { en: "Opens doors at machine builders, who still buy on price", de: "Öffnet Türen bei Maschinenbauern, die dennoch über den Preis kaufen" } },
        { item: "s4", weight: 0.15, rating: 3, reason: { en: "Large, but not yet connected or serviced under contract", de: "Groß, aber noch nicht vernetzt und nicht unter Vertrag betreut" } },
        { item: "w1", weight: 0.15, rating: 1, reason: { en: "Limits every service contract", de: "Begrenzt jeden Servicevertrag" } },
        { item: "w2", weight: 0.15, rating: 1, reason: { en: "Blocks billing by operating hours", de: "Verhindert die Abrechnung nach Betriebsstunden" } },
        { item: "w3", weight: 0.1, rating: 2, reason: { en: "Sales knows products, not contracts", de: "Der Vertrieb kennt Produkte, keine Verträge" } },
        { item: "o1", weight: 0.25, rating: 2, reason: { en: "Planned, not yet sold", de: "Geplant, noch nicht verkauft" } },
        { item: "o2", weight: 0.05, rating: 3, reason: { en: "Efficient drives already answer it", de: "Effiziente Antriebe antworten schon darauf" } },
        { item: "o3", weight: 0.1, rating: 1, reason: { en: "Nothing in place yet", de: "Noch nichts vorhanden" } },
        { item: "t1", weight: 0.15, rating: 1, reason: { en: "No answer to price competition", de: "Keine Antwort auf den Preiswettbewerb" } },
        { item: "t2", weight: 0.05, rating: 3, reason: { en: "Few exports to the United States", de: "Wenig Export in die Vereinigten Staaten" } },
        { item: "t3", weight: 0.05, rating: 2, reason: { en: "Wages kept up, training did not", de: "Die Löhne halten mit, die Ausbildung nicht" } },
        { item: "t4", weight: 0.1, rating: 2, reason: { en: "A product security role, no process yet", de: "Eine Rolle für Produktsicherheit, noch kein Prozess" } },
        { item: "t5", weight: 0.25, rating: 1, reason: { en: "No plan for customers who take their data elsewhere", de: "Kein Plan für Kunden, die ihre Daten woanders nutzen" } }
      ]
    },
    strategise: {
      strategies: [
        {
          id: "R1", type: "WO",
          title: { en: "Service software that reads every drive", de: "Service-Software, die jeden Antrieb liest" },
          items: ["w2", "o1", "o3"], issue: "I6", kind: "advantage",
          ratings: [{ item: "w2", to: 2 }, { item: "o1", to: 3 }, { item: "o3", to: 3 }],
          residual: [], upside: [{ likelihood: 3, eur_year_low: 800000, eur_year_high: 2000000 }],
          effort: "M",
          time_to_impact: { en: "About a year", de: "Etwa ein Jahr" },
          first_step: { en: "Connect the drives of ten customer lines to a pilot platform", de: "Die Antriebe von zehn Kundenlinien an eine Pilotplattform anschließen" },
          owner: { en: "Head of service", de: "Leitung Service" },
          recommended: true
        },
        {
          id: "R2", type: "ST",
          title: { en: "Data contracts that keep Arvento the first choice for service", de: "Datenverträge, die Arvento zur ersten Wahl für Service machen" },
          items: ["s4", "t5"], issue: "I3", kind: "mitigate",
          ratings: [{ item: "t5", to: 3 }],
          residual: [{ likelihood: 2, eur_year_low: 500000, eur_year_high: 1500000 }], upside: [],
          effort: "M",
          time_to_impact: { en: "A few months", de: "Wenige Monate" },
          first_step: { en: "Offer customers with Arvento drives a data and service contract that pledges uptime", de: "Kunden mit Arvento-Antrieben einen Daten- und Servicevertrag mit Verfügbarkeitszusage anbieten" },
          owner: { en: "Head of sales", de: "Leitung Vertrieb" },
          recommended: true
        },
        {
          id: "R3", type: "SO",
          title: { en: "Energy reports per line, sold with the drive", de: "Energieberichte je Linie, mit dem Antrieb verkauft" },
          items: ["s2", "o2"], issue: "I4", kind: "advantage",
          ratings: [{ item: "o2", to: 4 }],
          residual: [], upside: [{ likelihood: 3, eur_year_low: 400000, eur_year_high: 1200000 }],
          effort: "S",
          time_to_impact: { en: "A few months", de: "Wenige Monate" },
          first_step: { en: "Measure the energy use of three packaging lines and show the savings", de: "Den Energieverbrauch von drei Verpackungslinien messen und die Einsparung zeigen" },
          owner: { en: "Head of product", de: "Leitung Produkt" },
          recommended: false
        },
        {
          id: "R4", type: "ST",
          title: { en: "A service academy with the region's machine builders", de: "Eine Serviceakademie mit den Maschinenbauern der Region" },
          items: ["s3", "t3"], issue: "I1", kind: "mitigate",
          ratings: [{ item: "t3", to: 3 }],
          residual: [{ likelihood: 2, eur_year_low: 300000, eur_year_high: 900000 }], upside: [],
          effort: "M",
          time_to_impact: { en: "About a year", de: "Etwa ein Jahr" },
          first_step: { en: "Agree a shared training plan with two machine builders and the vocational school", de: "Mit zwei Maschinenbauern und der Berufsschule einen gemeinsamen Ausbildungsplan vereinbaren" },
          owner: { en: "Head of service", de: "Leitung Service" },
          recommended: false
        },
        {
          id: "R5", type: "ST",
          title: { en: "A security process for every drive with software", de: "Ein Sicherheitsprozess für jeden Antrieb mit Software" },
          items: ["s2", "t4"], issue: "I5", kind: "mitigate",
          ratings: [{ item: "t4", to: 3 }],
          residual: [{ likelihood: 1, eur_year_low: 100000, eur_year_high: 300000 }], upside: [],
          effort: "S",
          time_to_impact: { en: "A few months", de: "Wenige Monate" },
          first_step: { en: "Name a product security lead and set up the reporting route", de: "Eine Leitung für Produktsicherheit benennen und den Meldeweg einrichten" },
          owner: { en: "Head of engineering", de: "Leitung Entwicklung" },
          recommended: false
        }
      ]
    },
    summary: {
      headline: { en: "Arvento's SWOT misses the threat to its new service model", de: "Arventos SWOT übersieht das Risiko für das neue Servicemodell" },
      situation: {
        en: "Arvento wants to sell operating hours instead of drives. The challenge questions {{fact:items.challenged}} of the SWOT's {{fact:items.total}} items and adds a factor nobody listed: customers may now take their drives' data to any service firm. The issues found put {{fact:at_stake}} a year at stake, and the response to the market scores {{fact:efe.before}}, below the average.",
        de: "Arvento will Betriebsstunden statt Antriebe verkaufen. Die Prüfung stellt {{fact:items.challenged}} der {{fact:items.total}} Punkte der SWOT infrage und ergänzt einen Faktor, den niemand genannt hatte: Kunden dürfen die Daten ihrer Antriebe nun zu jeder Servicefirma mitnehmen. Die gefundenen Probleme stellen jährlich {{fact:at_stake}} aufs Spiel, und die Antwort auf den Markt liegt bei {{fact:efe.before}}, unter dem Durchschnitt."
      },
      findings: [
        {
          en: "The service model rests on data the company does not control: customers may pass it to rivals, and the old software cannot read it yet.",
          de: "Das Servicemodell beruht auf Daten, die das Unternehmen nicht kontrolliert: Kunden dürfen sie an Wettbewerber geben, und die alte Software liest sie noch nicht."
        },
        {
          en: "Two items are filed or judged wrongly: the shortage of technicians comes from outside, and low-cost rivals are rated far too low.",
          de: "Zwei Punkte sind falsch einsortiert oder falsch gewichtet: Der Technikermangel kommt von außen, und günstige Wettbewerber werden weit unterschätzt."
        },
        {
          en: "Quality is the first strength the team names, and nothing measures it.",
          de: "Qualität ist die erste Stärke, die das Team nennt, und nichts misst sie."
        }
      ],
      recommendation: {
        en: "Settle who may use the drives' data before selling the first operating hour, because the data decides who earns the service revenue. After the decision, {{fact:left}} a year stays at stake, against {{fact:at_stake}} before, and the response to the market stands at {{fact:efe.after}}, against {{fact:efe.before}}.",
        de: "Klären Sie, wer die Daten der Antriebe nutzen darf, bevor die erste Betriebsstunde verkauft ist, denn die Daten entscheiden, wer den Serviceumsatz verdient. Nach der Entscheidung bleiben jährlich {{fact:left}} auf dem Spiel, statt {{fact:at_stake}} vorher, und die Antwort auf den Markt liegt bei {{fact:efe.after}}, statt {{fact:efe.before}}."
      },
      assumptions: [
        { en: "Customers use their data rights once independent service firms offer to read their drives.", de: "Kunden nutzen ihre Datenrechte, sobald freie Servicefirmen anbieten, ihre Antriebe auszulesen." },
        { en: "The euro ranges are AI estimates from the team's notes, not from Arvento's accounts.", de: "Die Euro-Spannen sind KI-Schätzungen aus den Notizen des Teams, nicht aus Arventos Buchhaltung." },
        { en: "Machine builders keep buying on price for standard packaging lines.", de: "Maschinenbauer kaufen für Standard-Verpackungslinien weiter über den Preis." },
        { en: "The service team can be trained faster than the labour market supplies technicians.", de: "Das Serviceteam lässt sich schneller schulen, als der Arbeitsmarkt Techniker liefert." }
      ]
    }
  },
  recorded_choice: ["R1", "R2"]
});
