type RussianTimespan = 'с' | 'ми' | 'ч' | 'д' | 'н' | 'ме';

const russianTimespanToMs: { [timespan in RussianTimespan]: number } = {
    'с': 1e3,
    'ми': 60e3,
    'ч': 3600e3,
    'д': 86400e3,
    'н': 604800e3,
    'ме': 2628e6
}

// "5 минут назад" -> Date
export function parseRussianTextDate(text: string): Date {
    const match = text.match(/(\d+) (ми|ч|д|н|ме)/);

    if (match === null) {
        return new Date();
    }

    const amount = Number(match[1]);
    const timespan = match[2] as RussianTimespan;

    return new Date(Date.now() - russianTimespanToMs[timespan] * amount);
}
