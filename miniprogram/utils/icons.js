/* Inline SVG decorations carried over from the web app, served as data URIs
   for the <image> component. Crop art keeps its own colors; UI glyphs depend
   on currentColor, so callers pass the stroke color they need. */
const svg = inner => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${inner}</svg>`)}`;
const tint = (inner, color) => svg(inner.split('currentColor').join(color));

const CROPS = {
  sugarcane: '<path d="M24 43V9M31 43V16M17 40V15" stroke="#2E9F54" stroke-width="6"/><path d="M20 19H27M20 29H27M27 26H35M13 26H21" stroke="#FFF5D6" stroke-width="2"/><path d="M24 10C17 2 10 5 10 5M25 11C32 2 41 7 41 7" fill="none" stroke="#006348" stroke-width="3"/>',
  tomato: '<path d="M24 14C8 4 2 30 16 40C29 50 49 30 40 17C36 11 29 10 24 14" fill="#EB5743"/><path d="M25 15L15 10L21 19L29 16L35 11L25 13L27 6" fill="#006348"/><path d="M13 24C11 29 13 34 17 36" fill="none" stroke="#FFF5D6" stroke-width="3" stroke-linecap="round"/>',
  potato: '<path d="M9 25C8 11 30 7 36 15C48 17 45 40 29 42C16 46 7 38 9 25" fill="#FFC447"/><path d="M16 23L19 22M30 19L33 21M33 34L35 33M19 36L21 34" stroke="#006348" stroke-width="2.5" stroke-linecap="round"/>',
  wheat: '<path d="M24 44V8M23 21L14 14M24 30L13 23M24 37L16 32M25 22L34 16M25 31L36 25M25 38L33 34" stroke="#006348" stroke-width="2.5"/><path d="M23 21C12 22 10 14 11 9C21 9 23 14 23 21M24 30C13 31 9 25 10 19C21 19 24 24 24 30M25 22C36 22 39 14 36 11C27 13 25 17 25 22M25 31C37 32 41 23 37 20C26 23 25 26 25 31" fill="#FFC447"/>',
  carrot: '<path d="M17 17C22 12 34 15 33 22L19 43C15 47 13 43 14 40Z" fill="#FF8B22"/><path d="M24 16L19 7M25 15L31 4M24 13V4" stroke="#006348" stroke-width="4" stroke-linecap="round"/><path d="M17 26L23 28M16 34L20 35" stroke="#006348" stroke-width="2"/>',
  'orange pumpkin': '<ellipse cx="24" cy="29" rx="20" ry="16" fill="#FF9B21"/><path d="M24 13L26 5" stroke="#006348" stroke-width="5" stroke-linecap="round"/><path d="M16 15C9 28 12 39 17 44M30 15C39 28 35 38 30 44M24 15V44" fill="none" stroke="#FFC447" stroke-width="2"/>'
};

const GLYPHS = {
  basket: '<path d="M8 20H40L35 40H13Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M15 20L21 9M33 20L27 9M14 29H35M22 23V36M29 23V36" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  farm: '<path d="M8 29H40M8 37H40M24 26V10M24 17C12 18 11 9 11 9C22 8 24 17 24 17M25 21C38 21 38 12 38 12C28 11 25 21 25 21" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  book: '<path d="M24 12C18 7 7 9 7 9V37C13 36 21 36 24 40C29 36 36 36 41 37V9C33 8 28 9 24 12V40M13 18H18M13 25H18M30 18H35M30 25H35" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>',
  fish: '<path d="M8 24C20 8 33 15 36 24C33 34 20 40 8 24ZM35 24L44 17V31Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="18" cy="23" r="2" fill="currentColor"/>'
};

module.exports = {
  crop: name => svg(CROPS[name] || GLYPHS.basket),
  glyph: (name, color = '#006348') => tint(GLYPHS[name] || GLYPHS.basket, color),
  CROPS,
  GLYPHS
};
