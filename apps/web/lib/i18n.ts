const DEFAULT_LOCALE = "fr-SN";
const DEFAULT_TIME_ZONE = "Africa/Dakar";

type DateMethod = (this: Date, locales?: string | string[] | undefined, options?: Intl.DateTimeFormatOptions | undefined) => string;
type NumberMethod = (this: number, locales?: string | string[] | undefined, options?: Intl.NumberFormatOptions | undefined) => string;

const DATE_METHODS: Array<{ name: "toLocaleString" | "toLocaleDateString" | "toLocaleTimeString"; original: DateMethod }> = [
  { name: "toLocaleString", original: Date.prototype.toLocaleString as DateMethod },
  { name: "toLocaleDateString", original: Date.prototype.toLocaleDateString as DateMethod },
  { name: "toLocaleTimeString", original: Date.prototype.toLocaleTimeString as DateMethod },
];

function patchDate() {
  if ((Date.prototype as unknown as Record<string, boolean>).__dakarIntlPatched) return;

  DATE_METHODS.forEach(({ name, original }) => {
    (Date.prototype as unknown as Record<string, DateMethod>)[name] = function (locales, options) {
      return original.call(
        this,
        locales ?? DEFAULT_LOCALE,
        { timeZone: DEFAULT_TIME_ZONE, ...options }
      );
    };
  });

  (Date.prototype as unknown as Record<string, boolean>).__dakarIntlPatched = true;
}

function patchNumber() {
  if ((Number.prototype as unknown as Record<string, boolean>).__dakarIntlPatched) return;

  const original = Number.prototype.toLocaleString as NumberMethod;
  Number.prototype.toLocaleString = function (locales, options) {
    return original.call(this, locales ?? DEFAULT_LOCALE, options);
  } as NumberMethod;

  (Number.prototype as unknown as Record<string, boolean>).__dakarIntlPatched = true;
}

patchDate();
patchNumber();
