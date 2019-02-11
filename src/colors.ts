import * as log from './log';

export interface RgbColors {
    red: number;
    green: number;
    blue: number;
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes hue, saturation, and lightness are contained in the set [0, 1] and
 * returns an object with red, green, and blue [0, 255].
 */
export const hsl2rgb = (hue: number, saturation: number, lightness: number): RgbColors => {
    let red;
    let green;
    let blue;

    if (saturation === 0) {
        red = green = blue = lightness; // achromatic
    } else {
        const hue2rgb = (p: number, q: number, t: number): number => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;

            return p;
        }

        const q = lightness < 0.5 ?
            lightness * (1 + saturation) :
            lightness + saturation - lightness * saturation;
        const p = 2 * lightness - q;
        red = hue2rgb(p, q, hue + 1/3);
        green = hue2rgb(p, q, hue);
        blue = hue2rgb(p, q, hue - 1/3);
    }

    const rgb = {
        red: Math.round(red * 255),
        green: Math.round(green * 255),
        blue: Math.round(blue * 255)
    };

    log.verbose(
        'hsl2rgb',
        `H:${hue},S:${saturation},L:${lightness}`,
        'to',
        `R:${rgb.red},G:${rgb.green},B:${rgb.blue}`
    );

    return rgb;
}

export interface HslColors {
    hue: number;
    saturation: number;
    lightness: number;
}

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 */
export const rgb2hsl = (red: number, green: number, blue: number): HslColors => {
    red /= 255;
    green /= 255;
    blue /= 255;

    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);

    let hue: number;
    let saturation: number;
    const lightness = (max + min) / 2;

    if (max == min) {
        hue = saturation = 0; // achromatic
    } else {
        const d = max - min;
        if (lightness > 0.5) {
            saturation = d / (2 - max - min);
        } else {
            saturation = d / (max + min);
        }

        switch (max) {
            case red:
                hue = (green - blue) / d + (green < blue ? 6 : 0);
                break;

            case green:
                hue = (blue - red) / d + 2;
                break;

            case blue:
                hue = (red - green) / d + 4;
                break;

            default:
                throw new Error();
        }

        hue /= 6;
    }

    const hsl = {
        hue,
        saturation,
        lightness
    };

    log.verbose(
        'rgb2hsl',
        `R:${red},G:${green},B:${blue}`,
        'to',
        `H:${hsl.hue},S:${hsl.saturation},L:${hsl.lightness})`
    );

    return hsl;
}
