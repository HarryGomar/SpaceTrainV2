// Interpretive notes are frozen into a question definition, never into work.note.
export const SYMBOLISM_CONTENT_REVISION = 'symbolism-notes-20261115-v1';

const sources = {
  hope: {id:'tate-hope',publisher:'Tate Britain',title:'Hope',url:'https://artsandculture.google.com/asset/hope-george-frederic-watts/CgGv3RqPFUZk4A?hl=en',kind:'museum-authored-collection-entry'},
  ambassadors: {id:'ng-ambassadors',publisher:'The National Gallery',title:'The Ambassadors, Susan Foister, 2024',url:'https://www.nationalgallery.org.uk/paintings/catalogues/foister-2024/the-ambassadors',kind:'museum-catalogue'},
  tara: {id:'cma-tara',publisher:'Cleveland Museum of Art',title:'Green Tara, 1970.156',url:'https://www.clevelandart.org/print/art/1970.156',kind:'museum-collection-entry'},
  bosch: {id:'prado-garden',publisher:'American Friends of the Prado Museum',title:'The Garden of Earthly Delights: picture history',url:'https://www.afpradomuseum.org/the-garden-of-earthly-delights-bosch/history',kind:'museum-affiliate-interpretation'},
  catrina: {id:'inah-catrina',publisher:'Secretaría de Cultura / INAH',title:'Las historias falsas que se leen de la Catrina de José Guadalupe Posada',url:'https://www.gob.mx/cultura/prensa/las-historias-falsas-que-se-leen-de-la-catrina-de-jose-guadalupe-posada-en-relatos-e-historias-de-mexico',kind:'official-research-summary'},
  varo: {id:'mam-birds',publisher:'Museo de Arte Moderno / INBAL',title:'Mujeres en la modernidad',url:'https://inba.gob.mx/prensa/17510/el-museo-de-arte-moderno-reune-tres-exposiciones-en-mujeres-en-la-modernidad',kind:'museum-curatorial-interpretation'},
  venus: {id:'uffizi-venus',publisher:'Uffizi Galleries',title:'Birth of Venus, Daniela Parenti',url:'https://www.uffizi.it/en/artworks/birth-of-venus',kind:'museum-collection-entry'},
  ophelia: {id:'tate-ophelia',publisher:'Tate Britain',title:'Ophelia',url:'https://artsandculture.google.com/asset/ophelia-0123/-wGU6cT4JixtPA',kind:'museum-authored-collection-entry'},
  pearl: {id:'mauritshuis-pearl',publisher:'Mauritshuis',title:'Girl with a Pearl Earring, inventory 670',url:'https://www.mauritshuis.nl/en/our-collection/artworks/670-girl-with-a-pearl-earring',kind:'museum-collection-entry'},
  harmony: {id:'malba-harmony',publisher:'MALBA',title:'Harmony (Suggestive Self-Portrait)',url:'https://artsandculture.google.com/asset/harmony-suggestive-self-portrait-remedios-varo/NQGzTK03j7FCXQ',kind:'museum-authored-collection-entry'}
};
const claim = (id,text,status,source) => ({id,text,status,sourceUrls:[source.url]});
const entry = (id,workId,title,text,source,claims,interpretationLimit) => ({id,workId,revision:SYMBOLISM_CONTENT_REVISION,title,text,sourceUrls:[source.url],sources:[source],claims,interpretationLimit});

export const SYMBOLISM_CONTENT_BANK = [
  entry('hope-last-string','add-watts-hope','The remaining string',
    'The blindfolded figure sits on a globe with just one intact lyre string. Watts described hope as the music still possible from that string, rather than the expectation of a good outcome. Some early critics instead saw despair.',sources.hope,[
      claim('globe-and-string','A blindfolded figure sits on a globe and plays a lyre with one intact string.','visible-detail',sources.hope),
      claim('watts-account','Tate reports Watts’s account of hope as the music possible from the remaining string.','artist-account-reported-by-museum',sources.hope),
      claim('early-reception','Some early critics read the image as despair.','historical-reception',sources.hope)
    ],'The artist’s account and the recorded early reception differ. The note does not prescribe an optimistic response.'),
  entry('ambassadors-skull','holbein-ambassadors','A second viewpoint',
    'The stretched object across the floor is a skull. Seen from a sharp angle at the right, it resolves into a recognisable form. The National Gallery reads this reminder of death alongside the men’s learning and worldly accomplishments.',sources.ambassadors,[
      claim('anamorphic-skull','The distorted skull resolves when viewed obliquely from the right.','visible-detail',sources.ambassadors),
      claim('mortality-and-achievement','The catalogue connects the skull with mortality beside the men’s accomplishments.','museum-interpretation',sources.ambassadors)
    ],'The skull is identifiable; the complete symbolic programme remains open to interpretation. A small screen does not reproduce the original viewing position.'),
  entry('tara-protection','green-tara','A protective image',
    'The tiny monk beneath Tara’s right hand commissioned this painting. In the Cleveland Museum’s account, her green colour and gesture connect her with protection from fear. A mantra on the back also expresses that protective purpose: the image was made for devotional use.',sources.tara,[
      claim('commissioner','The small monastic figure beneath Tara’s right hand commissioned the painting.','historical-context',sources.tara),
      claim('protective-colour-and-gesture','The museum links Tara’s colour, gesture and the mantra on the reverse with protection from fear.','museum-interpretation',sources.tara)
    ],'This describes a particular Tibetan Buddhist devotional context. It does not assume the viewer shares its beliefs or experiences the promised protection.'),
  entry('garden-fragile-pleasures','bosch-garden-delights','Pleasure between two panels',
    'The central garden sits between Eden and Hell. A Prado interpretation reads its oversized fruit and fleeting flowers as signs of fragile, short-lived pleasure. The transparent sphere around one couple may make a similar point: happiness can break like glass.',sources.bosch,[
      claim('eden-and-hell','The open triptych places the garden between Eden and Hell.','visible-detail',sources.bosch),
      claim('fragile-pleasure','The museum-affiliated interpretation connects fruit and flowers with fleeting earthly pleasure.','museum-interpretation',sources.bosch),
      claim('glass-sphere','The sphere may allude to the fragility of happiness.','qualified-museum-interpretation',sources.bosch)
    ],'This is a published curatorial reading, not a settled decoding of every figure or a documented statement by Bosch.'),
  entry('catrina-later-name','study-posada-catrina','How a symbol acquired a name',
    'This hat-wearing skull was first printed in 1913, after Posada’s death. INAH’s research summary traces the name “Calavera catrina” to a 1930 collection that separated the image from its original printed context. Its familiar identity as a national symbol developed later.',sources.catrina,[
      claim('posthumous-print','The first documented printing was in October 1913, after Posada’s death.','historical-context',sources.catrina),
      claim('name-in-1930','A 1930 compilation printed the isolated image with the name Calavera catrina.','historical-context',sources.catrina),
      claim('later-cultural-symbol','Its status as a Mexican cultural symbol developed after its first printing.','historical-reception',sources.catrina)
    ],'Later naming and national symbolism are distinct from an intention documented by Posada. Familiar stories about a single political target are not presented as established fact.'),
  entry('varo-female-creator','add-varo-creation-of-the-birds','Who is doing the creating?',
    'The owl-like maker combines a human body with a bird’s head. Discussing the painting’s preparatory drawing, the Museo de Arte Moderno reads this as a female figure of wisdom and creation, taking on capacities often assigned to men.',sources.varo,[
      claim('owl-human-maker','The principal figure is an owl-human hybrid.','visible-detail',sources.varo),
      claim('female-wisdom-and-creation','The museum interprets the figure as a female embodiment of wisdom and creation.','museum-interpretation',sources.varo)
    ],'The cited museum discussion concerns the preparatory drawing for the painting. Its gendered interpretation is attributed to the museum, not quoted as Varo’s own explanation.'),
  entry('venus-spring-arrival','study-botticelli-birth-venus','An arrival in spring',
    'Despite the title, this is Venus arriving on land after her birth. The Uffizi connects the wind-blown roses and flower-covered cloak with spring. The woman waiting with the cloak may be a Grace or the Hora of spring: even this familiar scene retains an uncertain identity.',sources.venus,[
      claim('arrival','The scene shows Venus arriving on Cyprus rather than the moment of her birth.','museum-interpretation',sources.venus),
      claim('spring-flowers','The museum associates the roses and flower-covered cloak with spring.','museum-interpretation',sources.venus),
      claim('attendant-identity','The attendant is variously identified as a Grace or the Hora of spring.','qualified-museum-interpretation',sources.venus)
    ],'The note keeps the attendant’s identity uncertain. It does not present a documented Medici commission or a single philosophical programme as established fact.'),
  entry('ophelia-flowers','millais-ophelia','Flowers carrying a second meaning',
    'The flowers are more than riverbank detail. In Tate’s reading, the poppy stands for death, the daisies for innocence and the pansies for love in vain. They surround Ophelia from Shakespeare’s Hamlet, turning the lush natural setting into part of the tragedy.',sources.ophelia,[
      claim('literary-subject','The figure is Ophelia from Shakespeare’s Hamlet.','historical-context',sources.ophelia),
      claim('flower-symbols','Tate identifies poppy, daisies and pansies with death, innocence and love in vain.','museum-interpretation',sources.ophelia)
    ],'These are Tate’s identifications within this painting’s literary context, not universal meanings for those flowers or a diagnosis of Ophelia.'),
  entry('pearl-painted-fiction','study-vermeer-pearl','A character made from paint',
    'The Mauritshuis identifies this as a tronie: a study of an imagined character, rather than an identified portrait. The improbably large pearl is also an illusion made with two touches of white paint. The museum suggests it could represent imitation jewellery, or something Vermeer invented.',sources.pearl,[
      claim('tronie','The museum classifies the work as a tronie, not an identified individual portrait.','museum-interpretation',sources.pearl),
      claim('painted-pearl','The pearl is formed from a highlight and a reflected collar, without a painted hook.','visible-detail',sources.pearl),
      claim('jewel-uncertainty','The museum allows imitation jewellery or invention as possible explanations for the pearl.','qualified-museum-interpretation',sources.pearl)
    ],'No identity, love affair or personal story is assigned to the model. This is a reveal about representation and making rather than a decoded allegory.'),
  entry('varo-harmony-thread','add-varo-harmony','Finding a connection',
    'The figure threads leaves, crystals and other objects onto a three-dimensional musical stave. Varo described the task as searching for an invisible connection among all things. Figures emerging from the walls help with the work: making music becomes a way of bringing unlike elements together.',sources.harmony,[
      claim('objects-on-stave','The figure places natural objects and crystal forms on a three-dimensional musical stave.','visible-detail',sources.harmony),
      claim('varos-account','MALBA reports Varo’s description of the figure searching for a connection uniting all things.','artist-account-reported-by-museum',sources.harmony),
      claim('wall-assistants','Two figures emerging from the walls assist the task.','visible-detail',sources.harmony)
    ],'The artist’s reported account describes a search for connection. It does not assign a fixed meaning to every object or demonstrate that nature follows a musical system.')
];

export function getSymbolismContent(contentId) {
  const content = SYMBOLISM_CONTENT_BANK.find(item => item.id === contentId);
  return content ? structuredClone(content) : null;
}
