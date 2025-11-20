const a = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
];
const b = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'
];

function toWordsGroup(num: number): string {
  let str = '';
  if (num >= 100) {
    str += a[Math.floor(num / 100)] + ' hundred';
    num %= 100;
    if (num > 0) str += ' ';
  }
  if (num >= 20) {
    str += b[Math.floor(num / 10)];
    num %= 10;
    if (num > 0) str += '-' + a[num];
  } else if (num >= 10) {
    str += a[num];
  } else if (num > 0) {
    str += a[num];
  }
  return str;
}

function numberToWords(num: number): string {
  if (num === 0) return 'zero';

  const chunks = [];
  while (num > 0) {
    chunks.push(num % 1000);
    num = Math.floor(num / 1000);
  }

  const scales = ['', 'thousand', 'million', 'billion', 'trillion'];
  let words = '';
  for (let i = chunks.length - 1; i >= 0; i--) {
    if (chunks[i] > 0) {
      words += toWordsGroup(chunks[i]) + ' ' + scales[i] + ' ';
    }
  }
  return words.trim();
}

export const toWords = (num: number | undefined | null): string => {
  if (num === null || num === undefined) return '';
  const [integerPart, decimalPart] = num.toFixed(2).split('.');
  
  const integerWords = numberToWords(parseInt(integerPart, 10));
  const decimalWords = decimalPart !== '00' ? ` and ${numberToWords(parseInt(decimalPart, 10))} cents` : '';
  
  const result = `${integerWords}${decimalWords} only`;
  return result.charAt(0).toUpperCase() + result.slice(1);
};