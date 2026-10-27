/* Shared constants and lookup tables. Everything hangs off window.Lab. */
(() => {
'use strict';
const L = window.Lab = {};

L.VERSION = '1.1';               // bump when the simulator or generator changes how programs behave
L.W = 120; L.H = 80;            // arena size in cm
L.MAXV = 30;                     // cm/s at 100%
L.WHEELBASE = 7.6;               // cm between wheels
L.ROBOT_R = 6;                   // collision radius (cm)
L.SENSOR_FWD = 4.5; L.SENSOR_SIDE = 0.8; L.SONAR_FWD = 5.8;
L.PXCM = 8;                      // floor resolution (pixels per cm)
L.LINE_W = 2.4;                  // black tape width (cm)

L.C = { basic: '#1E90FF', input: '#D400D4', music: '#E63022', led: '#5C2D91', radio: '#E3008C', loops: '#00AA00', logic: '#00A4A6',
  vars: '#DC143C', math: '#9400D3', text: '#B8860B', fn: '#3455DB', cute: '#0fbc11', serial: '#002050' };

L.FONT = {
  '0':[14,19,21,25,14],'1':[4,12,4,4,14],'2':[28,2,12,16,30],'3':[30,2,4,17,14],'4':[6,10,18,31,2],
  '5':[31,16,30,1,30],'6':[2,4,14,17,14],'7':[31,2,4,8,16],'8':[14,17,14,17,14],'9':[14,17,14,4,8],
  A:[12,18,30,18,18],B:[28,18,28,18,28],C:[14,16,16,16,14],D:[28,18,18,18,28],E:[30,16,28,16,30],F:[30,16,28,16,16],
  G:[14,16,19,17,14],H:[18,18,30,18,18],I:[28,8,8,8,28],J:[31,2,2,18,12],K:[18,20,24,20,18],L:[16,16,16,16,30],
  M:[17,27,21,17,17],N:[17,25,21,19,17],O:[12,18,18,18,12],P:[28,18,28,16,16],Q:[12,18,18,12,3],R:[28,18,28,20,18],
  S:[14,16,12,2,28],T:[31,4,4,4,4],U:[18,18,18,18,12],V:[17,17,17,10,4],W:[17,17,21,27,17],X:[18,18,12,18,18],
  Y:[17,10,4,4,4],Z:[30,4,8,16,30],
  a:[0,14,18,18,15],b:[16,16,28,18,28],c:[0,14,16,16,14],d:[2,2,14,18,14],e:[12,18,28,16,14],f:[6,8,28,8,8],
  g:[14,18,14,2,12],h:[16,16,28,18,18],i:[8,0,8,8,8],j:[2,0,2,18,12],k:[16,20,24,20,18],l:[8,8,8,8,6],
  m:[0,10,21,17,17],n:[0,28,18,18,18],o:[0,12,18,18,12],p:[0,28,18,28,16],q:[0,14,18,14,2],r:[0,14,16,16,16],
  s:[0,6,8,4,24],t:[8,8,14,8,6],u:[0,18,18,18,14],v:[0,17,17,10,4],w:[0,17,21,21,10],x:[0,18,12,12,18],
  y:[0,17,10,4,24],z:[0,30,4,8,30],
  ' ':[0,0,0,0,0],'!':[8,8,8,0,8],'?':[14,17,6,0,4],'.':[0,0,0,0,8],',':[0,0,0,8,16],'-':[0,0,14,0,0],
  '+':[0,4,14,4,0],'=':[0,14,0,14,0],':':[0,8,0,8,0],"'":[8,8,0,0,0],'"':[10,10,0,0,0],'(':[4,8,8,8,4],
  ')':[8,4,4,4,8],'/':[1,2,4,8,16],'*':[0,10,4,10,0],'%':[25,26,4,11,19],'<':[2,4,8,4,2],'>':[8,4,2,4,8],
  '#':[10,31,10,31,10],'_':[0,0,0,0,31]
};
L.ICONS = {
  Heart:'0101011111111110111000100', SmallHeart:'0000001010011100010000000', Yes:'0000000001000101010001000',
  No:'1000101010001000101010001', Happy:'0000001010000001000101110', Sad:'0000001010000000111010001',
  Confused:'0000001010000000101010101', Angry:'1000101010000001111110101', Asleep:'0000011011000000111000000',
  Surprised:'0101000000001000101000100', Silly:'1000100000111110001100011', Fabulous:'1111111011000000101001110',
  Meh:'1101100000000100010001000', TShirt:'1101111111011100111001110', Square:'1111110001100011000111111',
  SmallSquare:'0000001110010100111000000', Diamond:'0010001010100010101000100', SmallDiamond:'0000000100010100010000000',
  Target:'0010001110110110111000100', Ghost:'1111110101111111111110101', Skull:'0111010101111110111001110',
  Rabbit:'1010010100111101101011110', Duck:'0110011100011110111000000', House:'0010001110111110111001010',
  Butterfly:'1101111111001001111111011', Umbrella:'0111011111001001010001100', EighthNote:'0010000110001011110011100',
  Giraffe:'1100001000010000111001010', Sword:'0010000100001000111000100', Snake:'1100011011010100111000000'
};
L.ICON_LABELS = { SmallHeart: 'small heart', TShirt: 't-shirt', SmallSquare: 'small square', SmallDiamond: 'small diamond', EighthNote: 'eighth note' };
L.ARROWS = {
  North:'0010001110101010010000100', NorthEast:'0011100011001010100010000', East:'0010000010111110001000100',
  SouthEast:'1000001000001010001100111', South:'0010000100101010111000100', SouthWest:'0000100010101001100011100',
  West:'0010001000111110100000100', NorthWest:'1110011000101000001000001'
};
L.NOTES = [['Middle C','C',262],['Middle C#','CSharp',277],['Middle D','D',294],['Middle Eb','Eb',311],['Middle E','E',330],['Middle F','F',349],
  ['Middle F#','FSharp',370],['Middle G','G',392],['Middle G#','GSharp',415],['Middle A','A',440],['Middle Bb','Bb',466],['Middle B','B',494],
  ['High C','C5',523],['High D','D5',587],['High E','E5',659],['High F','F5',698],['High G','G5',784],['High A','A5',880],['High B','B5',988],
  ['Low C','C3',131],['Low E','E3',165],['Low G','G3',196],['Low A','A3',220]];
L.BEATS = [['1','Whole',1],['1/2','Half',.5],['1/4','Quarter',.25],['1/8','Eighth',.125],['1/16','Sixteenth',.0625],['2','Double',2],['4','Breve',4]];
L.COLORS = [['red','0xff0000'],['orange','0xffa500'],['yellow','0xffff00'],['green','0x00ff00'],['blue','0x0000ff'],['indigo','0x4b0082'],['violet','0x8a2be2'],['purple','0xff00ff'],['white','0xffffff'],['off (black)','0x000000']];
// NeoPixel colours from the pxt-neopixel extension that the Cutebot extension depends on
L.NP_COLORS = [['red','Red',0xFF0000],['orange','Orange',0xFFA500],['yellow','Yellow',0xFFFF00],['green','Green',0x00FF00],['blue','Blue',0x0000FF],
  ['indigo','Indigo',0x4b0082],['violet','Violet',0x8a2be2],['purple','Purple',0xFF00FF],['white','White',0xFFFFFF],['black','Black',0x000000]];
// IR remote codes, from cuteBot.IRButtons
L.IR_BUTTONS = [['Off',1,'⏻'],['Menu',2,'Menu'],['Up',5,'▲'],['Left',8,'◀'],['OK',9,'OK'],['Right',10,'▶'],['Down',13,'▼'],['Plus',4,'+'],['Back',6,'↩'],['Minus',12,'−'],
  ['Zero',14,'0'],['One',16,'1'],['Two',17,'2'],['Three',18,'3'],['Four',20,'4'],['Five',21,'5'],['Six',22,'6'],['Seven',24,'7'],['Eight',25,'8'],['Nine',26,'9']];

L.$ = (id) => document.getElementById(id);
L.esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
L.hooks = {};
L.on = (name, fn) => (L.hooks[name] ||= []).push(fn);
L.emit = (name, ...a) => (L.hooks[name] || []).forEach(f => { try { f(...a); } catch (e) { console.error(e); } });
})();
