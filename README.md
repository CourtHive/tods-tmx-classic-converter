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

let { TMX2TODS } = require('tods-tmx-classic-converter');
let fs = require('fs');
t = fs.readFileSync('example/CourtHiveChallenge.json', 'UTF-8');
classic = JSON.parse(t);
tods = TMX2TODS({ tournament: classic });
```

-- or --

```js
// node -r esm

import { TMX2TODS } from 'tods-tmx-classic-converter';
let fs = require('fs');
t = fs.readFileSync('example/CourtHiveChallenge.json', 'UTF-8');
classic = JSON.parse(t);
tods = TMX2TODS({ tournament: classic });
```

## NOTE

If you want to work directly in the repo directory...

```js
let { TMX2TODS } = require('./dist');
// -- or --
import { TMX2TODS } from './dist';
```
