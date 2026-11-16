/** Editorial descriptions of visible reproductions, not validated psychological scales. */
export const ARTWORK_ATTRIBUTE_VERSION='artwork-attributes-v1';
export const ARTWORK_ATTRIBUTE_DEFINITIONS=Object.freeze({
  'narrative-detail':{
    label:'Story clues',
    definition:'Secondary incidents, objects or relationships offer clues beyond the focal pose. A sparse symbolic composition can qualify.',
    excludes:'Visual busyness alone, a suggestive title alone, or the mere presence of a person.',
    absentReason:'No secondary incident, object or relationship is emphasised as a clue beyond the main motif.'
  },
  'imagined-world':{
    label:'Fantastical imagery',
    definition:'Visibly fantastical or physically uncanny bodies, objects or settings appear in the reproduction.',
    excludes:'Religious subject matter alone, unusual colour, expressive distortion alone, or a fantastical title without visible evidence.',
    absentReason:'No visibly impossible body, object or setting is depicted under this criterion.'
  },
  'dramatic-light':{
    label:'Dramatic lighting',
    definition:'Strong selective illumination and deep shadow materially stage the subject or setting.',
    excludes:'A dark palette alone, presumed mood, or ordinary diffuse daylight.',
    absentReason:'Selective illumination against deep shadow does not organise this reproduction.'
  },
  'layered-space':{
    label:'Layers of space',
    definition:'Distinct spatial stages, frames, mirrors, doorways or recessed compartments organise the view.',
    excludes:'Any overlap, every use of perspective, or abstract planes without a readable physical setting.',
    absentReason:'Distinct physical stages, frames or recessed compartments do not organise the view.'
  },
  'geometric-structure':{
    label:'Geometric structure',
    definition:'Salient regular shapes, straight divisions, grids or clearly shaped colour fields organise the composition.',
    excludes:'All abstraction, irregular gestural marks alone, an isolated triangular mountain, or ordinary room perspective.',
    absentReason:'Regular geometric shapes, a grid or clearly divided colour fields are not a dominant organising feature.'
  },
  'visible-gesture':{
    label:'Bodily gestures',
    definition:'Emphasised reaching, striking, guiding, embracing, carrying or other visible bodily action shapes the image. Quiet hand actions can qualify.',
    excludes:'Every posed figure, resting hands, weather, brushwork, or movement inferred only from a title.',
    absentReason:'No emphasised bodily action or active hand gesture shapes the main motif.'
  },
  'intimate-figures':{
    label:'Figures close up',
    definition:'A near-view foreground human figure or compact bodily group occupies a substantial part of the composition.',
    excludes:'A claim about tenderness, sympathy or the viewer\'s feelings, and broad crowds of small figures.',
    absentReason:'A close human figure or compact foreground bodily group does not occupy a substantial part of this view.'
  },
  landscape:{
    label:'Natural settings',
    definition:'Substantial recognisable terrain, water or vegetation organises the composition, including some figure scenes.',
    excludes:'A tiny natural strip or window view, isolated still-life flowers without a surrounding natural setting, a landscape title alone, or a claim about the viewer\'s love of nature.',
    absentReason:'Recognisable terrain, water or vegetation does not substantially organise the composition.'
  },
  'expressive-distortion':{
    label:'Expressive distortion',
    definition:'Recognisable bodies, objects or terrain are conspicuously elongated, bent, fragmented or altered in proportion or shape.',
    excludes:'Nonfigurative shapes with no recognisable referent, unusual colour alone, or a general movement label. A missing referent makes this unknown rather than naturalistic.',
    absentReason:'Recognisable forms are not conspicuously elongated, fragmented or altered in proportion under this criterion.'
  },
  'precise-rendering':{
    label:'Precise edges and detail',
    definition:'Sharply controlled contours or finely differentiated details are a dominant visible treatment. Clearly delineated graphic geometry can qualify.',
    excludes:'A judgement of artistic skill, photographic realism alone, or precision inferred from an artist\'s reputation.',
    absentReason:'Sharply controlled contours or finely differentiated detail do not dominate the visible treatment.'
  },
  'visible-paint-marks':{
    label:'Visible mark-making',
    definition:'Distinct brush strokes, dabs, drips or visibly drawn expressive marks remain conspicuous as marks in the reproduction.',
    excludes:'Cracking, scanning texture, woodblock outlines, all handmade work, or a technique inferred only from metadata.',
    absentReason:'Separate painterly strokes, dabs or drips are not conspicuous in this reproduction.'
  },
  'pattern-rhythm':{
    label:'Pattern and rhythm',
    definition:'Repeated motifs, shapes, divisions or directional marks create a conspicuous visual rhythm.',
    excludes:'Busyness alone, a generic triangular arrangement, or repetition assumed from a movement label.',
    absentReason:'A conspicuous repeated motif or directional rhythm does not organise this view.'
  },
  'human-relationships':{
    label:'Relationships between people',
    definition:'At least two visible people are connected by an emphasised exchange of gaze, touch, guidance, care, confrontation or coordinated action.',
    excludes:'People merely sharing a picture, a family relationship inferred from a title, or an assertion about the viewer\'s sociability.',
    absentReason:'No emphasised visible exchange or coordinated action connects two depicted people.'
  },
  'theatrical-staging':{
    label:'Theatrical staging',
    definition:'Curtains, stage-like framing, arranged display or emphatic presented action visibly organise a scene as a staged encounter.',
    excludes:'Dramatic subject matter or selective lighting alone, every group composition, and assumed theatrical intent.',
    absentReason:'Curtains, stage-like framing or an emphatic arranged display do not organise the scene.'
  },
  'material-detail':{
    label:'Tactile material detail',
    definition:'Differentiated fabric, metal, skin, food, plants or other depicted surfaces receive conspicuous local texture or fine description.',
    excludes:'Actual paint texture by itself, a claim that the viewer wants to touch an object, or material inferred only from the title.',
    absentReason:'Finely differentiated depicted material surfaces are not a conspicuous treatment in this reproduction.'
  },
  'open-expanse':{
    label:'Open expanses',
    definition:'Large relatively uninterrupted fields of sky, water, ground or colour leave substantial open space around or between motifs.',
    excludes:'A presumed calm feeling, every landscape, and a small empty background patch.',
    absentReason:'Large relatively uninterrupted open fields do not occupy a substantial part of the composition.'
  }
});

export const ARTWORK_ATTRIBUTE_STATUSES=Object.freeze(['present','absent','unknown']);
export const ARTWORK_ATTRIBUTE_LIMITS=Object.freeze([
  'These are nonexclusive editorial descriptions of particular reproductions, reviewed by an assistant. They are not independent human validation, scientific scores or measurements of a viewer\'s feelings.',
  'Only an explicit reviewed absent status supplies a negative observation. A missing review, mismatched source, unknown status or insufficient reproduction remains unknown.',
  'Visible descriptions and museum-documented meanings are separate. Missing documentation never establishes that a work has no symbolism.',
  'A shared attribute across several preferred or admired works is a descriptive pattern. It does not identify why the viewer chose them or a psychological cause.'
]);
