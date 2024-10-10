export default class AvitoUrlUtils {
    static readonly mainUrl = 'https://www.avito.ru';
    static readonly urlRegex = /(https?:\/\/)?(www\.)?avito\.ru[-\]_.~!*'();:@&=+$,\/?%#[a-zA-Z0-9]+/;

    private static readonly sortNewParam = '104';

    static getAbsolute(url: string) {
        if (url.startsWith('/')) {
            url = AvitoUrlUtils.mainUrl + url;
        }

        return url;
    }

    static getCategory(url: string, params?: {
        page?: number,
        sortNew?: boolean
    }) {
        url = this.getAbsolute(url);
        const parsed = new URL(url);

        // Clear keys
        for (const key of [...parsed.searchParams.keys()]) {
            parsed.searchParams.delete(key);
        }

        if (params?.sortNew) {
            parsed.searchParams.append('s', this.sortNewParam);
        }

        if (params?.page && params.page !== 1) {
            parsed.searchParams.append('p', params.page.toString());
        }

        return parsed.toString();
    }
}
