#!/usr/bin/env node

'use strict'

//
// Use in CLI:
//
//   Type "riot" for help.
//
// Use in Node:
//
//   var riot = require('riot/compiler')
//   riot.make({ from: 'foo', to: 'bar', compact: true })
//   riot.watch({ from: 'foo.tag', to: 'bar.js' })
//

var ph = require('path'),
  sh = require('shelljs'),
  chokidar = require('chokidar'),
  chalk = require('chalk'),
  compiler = require('./compiler'),
  analyzer = require('./analyzer'),

  methods = {

    help() {
      log([
        '',
        'Builds .tag files to .js',
        '',
        'Options:',
        '',
        '  -h, --help      You\'re reading it',
        '  -v, --version   Print Riot\'s version',
        '  -w, --watch     Watch for changes',
        '  -c, --compact   Minify </p> <p> to </p><p>',
        '  -t, --type      JavaScript pre-processor. Built-in support for: es6, coffeescript, typescript, livescript, none',
        '  -m, --modular   AMD and CommonJS',
        '  -s, --silent    Silence build output',
        '  --template      HTML pre-processor. Built-in support for: jade',
        '  --whitespace    Preserve newlines and whitepace',
        '  --brackets      Change brackets used for expressions. Defaults to { }',
        '  --expr          Run expressions trough parser defined with --type',
        '  --ext           Change tag file extension. Defaults to .tag',
        '',
        'Build a single .tag file:',
        '',
        '  riot foo.tag           To a same named file (foo.js)',
        '  riot foo.tag bar.js    To a different named file (bar.js)',
        '  riot foo.tag bar       To a different dir (bar/foo.js)',
        '',
        'Build all .tag files in a directory:',
        '',
        '  riot foo/bar           To a same directory (foo/**/*.js)',
        '  riot foo/bar baz       To a different directory (baz/**/*.js)',
        '  riot foo/bar baz.js    To a single concatenated file (baz.js)',
        '',
        'Examples for options:',
        '',
        '  riot foo bar',
        '  riot --w foo bar',
        '  riot --watch foo bar',
        '  riot --compact foo bar',
        '  riot foo bar --compact',
        '  riot test.tag --type coffeescript --expr',
        ''
      ].join('\n'))
    },


    version() {
      log(require('../../package.json').version)
    },


    make(opt) {
      init(opt)

      // Generate a list of input/output files

      var from = opt.flow[0] == 'f' ? [opt.from] : find(opt.from),
        base = opt.flow[0] == 'f' ? ph.dirname(opt.from) : opt.from,
        to = opt.flow[1] == 'f' ? [opt.to] : remap(from, opt.to, base)

      // Create any necessary dirs

      var dirs = {}
      to.map(function(f) { dirs[ph.dirname(f)] = 0 })
      sh.mkdir('-p', Object.keys(dirs))

      // Process files

      function encapsulate(from) {
        if (!opt.compiler.modular) {
          return from
        }

        var out = ''
        out += '(function(tagger) {\n'
        out += '  if (typeof define === \'function\' && define.amd) {\n'
        out += '    define(function(require, exports, module) { tagger(require(\'riot\'), require, exports, module)})\n'
        out += '  } else if (typeof module !== \'undefined\' && typeof module.exports !== \'undefined\') {\n'
        out += '    tagger(require(\'riot\'), require, exports, module)\n'
        out += '  } else {\n'
        out += '    tagger(window.riot)\n'
        out += '  }\n'
        out += '})(function(riot, require, exports, module) {\n'
        out += from
        out += '\n});'
        return out
      }

      function parse(from) { return compiler.compile(sh.cat(from).replace(/^\uFEFF/g, /* strips BOM */''), opt.compiler) }
      function toFile(from, to) { encapsulate(from.map(function (path) { return parse(path) }).join('\n')).to(to[0]) }
      function toDir(from, to) { from.map(function(from, i) { encapsulate(parse(from)).to(to[i]) }) }
      ;(opt.flow[1] == 'f' ? toFile : toDir)(from, to)

      // Print what's been done (unless --silent)

      if (!opt.compiler.silent) {
        from.map(function(src, i) {
          log(toRelative(src) + ' -> ' + toRelative(to[i] || to[0]))
        })
      }

    },


    watch(opt) {
      init(opt)

      methods.make(opt)

      var glob = opt.flow[0] == 'f' ? opt.from : ph.join(opt.from, '**/*.'+opt.ext)

      chokidar.watch(glob, { ignoreInitial: true })
        .on('ready', function() { log('Watching ' + toRelative(glob)) })
        .on('all', function() { methods.make(opt) })

    },

    check(opt) {
      init(opt)

      //TODO: analyze each file separatedly
      var from = opt.flow[0] == 'f' ? [opt.from] : find(opt.from)
      var source = sh.cat(from).replace(/^\uFEFF/g, /* strips BOM */'')
      var errors = analyzer(source).filter(function(result) { return result.error })

      if (errors.length) {
        log(chalk.white.bgRed(' Riot Tag Syntax Error '))
        errors.map(function(result) {
          log(chalk.gray(result.line + '| ') + result.source)
          log(chalk.red('^^^ ' + result.error))
        })
        log(chalk.gray('Total error: ' + errors.length))
      } else {
        log(chalk.green('No syntax error. Ready to compile :)'))
      }
    }
  }


function cli() {

  // Get CLI arguments

  var args = require('minimist')(process.argv.slice(2), {
    boolean: ['watch', 'compact', 'help', 'version', 'whitespace', 'modular', 'silent', 'check'],
    alias: { w: 'watch', c: 'compact', h: 'help', v: 'version', t: 'type', m: 'modular', s: 'silent' }
  })

  // Translate args into options hash

  var opts = {
    compiler: {
      compact: args.compact,
      template: args.template,
      type: args.type,
      brackets: args.brackets,
      expr: args.expr,
      modular: args.modular,
      silent: args.silent,
      whitespace: args.whitespace
    },
    ext: args.ext,
    from: args._.shift(),
    to: args._.shift()
  }

  // Call matching method

  var method = Object.keys(methods).filter(function(v) { return args[v] })[0]
    || ( opts.from ? 'make' : 'help' )

  methods[method](opts)

}


// Run from CLI or as Node module

if (module.parent) {
  module.exports = methods
  log.silent = true
} else cli()