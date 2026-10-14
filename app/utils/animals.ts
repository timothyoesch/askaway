// Emoji for each anonymous animal. Keys match pb_hooks/lib/animals.js; the
// translated names live in i18n/locales/*.json under "animals".
export const ANIMAL_EMOJI: Record<string, string> = {
  otter: '🦦',
  hedgehog: '🦔',
  sloth: '🦥',
  panda: '🐼',
  koala: '🐨',
  penguin: '🐧',
  fox: '🦊',
  bunny: '🐰',
  duckling: '🐥',
  kitten: '🐱',
  puppy: '🐶',
  owl: '🦉',
  seal: '🦭',
  hamster: '🐹',
  llama: '🦙',
  raccoon: '🦝',
  squirrel: '🐿️',
  bee: '🐝',
  ladybug: '🐞',
  frog: '🐸',
  turtle: '🐢',
  beaver: '🦫',
  butterfly: '🦋',
  dolphin: '🐬',
  whale: '🐳',
  unicorn: '🦄',
  mouse: '🐭',
  octopus: '🐙',
  snail: '🐌',
  flamingo: '🦩',
}

export const ANIMALS = Object.keys(ANIMAL_EMOJI)

export function animalEmoji(animal: string) {
  return ANIMAL_EMOJI[animal] || '🐾'
}
