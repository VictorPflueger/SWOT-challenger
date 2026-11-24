// S1 Tidewell Lines: a recorded run, written by hand from the facts in DATA_SOURCES.md (brief 7). The
// company and its figures are fictional and illustrative; what the agents say about the world is real and
// dated there. Every text has its English and its German beside it; every number, id and choice is
// written once (data/scenarios/bilingual.js). The Writer's text carries no number of its own: every
// figure is a {{fact:key}} placeholder that the engine fills for whichever strategies the person chooses.

import { bilingual } from "./bilingual.js";

const ETS = "https://climate.ec.europa.eu/eu-action/transport-decarbonisation/reducing-emissions-shipping-sector_en";
const FUELEU = "https://transport.ec.europa.eu/transport-modes/maritime/decarbonising-maritime-transport-fueleu-maritime_en";
const SUEZ = "https://www.rivieramm.com/news-content-hub/full-suez-return-clouds-box-ship-outlook-as-one-becomes-latest-to-resume-transits-90632";
const COUNT = "https://transport.ec.europa.eu/news-events/news/commission-welcomes-political-agreement-new-rules-harmonise-transport-emissions-calculations-eu-2025-11-06_en";

const kpi = (id, en, de, unit, direction, change_low, change_high, basis) => ({ id, name: { en, de }, unit, direction, change_low, change_high, definition: "", basis });

export default bilingual({
  id: "s1",
  source: "authored",
  as_of: "2026-11-23",
  company: {
    name: "Tidewell Lines",
    sector: "transport_logistics",
    country: "DE",
    description: {
      en: "A mid-sized container line from Bremen that sails in a global alliance and runs its own feeder services in northern Europe",
      de: "Eine mittelgroße Containerreederei aus Bremen, die in einer globalen Allianz fährt und eigene Zubringerdienste in Nordeuropa betreibt"
    },
    fictional: true
  },
  sources: [
    { url: ETS, read_on: "2026-11-23" },
    { url: FUELEU, read_on: "2026-11-23" },
    { url: SUEZ, read_on: "2026-11-23" },
    { url: COUNT, read_on: "2026-11-23" }
  ],
  entered: {
    strengths: [
      { id: "s1", text: { en: "Customers want shipping with lower emissions", de: "Kunden wollen Transporte mit weniger Emissionen" } },
      { id: "s2", text: { en: "A global network through our alliance", de: "Ein weltweites Netz über unsere Allianz" } },
      { id: "s3", text: { en: "Fixed call days that shippers can plan around", de: "Feste Anlauftage, mit denen Verlader planen können" } }
    ],
    weaknesses: [
      { id: "w1", text: { en: "Bookings still run by e-mail and phone", de: "Buchungen laufen noch per E-Mail und Telefon" } },
      { id: "w2", text: { en: "Older ships in the feeder fleet", de: "Ältere Schiffe in der Zubringerflotte" } }
    ],
    opportunities: [
      { id: "o1", text: { en: "More cargo between ports in northern Europe", de: "Mehr Ladung zwischen Häfen in Nordeuropa" } }
    ],
    threats: [
      { id: "t1", text: { en: "Rising costs for fuel and emissions", de: "Steigende Kosten für Treibstoff und Emissionen" } },
      { id: "t2", text: { en: "Freight rates that swing from month to month", de: "Frachtraten, die von Monat zu Monat schwanken" } }
    ]
  },
  answers: {
    complete: {
      sector: "transport_logistics",
      items: [
        {
          quadrant: "weaknesses",
          text: { en: "No emissions figures per container for shippers", de: "Keine Emissionswerte je Container für Verlader" },
          basis: { en: "Shippers who publish their transport emissions need figures per shipment, and the line gives them per voyage only", de: "Verlader, die ihre Transportemissionen veröffentlichen, brauchen Werte je Sendung; die Reederei liefert sie nur je Reise" },
          confidence: "medium"
        },
        {
          quadrant: "opportunities",
          text: { en: "Shippers who report the emissions of their transport", de: "Verlader, die die Emissionen ihrer Transporte berichten" },
          basis: { en: "New EU rules give shippers one method to count transport emissions", de: "Neue EU-Regeln geben Verladern eine Methode, Transportemissionen zu zählen" },
          confidence: "medium"
        },
        {
          quadrant: "opportunities",
          text: { en: "Services returning to the Suez route shorten voyages to Asia", de: "Dienste, die auf die Suez-Route zurückkehren, verkürzen die Fahrt nach Asien" },
          basis: { en: "Carriers are moving their services between Asia and Europe back to the canal one by one", de: "Die Reedereien verlegen ihre Dienste zwischen Asien und Europa einen nach dem anderen zurück auf den Kanal" },
          confidence: "medium"
        },
        {
          quadrant: "threats",
          text: { en: "Rules that cut the carbon allowed in ship fuel", de: "Regeln, die den erlaubten Kohlenstoff im Schiffstreibstoff senken" },
          basis: { en: "FuelEU Maritime lowers the greenhouse gas intensity allowed for large ships in steps until mid-century", de: "FuelEU Maritime senkt die erlaubte Treibhausgasintensität großer Schiffe in Stufen bis zur Jahrhundertmitte" },
          confidence: "high"
        }
      ],
      misfiled: [
        { item: "s1", belongs_in: "opportunities", reason: { en: "Demand for cleaner shipping comes from customers outside the company, and the line has no lead in it yet", de: "Die Nachfrage nach saubererem Transport kommt von Kunden außerhalb, und die Reederei hat darin noch keinen Vorsprung" } }
      ]
    },
    challenge: {
      issues: [
        {
          id: "I1",
          title: { en: "Older feeder ships pay the most for emissions", de: "Ältere Zubringerschiffe zahlen am meisten für Emissionen" },
          type: "regulation",
          description: {
            en: "Emissions trading covers every voyage between EU ports, and from next year allowances must cover all reported emissions. FuelEU Maritime also limits the greenhouse gas intensity of the fuel. The older feeder ships burn the most per container.",
            de: "Der Emissionshandel erfasst jede Fahrt zwischen EU-Häfen, und ab dem nächsten Jahr müssen Zertifikate alle gemeldeten Emissionen decken. Auch FuelEU Maritime begrenzt die Treibhausgasintensität des Treibstoffs. Die älteren Zubringerschiffe verbrauchen je Container am meisten."
          },
          items: ["w2", "t1"],
          quadrants: ["weaknesses", "threats"],
          impact: 4,
          likelihood: 4,
          horizon: "now",
          evidence: [
            { url: ETS, title: { en: "Emissions trading for shipping: allowances for all reported emissions from 2027", de: "Emissionshandel für die Schifffahrt: Zertifikate für alle gemeldeten Emissionen ab 2027" } },
            { url: FUELEU, title: { en: "FuelEU Maritime: lower greenhouse gas intensity for ships above 5,000 gross tonnage", de: "FuelEU Maritime: geringere Treibhausgasintensität für Schiffe über 5.000 BRZ" } }
          ],
          confidence: "high",
          added_items: []
        },
        {
          id: "I2",
          title: { en: "Digital forwarders are missing from the threats", de: "Digitale Spediteure fehlen bei den Risiken" },
          type: "missing",
          description: {
            en: "Forwarders that book online sit between the line and its shippers and compare rates in seconds. A line that books by e-mail sells through them and competes on price alone.",
            de: "Spediteure, die online buchen, stehen zwischen der Reederei und ihren Verladern und vergleichen Raten in Sekunden. Wer per E-Mail bucht, verkauft über sie und konkurriert nur über den Preis."
          },
          items: [],
          quadrants: ["threats"],
          impact: 4,
          likelihood: 3,
          horizon: "1_to_3_years",
          evidence: [],
          confidence: "medium",
          added_items: [
            {
              quadrant: "threats",
              text: { en: "Digital forwarders stand between the line and its shippers", de: "Digitale Spediteure stehen zwischen der Reederei und ihren Verladern" },
              basis: { en: "Online forwarders book and compare rates for shippers, and carriers without online booking sell through them", de: "Online-Spediteure buchen für Verlader und vergleichen Raten, und Reedereien ohne Online-Buchung verkaufen über sie" }
            }
          ]
        },
        {
          id: "I3",
          title: { en: "Services switching back to Suez upset the fixed call days", de: "Dienste, die zum Suezkanal zurückwechseln, verschieben die festen Anlauftage" },
          type: "operations",
          description: {
            en: "Carriers are returning to the canal service by service, and each switch moves the arrival days in Europe. Shippers who plan around fixed call days see them move while the routes change.",
            de: "Die Reedereien kehren Dienst für Dienst zum Kanal zurück, und jeder Wechsel verschiebt die Ankunftstage in Europa. Verlader, die mit festen Anlauftagen planen, sehen sie wandern, solange die Routen wechseln."
          },
          items: ["s3"],
          quadrants: ["strengths"],
          impact: 3,
          likelihood: 4,
          horizon: "now",
          evidence: [{ url: SUEZ, title: { en: "Riviera: full Suez return clouds the box ship outlook as ONE resumes transits", de: "Riviera: Die volle Rückkehr zum Suezkanal trübt den Ausblick, ONE nimmt die Durchfahrten wieder auf" } }],
          confidence: "medium",
          added_items: []
        },
        {
          id: "I4",
          title: { en: "Every alliance member has the same global network", de: "Jedes Mitglied der Allianz hat dasselbe weltweite Netz" },
          type: "not_distinctive",
          description: {
            en: "The network belongs to the alliance, so every partner line sells the same ports and the same ships. Shippers compare the rate, not the reach.",
            de: "Das Netz gehört der Allianz, also verkauft jede Partnerreederei dieselben Häfen und Schiffe. Verlader vergleichen die Rate, nicht die Reichweite."
          },
          items: ["s2"],
          quadrants: ["strengths"],
          impact: 3,
          likelihood: 4,
          horizon: "now",
          evidence: [],
          confidence: "high",
          added_items: []
        },
        {
          id: "I5",
          title: { en: "Shippers want emissions figures the line cannot give yet", de: "Verlader wollen Emissionswerte, die die Reederei noch nicht liefern kann" },
          type: "contradiction",
          description: {
            en: "Shippers who publish their transport emissions will use the EU method and ask each carrier for figures per shipment. The opportunity needs exactly the data the line does not have.",
            de: "Verlader, die ihre Transportemissionen veröffentlichen, nutzen die EU-Methode und fragen jede Reederei nach Werten je Sendung. Die Chance braucht genau die Daten, die der Reederei fehlen."
          },
          items: ["o2", "w3"],
          quadrants: ["opportunities", "weaknesses"],
          impact: 3,
          likelihood: 3,
          horizon: "1_to_3_years",
          evidence: [{ url: COUNT, title: { en: "CountEmissionsEU: one EU method for transport emissions, based on EN ISO 14083", de: "CountEmissionsEU: eine EU-Methode für Transportemissionen nach EN ISO 14083" } }],
          confidence: "medium",
          added_items: []
        },
        {
          id: "I6",
          title: { en: "Demand for cleaner shipping is an opportunity, filed as a strength", de: "Die Nachfrage nach saubererem Transport ist eine Chance, als Stärke einsortiert" },
          type: "misfiled",
          description: {
            en: "Customers asking for lower emissions is a development outside the company. As a strength it suggests the line already wins that business, while its older feeder ships say otherwise.",
            de: "Kunden, die weniger Emissionen verlangen, sind eine Entwicklung außerhalb des Unternehmens. Als Stärke klingt es, als gewinne die Reederei dieses Geschäft schon, doch ihre älteren Zubringerschiffe sagen etwas anderes."
          },
          items: ["s1"],
          quadrants: ["strengths", "opportunities"],
          impact: 2,
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
          kpis: [
            kpi("transport_logistics.ets_cost_per_teu", "Emission allowance cost per container", "Kosten für Emissionszertifikate je Container", "€/TEU", "up", 15, 40, { en: "Allowances for all emissions of the feeder fleet", de: "Zertifikate für alle Emissionen der Zubringerflotte" }),
            kpi("transport_logistics.fuel_cost_per_teu", "Fuel cost per container", "Treibstoffkosten je Container", "€/TEU", "up", 5, 20, { en: "Cleaner fuel for the older ships", de: "Saubererer Treibstoff für die älteren Schiffe" })
          ],
          eur_year_low: 1000000, eur_year_high: 2600000,
          basis: { en: "Allowances and cleaner fuel for the feeder fleet over the next year", de: "Zertifikate und saubererer Treibstoff für die Zubringerflotte im nächsten Jahr" },
          confidence: "medium"
        },
        {
          issue: "I2", monetisable: true, reason: "",
          kpis: [kpi("transport_logistics.average_freight_rate", "Average freight rate", "Durchschnittliche Frachtrate", "€/TEU", "down", -60, -20, { en: "Forwarders buy space at the lowest rate and resell it", de: "Spediteure kaufen Laderaum zur niedrigsten Rate und verkaufen ihn weiter" })],
          eur_year_low: 1500000, eur_year_high: 4000000,
          basis: { en: "Rates the line gives up when forwarders resell its space", de: "Raten, auf die die Reederei verzichtet, wenn Spediteure ihren Laderaum weiterverkaufen" },
          confidence: "medium"
        },
        {
          issue: "I3", monetisable: true, reason: "",
          kpis: [
            kpi("transport_logistics.schedule_reliability", "Schedule reliability", "Fahrplantreue", "%", "down", -15, -5, { en: "Arrival days move with each switch of route", de: "Ankunftstage verschieben sich mit jedem Routenwechsel" }),
            kpi("transport_logistics.port_turnaround_time", "Port turnaround time", "Liegezeit im Hafen", "h", "up", 2, 8, { en: "Ships bunch up at the hub ports", de: "Schiffe stauen sich in den Umschlaghäfen" })
          ],
          eur_year_low: 800000, eur_year_high: 2000000,
          basis: { en: "Missed connections, extra port calls and claims while the routes change", de: "Verpasste Anschlüsse, zusätzliche Hafenanläufe und Forderungen, solange die Routen wechseln" },
          confidence: "medium"
        },
        {
          issue: "I4", monetisable: false,
          reason: { en: "A strength every rival shares costs nothing by itself; it only fails to win a bid", de: "Eine Stärke, die jeder Wettbewerber teilt, kostet für sich nichts; sie gewinnt nur keine Ausschreibung" },
          kpis: [], eur_year_low: 0, eur_year_high: 0, basis: "", confidence: "high"
        },
        {
          issue: "I5", monetisable: true, reason: "",
          kpis: [kpi("transport_logistics.vessel_utilisation", "Vessel utilisation", "Schiffsauslastung", "%", "down", -4, -1, { en: "Cargo of reporting shippers goes to carriers with figures", de: "Ladung berichtender Verlader geht an Reedereien mit Werten" })],
          eur_year_low: 500000, eur_year_high: 1500000,
          basis: { en: "Contracts with reporting shippers that go to carriers who give figures per container", de: "Verträge mit berichtenden Verladern, die an Reedereien mit Werten je Container gehen" },
          confidence: "medium"
        },
        {
          issue: "I6", monetisable: false,
          reason: { en: "Where an item sits in the SWOT costs nothing by itself; acting on the wrong reading does", de: "Wo ein Punkt in der SWOT steht, kostet für sich nichts; teuer wird es, falsch danach zu handeln" },
          kpis: [], eur_year_low: 0, eur_year_high: 0, basis: "", confidence: "high"
        }
      ],
      factors: [
        { item: "s1", weight: 0.1, rating: 3, reason: { en: "Real demand, but outside the company, and the line has no lead in it", de: "Echte Nachfrage, aber außerhalb des Unternehmens, und die Reederei hat darin keinen Vorsprung" } },
        { item: "s2", weight: 0.15, rating: 3, reason: { en: "Every alliance member offers the same reach", de: "Jedes Mitglied der Allianz bietet dieselbe Reichweite" } },
        { item: "s3", weight: 0.15, rating: 3, reason: { en: "Valued by shippers while the routes hold", de: "Bei Verladern geschätzt, solange die Routen halten" } },
        { item: "w1", weight: 0.2, rating: 1, reason: { en: "Forwarders book in seconds; an e-mail takes a day", de: "Spediteure buchen in Sekunden; eine E-Mail braucht einen Tag" } },
        { item: "w2", weight: 0.25, rating: 1, reason: { en: "The highest fuel and emissions cost per container", de: "Die höchsten Treibstoff- und Emissionskosten je Container" } },
        { item: "w3", weight: 0.15, rating: 2, reason: { en: "Figures exist per voyage, not per container", de: "Werte gibt es je Reise, nicht je Container" } },
        { item: "o1", weight: 0.1, rating: 3, reason: { en: "The feeder services already serve it", de: "Die Zubringerdienste bedienen sie schon" } },
        { item: "o2", weight: 0.15, rating: 1, reason: { en: "No offer yet for shippers who report emissions", de: "Noch kein Angebot für Verlader, die Emissionen berichten" } },
        { item: "o3", weight: 0.1, rating: 2, reason: { en: "Schedules not yet planned for the shorter route", de: "Fahrpläne für die kürzere Route noch nicht geplant" } },
        { item: "t1", weight: 0.2, rating: 2, reason: { en: "Costs are passed on in part", de: "Kosten werden zum Teil weitergegeben" } },
        { item: "t2", weight: 0.1, rating: 2, reason: { en: "Contracts cover some of the volume", de: "Verträge decken einen Teil der Menge" } },
        { item: "t3", weight: 0.15, rating: 2, reason: { en: "Fuel plans exist for the deep-sea fleet only", de: "Treibstoffpläne gibt es nur für die Tiefseeflotte" } },
        { item: "t4", weight: 0.2, rating: 1, reason: { en: "No online booking to compete with", de: "Keine Online-Buchung, um mitzuhalten" } }
      ]
    },
    strategise: {
      strategies: [
        {
          id: "R1", type: "WT",
          title: { en: "Online booking that sells straight to shippers", de: "Online-Buchung, die direkt an Verlader verkauft" },
          items: ["w1", "t4"], issue: "I2", kind: "mitigate",
          ratings: [{ item: "w1", to: 2 }, { item: "t4", to: 3 }],
          residual: [{ likelihood: 2, eur_year_low: 800000, eur_year_high: 2000000 }], upside: [],
          effort: "M",
          time_to_impact: { en: "About a year", de: "Etwa ein Jahr" },
          first_step: { en: "Put the feeder services' rates and space online for the ten largest shippers", de: "Raten und Laderaum der Zubringerdienste für die zehn größten Verlader online stellen" },
          owner: { en: "Head of sales", de: "Leitung Vertrieb" },
          recommended: true
        },
        {
          id: "R2", type: "WO",
          title: { en: "Emissions statements per container, by the EU method", de: "Emissionsnachweise je Container nach der EU-Methode" },
          items: ["w3", "o2"], issue: "I5", kind: "advantage",
          ratings: [{ item: "o2", to: 3 }],
          residual: [], upside: [{ likelihood: 3, eur_year_low: 600000, eur_year_high: 1400000 }],
          effort: "S",
          time_to_impact: { en: "A few months", de: "Wenige Monate" },
          first_step: { en: "Work out the emissions per container on the busiest feeder route and offer them to three shippers", de: "Die Emissionen je Container auf der stärksten Zubringerroute berechnen und drei Verladern anbieten" },
          owner: { en: "Head of sustainability", de: "Leitung Nachhaltigkeit" },
          recommended: true
        },
        {
          id: "R3", type: "WT",
          title: { en: "Renew the feeder fleet, oldest ships first", de: "Die Zubringerflotte erneuern, die ältesten Schiffe zuerst" },
          items: ["w2", "t1", "t3"], issue: "I1", kind: "mitigate",
          ratings: [{ item: "w2", to: 2 }, { item: "t1", to: 3 }, { item: "t3", to: 3 }],
          residual: [{ likelihood: 3, eur_year_low: 600000, eur_year_high: 1600000 }], upside: [],
          effort: "L",
          time_to_impact: { en: "Two to three years", de: "Zwei bis drei Jahre" },
          first_step: { en: "Charter two newer ships for the feeder routes with the highest emissions cost", de: "Zwei neuere Schiffe für die Zubringerrouten mit den höchsten Emissionskosten chartern" },
          owner: { en: "Head of fleet", de: "Leitung Flotte" },
          recommended: false
        },
        {
          id: "R4", type: "SO",
          title: { en: "Fixed call days rebuilt around the shorter Suez rotation", de: "Feste Anlauftage, neu geplant um die kürzere Suez-Rotation" },
          items: ["s3", "o3"], issue: "I3", kind: "advantage",
          ratings: [{ item: "o3", to: 3 }],
          residual: [], upside: [{ likelihood: 3, eur_year_low: 300000, eur_year_high: 900000 }],
          effort: "M",
          time_to_impact: { en: "A few months", de: "Wenige Monate" },
          first_step: { en: "Publish the new call days of each Suez service before it switches", de: "Die neuen Anlauftage jedes Suez-Dienstes vor dem Wechsel veröffentlichen" },
          owner: { en: "Head of network", de: "Leitung Netzwerk" },
          recommended: false
        }
      ]
    },
    summary: {
      headline: { en: "Tidewell's SWOT counts the alliance as a strength and misses the forwarders", de: "Tidewells SWOT zählt die Allianz als Stärke und übersieht die Spediteure" },
      situation: {
        en: "Tidewell runs its own feeder services next to its alliance work. The challenge questions {{fact:items.challenged}} of the SWOT's {{fact:items.total}} items and adds a threat nobody listed: digital forwarders that sit between the line and its shippers. The issues found put {{fact:at_stake}} a year at stake, and the response to the market scores {{fact:efe.before}}, below the average.",
        de: "Tidewell betreibt neben der Arbeit in der Allianz eigene Zubringerdienste. Die Prüfung stellt {{fact:items.challenged}} der {{fact:items.total}} Punkte der SWOT infrage und ergänzt ein Risiko, das niemand genannt hatte: digitale Spediteure, die zwischen der Reederei und ihren Verladern stehen. Die gefundenen Probleme stellen jährlich {{fact:at_stake}} aufs Spiel, und die Antwort auf den Markt liegt bei {{fact:efe.before}}, unter dem Durchschnitt."
      },
      findings: [
        {
          en: "The costliest issue is the older feeder fleet, which pays the most once emissions trading and the fuel rules apply in full.",
          de: "Das teuerste Problem ist die ältere Zubringerflotte, die am meisten zahlt, sobald Emissionshandel und Treibstoffregeln voll greifen."
        },
        {
          en: "Two strengths are not what they seem: cleaner shipping is what customers want, and the global network belongs to every alliance member.",
          de: "Zwei Stärken sind nicht, was sie scheinen: Sauberer Transport ist ein Wunsch der Kunden, und das weltweite Netz gehört jedem Mitglied der Allianz."
        },
        {
          en: "Booking by e-mail leaves shippers to the forwarders, and the missing emissions figures keep the line out of reporting shippers' tenders.",
          de: "Buchen per E-Mail überlässt die Verlader den Spediteuren, und fehlende Emissionswerte halten die Reederei aus den Ausschreibungen berichtender Verlader heraus."
        }
      ],
      recommendation: {
        en: "Win back the shipper's booking and data before renewing the fleet: both cost less and answer the threats that move fastest. After the decision, {{fact:left}} a year stays at stake, against {{fact:at_stake}} before, and the response to the market stands at {{fact:efe.after}}, against {{fact:efe.before}}.",
        de: "Holen Sie sich Buchung und Daten der Verlader zurück, bevor Sie die Flotte erneuern: Beides kostet weniger und antwortet auf die Risiken, die sich am schnellsten bewegen. Nach der Entscheidung bleiben jährlich {{fact:left}} auf dem Spiel, statt {{fact:at_stake}} vorher, und die Antwort auf den Markt liegt bei {{fact:efe.after}}, statt {{fact:efe.before}}."
      },
      assumptions: [
        { en: "Shippers keep booking through forwarders as long as the line offers no rates online.", de: "Verlader buchen weiter über Spediteure, solange die Reederei keine Raten online anbietet." },
        { en: "Emissions costs rise as allowances come to cover all reported emissions.", de: "Die Emissionskosten steigen, wenn Zertifikate alle gemeldeten Emissionen decken müssen." },
        { en: "Services keep switching back to Suez over the coming months.", de: "Die Dienste wechseln in den kommenden Monaten weiter zum Suezkanal zurück." },
        { en: "The euro ranges are AI estimates from the team's notes, not from Tidewell's accounts.", de: "Die Euro-Spannen sind KI-Schätzungen aus den Notizen des Teams, nicht aus Tidewells Buchhaltung." }
      ]
    }
  },
  recorded_choice: ["R1", "R2"]
});
