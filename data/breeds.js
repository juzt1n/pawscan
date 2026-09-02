// data/breeds.js — the 120 Stanford Dogs breeds (cleaned names) for the
// encyclopaedia (PRD #13). REGENERATE this from your friend's class_names.json
// so it exactly matches the model's classes:
//
//   const names = require("./class_names.json");
//   const cleaned = names.map(n => n.split("-").slice(1).join("-").replace(/_/g, " ").toLowerCase());
//   require("fs").writeFileSync("breeds.js", "export const BREEDS = " + JSON.stringify(cleaned, null, 2) + ";");

export const BREEDS = [
  "affenpinscher", "afghan hound", "african hunting dog", "airedale",
  "american staffordshire terrier", "appenzeller", "australian terrier",
  "basenji", "basset", "beagle", "bedlington terrier", "bernese mountain dog",
  "black-and-tan coonhound", "blenheim spaniel", "bloodhound", "bluetick",
  "border collie", "border terrier", "borzoi", "boston bull",
  "bouvier des flandres", "boxer", "brabancon griffon", "briard",
  "brittany spaniel", "bull mastiff", "cairn", "cardigan",
  "chesapeake bay retriever", "chihuahua", "chow", "clumber",
  "cocker spaniel", "collie", "curly-coated retriever", "dandie dinmont",
  "dhole", "dingo", "doberman", "english foxhound", "english setter",
  "english springer", "entlebucher", "eskimo dog", "flat-coated retriever",
  "french bulldog", "german shepherd", "german short-haired pointer",
  "giant schnauzer", "golden retriever", "gordon setter", "great dane",
  "great pyrenees", "greater swiss mountain dog", "groenendael",
  "ibizan hound", "irish setter", "irish terrier", "irish water spaniel",
  "irish wolfhound", "italian greyhound", "japanese spaniel", "keeshond",
  "kelpie", "kerry blue terrier", "komondor", "kuvasz", "labrador retriever",
  "lakeland terrier", "leonberg", "lhasa", "malamute", "malinois",
  "maltese dog", "mexican hairless", "miniature pinscher",
  "miniature poodle", "miniature schnauzer", "newfoundland",
  "norfolk terrier", "norwegian elkhound", "norwich terrier",
  "old english sheepdog", "otterhound", "papillon", "pekinese",
  "pembroke", "pomeranian", "pug", "redbone", "rhodesian ridgeback",
  "rottweiler", "saint bernard", "saluki", "samoyed", "schipperke",
  "scotch terrier", "scottish deerhound", "sealyham terrier",
  "shetland sheepdog", "shih-tzu", "siberian husky", "silky terrier",
  "soft-coated wheaten terrier", "staffordshire bullterrier",
  "standard poodle", "standard schnauzer", "sussex spaniel",
  "tibetan mastiff", "tibetan terrier", "toy poodle", "toy terrier",
  "vizsla", "walker hound", "weimaraner", "welsh springer spaniel",
  "west highland white terrier", "whippet", "wire-haired fox terrier",
  "yorkshire terrier",
];
