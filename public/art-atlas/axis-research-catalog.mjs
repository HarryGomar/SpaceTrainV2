// Research and design metadata only. These proposed instruments do not score users.
// Existing answers retain their original frozen question and instrument identity.
export const AXIS_RESEARCH_REVISION = 'axis-research-20261114-v1';

export const AXIS_RESEARCH_SOURCES = Object.freeze({
  ambiguity2009: 'https://pubmed.ncbi.nlm.nih.gov/19565431/',
  ambiguity2013: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0074084',
  fluency2010: 'https://www.experimental-psychology.de/ccc/docs/pubs/BelkeLederStrobachCarbon2010.pdf',
  appraisal2005: 'https://pubmed.ncbi.nlm.nih.gov/15755222/',
  effort2004: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1532566',
  effortReplication2023: 'https://doi.org/10.1525/collabra.87489',
  familiarity2021: 'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.694927/full',
  negativeEmotions2007: 'https://libres.uncg.edu/ir/uncg/f/P_Silvia_Anger_2007.pdf',
  artemis2021: 'https://openaccess.thecvf.com/content/CVPR2021/html/Achlioptas_ArtEmis_Affective_Language_for_Visual_Art_CVPR_2021_paper.html',
  artelingo2022: 'https://aclanthology.org/2022.emnlp-main.600/',
  stability2017: 'https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2017.00289/full',
  museumContext2014: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0099019',
  arrangement2012: 'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2012.00245/full',
  attributes2010: 'https://journals.sagepub.com/doi/10.2190/EM.28.2.f',
  appsPreprint2020: 'https://easychair.org/publications/preprint/rXZM',
  appsPublished: 'https://doi.org/10.1037/aca0000449',
  vaps2023: 'https://ucrisportal.univie.ac.at/en/publications/the-vienna-art-picture-system-vaps-a-dataset-of-999-paintings-and/',
  bradleyTerry1952: 'https://academic.oup.com/biomet/article-abstract/39/3-4/324/326091',
  hunter2004: 'https://doi.org/10.1214/aos/1079120141'
});

export const AXIS_RESEARCH_CATALOG = Object.freeze([
  {
    id: 'interpretive-openness', status: 'research-informed-proposal',
    title: 'What remains open',
    prompt: 'How many readings seem possible?',
    endpoints: ['One reading fits', 'Several readings fit'],
    outsideScale: ['I cannot find a reading yet'],
    interaction: 'interpretation-fork',
    companionMeasure: 'same-work liking or separately reported ease',
    existingEvidence: ['interpretive-openness with its original wording'],
    incompatibleEvidence: ['meaning.x amount of suggested meaning'],
    limits: ['Perceived openness is not a general tolerance-for-ambiguity trait.', 'New wording requires a new instrument identity.'],
    sources: ['ambiguity2009', 'ambiguity2013']
  },
  {
    id: 'interpretive-foothold', status: 'research-informed-proposal',
    title: 'Finding a way in',
    prompt: 'Do you have a way to read this painting?',
    endpoints: ['Nothing to go on yet', 'A clear way to read it'],
    outsideScale: ['I do not want to interpret it'],
    interaction: 'select-a-detail-then-revisit',
    companionMeasure: 'same-work openness and liking, collected separately',
    existingEvidence: ['connection.x reported understanding, under its original identity'],
    incompatibleEvidence: ['processing speed', 'correct interpretation', 'objective fluency'],
    limits: ['A selected detail is a reported foothold, not measured gaze or a causal explanation.'],
    sources: ['fluency2010', 'appraisal2005', 'ambiguity2013']
  },
  {
    id: 'context-liking-change', status: 'existing-measure-plus-proposed-extension',
    title: 'After the note',
    prompt: 'Rate how much you like the painting before and after reading.',
    informationOptions: ['How it was made', 'What is happening', 'When and why it was made'],
    interaction: 'one-information-ticket-and-paired-rating',
    companionMeasure: 'prospective context statement with frozen source identity',
    existingEvidence: ['preference-before-after-v1'],
    incompatibleEvidence: ['legacy more-or-less-curious context answer'],
    limits: ['Reading, repeated viewing, and elapsed time occur together.', 'A chosen note type is self-selection.', 'One work does not establish general context sensitivity.'],
    sources: ['fluency2010', 'museumContext2014']
  },
  {
    id: 'making-importance', status: 'research-informed-proposal',
    title: 'The making',
    prompt: 'How much does the way this was made matter to your response?',
    endpoints: ['Not a reason I value it', 'A major reason I value it'],
    interaction: 'choose-detail-or-whole-work-inspection',
    companionMeasure: 'separate liking, admiration, or perceived effort question',
    existingEvidence: ['attention-to-making reported attention, under its original identity'],
    incompatibleEvidence: ['actual skill', 'objective craftsmanship', 'physical material experience'],
    limits: ['A stated reason is not a recovered unconscious cause.', 'Effort replication findings vary by task and outcome.'],
    sources: ['effort2004', 'effortReplication2023', 'attributes2010']
  },
  {
    id: 'familiarity-and-selection', status: 'research-informed-proposal',
    title: 'Known and unfamiliar',
    prompt: 'Have you seen this exact image before today?',
    options: ['Yes', 'No', 'Unsure'],
    interaction: 'look-ticket-for-known-or-unfamiliar-work',
    companionMeasure: 'actual in-app exposure and original preference',
    existingEvidence: ['recorded in-app exposure where actually known'],
    incompatibleEvidence: ['artist or movement match as prior familiarity', 'general art expertise'],
    limits: ['Choices also reflect the content of the offered works.', 'No novelty-seeking personality inference.'],
    sources: ['familiarity2021', 'vaps2023']
  },
  {
    id: 'discomfort-and-staying', status: 'research-informed-proposal',
    title: 'Staying with discomfort',
    prompt: 'How uncomfortable is this to stay with?',
    endpoints: ['Nothing uncomfortable', 'Hard to sit with'],
    companionPrompt: 'Would you spend another minute with it?',
    companionEndpoints: ["I'd move on", "I'd stay"],
    interaction: 'stay-or-move-choice-after-discomfort-report',
    existingEvidence: [],
    incompatibleEvidence: ['response.x tension', 'response.y involvement', 'legacy pleasantness or activation'],
    limits: ['Willingness to stay is an intention unless an actual decision is recorded.', 'Discomfort is not low liking or evidence of sophistication.'],
    sources: ['negativeEmotions2007']
  },
  {
    id: 'story-and-resonance', status: 'research-informed-proposal',
    title: 'Story and personal connection',
    prompt: 'Can you imagine a before and after?',
    endpoints: ['No scene comes to mind', 'A scene comes to mind'],
    companionPrompt: 'Does it connect to something in your life?',
    companionEndpoints: ['No personal link', 'A specific memory or concern'],
    outsideScale: ['Unsure', 'Prefer not to say'],
    interaction: 'select-detail-or-optional-response-route',
    existingEvidence: ['connection.y personal connection, under its original identity'],
    incompatibleEvidence: ['humanity annotation as narrative preference or empathy', 'meaning.x as narrative'],
    limits: ['Dataset annotators do not determine this viewer\'s emotional meaning.', 'Abstract works may support narrative or personal associations.'],
    sources: ['artemis2021', 'artelingo2022']
  },
  {
    id: 'first-and-return-choice', status: 'existing-measures-plus-proposed-followup',
    title: 'First stop and next visit',
    prompt: 'Which would you stop at first?',
    companionPrompt: 'Keep two for your next visit.',
    interaction: 'initial-choice-then-later-limited-selection',
    existingEvidence: ['first-stop', 'return-visit', 'collection-intent', 'exact comparable repeats'],
    incompatibleEvidence: ['gallery entry versus linger as a true favourite', 'idle time as attention'],
    limits: ['Different briefs are contextual differences.', 'Within-session repeats do not establish lifelong stability.'],
    sources: ['stability2017', 'museumContext2014', 'familiarity2021']
  },
  {
    id: 'relational-fit', status: 'existing-measures-plus-proposed-followup',
    title: 'What belongs together',
    prompt: 'Keep this painting fixed. Change one companion.',
    endpoints: ['Weaker pair here', 'Stronger pair here'],
    interaction: 'free-arrangement-then-anchor-swap',
    companionMeasure: 'individual liking collected before arrangement',
    existingEvidence: ['open-gallery-v1 room membership', 'sorting-table-v1 original geometry', 'difficult edit under its actual brief'],
    incompatibleEvidence: ['omission as dislike', 'automatic wall spacing as similarity', 'room and table distances pooled together'],
    limits: ['Our room and table tasks do not implement inverse MDS.', 'A good companion need not be an individual favourite.'],
    sources: ['arrangement2012']
  }
]);
