# tods-tmx-classic-converter

Converts exported tournament records from TMX 1.9 to [TODS](https://itftennis.atlassian.net/wiki/spaces/TODS/overview)

Converted files may be used with the [Competition Factory](https://courthive.github.io/tods-competition-factory/) or drag/dropped into CourtHive TMX 2.0.

## Installation

```js
npm i tods-tmx-classic-converter
```

## Use

```js
// node

let { TMX2TODS } = require("tods-tmx-classic-converter");
let fs = require("fs");
t = fs.readFileSync('example/CourtHiveChallenge.json", "UTF-8');
classic = JSON.parse(t);
tods = TMX2TODS({ tournament: classic });
```

-- or --

```js
// node -r esm

let { TMX2TODS } = import("tods-tmx-classic-converter");
let fs = import("fs");
t = fs.readFileSync('example/CourtHiveChallenge.json", "UTF-8');
classic = JSON.parse(t);
tods = TMX2TODS({ tournament: classic });
```
