/**
 * Grundopskrifter — det Skagenfood pakker i kassen, som Netto ikke sælger.
 *
 * Skagenfoods opskrifter siger "tilsæt mørbradgryde", fordi mørbradgryden
 * ligger færdig i deres kasse. Handler man i Netto, findes den ikke, og
 * indkøbslisten bad om en vare der ikke er til at købe.
 *
 * Her står de som det de er: enten en ret man selv laver, eller en vare
 * man køber færdig.
 *
 * MÆNGDERNE ER PR. PERSON. Indkøbslisten ganger med dagens portionsantal,
 * præcis som med alt andet.
 *
 * Det her er almindelige danske og internationale hverdagsretter --
 * mørbradgryde, millionbøf, bolognese. De er skrevet som man laver dem,
 * ikke som et forsøg på at ramme Skagenfoods egen sammensætning.
 */


export interface GrundIngrediens {
  navn: string;
  /** Pr. person. Indkøbslisten skalerer selv. */
  mængde: number;
  enhed: string;
}

export interface Grundopskrift {
  /** Matcher ingrediensnavnet fra Skagenfood, normaliseret. */
  navn: string;
  visningsnavn: string;
  /**
   * Hvor varen står i Netto, når den købes færdig.
   *
   * Uden det her havnede bechamelsovs under Kolonial, mens noten sagde
   * "findes på køl" -- to modsatte anvisninger i samme række, og man leder
   * det forkerte sted.
   */
  zone?: string;
  /**
   * "lav-selv"  -- foldes ud til rigtige varer på indkøbslisten
   * "køb-færdig" -- findes i Netto; står som den er, men med en note
   */
  slags: "lav-selv" | "køb-færdig";
  note?: string;
  ingredienser: GrundIngrediens[];
  fremgangsmåde: string[];
}

export const GRUNDOPSKRIFTER: Grundopskrift[] = [
  {
    navn: "mørbradgryde",
    visningsnavn: "Mørbradgryde",
    slags: "lav-selv",
    ingredienser: [
      { navn: "svinemørbrad", mængde: 150, enhed: "g" },
      { navn: "champignon", mængde: 75, enhed: "g" },
      { navn: "løg", mængde: 0.5, enhed: "stk" },
      { navn: "fløde 9%", mængde: 0.75, enhed: "dl" },
      { navn: "bouillon", mængde: 0.5, enhed: "dl" },
      { navn: "dijon sennep", mængde: 1, enhed: "tsk" },
    ],
    fremgangsmåde: [
      "Skær mørbraden i skiver på en god centimeter. Krydr med salt og peber.",
      "Brun kødet hårdt på en varm pande i olie, ca. 2 minutter på hver side. Tag det op.",
      "Svits løg og champignon i samme pande, til væden er kogt væk.",
      "Tilsæt fløde, bouillon og sennep. Lad det koge ind i 5-8 minutter.",
      "Læg kødet tilbage og lad det trække med i 2 minutter. Smag til.",
    ],
  },
  {
    navn: "skinkegryde",
    visningsnavn: "Skinkegryde",
    slags: "lav-selv",
    ingredienser: [
      { navn: "skinkekød i tern", mængde: 150, enhed: "g" },
      { navn: "porre", mængde: 0.5, enhed: "stk" },
      { navn: "champignon", mængde: 60, enhed: "g" },
      { navn: "fløde 9%", mængde: 0.75, enhed: "dl" },
      { navn: "bouillon", mængde: 0.5, enhed: "dl" },
      { navn: "tomatpuré", mængde: 1, enhed: "spsk" },
    ],
    fremgangsmåde: [
      "Brun skinketernene på en varm pande.",
      "Tilsæt porre i skiver og champignon i kvarte. Svits med i 4-5 minutter.",
      "Rør tomatpuré i og lad den stege et halvt minut — det tager den syrlige kant.",
      "Hæld fløde og bouillon ved, og lad gryden koge ind i 10 minutter.",
      "Smag til med salt, peber og evt. et nip paprika.",
    ],
  },
  {
    navn: "millionbøf",
    visningsnavn: "Millionbøf",
    slags: "lav-selv",
    ingredienser: [
      { navn: "hakket oksekød", mængde: 150, enhed: "g" },
      { navn: "løg", mængde: 0.5, enhed: "stk" },
      { navn: "bouillon", mængde: 1.5, enhed: "dl" },
      { navn: "hvedemel", mængde: 1, enhed: "spsk" },
      { navn: "soja", mængde: 1, enhed: "tsk" },
    ],
    fremgangsmåde: [
      "Brun oksekødet godt igennem på en varm pande — lad det få farve, ikke bare blive gråt.",
      "Tilsæt hakket løg og svits med i 3 minutter.",
      "Drys melet over og rør rundt, så det suger fedtet.",
      "Hæld bouillon ved lidt ad gangen under omrøring. Lad det simre 10 minutter.",
      "Smag til med soja, salt og peber. Sovsen skal være tyk, ikke tynd.",
    ],
  },
  {
    navn: "kødboller i tomatsauce",
    visningsnavn: "Kødboller i tomatsauce",
    slags: "lav-selv",
    ingredienser: [
      { navn: "hakket oksekød", mængde: 125, enhed: "g" },
      { navn: "æg", mængde: 0.25, enhed: "stk" },
      { navn: "rasp", mængde: 1, enhed: "spsk" },
      { navn: "hakkede tomater", mængde: 200, enhed: "g" },
      { navn: "løg", mængde: 0.5, enhed: "stk" },
      { navn: "hvidløg", mængde: 1, enhed: "fed" },
      { navn: "tørret oregano", mængde: 0.5, enhed: "tsk" },
    ],
    fremgangsmåde: [
      "Rør kødet med æg, rasp, salt og peber. Lad det hvile 10 minutter, så rasp'en suger.",
      "Form boller på størrelse med en valnød og brun dem rundt om på en pande.",
      "Tag bollerne op. Svits løg og hvidløg i samme pande.",
      "Tilsæt de hakkede tomater og oregano, og lad saucen koge 10 minutter.",
      "Læg bollerne tilbage og lad dem simre med i 10 minutter. Smag til.",
    ],
  },
  {
    navn: "marokkanske kødboller",
    visningsnavn: "Marokkanske kødboller",
    slags: "lav-selv",
    ingredienser: [
      { navn: "hakket oksekød", mængde: 125, enhed: "g" },
      { navn: "æg", mængde: 0.25, enhed: "stk" },
      { navn: "rasp", mængde: 1, enhed: "spsk" },
      { navn: "spidskommen", mængde: 0.5, enhed: "tsk" },
      { navn: "stødt koriander", mængde: 0.5, enhed: "tsk" },
      { navn: "kanel", mængde: 0.25, enhed: "tsk" },
      { navn: "frisk persille", mængde: 0.25, enhed: "bundt" },
    ],
    fremgangsmåde: [
      "Rør kødet med æg, rasp, krydderier og finthakket persille.",
      "Smag farsen til med salt — steg en lille prøve på panden først.",
      "Form små boller og brun dem rundt om, 6-8 minutter i alt.",
      "De skal være gennemstegte, men ikke tørre. Tag dem af, mens de stadig giver efter.",
    ],
  },
  {
    navn: "spanske albondigas kødboller",
    visningsnavn: "Albondigas",
    slags: "lav-selv",
    ingredienser: [
      { navn: "hakket oksekød", mængde: 125, enhed: "g" },
      { navn: "æg", mængde: 0.25, enhed: "stk" },
      { navn: "rasp", mængde: 1, enhed: "spsk" },
      { navn: "hvidløg", mængde: 1, enhed: "fed" },
      { navn: "røget paprika", mængde: 0.5, enhed: "tsk" },
      { navn: "frisk persille", mængde: 0.25, enhed: "bundt" },
    ],
    fremgangsmåde: [
      "Rør kødet med æg, rasp, presset hvidløg, paprika og hakket persille.",
      "Form små boller — albondigas er mindre end danske frikadeller.",
      "Brun dem i olivenolie rundt om, 6-8 minutter.",
      "Server dem med det samme, eller lad dem trække i en tomatsauce.",
    ],
  },
  {
    navn: "ungarske kødboller i cremet paprikasovs",
    visningsnavn: "Ungarske kødboller i paprikasovs",
    slags: "lav-selv",
    ingredienser: [
      { navn: "hakket oksekød", mængde: 125, enhed: "g" },
      { navn: "æg", mængde: 0.25, enhed: "stk" },
      { navn: "rasp", mængde: 1, enhed: "spsk" },
      { navn: "løg", mængde: 0.5, enhed: "stk" },
      { navn: "røget paprika", mængde: 1, enhed: "tsk" },
      { navn: "creme fraiche 18%", mængde: 0.5, enhed: "dl" },
      { navn: "bouillon", mængde: 1, enhed: "dl" },
    ],
    fremgangsmåde: [
      "Rør farsen med æg, rasp, salt og peber. Form boller og brun dem. Tag dem op.",
      "Svits hakket løg blødt i samme pande.",
      "Tilsæt paprika og rør et halvt minut — den må ikke brænde, så bliver den bitter.",
      "Hæld bouillon ved og lad det koge ind til det halve.",
      "Rør creme fraiche i UDEN at koge videre, læg bollerne tilbage og lad dem trække.",
    ],
  },
  {
    navn: "ragù bolognese",
    visningsnavn: "Ragù bolognese",
    slags: "lav-selv",
    ingredienser: [
      { navn: "hakket oksekød", mængde: 125, enhed: "g" },
      { navn: "gulerod", mængde: 0.5, enhed: "stk" },
      { navn: "bladselleri", mængde: 0.5, enhed: "stængel" },
      { navn: "løg", mængde: 0.5, enhed: "stk" },
      { navn: "hakkede tomater", mængde: 200, enhed: "g" },
      { navn: "tomatpuré", mængde: 1, enhed: "spsk" },
      { navn: "mælk", mængde: 0.5, enhed: "dl" },
    ],
    fremgangsmåde: [
      "Hak gulerod, selleri og løg meget fint og svits det blødt i olie — 8-10 minutter, uden farve.",
      "Tilsæt kødet og brun det godt igennem.",
      "Rør tomatpuré i og lad den stege et minut.",
      "Hæld mælken ved og lad den koge helt ind. Det er det, der gør ragùen mild.",
      "Tilsæt tomaterne og lad det simre mindst 45 minutter ved svag varme. Længere er bedre.",
    ],
  },
  {
    navn: "chicken tikka masala",
    visningsnavn: "Chicken tikka masala",
    slags: "lav-selv",
    ingredienser: [
      { navn: "kyllingebryst", mængde: 150, enhed: "g" },
      { navn: "yoghurt naturel", mængde: 0.5, enhed: "dl" },
      { navn: "tikka curry paste", mængde: 1, enhed: "spsk" },
      { navn: "hakkede tomater", mængde: 150, enhed: "g" },
      { navn: "fløde 38%", mængde: 0.5, enhed: "dl" },
      { navn: "løg", mængde: 0.5, enhed: "stk" },
      { navn: "hvidløg", mængde: 1, enhed: "fed" },
      { navn: "ingefær", mængde: 5, enhed: "g" },
    ],
    fremgangsmåde: [
      "Skær kyllingen i tern og vend den i yoghurt og halvdelen af tikka-pastaen. Lad den marinere mindst 30 minutter.",
      "Steg kyllingen på en meget varm pande, til den får mørke pletter. Tag den op.",
      "Svits løg, hvidløg og revet ingefær blødt.",
      "Tilsæt resten af pastaen og de hakkede tomater. Lad saucen koge 10 minutter.",
      "Rør fløden i, læg kyllingen tilbage og lad den simre med i 5 minutter.",
    ],
  },
  {
    navn: "chicken korma",
    visningsnavn: "Chicken korma",
    slags: "lav-selv",
    ingredienser: [
      { navn: "kyllingebryst", mængde: 150, enhed: "g" },
      { navn: "løg", mængde: 0.5, enhed: "stk" },
      { navn: "hvidløg", mængde: 1, enhed: "fed" },
      { navn: "kokosmælk", mængde: 1, enhed: "dl" },
      { navn: "mandler", mængde: 15, enhed: "g" },
      { navn: "garam masala", mængde: 1, enhed: "tsk" },
      { navn: "gurkemeje", mængde: 0.5, enhed: "tsk" },
    ],
    fremgangsmåde: [
      "Svits løg og hvidløg blødt uden at tage farve — korma skal være lys.",
      "Tilsæt krydderierne og rør et halvt minut.",
      "Læg kyllingen i tern i og vend den rundt.",
      "Hæld kokosmælk og fintkværnede mandler ved. Lad det simre 15 minutter ved svag varme.",
      "Smag til med salt og en smule sukker. Saucen skal være mild og tyk.",
    ],
  },
  {
    navn: "marokkansk tagine",
    visningsnavn: "Marokkansk tagine",
    slags: "lav-selv",
    ingredienser: [
      { navn: "kyllingelår", mængde: 175, enhed: "g" },
      { navn: "løg", mængde: 0.5, enhed: "stk" },
      { navn: "gulerod", mængde: 1, enhed: "stk" },
      { navn: "kikærter", mængde: 75, enhed: "g" },
      { navn: "tørrede abrikoser", mængde: 25, enhed: "g" },
      { navn: "ras el hanout", mængde: 1, enhed: "tsk" },
      { navn: "bouillon", mængde: 1.5, enhed: "dl" },
    ],
    fremgangsmåde: [
      "Brun kødet rundt om i en tykbundet gryde. Tag det op.",
      "Svits løg og gulerod i skiver, og rør krydderiet i.",
      "Læg kødet tilbage sammen med kikærter, abrikoser og bouillon.",
      "Læg låg på og lad det simre mindst 40 minutter ved svag varme.",
      "Smag til. Væden skal være sirupagtig, ikke suppeagtig — tag låget af de sidste 10 minutter hvis den er for tynd.",
    ],
  },
  {
    navn: "høns i asparges",
    visningsnavn: "Høns i asparges",
    slags: "lav-selv",
    ingredienser: [
      { navn: "kyllingebryst", mængde: 100, enhed: "g" },
      { navn: "hvide asparges fra glas", mængde: 75, enhed: "g" },
      { navn: "smør", mængde: 15, enhed: "g" },
      { navn: "hvedemel", mængde: 15, enhed: "g" },
      { navn: "hønsebouillon", mængde: 1.5, enhed: "dl" },
      { navn: "fløde 38%", mængde: 0.5, enhed: "dl" },
    ],
    fremgangsmåde: [
      "Kog kyllingen møre i letsaltet vand, ca. 12 minutter. Lad den køle lidt og pluk den i mundrette stykker.",
      "Smelt smørret, rør melet i og lad det boble et minut uden at tage farve.",
      "Pisk bouillon og aspargeslage i lidt ad gangen — det er lagen der giver smagen.",
      "Lad sovsen koge 5 minutter, og rør så fløden i.",
      "Vend kylling og asparges i. Varm det igennem uden at koge, så aspargesene ikke går i stykker.",
    ],
  },
  {
    navn: "tarteletfyld med høns i asparges",
    visningsnavn: "Tarteletfyld: høns i asparges",
    slags: "lav-selv",
    ingredienser: [
      { navn: "kyllingebryst", mængde: 100, enhed: "g" },
      { navn: "hvide asparges fra glas", mængde: 75, enhed: "g" },
      { navn: "smør", mængde: 15, enhed: "g" },
      { navn: "hvedemel", mængde: 15, enhed: "g" },
      { navn: "hønsebouillon", mængde: 1.5, enhed: "dl" },
      { navn: "fløde 38%", mængde: 0.5, enhed: "dl" },
    ],
    fremgangsmåde: [
      "Samme fremgangsmåde som høns i asparges — fyldet er det samme.",
      "Lav sovsen lidt tykkere end du ellers ville. Den skal blive i tartelettten, ikke løbe ud på tallerkenen.",
      "Varm tartelettterne 5 minutter ved 180 grader, mens fyldet varmer. De skal være sprøde, når fyldet kommer i.",
    ],
  },
  {
    navn: "shivid polo",
    visningsnavn: "Shivid polo (persisk dildris)",
    slags: "lav-selv",
    ingredienser: [
      { navn: "basmatiris", mængde: 75, enhed: "g" },
      { navn: "dild", mængde: 0.5, enhed: "bundt" },
      { navn: "smør", mængde: 15, enhed: "g" },
      { navn: "kardemomme", mængde: 0.25, enhed: "tsk" },
    ],
    fremgangsmåde: [
      "Skyl risene i koldt vand, til vandet er klart. Det er det, der gør kornene løse.",
      "Kog dem 6-7 minutter i rigeligt saltet vand — de skal stadig have bid. Hæld vandet fra.",
      "Vend groft hakket dild og kardemomme i.",
      "Smelt smørret i bunden af gryden, læg risene tilbage, læg et viskestykke under låget og damp dem færdige ved meget svag varme i 20 minutter.",
    ],
  },
  {
    navn: "dunsen dilddellen",
    visningsnavn: "Dilddeller",
    slags: "lav-selv",
    ingredienser: [
      { navn: "torskefilet uden skind", mængde: 150, enhed: "g" },
      { navn: "æg", mængde: 0.25, enhed: "stk" },
      { navn: "hvedemel", mængde: 1, enhed: "spsk" },
      { navn: "dild", mængde: 0.25, enhed: "bundt" },
      { navn: "citron", mængde: 0.25, enhed: "stk" },
    ],
    fremgangsmåde: [
      "Blend fisken kort med salt — kun til den hænger sammen, ellers bliver farsen sej.",
      "Rør æg, mel, hakket dild og revet citronskal i.",
      "Lad farsen hvile 15 minutter på køl.",
      "Form deller med en ske og steg dem i smør, 3-4 minutter på hver side ved middel varme.",
    ],
  },

  /* --- Dem man køber færdige ------------------------------------------- */

  {
    navn: "bechamelsovs",
    visningsnavn: "Bechamelsovs",
    slags: "køb-færdig",
    zone: "Køl",
    note: "Findes på køl i Netto. Vil du lave den selv: 25 g smør, 25 g mel og 2,5 dl mælk pr. person.",
    ingredienser: [],
    fremgangsmåde: [
      "Smelt smørret, rør melet i og lad det boble et minut uden farve.",
      "Pisk mælken i lidt ad gangen, så der ikke kommer klumper.",
      "Lad sovsen koge 5-8 minutter. Smag til med salt, peber og revet muskatnød.",
    ],
  },
  {
    navn: "skysovs",
    visningsnavn: "Skysovs",
    slags: "køb-færdig",
    note: "Findes som pulver eller færdig i Netto. Har du stegesky, er den bedre.",
    ingredienser: [],
    fremgangsmåde: [
      "Hæld stegeskyen fra panden i en gryde og skum fedtet af.",
      "Jævn med en smule majsstivelse rørt ud i koldt vand.",
      "Smag til med salt, peber og et par dråber kulør.",
    ],
  },
  {
    navn: "skagenfood frikadeller",
    visningsnavn: "Frikadeller",
    slags: "køb-færdig",
    zone: "Kød & fjerkræ",
    note: "Færdige frikadeller findes på køl. Vil du lave dem selv: 125 g hakket svin/kalv, ¼ æg, 1 spsk rasp og ½ løg pr. person.",
    ingredienser: [],
    fremgangsmåde: [
      "Rør farsen med æg, rasp, revet løg, salt og peber. Lad den hvile 15 minutter.",
      "Form deller med en ske dyppet i vand.",
      "Steg dem i smør ved middel varme, 5 minutter på hver side.",
    ],
  },
  {
    navn: "skagenfood fiskefrikadeller",
    visningsnavn: "Fiskefrikadeller",
    slags: "køb-færdig",
    zone: "Fisk",
    note: "Færdige fiskefrikadeller findes på køl. Vil du lave dem selv: 150 g torskefilet, ¼ æg og 1 spsk mel pr. person.",
    ingredienser: [],
    fremgangsmåde: [
      "Blend fisken kort med salt, til farsen hænger sammen.",
      "Rør æg, mel og evt. hakket dild i, og lad farsen hvile på køl.",
      "Steg dellerne i smør, 3-4 minutter på hver side.",
    ],
  },
];
