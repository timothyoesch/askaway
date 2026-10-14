// Keys for the anonymous "Anonymous <Animal>" names. The display text and
// emoji live in the frontend translations (i18n/locales/*.json → animals.*),
// so every screen shows the name in its own language.
const ANIMALS = [
  "otter", "hedgehog", "sloth", "panda", "koala", "penguin", "fox", "bunny",
  "duckling", "kitten", "puppy", "owl", "seal", "hamster", "llama", "raccoon",
  "squirrel", "bee", "ladybug", "frog", "turtle", "beaver", "butterfly",
  "dolphin", "whale", "unicorn", "mouse", "octopus", "snail", "flamingo",
]

function randomAnimal() {
  return ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
}

function isAnimal(key) {
  return ANIMALS.indexOf(key) !== -1
}

module.exports = { ANIMALS, randomAnimal, isAnimal }
