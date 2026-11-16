/** Research-only details may remain in the catalogue without becoming quiz
 * stimuli. This gate does not invent missing image or descriptor metadata. */
export const isStudyEligibleArtwork=work=>!!work&&work.eligibleForStudy!==false&&work.studyEligible!==false&&work.decorativeOnly!==true;
