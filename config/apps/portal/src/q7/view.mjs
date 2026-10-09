export function desktopView(width, height) {
  const wide = width >= 1800 && height >= 680;
  const gain = wide ? Math.max(0, Math.min((width - 1700) / 1600, (height - 680) / 1000, 1)) : 0;
  const area = wide ? Math.max(1, width * height / (1600 * 900)) : 1;
  return {
    wide,
    scale: 1 + gain * .88,
    effectScale: 1 + gain * .3,
    pointCount: width < 700 ? 5500 : Math.min(44000, Math.round(11000 * Math.min(4, area))),
    bufferCap: wide ? (width >= 3200 ? 3072 : 2560) : 0
  };
}
