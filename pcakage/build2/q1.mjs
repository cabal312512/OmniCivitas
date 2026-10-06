export function roofLevel(roof,x,z){const dx=Math.abs(x-roof.x),dz=Math.abs(z-roof.z);if(dx>roof.width/2||dz>roof.depth/2)return null;return roof.baseY+roof.rise*(1-dz/(roof.depth/2));}
