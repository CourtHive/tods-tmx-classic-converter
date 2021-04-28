# tods-tmx-classic-converter

Converts exported tournament records from TMX 1.9 to [TODS](https://itftennis.atlassian.net/wiki/spaces/TODS/overview)

Converted files may be used with the [Competition Factory](https://courthive.github.io/tods-competition-factory/) or drag/dropped into CourtHive TMX 2.0.

## Installation

```js
npm i tods-tmx-classic-converter
```

## Use

See examples directory...

```js
cd example

node

const { TMX2TODS } = require('./TMX2TODS');

// convert all files in sourceDir
TMX2TODS({
  sourceDir: '.',
  targetDir: '.',
  targetExtension, // optional file extension, defaults to '.tods.json'
});
```
