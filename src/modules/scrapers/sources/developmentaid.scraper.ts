import { Injectable } from '@nestjs/common';
import { AbstractScraper, ScrapedItem, ScraperResult } from '../abstract-scraper';

/**
 * DevelopmentAid — utilise l'API JSON publique du frontend
 * https://www.developmentaid.org/api/frontend/tender/search
 *
 * Filtre sur 25 pays africains, types AO + AMI, statut Open, mot-clé "AUDIT" dans le titre.
 * Volume : ~30 résultats actifs en moyenne.
 *
 * NOTE éthique : API publique mais non documentée pour usage tiers.
 * À terme, considérer un partenariat data ou un abonnement Premium.
 */
@Injectable()
export class DevelopmentAidScraper extends AbstractScraper {
  readonly sourceCode = 'DEVELOPMENTAID';
  readonly sourceLabel = 'DevelopmentAid';
  readonly countries = ['INTERNATIONAL'];
  readonly baseUrl = 'https://www.developmentaid.org/tenders/search';
  readonly enabled = true;
  readonly intervalMinutes = 360; // 6h — soft pour éviter blocage

  private readonly API_URL = 'https://www.developmentaid.org/api/frontend/tender/search';

  /**
   * 25 codes pays DevelopmentAid (couvrant la francophonie africaine + zone UEMOA)
   */
  private readonly LOCATIONS = [
    12, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24,
    29, 30, 34, 39, 41, 44, 45, 48, 51, 54, 55,
    33, 42, 63,
  ];

  /**
   * Mapping locationNames retournés par l'API → ISO2.
   */
  private readonly COUNTRY_MAP: Record<string, string> = {
    'Benin': 'BJ',
    'Burkina Faso': 'BF',
    'Burundi': 'BI',
    'Cameroon': 'CM',
    'Central African Republic': 'CF',
    'Chad': 'TD',
    'Comoros': 'KM',
    'Congo': 'CG',
    "Cote d'Ivoire": 'CI',
    "Côte d'Ivoire": 'CI',
    'Dem. Rep. Congo': 'CD',
    'Djibouti': 'DJ',
    'French Southern Territory': 'TF',
    'Gabon': 'GA',
    'Guinea': 'GN',
    'Guinea-Bissau': 'GW',
    'Madagascar': 'MG',
    'Mali': 'ML',
    'Mauritania': 'MR',
    'Mayotte': 'YT',
    'Morocco': 'MA',
    'Niger': 'NE',
    'Rwanda': 'RW',
    'Senegal': 'SN',
    'Seychelles': 'SC',
    'Togo': 'TG',
  };

  async scrape(): Promise<ScraperResult> {
    const errors: string[] = [];
    const items: ScrapedItem[] = [];
    const PAGE_SIZE = 50;
    const MAX_PAGES = 5; // protection : 250 items max par run

    try {
      for (let pageNr = 1; pageNr <= MAX_PAGES; pageNr++) {
        const payload = {
          filter: {
            keyword: { searchedText: 'AUDIT', searchedFields: ['title'] },
            tenderTypes: [4, 5], // 4=AO, 5=AMI
            typesIsStrict: false,
            sectors: [],
            sectorsIsStrict: false,
            locations: this.LOCATIONS,
            locationIsStrict: false,
            donors: [],
            statuses: [3], // 3 = Open
            languages: [],
            contractingAuthorities: [],
            budgetInEuroRange: { min: 0, max: 20000000 },
            ownPosts: false,
          },
          sort: 'relevance.desc',
          pageSize: PAGE_SIZE,
          pageNr,
        };

        const res = await fetch(this.API_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'User-Agent': 'TenderPro/1.0 (+https://mytenderspro.com)',
            'Origin': 'https://www.developmentaid.org',
            'Referer': 'https://www.developmentaid.org/tenders/search',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
          errors.push(`HTTP ${res.status} on page ${pageNr}`);
          break;
        }

        const data = await res.json();
        const list: any[] = data?.items ?? [];

        if (list.length === 0) break;

        for (const item of list) {
          // Filtre pays — on garde uniquement africains du mapping
          // locationNames peut être multi-pays séparés par virgule, on prend le 1er
          const firstLocation = (item.locationNames ?? '').split(',')[0].trim();
          const iso2 = this.COUNTRY_MAP[firstLocation];
          if (!iso2) continue;

          // Filtre deadline — ignore les avis expirés
          const deadline = this.parseDate(item.deadline);
          if (deadline && deadline.getTime() < Date.now()) continue;

          const title = this.cleanText(item.name) ?? '(Sans titre)';
          const isEoi = /^AMI/i.test(title) || /AMI -/i.test(title);

          const sourceUrl = item.id && item.slug
            ? `https://www.developmentaid.org/tenders/view/${item.id}/${item.slug}`
            : `https://www.developmentaid.org/tenders/view/${item.id}`;

          // Budget : DevelopmentAid donne en EUR. On garde la valeur native + currency.
          const budget = item.budget && item.budget > 0 ? item.budget : undefined;
          const currency = budget ? (item.currency ?? 'EUR') : undefined;

          items.push({
            externalRef: String(item.id),
            title,
            description: undefined,
            clientName: this.cleanText(item.organizationName),
            sector: this.cleanText(item.sectors),
            country: iso2,
            publishedAt: this.parseDate(item.postedDate),
            submissionDeadline: deadline,
            budgetIndicative: budget,
            currency,
            sourceUrl,
            documentUrls: [],
            isEoi,
            rawData: item,
          });
        }

        // Si on a moins que pageSize, c'est la dernière page
        if (list.length < PAGE_SIZE) break;

        // Petit délai anti-rate-limit (1.5s entre pages)
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err: any) {
      errors.push(`Fetch error: ${err.message}`);
    }

    return { items, errors };
  }
}
