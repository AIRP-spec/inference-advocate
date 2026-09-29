#!/usr/bin/env node
// Provisional Section 3.3. Convert primitives labels + corpus → Laya training samples.
// Each row becomes one Laya sample: {state, questions, answers}.

import { readFileSync, writeFileSync } from 'node:fs';

function buildLayaSample(row, corpusMap, questionBundle) {
  const corpusRow = corpusMap.get(row.id);
  if (!corpusRow) {
    throw new Error(`Missing corpus row for id: ${row.id}`);
  }

  const state = corpusRow.content;

  const answers = {};
  
  // Stance (choice)
  answers.stance = { choice: row.stance };

  // Objects (noul)
  for (const obj of ['violence_person', 'self_harm', 'sexual_activity', 'financial_crime', 'intrusion', 'weapons', 'profanity']) {
    answers[obj] = { noul: row.objects.includes(obj) };
  }

  // Qualifiers (noul)
  for (const qual of ['targets_protected_characteristic', 'subject_is_minor', 'asserts_interior_state', 'addresses_own_nature', 'explicit_register', 'exceeds_common_knowledge', 'is_mention_not_use', 'directed_at_user', 'untethered_to_content']) {
    answers[qual] = { noul: row.qualifiers.includes(qual) };
  }

  return {
    id: row.id,
    kind: row.kind,
    state,
    questions: questionBundle.questions,
    answers
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4) {
    console.error('Usage: build-laya-dataset.mjs <labels.jsonl> <corpus.jsonl> <questions.json> <output.jsonl>');
    console.error('  Reads labels+corpus, builds Laya samples, writes output');
    process.exit(1);
  }

  const [labelsPath, corpusPath, questionsPath, outputPath] = args;

  const labelsText = readFileSync(labelsPath, 'utf8');
  const labels = labelsText.trim().split('\n').filter(l => l).map(l => JSON.parse(l));

  const corpusText = readFileSync(corpusPath, 'utf8');
  const corpus = corpusText.trim().split('\n').filter(l => l).map(l => JSON.parse(l));
  const corpusMap = new Map(corpus.map(r => [r.id, r]));

  const questionBundle = JSON.parse(readFileSync(questionsPath, 'utf8'));

  const samples = [];
  for (const row of labels) {
    try {
      const sample = buildLayaSample(row, corpusMap, questionBundle);
      samples.push(sample);
    } catch (err) {
      console.error(`Error building sample for ${row.id}: ${err.message}`);
      process.exit(1);
    }
  }

  const outputJsonl = samples.map(s => JSON.stringify(s)).join('\n') + '\n';
  writeFileSync(outputPath, outputJsonl);

  console.log(`Built ${samples.length} Laya samples`);
  console.log(`  Output: ${outputPath}`);
}

main();
