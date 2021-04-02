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
const { TMX2TODS } = require('tods-tmx-classic-converter');

// node -r esm
import { TMX2TODS } from 'tods-tmx-classic-converter';

// If you want to work directly in the repo directory...
const { TMX2TODS } = require('./dist');

// convert all files in sourceDir

TMX2TODS({
  sourceDir: './example',
  targetDir: './example',
  /*
  targetExtension, // optional
  */
});
```
