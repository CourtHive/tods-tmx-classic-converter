
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./tods-tmx-legacy-converter.cjs.production.min.js')
} else {
  module.exports = require('./tods-tmx-legacy-converter.cjs.development.js')
}
