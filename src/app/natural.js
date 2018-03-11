(function(){var require = function (file, cwd) {
  var resolved = require.resolve(file, cwd || '/');
  var mod = require.modules[resolved];
  if (!mod) throw new Error(
      'Failed to resolve module ' + file + ', tried ' + resolved
  );
  var cached = require.cache[resolved];
  var res = cached? cached.exports : mod();
  return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee"];

require._core = {
  'assert': true,
  'events': true,
  'fs': true,
  'path': true,
  'vm': true
};

require.resolve = (function () {
  return function (x, cwd) {
      if (!cwd) cwd = '/';

      if (require._core[x]) return x;
      var path = require.modules.path();
      cwd = path.resolve('/', cwd);
      var y = cwd || '/';

      if (x.match(/^(?:\.\.?\/|\/)/)) {
          var m = loadAsFileSync(path.resolve(y, x))
              || loadAsDirectorySync(path.resolve(y, x));
          if (m) return m;
      }

      var n = loadNodeModulesSync(x, y);
      if (n) return n;

      throw new Error("Cannot find module '" + x + "'");

      function loadAsFileSync (x) {
          x = path.normalize(x);
          if (require.modules[x]) {
              return x;
          }

          for (var i = 0; i < require.extensions.length; i++) {
              var ext = require.extensions[i];
              if (require.modules[x + ext]) return x + ext;
          }
      }

      function loadAsDirectorySync (x) {
          x = x.replace(/\/+$/, '');
          var pkgfile = path.normalize(x + '/package.json');
          if (require.modules[pkgfile]) {
              var pkg = require.modules[pkgfile]();
              var b = pkg.browserify;
              if (typeof b === 'object' && b.main) {
                  var m = loadAsFileSync(path.resolve(x, b.main));
                  if (m) return m;
              }
              else if (typeof b === 'string') {
                  var m = loadAsFileSync(path.resolve(x, b));
                  if (m) return m;
              }
              else if (pkg.main) {
                  var m = loadAsFileSync(path.resolve(x, pkg.main));
                  if (m) return m;
              }
          }

          return loadAsFileSync(x + '/index');
      }

      function loadNodeModulesSync (x, start) {
          var dirs = nodeModulesPathsSync(start);
          for (var i = 0; i < dirs.length; i++) {
              var dir = dirs[i];
              var m = loadAsFileSync(dir + '/' + x);
              if (m) return m;
              var n = loadAsDirectorySync(dir + '/' + x);
              if (n) return n;
          }

          var m = loadAsFileSync(x);
          if (m) return m;
      }

      function nodeModulesPathsSync (start) {
          var parts;
          if (start === '/') parts = [ '' ];
          else parts = path.normalize(start).split('/');

          var dirs = [];
          for (var i = parts.length - 1; i >= 0; i--) {
              if (parts[i] === 'node_modules') continue;
              var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
              dirs.push(dir);
          }

          return dirs;
      }
  };
})();

require.alias = function (from, to) {
  var path = require.modules.path();
  var res = null;
  try {
      res = require.resolve(from + '/package.json', '/');
  }
  catch (err) {
      res = require.resolve(from, '/');
  }
  var basedir = path.dirname(res);

  var keys = (Object.keys || function (obj) {
      var res = [];
      for (var key in obj) res.push(key);
      return res;
  })(require.modules);

  for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key.slice(0, basedir.length + 1) === basedir + '/') {
          var f = key.slice(basedir.length);
          require.modules[to + f] = require.modules[basedir + f];
      }
      else if (key === basedir) {
          require.modules[to] = require.modules[basedir];
      }
  }
};

(function () {
  var process = {};

  require.define = function (filename, fn) {
      if (require.modules.__browserify_process) {
          process = require.modules.__browserify_process();
      }

      var dirname = require._core[filename]
          ? ''
          : require.modules.path().dirname(filename)
      ;

      var require_ = function (file) {
          var requiredModule = require(file, dirname);
          var cached = require.cache[require.resolve(file, dirname)];

          if (cached && cached.parent === null) {
              cached.parent = module_;
          }

          return requiredModule;
      };
      require_.resolve = function (name) {
          return require.resolve(name, dirname);
      };
      require_.modules = require.modules;
      require_.define = require.define;
      require_.cache = require.cache;
      var module_ = {
          id : filename,
          filename: filename,
          exports : {},
          loaded : false,
          parent: null
      };

      require.modules[filename] = function () {
          require.cache[filename] = module_;
          fn.call(
              module_.exports,
              require_,
              module_,
              module_.exports,
              dirname,
              filename,
              process
          );
          module_.loaded = true;
          return module_.exports;
      };
  };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process){function filter (xs, fn) {
  var res = [];
  for (var i = 0; i < xs.length; i++) {
      if (fn(xs[i], i, xs)) res.push(xs[i]);
  }
  return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
// if the path tries to go above the root, `up` ends up > 0
var up = 0;
for (var i = parts.length; i >= 0; i--) {
  var last = parts[i];
  if (last == '.') {
    parts.splice(i, 1);
  } else if (last === '..') {
    parts.splice(i, 1);
    up++;
  } else if (up) {
    parts.splice(i, 1);
    up--;
  }
}

// if the path is allowed to go above the root, restore leading ..s
if (allowAboveRoot) {
  for (; up--; up) {
    parts.unshift('..');
  }
}

return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
  resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
var path = (i >= 0)
    ? arguments[i]
    : process.cwd();

// Skip empty and invalid entries
if (typeof path !== 'string' || !path) {
  continue;
}

resolvedPath = path + '/' + resolvedPath;
resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
  return !!p;
}), !resolvedAbsolute).join('/');

return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
  trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
  return !!p;
}), !isAbsolute).join('/');

if (!path && !isAbsolute) {
  path = '.';
}
if (path && trailingSlash) {
  path += '/';
}

return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
var paths = Array.prototype.slice.call(arguments, 0);
return exports.normalize(filter(paths, function(p, index) {
  return p && typeof p === 'string';
}).join('/'));
};


exports.dirname = function(path) {
var dir = splitPathRe.exec(path)[1] || '';
var isWindows = false;
if (!dir) {
  // No dirname
  return '.';
} else if (dir.length === 1 ||
    (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
  // It is just a slash or a drive letter with a slash
  return dir;
} else {
  // It is a full dirname, strip trailing slash
  return dir.substring(0, dir.length - 1);
}
};


exports.basename = function(path, ext) {
var f = splitPathRe.exec(path)[2] || '';
// TODO: make this comparison case-insensitive on windows?
if (ext && f.substr(-1 * ext.length) === ext) {
  f = f.substr(0, f.length - ext.length);
}
return f;
};


exports.extname = function(path) {
return splitPathRe.exec(path)[3] || '';
};
});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process){var process = module.exports = {};

process.nextTick = (function () {
  var queue = [];
  var canPost = typeof window !== 'undefined'
      && window.postMessage && window.addEventListener
  ;

  if (canPost) {
      window.addEventListener('message', function (ev) {
          if (ev.source === window && ev.data === 'browserify-tick') {
              ev.stopPropagation();
              if (queue.length > 0) {
                  var fn = queue.shift();
                  fn();
              }
          }
      }, true);
  }

  return function (fn) {
      if (canPost) {
          queue.push(fn);
          window.postMessage('browserify-tick', '*');
      }
      else setTimeout(fn, 0);
  };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
  if (name === 'evals') return (require)('vm')
  else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
  var cwd = '/';
  var path;
  process.cwd = function () { return cwd };
  process.chdir = function (dir) {
      if (!path) path = require('path');
      cwd = path.resolve(dir, cwd);
  };
})();
});

require.define("vm",function(require,module,exports,__dirname,__filename,process){module.exports = require("vm-browserify")});

require.define("/node_modules/vm-browserify/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/vm-browserify/index.js",function(require,module,exports,__dirname,__filename,process){var Object_keys = function (obj) {
  if (Object.keys) return Object.keys(obj)
  else {
      var res = [];
      for (var key in obj) res.push(key)
      return res;
  }
};

var forEach = function (xs, fn) {
  if (xs.forEach) return xs.forEach(fn)
  else for (var i = 0; i < xs.length; i++) {
      fn(xs[i], i, xs);
  }
};

var Script = exports.Script = function NodeScript (code) {
  if (!(this instanceof Script)) return new Script(code);
  this.code = code;
};

Script.prototype.runInNewContext = function (context) {
  if (!context) context = {};

  var iframe = document.createElement('iframe');
  if (!iframe.style) iframe.style = {};
  iframe.style.display = 'none';

  document.body.appendChild(iframe);

  var win = iframe.contentWindow;

  forEach(Object_keys(context), function (key) {
      win[key] = context[key];
  });

  if (!win.eval && win.execScript) {
      // win.eval() magically appears when this is called in IE:
      win.execScript('null');
  }

  var res = win.eval(this.code);

  forEach(Object_keys(win), function (key) {
      context[key] = win[key];
  });

  document.body.removeChild(iframe);

  return res;
};

Script.prototype.runInThisContext = function () {
  return eval(this.code); // maybe...
};

Script.prototype.runInContext = function (context) {
  // seems to be just runInNewContext on magical context objects which are
  // otherwise indistinguishable from objects except plain old objects
  // for the parameter segfaults node
  return this.runInNewContext(context);
};

forEach(Object_keys(Script.prototype), function (name) {
  exports[name] = Script[name] = function (code) {
      var s = Script(code);
      return s[name].apply(s, [].slice.call(arguments, 1));
  };
});

exports.createScript = function (code) {
  return exports.Script(code);
};

exports.createContext = Script.createContext = function (context) {
  // not really sure what this one does
  // seems to just make a shallow copy
  var copy = {};
  if(typeof context === 'object') {
      forEach(Object_keys(context), function (key) {
          copy[key] = context[key];
      });
  }
  return copy;
};
});

require.define("/lib/natural/phonetics/soundex.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Phonetic = require('./phonetic');

function transformLipps(token) {
  return token.replace(/[bfpv]/g, '1');
}

function transformThroats(token) {
  return token.replace(/[cgjkqsxz]/g, '2');
}

function transformToungue(token) {
  return token.replace(/[dt]/g, '3');
}

function transformL(token) {
  return token.replace(/l/g, '4');
}

function transformHum(token) {
  return token.replace(/[mn]/g, '5');
}

function transformR(token) {
  return token.replace(/r/g, '6');
}

function condense(token) {
  return token.replace(/(\d)[hw]?\1+/g, '$1').replace(/[hw]/g, '');
}

function padRight0(token) {
  if(token.length < 4)
      return token + Array(4 - token.length).join('0');
  else
      return token;
}

var SoundEx = new Phonetic();
module.exports = SoundEx;

SoundEx.process = function(token, maxLength) {
  token = token.toLowerCase();

  return token.charAt(0).toUpperCase() + padRight0(condense(transformLipps(transformThroats(
      transformToungue(transformL(transformHum(transformR(
          token.substr(1, token.length - 1).replace(/[aeiouy]/g, '')))))))
              )).substr(0, (maxLength && maxLength - 1) || 3);
};

// export for tests;
SoundEx.transformLipps = transformLipps;
SoundEx.transformThroats = transformThroats;
SoundEx.transformToungue = transformToungue;
SoundEx.transformL = transformL;
SoundEx.transformHum = transformHum;
SoundEx.transformR = transformR;
SoundEx.condense = condense;
SoundEx.padRight0 = padRight0;
});

require.define("/lib/natural/phonetics/phonetic.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var stopwords = require('../util/stopwords');
var Tokenizer = new require('../tokenizers/aggressive_tokenizer')
  tokenizer = new Tokenizer();

module.exports = function() {
  this.compare = function(stringA, stringB) {
      return this.process(stringA) == this.process(stringB);
  };

  this.attach = function() {
var phonetic = this;

      String.prototype.soundsLike = function(compareTo) {
          return phonetic.compare(this, compareTo);
      }

      String.prototype.phonetics = function() {
          return phonetic.process(this);
      }

      String.prototype.tokenizeAndPhoneticize = function(keepStops) {
          var phoneticizedTokens = [];

          tokenizer.tokenize(this).forEach(function(token) {
              if(keepStops || stopwords.words.indexOf(token) < 0)
                  phoneticizedTokens.push(token.phonetics());
          });

          return phoneticizedTokens;
      }
  };
};
});

require.define("/lib/natural/util/stopwords.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

// a list of commonly used words that have little meaning and can be excluded
// from analysis.
var words = [
  'about', 'after', 'all', 'also', 'am', 'an', 'and', 'another', 'any', 'are', 'as', 'at', 'be',
  'because', 'been', 'before', 'being', 'between', 'both', 'but', 'by', 'came', 'can',
  'come', 'could', 'did', 'do', 'each', 'for', 'from', 'get', 'got', 'has', 'had',
  'he', 'have', 'her', 'here', 'him', 'himself', 'his', 'how', 'if', 'in', 'into',
  'is', 'it', 'like', 'make', 'many', 'me', 'might', 'more', 'most', 'much', 'must',
  'my', 'never', 'now', 'of', 'on', 'only', 'or', 'other', 'our', 'out', 'over',
  'said', 'same', 'see', 'should', 'since', 'some', 'still', 'such', 'take', 'than',
  'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
  'through', 'to', 'too', 'under', 'up', 'very', 'was', 'way', 'we', 'well', 'were',
  'what', 'where', 'which', 'while', 'who', 'with', 'would', 'you', 'your',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
  'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '$', '1',
  '2', '3', '4', '5', '6', '7', '8', '9', '0', '_'];

// tell the world about the noise words.
exports.words = words;
});

require.define("/lib/natural/phonetics/metaphone.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Phonetic = require('./phonetic');

function dedup(token) {
  return token.replace(/([^c])\1/g, '$1');
}

function dropInitialLetters(token) {
  if(token.match(/^(kn|gn|pn|ae|wr)/))
      return token.substr(1, token.length - 1);

  return token;
}

function dropBafterMAtEnd(token) {
  return token.replace(/mb$/, 'm');
}

function cTransform(token) {
  token = token.replace(/([^s]|^)(c)(h)/g, '$1x$3').trim();
  token = token.replace(/cia/g, 'xia');
  token = token.replace(/c(i|e|y)/g, 's$1');
  token = token.replace(/c/g, 'k');

  return token;
}

function dTransform(token) {
  token = token.replace(/d(ge|gy|gi)/g, 'j$1');
  token = token.replace(/d/g, 't');

  return token;
}

function dropG(token) {
  token = token.replace(/gh(^$|[^aeiou])/g, 'h$1');
  token = token.replace(/g(n|ned)$/g, '$1');

  return token;
}

function transformG(token) {
  token = token.replace(/([^g]|^)(g)(i|e|y)/g, '$1j$3');
  token = token.replace(/gg/g, 'g');
  token = token.replace(/g/g, 'k');

  return token;
}

function dropH(token) {
  return token.replace(/([aeiou])h([^aeiou])/g, '$1$2');
}

function transformCK(token) {
  return token.replace(/ck/g, 'k');
}
function transformPH(token) {
  return token.replace(/ph/g, 'f');
}

function transformQ(token) {
  return token.replace(/q/g, 'k');
}

function transformS(token) {
  return token.replace(/s(h|io|ia)/g, 'x$1');
}

function transformT(token) {
  token = token.replace(/t(ia|io)/g, 'x$1');
  token = token.replace(/th/, '0');

  return token;
}

function dropT(token) {
  return token.replace(/tch/g, 'ch');
}

function transformV(token) {
  return token.replace(/v/g, 'f');
}

function transformWH(token) {
  return token.replace(/^wh/, 'w');
}

function dropW(token) {
  return token.replace(/w([^aeiou]|$)/g, '$1');
}

function transformX(token) {
  token = token.replace(/^x/, 's');
  token = token.replace(/x/g, 'ks');
  return token;
}

function dropY(token) {
  return token.replace(/y([^aeiou]|$)/g, '$1');
}

function transformZ(token) {
  return token.replace(/z/, 's');
}

function dropVowels(token) {
  return token.charAt(0) + token.substr(1, token.length).replace(/[aeiou]/g, '');
}

var Metaphone = new Phonetic();
module.exports = Metaphone;

Metaphone.process = function(token, maxLength) {
  maxLength == maxLength || 32;
  token = token.toLowerCase();
  token = dedup(token);
  token = dropInitialLetters(token);
  token = dropBafterMAtEnd(token);
  token = transformCK(token);
  token = cTransform(token);
  token = dTransform(token);
  token = dropG(token);
  token = transformG(token);
  token = dropH(token);
  token = transformPH(token);
  token = transformQ(token);
  token = transformS(token);
  token = transformX(token);
  token = transformT(token);
  token = dropT(token);
  token = transformV(token);
  token = transformWH(token);
  token = dropW(token);
  token = dropY(token);
  token = transformZ(token);
  token = dropVowels(token);

  token.toUpperCase();
  if(token.length >= maxLength)
      token = token.substring(0, maxLength);

  return token.toUpperCase();
};

// expose functions for testing
Metaphone.dedup = dedup;
Metaphone.dropInitialLetters = dropInitialLetters;
Metaphone.dropBafterMAtEnd = dropBafterMAtEnd;
Metaphone.cTransform = cTransform;
Metaphone.dTransform = dTransform;
Metaphone.dropG = dropG;
Metaphone.transformG = transformG;
Metaphone.dropH = dropH;
Metaphone.transformCK = transformCK;
Metaphone.transformPH = transformPH;
Metaphone.transformQ = transformQ;
Metaphone.transformS = transformS;
Metaphone.transformT = transformT;
Metaphone.dropT = dropT;
Metaphone.transformV = transformV;
Metaphone.transformWH = transformWH;
Metaphone.dropW = dropW;
Metaphone.transformX = transformX;
Metaphone.dropY = dropY;
Metaphone.transformZ = transformZ;
Metaphone.dropVowels = dropVowels;
});

require.define("/lib/natural/phonetics/double_metaphone.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Phonetic = require('./phonetic');

var DoubleMetaphone = new Phonetic();
module.exports = DoubleMetaphone;

function isVowel(c) {
return c && c.match(/[aeiouy]/i);
}

function truncate(string, length) {
  if(string.length >= length)
      string = string.substring(0, length);

  return string;
}

function process(token, maxLength) {
token = token.toUpperCase();
var primary = '', secondary = '';
  var pos = 0;
  maxLength == maxLength || 32;

  function subMatch(startOffset, stopOffset, terms) {
      return subMatchAbsolute(pos + startOffset, pos + stopOffset, terms);
  }

  function subMatchAbsolute(startOffset, stopOffset, terms) {
      return terms.indexOf(token.substring(startOffset, stopOffset)) > -1;
  }

  function addSecondary(primaryAppendage, secondaryAppendage) {
    primary += primaryAppendage;
    secondary += secondaryAppendage;
  }

  function add(primaryAppendage) {
    addSecondary(primaryAppendage, primaryAppendage);
  }

  function addCompressedDouble(c, encoded) {
    if(token[pos + 1] == c)
      pos++;
    add(encoded || c);
  }

  function handleC() {
      if(pos > 1 && !isVowel(token[pos - 2])
              && token[pos - 1] == 'A' && token[pos + 1] == 'H'
                  && (token[pos + 2] != 'I' && token[pos + 2] != 'I')
                      || subMatch(-2, 4, ['BACHER', 'MACHER'])) {
          add('K');
          pos++;
      } else if(pos == 0 && token.substring(1, 6) == 'EASAR') {
          add('S');
          pos++;
      } else if(token.substring(pos + 1, pos + 4) == 'HIA') {
          add('K');
          pos++;
      } else if(token[pos + 1] == 'H') {
          if(pos > 0 && token.substring(pos + 2, pos + 4) == 'AE') {
              addSecondary('K', 'X');
              pos++;
          } else if(pos == 0
                      && (subMatch(1, 6, ['HARAC', 'HARIS'])
                          || subMatch(1, 3, ['HOR', 'HUM', 'HIA', 'HEM']))
                      && token.substring(pos + 1, pos + 5) != 'HORE') {
              add('K');
              pos++;
          } else {
              if((subMatchAbsolute(0, 3, ['VAN', 'VON']) || token.substring(0,  3) == 'SCH')
                  || subMatch(-2, 4, ['ORCHES', 'ARCHIT', 'ORCHID'])
                  || subMatch(2, 3, ['T', 'S'])
                  || ((subMatch(-1, 0, ['A', 'O', 'U', 'E']) || pos == 0)
                      && subMatch(2, 3, ['B', 'F', 'H', 'L', 'M', 'N', 'R', 'V', 'W']))) {
                  add('K');
              } else if(pos > 0) {
                  if(token.substring(0, 2) == 'MC') {
                      add('K');
                  } else {
                      addSecondary('X', 'K');
                  }
              } else {
                  add('X');
              }

              pos++;
          }
      } else if(token.substring(pos, pos + 2) == 'CZ'
              && token.substring(pos - 2, pos + 1) != 'WICZ') {
          addSecondary('S', 'X');
          pos++;
      } else if(token.substring(pos, pos + 3) == 'CIA') {
          add('X');
          pos += 2;
      } else if(token[pos + 1] == 'C' && pos != 1 && token[0] != 'M') {
          if(['I', 'E', 'H'].indexOf(token[pos + 2]) > -1
                  && token.substring(pos + 2, pos + 4) != 'HU') {
              if(pos == 1 && token[pos - 1] == 'A'
                      || subMatch(-1, 4, ['UCCEE', 'UCCES'])) {
                  add('KS');
              } else {
                 add('X');
              }

             pos +=2;
          } else {
              add('K');
              pos++;
          }
      } else if(['K', 'G', 'Q'].indexOf(token[pos + 1]) > -1) {
          add('K');
          pos++;
      } else if(['E', 'I', 'Y'].indexOf(token[pos + 1]) > -1) {
          if(subMatch(1, 3, ['IA', 'IE', 'IO'])) {
              addSecondary('S', 'X');
          } else {
              add('S');
          }
          pos++;
      } else {
          add('K');
          if(token[pos + 1] == ' ' && ['C', 'Q', 'G'].indexOf(token[pos + 2])) {
              pos += 2;
          } else if(['C', 'K', 'Q'].indexOf(token[pos + 1]) > -1
                  && !subMatch(1, 3, ['CE', 'CI'])) {
              pos++;
          }
      }
  }

  function handleD() {
    if(token[pos + 1] == 'G') {
      if(['I', 'E', 'Y'].indexOf(token[pos + 2]) > -1)  {
        add('J');
        pos += 2;
      } else {
        add('TK');
        pos++;
      }
    } else if(token[pos + 1] == 'T') {
      add('T');
      pos++;
    } else
      addCompressedDouble('D', 'T');
  }

  function handleG() {
      if(token[pos + 1] == 'H') {
          if(pos > 0 && !isVowel(token[pos - 1])) {
              add('K');
              pos++;
          } else if(pos == 0) {
              if(token[pos + 2] == 'I') {
                  add('J');
              } else {
                  add('K');
              }
              pos++;
          } else if(pos > 1
              && (['B', 'H', 'D'].indexOf(token[pos - 2]) > -1
                  || ['B', 'H', 'D'].indexOf(token[pos - 3]) > -1
                  || ['B', 'H'].indexOf(token[pos - 4]) > -1)) {
              pos++;
          } else {
              if(pos > 2
                      && token[pos - 1] == 'U'
                      && ['C', 'G', 'L', 'R', 'T'].indexOf(token[pos - 3]) > -1) {
                  add('F');
              } else if(token[pos - 1] != 'I') {
                  add('K');
              }

              pos++;
          }
      } else if(token[pos + 1] == 'N') {
          if(pos == 1 && startsWithVowel && !slavoGermanic) {
              addSecondary('KN', 'N');
          } else {
              if(token.substring(pos + 2, pos + 4) != 'EY'
                      && (token[pos + 1] != 'Y'
                          && !slavoGermanic)) {
                  addSecondary('N', 'KN');
              } else
                  add('KN');
          }
          pos++;
      } else if(token.substring(pos + 1, pos + 3) == 'LI' && !slavoGermanic) {
          addSecondary('KL', 'L');
          pos++;
      } else if(pos == 0 && (token[pos + 1] == 'Y'
              || subMatch(1, 3, ['ES', 'EP', 'EB', 'EL', 'EY', 'IB', 'IL', 'IN', 'IE', 'EI', 'ER']))) {
          addSecondary('K', 'J')
      } else {
          addCompressedDouble('G', 'K');
      }
  }

  function handleH() {
  // keep if starts a word or is surrounded by vowels
  if((pos == 0 || isVowel(token[pos - 1])) && isVowel(token[pos + 1])) {
    add('H');
    pos++;
  }
  }

  function handleJ() {
      var jose = (token.substring(pos + 1, pos + 4) == 'OSE');

      if(san || jose) {
          if((pos == 0 && token[pos + 4] == ' ')
                  || san) {
              add('H');
          } else
              add('J', 'H');
      } else {
          if(pos == 0/* && !jose*/) {
              addSecondary('J', 'A');
          } else if(isVowel(token[pos - 1]) && !slavoGermanic
                  && (token[pos + 1] == 'A' || token[pos + 1] == 'O')) {
              addSecondary('J', 'H');
          } else if(pos == token.length - 1) {
              addSecondary('J', ' ');
          } else
              addCompressedDouble('J');
      }
  }

  function handleL() {
    if(token[pos + 1] == 'L') {
      if(pos == token.length - 3 && (
            subMatch(-1, 3, ['ILLO', 'ILLA', 'ALLE']) || (
              token.substring(pos - 1, pos + 3) == 'ALLE' &&
              (subMatch(-2, -1, ['AS', 'OS']) > -1 ||
              ['A', 'O'].indexOf(token[token.length - 1]) > -1)))) {
        addSecondary('L', '');
        pos++;
        return;
      }
      pos++;
    }
    add('L');
  }

  function handleM() {
    addCompressedDouble('M');
    if(token[pos - 1] == 'U' && token[pos + 1] == 'B' &&
        ((pos == token.length - 2  || token.substring(pos + 2, pos + 4) == 'ER')))
      pos++;
  }

  function handleP() {
    if(token[pos + 1] == 'H') {
      add('F');
      pos++;
    } else {
      addCompressedDouble('P');

    if(token[pos + 1] == 'B')
        pos++;
    }
  }

  function handleR() {
    if(pos == token.length - 1 && !slavoGermanic
        && token.substring(pos - 2, pos) == 'IE'
        && !subMatch(-4, -3, ['ME', 'MA'])) {
      addSecondary('', 'R');
    } else
      addCompressedDouble('R');
  }

  function handleS() {
      if(pos == 0 && token.substring(0, 5) == 'SUGAR') {
          addSecondary('X', 'S');
      } else if(token[pos + 1] == 'H') {
          if(subMatch(2, 5, ['EIM', 'OEK', 'OLM', 'OLZ'])) {
              add('S');
          } else {
              add('X');
          }
          pos++;
      } else if(subMatch(1, 3, ['IO', 'IA'])) {
          if(slavoGermanic) {
              add('S');
          } else {
              addSecondary('S', 'X');
          }
          pos++;
      } else if((pos == 0 && ['M', 'N', 'L', 'W'].indexOf(token[pos + 1]) > -1)
              || token[pos + 1] == 'Z') {
          addSecondary('S', 'X');
          if(token[pos + 1] == 'Z')
              pos++;
      } else if(token.substring(pos, pos + 2) == 'SC') {
          if(token[pos + 2] == 'H') {
              if(subMatch(3, 5, ['ER', 'EN'])) {
                  addSecondary('X', 'SK');
              } else if(subMatch(3, 5, ['OO', 'UY', 'ED', 'EM'])) {
                  add('SK');
              } else if(pos == 0 && !isVowel(token[3]) && token[3] != 'W') {
                  addSecondary('X', 'S');
              } else {
                  add('X');
              }
          } else if(['I', 'E', 'Y'].indexOf(token[pos + 2]) > -1) {
              add('S');
          } else {
              add('SK');
          }

          pos += 2;
      } else if(pos == token.length - 1
              && subMatch(-2, 0, ['AI', 'OI'])) {
          addSecondary('', 'S');
      } else if(token[pos + 1] != 'L' && (
              token[pos - 1] != 'A' && token[pos - 1] != 'I')) {
          addCompressedDouble('S');
          if(token[pos + 1] == 'Z')
              pos++;
      }
  }

  function handleT() {
      if(token.substring(pos + 1, pos + 4) == 'ION') {
          add('XN');
          pos += 3;
      } else if(subMatch(1, 3, ['IA', 'CH'])) {
          add('X');
          pos += 2;
      } else if(token[pos + 1] == 'H'
              || token.substring(1, 2) == 'TH') {
          if(subMatch(2, 4, ['OM', 'AM'])
                  || ['VAN ', 'VON '].indexOf(token.substring(0, 4)) > -1
                  || token.substring(0, 3) == 'SCH') {
              add('T');
          } else
              addSecondary('0', 'T');
          pos++;
      } else {
          addCompressedDouble('T');

          if(token[pos + 1] == 'D')
              pos++;
      }
  }

  function handleX() {
    if(pos == 0) {
      add('S');
    } else if(!(pos == token.length - 1
        && (['IAU', 'EAU', 'IEU'].indexOf(token.substring(pos - 3, pos)) > -1
          || ['AU', 'OU'].indexOf(token.substring(pos - 2, pos)) > -1))) {
      add('KS');
    }
  }

  function handleW() {
      if(pos == 0) {
          if(token[1] == 'H') {
              add('A');
          } else if (isVowel(token[1])) {
              addSecondary('A', 'F');
          }
      } else if((pos == token.length - 1 && isVowel(token[pos - 1])
                  || subMatch(-1, 4, ['EWSKI', 'EWSKY', 'OWSKI', 'OWSKY'])
                  || token.substring(0, 3) == 'SCH')) {
              addSecondary('', 'F');
              pos++;
      } else if(['ICZ', 'ITZ'].indexOf(token.substring(pos + 1, pos + 4)) > -1) {
          addSecondary('TS', 'FX');
          pos += 3;
      }
  }

  function handleZ() {
      if(token[pos + 1] == 'H') {
          add('J');
          pos++;
      } else if(subMatch(1, 3, ['ZO', 'ZI', 'ZA'])
              || (slavoGermanic && pos > 0 && token[pos - 1] != 'T')) {
          addSecondary('S', 'TS');
          pos++;
      } else
          addCompressedDouble('Z', 'S');
  }

  var san = (token.substring(0, 3) == 'SAN');
  var startsWithVowel = isVowel(token[0]);
  var slavoGermanic = token.match(/(W|K|CZ|WITZ)/);

  if(subMatch(0, 2, ['GN', 'KN', 'PN', 'WR', 'PS'])) {
    pos++;
  }

  while(pos < token.length) {
    switch(token[pos]) {
        case 'A': case 'E': case 'I': case 'O': case 'U': case 'Y':
        case 'Ê': case 'É': case 'É': case'À':
          if(pos == 0)
            add('A');
          break;
      case 'B':
        addCompressedDouble('B', 'P');
        break;
          case 'C':
              handleC();
              break;
        case 'Ç':
            add("S");
            break;
        case 'D':
          handleD();
          break;
        case 'F': case 'K': case 'N':
          addCompressedDouble(token[pos]);
          break;
          case 'G':
              handleG();
              break;
        case 'H':
          handleH();
          break;
          case 'J':
              handleJ();
              break;
        case 'L':
          handleL();
          break;
        case 'M':
          handleM();
          break;
        case 'Ñ':
          add('N');
          break;
        case 'P':
          handleP();
          break;
        case 'Q':
          addCompressedDouble('Q', 'K');
          break;
        case 'R':
          handleR();
          break;
          case 'S':
              handleS();
              break;
          case 'T':
              handleT();
              break;
        case 'V':
          addCompressedDouble('V', 'F');
          break;
          case 'W':
              handleW();
              break;
        case 'X':
          handleX();
          break;
        case 'Z':
          handleZ();
          break;
    }

      if(primary.length >= maxLength && secondary.length >= maxLength) {
          break;
      }

    pos++;
  }

  return [truncate(primary, maxLength), truncate(secondary, maxLength)];
}

function compare(stringA, stringB) {
  var encodingsA = process(stringA),
      encodingsB = process(stringB);

  return encodingsA[0] == encodingsB[0] ||
      encodingsA[1] == encodingsB[1];
};

DoubleMetaphone.compare = compare
DoubleMetaphone.process = process;
DoubleMetaphone.isVowel = isVowel;
});

require.define("/lib/natural/stemmers/porter_stemmer.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Stemmer = require('./stemmer');

// denote groups of consecutive consonants with a C and consecutive vowels
// with a V.
function categorizeGroups(token) {
  return token.replace(/[^aeiou]+/g, 'C').replace(/[aeiouy]+/g, 'V');
}

// denote single consonants with a C and single vowels with a V
function categorizeChars(token) {
  return token.replace(/[^aeiou]/g, 'C').replace(/[aeiouy]/g, 'V');
}

// calculate the "measure" M of a word. M is the count of VC sequences dropping
// an initial C if it exists and a trailing V if it exists.
function measure(token) {
  if(!token)
return -1;

  return categorizeGroups(token).replace(/^C/, '').replace(/V$/, '').length / 2;
}

// determine if a token end with a double consonant i.e. happ
function endsWithDoublCons(token) {
  return token.match(/([^aeiou])\1$/);
}

// replace a pattern in a word. if a replacement occurs an optional callback
// can be called to post-process the result. if no match is made NULL is
// returned.
function attemptReplace(token, pattern, replacement, callback) {
  var result = null;

  if((typeof pattern == 'string') && token.substr(0 - pattern.length) == pattern)
      result = token.replace(new RegExp(pattern + '$'), replacement);
  else if((pattern instanceof RegExp) && token.match(pattern))
      result = token.replace(pattern, replacement);

  if(result && callback)
      return callback(result);
  else
      return result;
}

// attempt to replace a list of patterns/replacements on a token for a minimum
// measure M.
function attemptReplacePatterns(token, replacements, measureThreshold) {
  var replacement = null;

  for(var i = 0; i < replacements.length; i++) {
if(measureThreshold == null || measure(attemptReplace(token, replacements[i][0], '')) > measureThreshold)
    replacement = attemptReplace(token, replacements[i][0], replacements[i][1]);

if(replacement)
    break;
  }

  return replacement;
}

// replace a list of patterns/replacements on a word. if no match is made return
// the original token.
function replacePatterns(token, replacements, measureThreshold) {
  var result = attemptReplacePatterns(token, replacements, measureThreshold);
  token = result == null ? token : result;

  return token;
}

// step 1a as defined for the porter stemmer algorithm.
function step1a(token) {
  if(token.match(/(ss|i)es$/))
      return token.replace(/(ss|i)es$/, '$1');

  if(token.substr(-1) == 's' && token.substr(-2, 1) != 's')
      return token.replace(/s?$/, '');

  return token;
}

// step 1b as defined for the porter stemmer algorithm.
function step1b(token) {
  if(token.substr(-3) == 'eed') {
if(measure(token.substr(0, token.length - 3)) > 0)
          return token.replace(/eed$/, 'ee');
  } else {
var result = attemptReplace(token, /ed|ing$/, '', function(token) {
    if(categorizeGroups(token).indexOf('V') > 0) {
  var result = attemptReplacePatterns(token, [['at', 'ate'],  ['bl', 'ble'], ['iz', 'ize']]);

  if(result)
      return result;
  else {
      if(endsWithDoublCons(token) && token.match(/[^lsz]$/))
    return token.replace(/([^aeiou])\1$/, '$1');

      if(measure(token) == 1 && categorizeChars(token).substr(-3) == 'CVC' && token.match(/[^wxy]$/))
    return token + 'e';
  }

  return token;
    }

    return null;
});

if(result)
    return result;
  }

  return token;
}

// step 1c as defined for the porter stemmer algorithm.
function step1c(token) {
  if(categorizeGroups(token).substr(-2, 1) == 'V') {
      if(token.substr(-1) == 'y')
          return token.replace(/y$/, 'i');
  }

  return token;
}

// step 2 as defined for the porter stemmer algorithm.
function step2(token) {
  return replacePatterns(token, [['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
      ['izer', 'ize'], ['abli', 'able'], ['alli', 'al'], ['entli', 'ent'], ['eli', 'e'],
      ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'], ['ator', 'ate'],['alism', 'al'],
      ['iveness', 'ive'], ['fulness', 'ful'], ['ousness', 'ous'], ['aliti', 'al'],
      ['iviti', 'ive'], ['biliti', 'ble']], 0);
}

// step 3 as defined for the porter stemmer algorithm.
function step3(token) {
  return replacePatterns(token, [['icate', 'ic'], ['ative', ''], ['alize', 'al'],
         ['iciti', 'ic'], ['ical', 'ic'], ['ful', ''], ['ness', '']], 0);
}

// step 4 as defined for the porter stemmer algorithm.
function step4(token) {
  return replacePatterns(token, [['al', ''], ['ance', ''], ['ence', ''], ['er', ''],
      ['ic', ''], ['able', ''], ['ible', ''], ['ant', ''],
      ['ement', ''], ['ment', ''], ['ent', ''], [/([st])ion/, '$1'], ['ou', ''], ['ism', ''],
      ['ate', ''], ['iti', ''], ['ous', ''], ['ive', ''],
      ['ize', '']], 1);
}

// step 5a as defined for the porter stemmer algorithm.
function step5a(token) {
  var m = measure(token);

  if((m > 1 && token.substr(-1) == 'e') || (m == 1 && !(categorizeChars(token).substr(-4, 3) == 'CVC' && token.match(/[^wxy].$/))))
      return token.replace(/e$/, '');

  return token;
}

// step 5b as defined for the porter stemmer algorithm.
function step5b(token) {
  if(measure(token) > 1) {
      if(endsWithDoublCons(token) && token.substr(-2) == 'll')
         return token.replace(/ll$/, 'l');
  }

  return token;
}

var PorterStemmer = new Stemmer();
module.exports = PorterStemmer;

// perform full stemming algorithm on a single word
PorterStemmer.stem = function(token) {
  return step5b(step5a(step4(step3(step2(step1c(step1b(step1a(token.toLowerCase())))))))).toString();
};

//exports for tests
PorterStemmer.step1a = step1a;
PorterStemmer.step1b = step1b;
PorterStemmer.step1c = step1c;
PorterStemmer.step2 = step2;
PorterStemmer.step3 = step3;
PorterStemmer.step4 = step4;
PorterStemmer.step5a = step5a;
PorterStemmer.step5b = step5b;
});

require.define("/lib/natural/stemmers/stemmer.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var stopwords = require('../util/stopwords');
var Tokenizer = require('../tokenizers/aggressive_tokenizer');

module.exports = function() {
  var stemmer = this;

  stemmer.stem = function(token) {
      return token;
  };

  stemmer.tokenizeAndStem = function(text, keepStops) {
      var stemmedTokens = [];

      new Tokenizer().tokenize(text).forEach(function(token) {
          if(keepStops || stopwords.words.indexOf(token) == -1)
              stemmedTokens.push(stemmer.stem(token));
      });

      return stemmedTokens;
  };

  stemmer.attach = function() {
      String.prototype.stem = function() {
          return stemmer.stem(this);
      };

      String.prototype.tokenizeAndStem = function(keepStops) {
          return stemmer.tokenizeAndStem(this, keepStops);
      };
  };
}
});

require.define("/lib/natural/tokenizers/aggressive_tokenizer.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Tokenizer = require('./tokenizer'),
  util = require('util');

AggressiveTokenizer = function() {
  Tokenizer.call(this);
};
util.inherits(AggressiveTokenizer, Tokenizer);

module.exports = AggressiveTokenizer;

AggressiveTokenizer.prototype.tokenize = function(text) {
  // break a string up into an array of tokens by anything non-word
  return this.trim(text.split(/\W+/));
};
});

require.define("/lib/natural/tokenizers/tokenizer.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Tokenizer = function() {
};

Tokenizer.prototype.trim = function(array) {
  if(array[array.length - 1] == '')
      array.pop();

  if(array[0] == '')
      array.shift();

  return array;
};

// expose an attach function that will patch String with a tokenize method
Tokenizer.prototype.attach = function() {
  var tokenizer = this;

  String.prototype.tokenize = function() {
      return tokenizer.tokenize(this);
  }
};

Tokenizer.prototype.tokenize = function() {};

module.exports = Tokenizer;
});

require.define("util",function(require,module,exports,__dirname,__filename,process){var events = require('events');

exports.print = function () {};
exports.puts = function () {};
exports.debug = function() {};

exports.inspect = function(obj, showHidden, depth, colors) {
var seen = [];

var stylize = function(str, styleType) {
  // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
  var styles =
      { 'bold' : [1, 22],
        'italic' : [3, 23],
        'underline' : [4, 24],
        'inverse' : [7, 27],
        'white' : [37, 39],
        'grey' : [90, 39],
        'black' : [30, 39],
        'blue' : [34, 39],
        'cyan' : [36, 39],
        'green' : [32, 39],
        'magenta' : [35, 39],
        'red' : [31, 39],
        'yellow' : [33, 39] };

  var style =
      { 'special': 'cyan',
        'number': 'blue',
        'boolean': 'yellow',
        'undefined': 'grey',
        'null': 'bold',
        'string': 'green',
        'date': 'magenta',
        // "name": intentionally not styling
        'regexp': 'red' }[styleType];

  if (style) {
    return '\033[' + styles[style][0] + 'm' + str +
           '\033[' + styles[style][1] + 'm';
  } else {
    return str;
  }
};
if (! colors) {
  stylize = function(str, styleType) { return str; };
}

function format(value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (value && typeof value.inspect === 'function' &&
      // Filter out the util module, it's inspect function is special
      value !== exports &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    return value.inspect(recurseTimes);
  }

  // Primitive types cannot have properties
  switch (typeof value) {
    case 'undefined':
      return stylize('undefined', 'undefined');

    case 'string':
      var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                               .replace(/'/g, "\\'")
                                               .replace(/\\"/g, '"') + '\'';
      return stylize(simple, 'string');

    case 'number':
      return stylize('' + value, 'number');

    case 'boolean':
      return stylize('' + value, 'boolean');
  }
  // For some reason typeof null is "object", so special case here.
  if (value === null) {
    return stylize('null', 'null');
  }

  // Look up the keys of the object.
  var visible_keys = Object_keys(value);
  var keys = showHidden ? Object_getOwnPropertyNames(value) : visible_keys;

  // Functions without properties can be shortcutted.
  if (typeof value === 'function' && keys.length === 0) {
    if (isRegExp(value)) {
      return stylize('' + value, 'regexp');
    } else {
      var name = value.name ? ': ' + value.name : '';
      return stylize('[Function' + name + ']', 'special');
    }
  }

  // Dates without properties can be shortcutted
  if (isDate(value) && keys.length === 0) {
    return stylize(value.toUTCString(), 'date');
  }

  var base, type, braces;
  // Determine the object type
  if (isArray(value)) {
    type = 'Array';
    braces = ['[', ']'];
  } else {
    type = 'Object';
    braces = ['{', '}'];
  }

  // Make functions say that they are functions
  if (typeof value === 'function') {
    var n = value.name ? ': ' + value.name : '';
    base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';
  } else {
    base = '';
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + value.toUTCString();
  }

  if (keys.length === 0) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return stylize('' + value, 'regexp');
    } else {
      return stylize('[Object]', 'special');
    }
  }

  seen.push(value);

  var output = keys.map(function(key) {
    var name, str;
    if (value.__lookupGetter__) {
      if (value.__lookupGetter__(key)) {
        if (value.__lookupSetter__(key)) {
          str = stylize('[Getter/Setter]', 'special');
        } else {
          str = stylize('[Getter]', 'special');
        }
      } else {
        if (value.__lookupSetter__(key)) {
          str = stylize('[Setter]', 'special');
        }
      }
    }
    if (visible_keys.indexOf(key) < 0) {
      name = '[' + key + ']';
    }
    if (!str) {
      if (seen.indexOf(value[key]) < 0) {
        if (recurseTimes === null) {
          str = format(value[key]);
        } else {
          str = format(value[key], recurseTimes - 1);
        }
        if (str.indexOf('\n') > -1) {
          if (isArray(value)) {
            str = str.split('\n').map(function(line) {
              return '  ' + line;
            }).join('\n').substr(2);
          } else {
            str = '\n' + str.split('\n').map(function(line) {
              return '   ' + line;
            }).join('\n');
          }
        }
      } else {
        str = stylize('[Circular]', 'special');
      }
    }
    if (typeof name === 'undefined') {
      if (type === 'Array' && key.match(/^\d+$/)) {
        return str;
      }
      name = JSON.stringify('' + key);
      if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
        name = name.substr(1, name.length - 2);
        name = stylize(name, 'name');
      } else {
        name = name.replace(/'/g, "\\'")
                   .replace(/\\"/g, '"')
                   .replace(/(^"|"$)/g, "'");
        name = stylize(name, 'string');
      }
    }

    return name + ': ' + str;
  });

  seen.pop();

  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.length + 1;
  }, 0);

  if (length > 50) {
    output = braces[0] +
             (base === '' ? '' : base + '\n ') +
             ' ' +
             output.join(',\n  ') +
             ' ' +
             braces[1];

  } else {
    output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
  }

  return output;
}
return format(obj, (typeof depth === 'undefined' ? 2 : depth));
};


function isArray(ar) {
return ar instanceof Array ||
       Array.isArray(ar) ||
       (ar && ar !== Object.prototype && isArray(ar.__proto__));
}


function isRegExp(re) {
return re instanceof RegExp ||
  (typeof re === 'object' && Object.prototype.toString.call(re) === '[object RegExp]');
}


function isDate(d) {
if (d instanceof Date) return true;
if (typeof d !== 'object') return false;
var properties = Date.prototype && Object_getOwnPropertyNames(Date.prototype);
var proto = d.__proto__ && Object_getOwnPropertyNames(d.__proto__);
return JSON.stringify(proto) === JSON.stringify(properties);
}

function pad(n) {
return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
            'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
var d = new Date();
var time = [pad(d.getHours()),
            pad(d.getMinutes()),
            pad(d.getSeconds())].join(':');
return [d.getDate(), months[d.getMonth()], time].join(' ');
}

exports.log = function (msg) {};

exports.pump = null;

var Object_keys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) res.push(key);
  return res;
};

var Object_getOwnPropertyNames = Object.getOwnPropertyNames || function (obj) {
  var res = [];
  for (var key in obj) {
      if (Object.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

var Object_create = Object.create || function (prototype, properties) {
  // from es5-shim
  var object;
  if (prototype === null) {
      object = { '__proto__' : null };
  }
  else {
      if (typeof prototype !== 'object') {
          throw new TypeError(
              'typeof prototype[' + (typeof prototype) + '] != \'object\''
          );
      }
      var Type = function () {};
      Type.prototype = prototype;
      object = new Type();
      object.__proto__ = prototype;
  }
  if (typeof properties !== 'undefined' && Object.defineProperties) {
      Object.defineProperties(object, properties);
  }
  return object;
};

exports.inherits = function(ctor, superCtor) {
ctor.super_ = superCtor;
ctor.prototype = Object_create(superCtor.prototype, {
  constructor: {
    value: ctor,
    enumerable: false,
    writable: true,
    configurable: true
  }
});
};
});

require.define("events",function(require,module,exports,__dirname,__filename,process){if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
  ? Array.isArray
  : function (xs) {
      return Object.prototype.toString.call(xs) === '[object Array]'
  }
;

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
if (!this._events) this._events = {};
this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
// If there is no 'error' event listener then throw.
if (type === 'error') {
  if (!this._events || !this._events.error ||
      (isArray(this._events.error) && !this._events.error.length))
  {
    if (arguments[1] instanceof Error) {
      throw arguments[1]; // Unhandled 'error' event
    } else {
      throw new Error("Uncaught, unspecified 'error' event.");
    }
    return false;
  }
}

if (!this._events) return false;
var handler = this._events[type];
if (!handler) return false;

if (typeof handler == 'function') {
  switch (arguments.length) {
    // fast cases
    case 1:
      handler.call(this);
      break;
    case 2:
      handler.call(this, arguments[1]);
      break;
    case 3:
      handler.call(this, arguments[1], arguments[2]);
      break;
    // slower
    default:
      var args = Array.prototype.slice.call(arguments, 1);
      handler.apply(this, args);
  }
  return true;

} else if (isArray(handler)) {
  var args = Array.prototype.slice.call(arguments, 1);

  var listeners = handler.slice();
  for (var i = 0, l = listeners.length; i < l; i++) {
    listeners[i].apply(this, args);
  }
  return true;

} else {
  return false;
}
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
if ('function' !== typeof listener) {
  throw new Error('addListener only takes instances of Function');
}

if (!this._events) this._events = {};

// To avoid recursion in the case that type == "newListeners"! Before
// adding it to the listeners, first emit "newListeners".
this.emit('newListener', type, listener);

if (!this._events[type]) {
  // Optimize the case of one listener. Don't need the extra array object.
  this._events[type] = listener;
} else if (isArray(this._events[type])) {

  // Check for listener leak
  if (!this._events[type].warned) {
    var m;
    if (this._events.maxListeners !== undefined) {
      m = this._events.maxListeners;
    } else {
      m = defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  // If we've already got an array, just append.
  this._events[type].push(listener);
} else {
  // Adding the second element, need to change to array.
  this._events[type] = [this._events[type], listener];
}

return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
var self = this;
self.on(type, function g() {
  self.removeListener(type, g);
  listener.apply(this, arguments);
});

return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
if ('function' !== typeof listener) {
  throw new Error('removeListener only takes instances of Function');
}

// does not use listeners(), so no side effect of creating _events[type]
if (!this._events || !this._events[type]) return this;

var list = this._events[type];

if (isArray(list)) {
  var i = list.indexOf(listener);
  if (i < 0) return this;
  list.splice(i, 1);
  if (list.length == 0)
    delete this._events[type];
} else if (this._events[type] === listener) {
  delete this._events[type];
}

return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
// does not use listeners(), so no side effect of creating _events[type]
if (type && this._events && this._events[type]) this._events[type] = null;
return this;
};

EventEmitter.prototype.listeners = function(type) {
if (!this._events) this._events = {};
if (!this._events[type]) this._events[type] = [];
if (!isArray(this._events[type])) {
  this._events[type] = [this._events[type]];
}
return this._events[type];
};
});

require.define("/lib/natural/stemmers/porter_stemmer_ru.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2012, Polyakov Vladimir, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Stemmer = require('./stemmer_ru');

var PorterStemmer = new Stemmer();
module.exports = PorterStemmer;

function attemptReplacePatterns(token, patterns) {
var replacement = null;
var i = 0, isReplaced = false;
while ((i < patterns.length) && !isReplaced) {
  if (patterns[i][0].test(token)) {
    replacement = token.replace(patterns[i][0], patterns[i][1]);
    isReplaced = true;
  }
  i++;
}
return replacement;
};

function perfectiveGerund(token) {
var result = attemptReplacePatterns(token, [
    [/[ая]в(ши|шись)$/g, ''],
    [/(ив|ивши|ившись|ывши|ывшись|ыв)$/g, '']
  ]);
return result;
};

function adjectival(token) {
var result = adjective(token);
if (result != null) {
  var pariticipleResult = participle(result);
  result = pariticipleResult ? pariticipleResult : result;
}
return result;
};

function adjective(token) {
var result = attemptReplacePatterns(token, [
    [/(ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$/g, '']
  ]);
return result;
};

function participle(token) {
var result = attemptReplacePatterns(token, [
  [/([ая])(ем|нн|вш|ющ|щ)$/g, '$1'],
  [/(ивш|ывш|ующ)$/g, '']
]);
return result;
};

function reflexive(token) {
var result = attemptReplacePatterns(token, [
  [/(ся|сь)$/g, '']
]);
return result;
};

function verb(token) {
var result = attemptReplacePatterns(token, [
  [/([ая])(ла|на|ете|йте|ли|й|л|ем|н|ло|но|ет|ют|ны|ть|ешь|нно)$/g, '$1'],
  [/(ила|ыла|ена|ейте|уйте|ите|или|ыли|ей|уй|ил|ыл|им|ым|ен|ило|ыло|ено|ят|ует|ит|ыт|ены|ить|ыть|ишь|ую|ю)$/g, '']
]);
return result;
};

function noun(token) {
var result = attemptReplacePatterns(token, [
  [/(а|ев|ов|ие|ье|е|иями|ями|ами|еи|ии|и|ией|ей|ой|ий|й|иям|ям|ием|ем|ам|ом|о|у|ах|иях|ях|ы|ь|ию|ью|ю|ия|ья|я)$/g, '']
]);
return result;
};

function superlative (token) {
var result = attemptReplacePatterns(token, [
  [/(ейш|ейше)$/g, '']
]);
return result;
};

function derivational (token) {
var result = attemptReplacePatterns(token, [
  [/(ост|ость)$/g, '']
]);
return result;
};

// perform full stemming algorithm on a single word
PorterStemmer.stem = function(token) {
token = token.toLowerCase().replace(/ё/g, 'е');
var volwesRegexp = /^(.*?[аеиоюяуыиэ])(.*)$/g;
var RV = volwesRegexp.exec(token);
if (!RV || RV.length < 3) {
  return token;
}
var head = RV[1];
RV = RV[2];
volwesRegexp.lastIndex = 0;
var R2 = volwesRegexp.exec(RV);
var result = perfectiveGerund(RV);
if (result === null) {
  var resultReflexive = reflexive(RV) || RV;
  result = adjectival(resultReflexive);
  if (result === null) {
    result = verb(resultReflexive);
    if (result === null) {
      result = noun(resultReflexive);
      if (result === null) {
        result = resultReflexive;
      }
    }
  }
}
result = result.replace(/и$/g, '');
var derivationalResult = result
if (R2 && R2[2]) {
  derivationalResult = derivational(R2[2]);
  if (derivationalResult != null) {
    derivationalResult = derivational(result);
  } else {
    derivationalResult = result;
  }
}

var superlativeResult = superlative(derivationalResult) || derivationalResult;

superlativeResult = superlativeResult.replace(/(н)н/g, '$1');
superlativeResult = superlativeResult.replace(/ь$/g, '');
return head + superlativeResult;
};
});

require.define("/lib/natural/stemmers/stemmer_ru.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2012, Polyakov Vladimir, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var stopwords = require('../util/stopwords_ru');
var Tokenizer = require('../tokenizers/aggressive_tokenizer_ru');

module.exports = function() {
  var stemmer = this;

  stemmer.stem = function(token) {
      return token;
  };

  stemmer.tokenizeAndStem = function(text, keepStops) {
      var stemmedTokens = [];

      new Tokenizer().tokenize(text).forEach(function(token) {
          if (keepStops || stopwords.words.indexOf(token) == -1) {
              var resultToken = token.toLowerCase();
              if (resultToken.match(new RegExp('[а-яё0-9]+', 'gi'))) {
                  resultToken = stemmer.stem(resultToken);
              }
              stemmedTokens.push(resultToken);
          }
      });

      return stemmedTokens;
  };

  stemmer.attach = function() {
      String.prototype.stem = function() {
          return stemmer.stem(this);
      };

      String.prototype.tokenizeAndStem = function(keepStops) {
          return stemmer.tokenizeAndStem(this, keepStops);
      };
  };
}
});

require.define("/lib/natural/util/stopwords_ru.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Polyakov Vladimir, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

// a list of commonly used words that have little meaning and can be excluded
// from analysis.
var words = [
  'о', 'после', 'все', 'также', 'и', 'другие', 'все', 'как', 'во', 'быть',
  'потому', 'был', 'до', 'являюсь', 'между', 'все', 'но', 'от', 'иди', 'могу',
  'подойди', 'мог', 'делал', 'делаю', 'каждый', 'для', 'откуда', 'иметь', 'имел',
  'он', 'имеет', 'её', 'здесь', 'его', 'как', 'если', 'в', 'оно', 'за',
  'делать', 'много', 'я', 'может быть', 'более', 'самый', 'должен',
  'мой', 'никогда', 'сейчас', 'из', 'на', 'только', 'или', 'другой', 'другая',
  'другое', 'наше', 'вне', 'конец', 'сказал', 'сказала', 'также', 'видел', 'c',
  'немного', 'все еще', 'так', 'затем', 'тот', 'их', 'там', 'этот', 'они', 'те',
  'через', 'тоже', 'под', 'над', 'очень', 'был', 'путь', 'мы', 'хорошо',
  'что', 'где', 'который', 'пока', 'кто', 'с кем', 'хотел бы', 'ты', 'твои',
  'а', 'б', 'в', 'г', 'д', 'е', 'ё', 'ж', 'з', 'и', 'й', 'к', 'л', 'м', 'н',
  'o', 'п', 'р', 'с', 'т', 'у', 'ф', 'х', 'ц', 'ч', 'ш', 'щ', 'ъ', 'ы', 'ь',
  'э', 'ю', 'я','$', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '_'];

// tell the world about the noise words.
exports.words = words;
});

require.define("/lib/natural/tokenizers/aggressive_tokenizer_ru.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Tokenizer = require('./tokenizer'),
  util = require('util');

AggressiveTokenizer = function() {
  Tokenizer.call(this);
};
util.inherits(AggressiveTokenizer, Tokenizer);

module.exports = AggressiveTokenizer;

AggressiveTokenizer.prototype.clearEmptyString = function(array) {
return array.filter(function(a) {
  return a != '';
});
};

AggressiveTokenizer.prototype.clearText = function(text) {
return text.replace(new RegExp('«|»|!|\\?', 'g'), ' ');
};

AggressiveTokenizer.prototype.tokenize = function(text) {
  // break a string up into an array of tokens by anything non-word
  text = this.clearText(text);
  return this.clearEmptyString(text.split(/-|[|$|\b|\(|\)|[ \s\xA0'\.,:"]+/gi));
};
});

require.define("/lib/natural/stemmers/lancaster_stemmer.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var Stemmer = require('./stemmer');
var ruleTable = require('./lancaster_rules').rules;

function acceptable(candidate) {
  if (candidate.match(/^[aeiou]/))
      return (candidate.length > 1);
  else
      return (candidate.length > 2 && candidate.match(/[aeiouy]/));
}

// take a token, look up the applicatble rule section and attempt some stemming!
function applyRuleSection(token, intact) {
  var section = token.substr( - 1);
  var rules = ruleTable[section];

  if (rules) {
      for (var i = 0; i < rules.length; i++) {
          if ((intact || !rules[i].intact)
          // only apply intact rules to intact tokens
          && token.substr(0 - rules[i].pattern.length) == rules[i].pattern) {
              // hack off only as much as the rule indicates
              var result = token.substr(0, token.length - rules[i].size);

              // if the rules wants us to apply an appendage do so
              if (rules[i].appendage)
                  result += rules[i].appendage;

              if (acceptable(result)) {
                  token = result;

                  // see what the rules wants to do next
                  if (rules[i].continuation) {
                      // this rule thinks there still might be stem left. keep at it.
                      // since we've applied a change we'll pass false in for intact
                      return applyRuleSection(result, false);
                  } else {
                      // the rule thinks we're done stemming. drop out.
                      return result;
                  }
              }
          }
      }
  }

  return token;
}

var LancasterStemmer = new Stemmer();
module.exports = LancasterStemmer;

LancasterStemmer.stem = function(token) {
  return applyRuleSection(token.toLowerCase(), true);
}});

require.define("/lib/natural/stemmers/lancaster_rules.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

exports.rules = {
  "a": [
      {
          "continuation": false,
          "intact": true,
          "pattern": "ia",
          "size": "2"
      },
      {
          "continuation": false,
          "intact": true,
          "pattern": "a",
          "size": "1"
      }
  ],
  "b": [
      {
          "continuation": false,
          "intact": false,
          "pattern": "bb",
          "size": "1"
      }
  ],
  "c": [
      {
          "appendage": "s",
          "continuation": false,
          "intact": false,
          "pattern": "ytic",
          "size": "3"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ic",
          "size": "2"
     },
      {
          "appendage": "t",
          "continuation": true,
          "intact": false,
          "pattern": "nc",
          "size": "1"
      }
  ],
  "d": [
      {
          "continuation": false,
          "intact": false,
          "pattern": "dd",
          "size": "1"
      },
      {
          "appendage": "y",
          "continuation": true,
          "intact": false,
          "pattern": "ied",
          "size": "3"
      },
      {
          "appendage": "s",
          "continuation": false,
          "intact": false,
          "pattern": "ceed",
          "size": "2"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "eed",
          "size": "1"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ed",
          "size": "2"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "hood",
          "size": "4"
      }
  ],
  "e": [
      {
          "continuation": true,
          "intact": false,
          "pattern": "e",
          "size": "1"
      }
  ],
  "f": [
      {
          "appendage": "v",
          "continuation": false,
          "intact": false,
          "pattern": "lief",
          "size": "1"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "if",
          "size": "2"
      }
  ],
  "g": [
      {
          "continuation": true,
          "intact": false,
          "pattern": "ing",
          "size": "3"
      },
      {
          "appendage": "y",
          "continuation": false,
          "intact": false,
          "pattern": "iag",
          "size": "3"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ag",
          "size": "2"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "gg",
          "size": "1"
      }
  ],
  "h": [
      {
          "continuation": false,
          "intact": true,
          "pattern": "th",
          "size": "2"
      },
      {
          "appendage": "c",
          "continuation": false,
          "intact": false,
          "pattern": "guish",
          "size": "5"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ish",
          "size": "3"
      }
  ],
  "i": [
      {
          "continuation": false,
          "intact": true,
          "pattern": "i",
          "size": "1"
      },
      {
          "appendage": "y",
          "continuation": true,
          "intact": false,
          "pattern": "i",
          "size": "1"
      }
  ],
  "j": [
      {
          "appendage": "d",
          "continuation": false,
          "intact": false,
          "pattern": "ij",
          "size": "1"
      },
      {
          "appendage": "s",
          "continuation": false,
          "intact": false,
          "pattern": "fuj",
          "size": "1"
      },
      {
          "appendage": "d",
          "continuation": false,
          "intact": false,
          "pattern": "uj",
          "size": "1"
      },
      {
          "appendage": "d",
          "continuation": false,
          "intact": false,
          "pattern": "oj",
          "size": "1"
      },
      {
          "appendage": "r",
          "continuation": false,
          "intact": false,
          "pattern": "hej",
          "size": "1"
      },
      {
          "appendage": "t",
          "continuation": false,
          "intact": false,
          "pattern": "verj",
          "size": "1"
      },
      {
          "appendage": "t",
          "continuation": false,
          "intact": false,
          "pattern": "misj",
          "size": "2"
      },
      {
          "appendage": "d",
          "continuation": false,
          "intact": false,
          "pattern": "nj",
          "size": "1"
      },
      {
          "appendage": "s",
          "continuation": false,
          "intact": false,
          "pattern": "j",
          "size": "1"
      }
  ],
  "l": [
      {
          "continuation": false,
          "intact": false,
          "pattern": "ifiabl",
          "size": "6"
      },
      {
          "appendage": "y",
          "continuation": false,
          "intact": false,
          "pattern": "iabl",
          "size": "4"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "abl",
          "size": "3"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "ibl",
          "size": "3"
      },
      {
          "appendage": "l",
          "continuation": true,
          "intact": false,
          "pattern": "bil",
          "size": "2"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "cl",
          "size": "1"
      },
      {
          "appendage": "y",
          "continuation": false,
          "intact": false,
          "pattern": "iful",
          "size": "4"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ful",
          "size": "3"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "ul",
          "size": "2"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ial",
          "size": "3"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ual",
          "size": "3"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "al",
          "size": "2"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "ll",
          "size": "1"
      }
  ],
  "m": [
      {
          "continuation": false,
          "intact": false,
          "pattern": "ium",
          "size": "3"
      },
      {
          "continuation": false,
          "intact": true,
          "pattern": "um",
          "size": "2"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ism",
          "size": "3"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "mm",
          "size": "1"
      }
  ],
  "n": [
      {
          "appendage": "j",
          "continuation": true,
          "intact": false,
          "pattern": "sion",
          "size": "4"
      },
      {
          "appendage": "c",
          "continuation": false,
          "intact": false,
          "pattern": "xion",
          "size": "4"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ion",
          "size": "3"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ian",
          "size": "3"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "an",
          "size": "2"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "een",
          "size": "0"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "en",
          "size": "2"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "nn",
          "size": "1"
      }
  ],
  "p": [
      {
          "continuation": true,
          "intact": false,
          "pattern": "ship",
          "size": "4"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "pp",
          "size": "1"
      }
  ],
  "r": [
      {
          "continuation": true,
          "intact": false,
          "pattern": "er",
          "size": "2"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "ear",
          "size": "0"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "ar",
          "size": "2"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "or",
          "size": "2"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ur",
          "size": "2"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "rr",
          "size": "1"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "tr",
          "size": "1"
      },
      {
          "appendage": "y",
          "continuation": true,
          "intact": false,
          "pattern": "ier",
          "size": "3"
      }
  ],
  "s": [
      {
          "appendage": "y",
          "continuation": true,
          "intact": false,
          "pattern": "ies",
          "size": "3"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "sis",
          "size": "2"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "is",
          "size": "2"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ness",
          "size": "4"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "ss",
          "size": "0"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ous",
          "size": "3"
      },
      {
          "continuation": false,
          "intact": true,
          "pattern": "us",
          "size": "2"
      },
      {
          "continuation": true,
          "intact": true,
          "pattern": "s",
          "size": "1"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "s",
          "size": "0"
      }
  ],
  "t": [
      {
          "appendage": "y",
          "continuation": false,
          "intact": false,
          "pattern": "plicat",
          "size": "4"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "at",
          "size": "2"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ment",
          "size": "4"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ent",
          "size": "3"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ant",
          "size": "3"
      },
      {
          "appendage": "b",
          "continuation": false,
          "intact": false,
          "pattern": "ript",
          "size": "2"
      },
      {
          "appendage": "b",
          "continuation": false,
          "intact": false,
          "pattern": "orpt",
          "size": "2"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "duct",
          "size": "1"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "sumpt",
          "size": "2"
      },
      {
          "appendage": "i",
          "continuation": false,
          "intact": false,
          "pattern": "cept",
          "size": "2"
      },
      {
          "appendage": "v",
          "continuation": false,
          "intact": false,
          "pattern": "olut",
          "size": "2"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "sist",
          "size": "0"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ist",
          "size": "3"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "tt",
          "size": "1"
      }
  ],
  "u": [
      {
          "continuation": false,
          "intact": false,
          "pattern": "iqu",
          "size": "3"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "ogu",
          "size": "1"
      }
  ],
  "v": [
      {
          "appendage": "j",
          "continuation": true,
          "intact": false,
          "pattern": "siv",
          "size": "3"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "eiv",
          "size": "0"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "iv",
          "size": "2"
      }
  ],
  "y": [
      {
          "continuation": true,
          "intact": false,
          "pattern": "bly",
          "size": "1"
      },
      {
          "appendage": "y",
          "continuation": true,
          "intact": false,
          "pattern": "ily",
          "size": "3"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "ply",
          "size": "0"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ly",
          "size": "2"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "ogy",
          "size": "1"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "phy",
          "size": "1"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "omy",
          "size": "1"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "opy",
          "size": "1"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ity",
          "size": "3"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ety",
          "size": "3"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "lty",
          "size": "2"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "istry",
          "size": "5"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ary",
          "size": "3"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "ory",
          "size": "3"
      },
      {
          "continuation": false,
          "intact": false,
          "pattern": "ify",
          "size": "3"
      },
      {
          "appendage": "t",
          "continuation": true,
          "intact": false,
          "pattern": "ncy",
          "size": "2"
      },
      {
          "continuation": true,
          "intact": false,
          "pattern": "acy",
          "size": "3"
      }
  ],
  "z": [
      {
          "continuation": true,
          "intact": false,
          "pattern": "iz",
          "size": "2"
      },
      {
          "appendage": "s",
          "continuation": false,
          "intact": false,
          "pattern": "yz",
          "size": "1"
      }
  ]
};

});

require.define("/lib/natural/tokenizers/regexp_tokenizer.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Rob Ellis, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var util = require("util");
var _ = require('underscore')._;
var Tokenizer = require('./tokenizer');

// Base Class for RegExp Matching
RegexpTokenizer = function(options) {
  var options = options || {};
  this._pattern = options.pattern || this._pattern;
  this.discardEmpty = options.discardEmpty || true;

  // Match and split on GAPS not the actual WORDS
  this._gaps = options.gaps;

  if (this._gaps === undefined) {
      this._gaps = true;
  }
}

util.inherits(RegexpTokenizer, Tokenizer);

RegexpTokenizer.prototype.tokenize = function(s) {
  var results;

  if (this._gaps) {
      results = s.split(this._pattern);
      return (this.discardEmpty) ? _.without(results,'',' ') : results;
  } else {
      return s.match(this._pattern);
  }
}

exports.RegexpTokenizer = RegexpTokenizer;

/***
* A tokenizer that divides a text into sequences of alphabetic and
* non-alphabetic characters.  E.g.:
*
*      >>> WordTokenizer().tokenize("She said 'hello'.")
*      ['She', 'said', 'hello']
*
*/
WordTokenizer = function(options) {
  this._pattern = /\W+/;
  RegexpTokenizer.call(this,options)
}

util.inherits(WordTokenizer, RegexpTokenizer);
exports.WordTokenizer = WordTokenizer;

/***
* A tokenizer that divides a text into sequences of alphabetic and
* non-alphabetic characters.  E.g.:
*
*      >>> WordPunctTokenizer().tokenize("She said 'hello'.")
*      ['She', 'said', "'", 'hello', "'."]
*
*/
WordPunctTokenizer = function(options) {
  this._pattern = new RegExp(/(\w+|\!|\'|\"")/i);
  RegexpTokenizer.call(this,options)
}

util.inherits(WordPunctTokenizer, RegexpTokenizer);
exports.WordPunctTokenizer = WordPunctTokenizer;
});

require.define("/node_modules/underscore/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"underscore.js"}});

require.define("/node_modules/underscore/underscore.js",function(require,module,exports,__dirname,__filename,process){//     Underscore.js 1.3.3
//     (c) 2009-2012 Jeremy Ashkenas, DocumentCloud Inc.
//     Underscore is freely distributable under the MIT license.
//     Portions of Underscore are inspired or borrowed from Prototype,
//     Oliver Steele's Functional, and John Resig's Micro-Templating.
//     For all details and documentation:
//     http://documentcloud.github.com/underscore

(function() {

// Baseline setup
// --------------

// Establish the root object, `window` in the browser, or `global` on the server.
var root = this;

// Save the previous value of the `_` variable.
var previousUnderscore = root._;

// Establish the object that gets returned to break out of a loop iteration.
var breaker = {};

// Save bytes in the minified (but not gzipped) version:
var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

// Create quick reference variables for speed access to core prototypes.
var slice            = ArrayProto.slice,
    unshift          = ArrayProto.unshift,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

// All **ECMAScript 5** native function implementations that we hope to use
// are declared here.
var
  nativeForEach      = ArrayProto.forEach,
  nativeMap          = ArrayProto.map,
  nativeReduce       = ArrayProto.reduce,
  nativeReduceRight  = ArrayProto.reduceRight,
  nativeFilter       = ArrayProto.filter,
  nativeEvery        = ArrayProto.every,
  nativeSome         = ArrayProto.some,
  nativeIndexOf      = ArrayProto.indexOf,
  nativeLastIndexOf  = ArrayProto.lastIndexOf,
  nativeIsArray      = Array.isArray,
  nativeKeys         = Object.keys,
  nativeBind         = FuncProto.bind;

// Create a safe reference to the Underscore object for use below.
var _ = function(obj) { return new wrapper(obj); };

// Export the Underscore object for **Node.js**, with
// backwards-compatibility for the old `require()` API. If we're in
// the browser, add `_` as a global object via a string identifier,
// for Closure Compiler "advanced" mode.
if (typeof exports !== 'undefined') {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = _;
  }
  exports._ = _;
} else {
  root['_'] = _;
}

// Current version.
_.VERSION = '1.3.3';

// Collection Functions
// --------------------

// The cornerstone, an `each` implementation, aka `forEach`.
// Handles objects with the built-in `forEach`, arrays, and raw objects.
// Delegates to **ECMAScript 5**'s native `forEach` if available.
var each = _.each = _.forEach = function(obj, iterator, context) {
  if (obj == null) return;
  if (nativeForEach && obj.forEach === nativeForEach) {
    obj.forEach(iterator, context);
  } else if (obj.length === +obj.length) {
    for (var i = 0, l = obj.length; i < l; i++) {
      if (i in obj && iterator.call(context, obj[i], i, obj) === breaker) return;
    }
  } else {
    for (var key in obj) {
      if (_.has(obj, key)) {
        if (iterator.call(context, obj[key], key, obj) === breaker) return;
      }
    }
  }
};

// Return the results of applying the iterator to each element.
// Delegates to **ECMAScript 5**'s native `map` if available.
_.map = _.collect = function(obj, iterator, context) {
  var results = [];
  if (obj == null) return results;
  if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
  each(obj, function(value, index, list) {
    results[results.length] = iterator.call(context, value, index, list);
  });
  if (obj.length === +obj.length) results.length = obj.length;
  return results;
};

// **Reduce** builds up a single result from a list of values, aka `inject`,
// or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
_.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
  var initial = arguments.length > 2;
  if (obj == null) obj = [];
  if (nativeReduce && obj.reduce === nativeReduce) {
    if (context) iterator = _.bind(iterator, context);
    return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
  }
  each(obj, function(value, index, list) {
    if (!initial) {
      memo = value;
      initial = true;
    } else {
      memo = iterator.call(context, memo, value, index, list);
    }
  });
  if (!initial) throw new TypeError('Reduce of empty array with no initial value');
  return memo;
};

// The right-associative version of reduce, also known as `foldr`.
// Delegates to **ECMAScript 5**'s native `reduceRight` if available.
_.reduceRight = _.foldr = function(obj, iterator, memo, context) {
  var initial = arguments.length > 2;
  if (obj == null) obj = [];
  if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
    if (context) iterator = _.bind(iterator, context);
    return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
  }
  var reversed = _.toArray(obj).reverse();
  if (context && !initial) iterator = _.bind(iterator, context);
  return initial ? _.reduce(reversed, iterator, memo, context) : _.reduce(reversed, iterator);
};

// Return the first value which passes a truth test. Aliased as `detect`.
_.find = _.detect = function(obj, iterator, context) {
  var result;
  any(obj, function(value, index, list) {
    if (iterator.call(context, value, index, list)) {
      result = value;
      return true;
    }
  });
  return result;
};

// Return all the elements that pass a truth test.
// Delegates to **ECMAScript 5**'s native `filter` if available.
// Aliased as `select`.
_.filter = _.select = function(obj, iterator, context) {
  var results = [];
  if (obj == null) return results;
  if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
  each(obj, function(value, index, list) {
    if (iterator.call(context, value, index, list)) results[results.length] = value;
  });
  return results;
};

// Return all the elements for which a truth test fails.
_.reject = function(obj, iterator, context) {
  var results = [];
  if (obj == null) return results;
  each(obj, function(value, index, list) {
    if (!iterator.call(context, value, index, list)) results[results.length] = value;
  });
  return results;
};

// Determine whether all of the elements match a truth test.
// Delegates to **ECMAScript 5**'s native `every` if available.
// Aliased as `all`.
_.every = _.all = function(obj, iterator, context) {
  var result = true;
  if (obj == null) return result;
  if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
  each(obj, function(value, index, list) {
    if (!(result = result && iterator.call(context, value, index, list))) return breaker;
  });
  return !!result;
};

// Determine if at least one element in the object matches a truth test.
// Delegates to **ECMAScript 5**'s native `some` if available.
// Aliased as `any`.
var any = _.some = _.any = function(obj, iterator, context) {
  iterator || (iterator = _.identity);
  var result = false;
  if (obj == null) return result;
  if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
  each(obj, function(value, index, list) {
    if (result || (result = iterator.call(context, value, index, list))) return breaker;
  });
  return !!result;
};

// Determine if a given value is included in the array or object using `===`.
// Aliased as `contains`.
_.include = _.contains = function(obj, target) {
  var found = false;
  if (obj == null) return found;
  if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
  found = any(obj, function(value) {
    return value === target;
  });
  return found;
};

// Invoke a method (with arguments) on every item in a collection.
_.invoke = function(obj, method) {
  var args = slice.call(arguments, 2);
  return _.map(obj, function(value) {
    return (_.isFunction(method) ? method || value : value[method]).apply(value, args);
  });
};

// Convenience version of a common use case of `map`: fetching a property.
_.pluck = function(obj, key) {
  return _.map(obj, function(value){ return value[key]; });
};

// Return the maximum element or (element-based computation).
_.max = function(obj, iterator, context) {
  if (!iterator && _.isArray(obj) && obj[0] === +obj[0]) return Math.max.apply(Math, obj);
  if (!iterator && _.isEmpty(obj)) return -Infinity;
  var result = {computed : -Infinity};
  each(obj, function(value, index, list) {
    var computed = iterator ? iterator.call(context, value, index, list) : value;
    computed >= result.computed && (result = {value : value, computed : computed});
  });
  return result.value;
};

// Return the minimum element (or element-based computation).
_.min = function(obj, iterator, context) {
  if (!iterator && _.isArray(obj) && obj[0] === +obj[0]) return Math.min.apply(Math, obj);
  if (!iterator && _.isEmpty(obj)) return Infinity;
  var result = {computed : Infinity};
  each(obj, function(value, index, list) {
    var computed = iterator ? iterator.call(context, value, index, list) : value;
    computed < result.computed && (result = {value : value, computed : computed});
  });
  return result.value;
};

// Shuffle an array.
_.shuffle = function(obj) {
  var shuffled = [], rand;
  each(obj, function(value, index, list) {
    rand = Math.floor(Math.random() * (index + 1));
    shuffled[index] = shuffled[rand];
    shuffled[rand] = value;
  });
  return shuffled;
};

// Sort the object's values by a criterion produced by an iterator.
_.sortBy = function(obj, val, context) {
  var iterator = _.isFunction(val) ? val : function(obj) { return obj[val]; };
  return _.pluck(_.map(obj, function(value, index, list) {
    return {
      value : value,
      criteria : iterator.call(context, value, index, list)
    };
  }).sort(function(left, right) {
    var a = left.criteria, b = right.criteria;
    if (a === void 0) return 1;
    if (b === void 0) return -1;
    return a < b ? -1 : a > b ? 1 : 0;
  }), 'value');
};

// Groups the object's values by a criterion. Pass either a string attribute
// to group by, or a function that returns the criterion.
_.groupBy = function(obj, val) {
  var result = {};
  var iterator = _.isFunction(val) ? val : function(obj) { return obj[val]; };
  each(obj, function(value, index) {
    var key = iterator(value, index);
    (result[key] || (result[key] = [])).push(value);
  });
  return result;
};

// Use a comparator function to figure out at what index an object should
// be inserted so as to maintain order. Uses binary search.
_.sortedIndex = function(array, obj, iterator) {
  iterator || (iterator = _.identity);
  var low = 0, high = array.length;
  while (low < high) {
    var mid = (low + high) >> 1;
    iterator(array[mid]) < iterator(obj) ? low = mid + 1 : high = mid;
  }
  return low;
};

// Safely convert anything iterable into a real, live array.
_.toArray = function(obj) {
  if (!obj)                                     return [];
  if (_.isArray(obj))                           return slice.call(obj);
  if (_.isArguments(obj))                       return slice.call(obj);
  if (obj.toArray && _.isFunction(obj.toArray)) return obj.toArray();
  return _.values(obj);
};

// Return the number of elements in an object.
_.size = function(obj) {
  return _.isArray(obj) ? obj.length : _.keys(obj).length;
};

// Array Functions
// ---------------

// Get the first element of an array. Passing **n** will return the first N
// values in the array. Aliased as `head` and `take`. The **guard** check
// allows it to work with `_.map`.
_.first = _.head = _.take = function(array, n, guard) {
  return (n != null) && !guard ? slice.call(array, 0, n) : array[0];
};

// Returns everything but the last entry of the array. Especcialy useful on
// the arguments object. Passing **n** will return all the values in
// the array, excluding the last N. The **guard** check allows it to work with
// `_.map`.
_.initial = function(array, n, guard) {
  return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
};

// Get the last element of an array. Passing **n** will return the last N
// values in the array. The **guard** check allows it to work with `_.map`.
_.last = function(array, n, guard) {
  if ((n != null) && !guard) {
    return slice.call(array, Math.max(array.length - n, 0));
  } else {
    return array[array.length - 1];
  }
};

// Returns everything but the first entry of the array. Aliased as `tail`.
// Especially useful on the arguments object. Passing an **index** will return
// the rest of the values in the array from that index onward. The **guard**
// check allows it to work with `_.map`.
_.rest = _.tail = function(array, index, guard) {
  return slice.call(array, (index == null) || guard ? 1 : index);
};

// Trim out all falsy values from an array.
_.compact = function(array) {
  return _.filter(array, function(value){ return !!value; });
};

// Return a completely flattened version of an array.
_.flatten = function(array, shallow) {
  return _.reduce(array, function(memo, value) {
    if (_.isArray(value)) return memo.concat(shallow ? value : _.flatten(value));
    memo[memo.length] = value;
    return memo;
  }, []);
};

// Return a version of the array that does not contain the specified value(s).
_.without = function(array) {
  return _.difference(array, slice.call(arguments, 1));
};

// Produce a duplicate-free version of the array. If the array has already
// been sorted, you have the option of using a faster algorithm.
// Aliased as `unique`.
_.uniq = _.unique = function(array, isSorted, iterator) {
  var initial = iterator ? _.map(array, iterator) : array;
  var results = [];
  // The `isSorted` flag is irrelevant if the array only contains two elements.
  if (array.length < 3) isSorted = true;
  _.reduce(initial, function (memo, value, index) {
    if (isSorted ? _.last(memo) !== value || !memo.length : !_.include(memo, value)) {
      memo.push(value);
      results.push(array[index]);
    }
    return memo;
  }, []);
  return results;
};

// Produce an array that contains the union: each distinct element from all of
// the passed-in arrays.
_.union = function() {
  return _.uniq(_.flatten(arguments, true));
};

// Produce an array that contains every item shared between all the
// passed-in arrays. (Aliased as "intersect" for back-compat.)
_.intersection = _.intersect = function(array) {
  var rest = slice.call(arguments, 1);
  return _.filter(_.uniq(array), function(item) {
    return _.every(rest, function(other) {
      return _.indexOf(other, item) >= 0;
    });
  });
};

// Take the difference between one array and a number of other arrays.
// Only the elements present in just the first array will remain.
_.difference = function(array) {
  var rest = _.flatten(slice.call(arguments, 1), true);
  return _.filter(array, function(value){ return !_.include(rest, value); });
};

// Zip together multiple lists into a single array -- elements that share
// an index go together.
_.zip = function() {
  var args = slice.call(arguments);
  var length = _.max(_.pluck(args, 'length'));
  var results = new Array(length);
  for (var i = 0; i < length; i++) results[i] = _.pluck(args, "" + i);
  return results;
};

// If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
// we need this function. Return the position of the first occurrence of an
// item in an array, or -1 if the item is not included in the array.
// Delegates to **ECMAScript 5**'s native `indexOf` if available.
// If the array is large and already in sort order, pass `true`
// for **isSorted** to use binary search.
_.indexOf = function(array, item, isSorted) {
  if (array == null) return -1;
  var i, l;
  if (isSorted) {
    i = _.sortedIndex(array, item);
    return array[i] === item ? i : -1;
  }
  if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item);
  for (i = 0, l = array.length; i < l; i++) if (i in array && array[i] === item) return i;
  return -1;
};

// Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
_.lastIndexOf = function(array, item) {
  if (array == null) return -1;
  if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) return array.lastIndexOf(item);
  var i = array.length;
  while (i--) if (i in array && array[i] === item) return i;
  return -1;
};

// Generate an integer Array containing an arithmetic progression. A port of
// the native Python `range()` function. See
// [the Python documentation](http://docs.python.org/library/functions.html#range).
_.range = function(start, stop, step) {
  if (arguments.length <= 1) {
    stop = start || 0;
    start = 0;
  }
  step = arguments[2] || 1;

  var len = Math.max(Math.ceil((stop - start) / step), 0);
  var idx = 0;
  var range = new Array(len);

  while(idx < len) {
    range[idx++] = start;
    start += step;
  }

  return range;
};

// Function (ahem) Functions
// ------------------

// Reusable constructor function for prototype setting.
var ctor = function(){};

// Create a function bound to a given object (assigning `this`, and arguments,
// optionally). Binding with arguments is also known as `curry`.
// Delegates to **ECMAScript 5**'s native `Function.bind` if available.
// We check for `func.bind` first, to fail fast when `func` is undefined.
_.bind = function bind(func, context) {
  var bound, args;
  if (func.bind === nativeBind && nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
  if (!_.isFunction(func)) throw new TypeError;
  args = slice.call(arguments, 2);
  return bound = function() {
    if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
    ctor.prototype = func.prototype;
    var self = new ctor;
    var result = func.apply(self, args.concat(slice.call(arguments)));
    if (Object(result) === result) return result;
    return self;
  };
};

// Bind all of an object's methods to that object. Useful for ensuring that
// all callbacks defined on an object belong to it.
_.bindAll = function(obj) {
  var funcs = slice.call(arguments, 1);
  if (funcs.length == 0) funcs = _.functions(obj);
  each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
  return obj;
};

// Memoize an expensive function by storing its results.
_.memoize = function(func, hasher) {
  var memo = {};
  hasher || (hasher = _.identity);
  return function() {
    var key = hasher.apply(this, arguments);
    return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
  };
};

// Delays a function for the given number of milliseconds, and then calls
// it with the arguments supplied.
_.delay = function(func, wait) {
  var args = slice.call(arguments, 2);
  return setTimeout(function(){ return func.apply(null, args); }, wait);
};

// Defers a function, scheduling it to run after the current call stack has
// cleared.
_.defer = function(func) {
  return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
};

// Returns a function, that, when invoked, will only be triggered at most once
// during a given window of time.
_.throttle = function(func, wait) {
  var context, args, timeout, throttling, more, result;
  var whenDone = _.debounce(function(){ more = throttling = false; }, wait);
  return function() {
    context = this; args = arguments;
    var later = function() {
      timeout = null;
      if (more) func.apply(context, args);
      whenDone();
    };
    if (!timeout) timeout = setTimeout(later, wait);
    if (throttling) {
      more = true;
    } else {
      result = func.apply(context, args);
    }
    whenDone();
    throttling = true;
    return result;
  };
};

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
_.debounce = function(func, wait, immediate) {
  var timeout;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    if (immediate && !timeout) func.apply(context, args);
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Returns a function that will be executed at most one time, no matter how
// often you call it. Useful for lazy initialization.
_.once = function(func) {
  var ran = false, memo;
  return function() {
    if (ran) return memo;
    ran = true;
    return memo = func.apply(this, arguments);
  };
};

// Returns the first function passed as an argument to the second,
// allowing you to adjust arguments, run code before and after, and
// conditionally execute the original function.
_.wrap = function(func, wrapper) {
  return function() {
    var args = [func].concat(slice.call(arguments, 0));
    return wrapper.apply(this, args);
  };
};

// Returns a function that is the composition of a list of functions, each
// consuming the return value of the function that follows.
_.compose = function() {
  var funcs = arguments;
  return function() {
    var args = arguments;
    for (var i = funcs.length - 1; i >= 0; i--) {
      args = [funcs[i].apply(this, args)];
    }
    return args[0];
  };
};

// Returns a function that will only be executed after being called N times.
_.after = function(times, func) {
  if (times <= 0) return func();
  return function() {
    if (--times < 1) { return func.apply(this, arguments); }
  };
};

// Object Functions
// ----------------

// Retrieve the names of an object's properties.
// Delegates to **ECMAScript 5**'s native `Object.keys`
_.keys = nativeKeys || function(obj) {
  if (obj !== Object(obj)) throw new TypeError('Invalid object');
  var keys = [];
  for (var key in obj) if (_.has(obj, key)) keys[keys.length] = key;
  return keys;
};

// Retrieve the values of an object's properties.
_.values = function(obj) {
  return _.map(obj, _.identity);
};

// Return a sorted list of the function names available on the object.
// Aliased as `methods`
_.functions = _.methods = function(obj) {
  var names = [];
  for (var key in obj) {
    if (_.isFunction(obj[key])) names.push(key);
  }
  return names.sort();
};

// Extend a given object with all the properties in passed-in object(s).
_.extend = function(obj) {
  each(slice.call(arguments, 1), function(source) {
    for (var prop in source) {
      obj[prop] = source[prop];
    }
  });
  return obj;
};

// Return a copy of the object only containing the whitelisted properties.
_.pick = function(obj) {
  var result = {};
  each(_.flatten(slice.call(arguments, 1)), function(key) {
    if (key in obj) result[key] = obj[key];
  });
  return result;
};

// Fill in a given object with default properties.
_.defaults = function(obj) {
  each(slice.call(arguments, 1), function(source) {
    for (var prop in source) {
      if (obj[prop] == null) obj[prop] = source[prop];
    }
  });
  return obj;
};

// Create a (shallow-cloned) duplicate of an object.
_.clone = function(obj) {
  if (!_.isObject(obj)) return obj;
  return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
};

// Invokes interceptor with the obj, and then returns obj.
// The primary purpose of this method is to "tap into" a method chain, in
// order to perform operations on intermediate results within the chain.
_.tap = function(obj, interceptor) {
  interceptor(obj);
  return obj;
};

// Internal recursive comparison function.
function eq(a, b, stack) {
  // Identical objects are equal. `0 === -0`, but they aren't identical.
  // See the Harmony `egal` proposal: http://wiki.ecmascript.org/doku.php?id=harmony:egal.
  if (a === b) return a !== 0 || 1 / a == 1 / b;
  // A strict comparison is necessary because `null == undefined`.
  if (a == null || b == null) return a === b;
  // Unwrap any wrapped objects.
  if (a._chain) a = a._wrapped;
  if (b._chain) b = b._wrapped;
  // Invoke a custom `isEqual` method if one is provided.
  if (a.isEqual && _.isFunction(a.isEqual)) return a.isEqual(b);
  if (b.isEqual && _.isFunction(b.isEqual)) return b.isEqual(a);
  // Compare `[[Class]]` names.
  var className = toString.call(a);
  if (className != toString.call(b)) return false;
  switch (className) {
    // Strings, numbers, dates, and booleans are compared by value.
    case '[object String]':
      // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
      // equivalent to `new String("5")`.
      return a == String(b);
    case '[object Number]':
      // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
      // other numeric values.
      return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
    case '[object Date]':
    case '[object Boolean]':
      // Coerce dates and booleans to numeric primitive values. Dates are compared by their
      // millisecond representations. Note that invalid dates with millisecond representations
      // of `NaN` are not equivalent.
      return +a == +b;
    // RegExps are compared by their source patterns and flags.
    case '[object RegExp]':
      return a.source == b.source &&
             a.global == b.global &&
             a.multiline == b.multiline &&
             a.ignoreCase == b.ignoreCase;
  }
  if (typeof a != 'object' || typeof b != 'object') return false;
  // Assume equality for cyclic structures. The algorithm for detecting cyclic
  // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
  var length = stack.length;
  while (length--) {
    // Linear search. Performance is inversely proportional to the number of
    // unique nested structures.
    if (stack[length] == a) return true;
  }
  // Add the first object to the stack of traversed objects.
  stack.push(a);
  var size = 0, result = true;
  // Recursively compare objects and arrays.
  if (className == '[object Array]') {
    // Compare array lengths to determine if a deep comparison is necessary.
    size = a.length;
    result = size == b.length;
    if (result) {
      // Deep compare the contents, ignoring non-numeric properties.
      while (size--) {
        // Ensure commutative equality for sparse arrays.
        if (!(result = size in a == size in b && eq(a[size], b[size], stack))) break;
      }
    }
  } else {
    // Objects with different constructors are not equivalent.
    if ('constructor' in a != 'constructor' in b || a.constructor != b.constructor) return false;
    // Deep compare objects.
    for (var key in a) {
      if (_.has(a, key)) {
        // Count the expected number of properties.
        size++;
        // Deep compare each member.
        if (!(result = _.has(b, key) && eq(a[key], b[key], stack))) break;
      }
    }
    // Ensure that both objects contain the same number of properties.
    if (result) {
      for (key in b) {
        if (_.has(b, key) && !(size--)) break;
      }
      result = !size;
    }
  }
  // Remove the first object from the stack of traversed objects.
  stack.pop();
  return result;
}

// Perform a deep comparison to check if two objects are equal.
_.isEqual = function(a, b) {
  return eq(a, b, []);
};

// Is a given array, string, or object empty?
// An "empty" object has no enumerable own-properties.
_.isEmpty = function(obj) {
  if (obj == null) return true;
  if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
  for (var key in obj) if (_.has(obj, key)) return false;
  return true;
};

// Is a given value a DOM element?
_.isElement = function(obj) {
  return !!(obj && obj.nodeType == 1);
};

// Is a given value an array?
// Delegates to ECMA5's native Array.isArray
_.isArray = nativeIsArray || function(obj) {
  return toString.call(obj) == '[object Array]';
};

// Is a given variable an object?
_.isObject = function(obj) {
  return obj === Object(obj);
};

// Is a given variable an arguments object?
_.isArguments = function(obj) {
  return toString.call(obj) == '[object Arguments]';
};
if (!_.isArguments(arguments)) {
  _.isArguments = function(obj) {
    return !!(obj && _.has(obj, 'callee'));
  };
}

// Is a given value a function?
_.isFunction = function(obj) {
  return toString.call(obj) == '[object Function]';
};

// Is a given value a string?
_.isString = function(obj) {
  return toString.call(obj) == '[object String]';
};

// Is a given value a number?
_.isNumber = function(obj) {
  return toString.call(obj) == '[object Number]';
};

// Is a given object a finite number?
_.isFinite = function(obj) {
  return _.isNumber(obj) && isFinite(obj);
};

// Is the given value `NaN`?
_.isNaN = function(obj) {
  // `NaN` is the only value for which `===` is not reflexive.
  return obj !== obj;
};

// Is a given value a boolean?
_.isBoolean = function(obj) {
  return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
};

// Is a given value a date?
_.isDate = function(obj) {
  return toString.call(obj) == '[object Date]';
};

// Is the given value a regular expression?
_.isRegExp = function(obj) {
  return toString.call(obj) == '[object RegExp]';
};

// Is a given value equal to null?
_.isNull = function(obj) {
  return obj === null;
};

// Is a given variable undefined?
_.isUndefined = function(obj) {
  return obj === void 0;
};

// Has own property?
_.has = function(obj, key) {
  return hasOwnProperty.call(obj, key);
};

// Utility Functions
// -----------------

// Run Underscore.js in *noConflict* mode, returning the `_` variable to its
// previous owner. Returns a reference to the Underscore object.
_.noConflict = function() {
  root._ = previousUnderscore;
  return this;
};

// Keep the identity function around for default iterators.
_.identity = function(value) {
  return value;
};

// Run a function **n** times.
_.times = function (n, iterator, context) {
  for (var i = 0; i < n; i++) iterator.call(context, i);
};

// Escape a string for HTML interpolation.
_.escape = function(string) {
  return (''+string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g,'&#x2F;');
};

// If the value of the named property is a function then invoke it;
// otherwise, return it.
_.result = function(object, property) {
  if (object == null) return null;
  var value = object[property];
  return _.isFunction(value) ? value.call(object) : value;
};

// Add your own custom functions to the Underscore object, ensuring that
// they're correctly added to the OOP wrapper as well.
_.mixin = function(obj) {
  each(_.functions(obj), function(name){
    addToWrapper(name, _[name] = obj[name]);
  });
};

// Generate a unique integer id (unique within the entire client session).
// Useful for temporary DOM ids.
var idCounter = 0;
_.uniqueId = function(prefix) {
  var id = idCounter++;
  return prefix ? prefix + id : id;
};

// By default, Underscore uses ERB-style template delimiters, change the
// following template settings to use alternative delimiters.
_.templateSettings = {
  evaluate    : /<%([\s\S]+?)%>/g,
  interpolate : /<%=([\s\S]+?)%>/g,
  escape      : /<%-([\s\S]+?)%>/g
};

// When customizing `templateSettings`, if you don't want to define an
// interpolation, evaluation or escaping regex, we need one that is
// guaranteed not to match.
var noMatch = /.^/;

// Certain characters need to be escaped so that they can be put into a
// string literal.
var escapes = {
  '\\': '\\',
  "'": "'",
  'r': '\r',
  'n': '\n',
  't': '\t',
  'u2028': '\u2028',
  'u2029': '\u2029'
};

for (var p in escapes) escapes[escapes[p]] = p;
var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;
var unescaper = /\\(\\|'|r|n|t|u2028|u2029)/g;

// Within an interpolation, evaluation, or escaping, remove HTML escaping
// that had been previously added.
var unescape = function(code) {
  return code.replace(unescaper, function(match, escape) {
    return escapes[escape];
  });
};

// JavaScript micro-templating, similar to John Resig's implementation.
// Underscore templating handles arbitrary delimiters, preserves whitespace,
// and correctly escapes quotes within interpolated code.
_.template = function(text, data, settings) {
  settings = _.defaults(settings || {}, _.templateSettings);

  // Compile the template source, taking care to escape characters that
  // cannot be included in a string literal and then unescape them in code
  // blocks.
  var source = "__p+='" + text
    .replace(escaper, function(match) {
      return '\\' + escapes[match];
    })
    .replace(settings.escape || noMatch, function(match, code) {
      return "'+\n_.escape(" + unescape(code) + ")+\n'";
    })
    .replace(settings.interpolate || noMatch, function(match, code) {
      return "'+\n(" + unescape(code) + ")+\n'";
    })
    .replace(settings.evaluate || noMatch, function(match, code) {
      return "';\n" + unescape(code) + "\n;__p+='";
    }) + "';\n";

  // If a variable is not specified, place data values in local scope.
  if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

  source = "var __p='';" +
    "var print=function(){__p+=Array.prototype.join.call(arguments, '')};\n" +
    source + "return __p;\n";

  var render = new Function(settings.variable || 'obj', '_', source);
  if (data) return render(data, _);
  var template = function(data) {
    return render.call(this, data, _);
  };

  // Provide the compiled function source as a convenience for build time
  // precompilation.
  template.source = 'function(' + (settings.variable || 'obj') + '){\n' +
    source + '}';

  return template;
};

// Add a "chain" function, which will delegate to the wrapper.
_.chain = function(obj) {
  return _(obj).chain();
};

// The OOP Wrapper
// ---------------

// If Underscore is called as a function, it returns a wrapped object that
// can be used OO-style. This wrapper holds altered versions of all the
// underscore functions. Wrapped objects may be chained.
var wrapper = function(obj) { this._wrapped = obj; };

// Expose `wrapper.prototype` as `_.prototype`
_.prototype = wrapper.prototype;

// Helper function to continue chaining intermediate results.
var result = function(obj, chain) {
  return chain ? _(obj).chain() : obj;
};

// A method to easily add functions to the OOP wrapper.
var addToWrapper = function(name, func) {
  wrapper.prototype[name] = function() {
    var args = slice.call(arguments);
    unshift.call(args, this._wrapped);
    return result(func.apply(_, args), this._chain);
  };
};

// Add all of the Underscore functions to the wrapper object.
_.mixin(_);

// Add all mutator Array functions to the wrapper.
each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
  var method = ArrayProto[name];
  wrapper.prototype[name] = function() {
    var wrapped = this._wrapped;
    method.apply(wrapped, arguments);
    var length = wrapped.length;
    if ((name == 'shift' || name == 'splice') && length === 0) delete wrapped[0];
    return result(wrapped, this._chain);
  };
});

// Add all accessor Array functions to the wrapper.
each(['concat', 'join', 'slice'], function(name) {
  var method = ArrayProto[name];
  wrapper.prototype[name] = function() {
    return result(method.apply(this._wrapped, arguments), this._chain);
  };
});

// Start chaining a wrapped Underscore object.
wrapper.prototype.chain = function() {
  this._chain = true;
  return this;
};

// Extracts the result from a wrapped and chained object.
wrapper.prototype.value = function() {
  return this._wrapped;
};

}).call(this);
});

require.define("/lib/natural/tokenizers/treebank_word_tokenizer.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Rob Ellis, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var util = require("util"),
  Tokenizer = require('./tokenizer'),
  _ = require('underscore')._;

var contractions2 = [
  /(.)('ll|'re|'ve|n't|'s|'m|'d)\b/ig,
  /\b(can)(not)\b/ig,
  /\b(D)('ye)\b/ig,
  /\b(Gim)(me)\b/ig,
  /\b(Gon)(na)\b/ig,
  /\b(Got)(ta)\b/ig,
  /\b(Lem)(me)\b/ig,
  /\b(Mor)('n)\b/ig,
  /\b(T)(is)\b/ig,
  /\b(T)(was)\b/ig,
  /\b(Wan)(na)\b/ig];

var contractions3 = [
  /\b(Whad)(dd)(ya)\b/ig,
  /\b(Wha)(t)(cha)\b/ig
];

TreebankWordTokenizer = function() {
}

util.inherits(TreebankWordTokenizer, Tokenizer);

TreebankWordTokenizer.prototype.tokenize = function(text) {
  contractions2.forEach(function(regexp) {
text = text.replace(regexp,"$1 $2");
  });

  contractions3.forEach(function(regexp) {
text = text.replace(regexp,"$1 $2 $3");
  });

  // most punctuation
  text = text.replace(/([^\w\.\'\-\/\+\<\>,&])/g, " $1 ");

  // commas if followed by space
  text = text.replace(/(,\s)/g, " $1");

  // single quotes if followed by a space
  text = text.replace(/('\s)/g, " $1");

  // periods before newline or end of string
  text = text.replace(/\. *(\n|$)/g, " . ");

  return  _.without(text.split(/\s+/), '');
}

module.exports = TreebankWordTokenizer;
});

require.define("/lib/natural/inflectors/noun_inflector.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var SingularPluralInflector = require('./singular_plural_inflector'),
  util = require('util'),
  FormSet = require('./form_set');

function attach() {
  var inflector = this;

  String.prototype.singularizeNoun = function() {
      return inflector.singularize(this);
  }

  String.prototype.pluralizeNoun = function() {
      return inflector.pluralize(this);
  }
}

var NounInflector = function() {
  this.ambiguous = [
      'bison', 'bream', 'carp', 'chassis', 'cod', 'corps', 'debris', 'deer',
      'diabetes', 'equipment', 'elk', 'fish', 'flounder', 'gallows', 'graffiti',
      'headquarters', 'herpes', 'highjinks', 'homework', 'information',
      'mackerel', 'mews', 'money', 'news', 'rice', 'rabies', 'salmon', 'series',
      'sheep', 'shrimp', 'species', 'swine', 'trout', 'tuna', 'whiting', 'wildebeest'
  ];

  this.customPluralForms = [];
  this.customSingularForms = [];
  this.singularForms = new FormSet();
  this.pluralForms = new FormSet();

  this.attach = attach;

  this.addIrregular("child", "children");
  this.addIrregular("man", "men");
  this.addIrregular("person", "people");
  this.addIrregular("sex", "sexes");
  this.addIrregular("mouse", "mice");
  this.addIrregular("ox", "oxen");
  this.addIrregular("foot", "feet");
  this.addIrregular("tooth", "teeth");
  this.addIrregular("goose", "geese");

  // see if it is possible to unify the creation of both the singular and
  // plural regexes or maybe even just have one list. with a complete list
  // of rules it may only be possible for some regular forms, but worth a shot
  this.pluralForms.regularForms.push([/y$/i, 'ies']);
  this.pluralForms.regularForms.push([/ife$/i, 'ives']);
  this.pluralForms.regularForms.push([/(antenn|formul|nebul|vertebr|vit)a$/i, '$1ae']);
  this.pluralForms.regularForms.push([/(octop|vir|radi|nucle|fung|cact|stimul)us$/i, '$1i']);
  this.pluralForms.regularForms.push([/(buffal|tomat)o$/i, '$1oes']);
  this.pluralForms.regularForms.push([/(sis)$/i, 'ses']);
  this.pluralForms.regularForms.push([/(matr|vert|ind)(ix|ex)$/i, '$1ices']);
  this.pluralForms.regularForms.push([/(x|ch|ss|sh|s|z)$/i, '$1es']);
  this.pluralForms.regularForms.push([/^(?!talis|.*hu)(.*)man$/i, '$1men']);
  this.pluralForms.regularForms.push([/(.*)/i, '$1s']);

  this.singularForms.regularForms.push([/([^v])ies$/i, '$1y']);
  this.singularForms.regularForms.push([/ives$/i, 'ife']);
  this.singularForms.regularForms.push([/(antenn|formul|nebul|vertebr|vit)ae$/i, '$1a']);
  this.singularForms.regularForms.push([/(octop|vir|radi|nucle|fung|cact|stimul)(i)$/i, '$1us']);
  this.singularForms.regularForms.push([/(buffal|tomat)(oes)$/i, '$1o']);
  this.singularForms.regularForms.push([/(analy|naly|synop|parenthe|diagno|the)ses$/i, '$1sis']);
  this.singularForms.regularForms.push([/(vert|ind)(ices)$/i, '$1ex']);
  // our pluralizer won''t cause this form of appendix (appendicies)
  // but we should handle it
  this.singularForms.regularForms.push([/(matr|append)(ices)$/i, '$1ix']);
  this.singularForms.regularForms.push([/(x|ch|ss|sh|s|z)es$/i, '$1']);
  this.singularForms.regularForms.push([/men$/i, 'man']);
  this.singularForms.regularForms.push([/s$/i, '']);

  this.pluralize = function (token) {
      return this.ize(token, this.pluralForms, this.customPluralForms);
  };

  this.singularize = function(token) {
      return this.ize(token, this.singularForms, this.customSingularForms);
  };
};

util.inherits(NounInflector, SingularPluralInflector);

module.exports = NounInflector;
});

require.define("/lib/natural/inflectors/singular_plural_inflector.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var TenseInflector = function () {
};

TenseInflector.prototype.addSingular = function(pattern, replacement) {
  this.customSingularForms.push([pattern, replacement]);
};

TenseInflector.prototype.addPlural = function(pattern, replacement) {
  this.customPluralForms.push([pattern, replacement]);
};

TenseInflector.prototype.ize = function (token, formSet, customForms) {
  var restoreCase = this.restoreCase(token);
  return restoreCase(this.izeRegExps(token, customForms) || this.izeAbiguous(token) ||
      this.izeRegulars(token, formSet) || this.izeRegExps(token, formSet.regularForms) ||
      token);
}

TenseInflector.prototype.izeAbiguous = function (token) {
  if(this.ambiguous.indexOf(token.toLowerCase()) > -1)
      return token.toLowerCase();

  return false;
}

TenseInflector.prototype.pluralize = function (token) {
  return this.ize(token, this.pluralForms, this.customPluralForms);
};

TenseInflector.prototype.singularize = function(token) {
  return this.ize(token, this.singularForms, this.customSingularForms);
};

var uppercaseify = function(token) {
  return token.toUpperCase();
}
var capitalize = function(token) {
  return token[0].toUpperCase() + token.slice(1);
}
var lowercaseify = function(token) {
  return token.toLowerCase();
}

TenseInflector.prototype.restoreCase = function(token) {
  if (token[0] === token[0].toUpperCase()) {
      if (token[1] && token[1] === token[1].toLowerCase()) {
          return capitalize;
      } else {
          return uppercaseify;
      }
  } else {
      return lowercaseify;
  }
}

TenseInflector.prototype.izeRegulars = function(token, formSet) {
  token = token.toLowerCase();

  if(formSet.irregularForms[token])
      return formSet.irregularForms[token];

  return false;
}

TenseInflector.prototype.addForm = function(singularTable, pluralTable, singular, plural) {
  singular = singular.toLowerCase();
  plural = plural.toLowerCase();
  pluralTable[singular] = plural;
  singularTable[plural] = singular;
};

TenseInflector.prototype.addIrregular = function(singular, plural) {
  this.addForm(this.singularForms.irregularForms, this.pluralForms.irregularForms, singular, plural);
};

TenseInflector.prototype.izeRegExps = function(token, forms) {
      var i, form;
      for(i = 0; i < forms.length; i++) {
          form = forms[i];

          if(token.match(form[0]))
              return token.replace(form[0], form[1]);
      }

      return false;
  }

module.exports = TenseInflector;
});

require.define("/lib/natural/inflectors/form_set.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var FormSet = function() {
  this.regularForms = [];
  this.irregularForms = {};
}

module.exports = FormSet;
});

require.define("/lib/natural/inflectors/present_verb_inflector.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var util = require('util'),
  SingularPluralInflector = require('./singular_plural_inflector'),
  FormSet = require('./form_set');

function attach() {
  var inflector = this;

  String.prototype.singularizePresentVerb = function() {
      return inflector.singularize(this);
  }

  String.prototype.pluralizePresentVerb = function() {
      return inflector.pluralize(this);
  }
}

var VerbInflector = function() {
  this.ambiguous = [
      'will'
  ];

  this.attach = attach;

  this.customPluralForms = [];
  this.customSingularForms = [];
  this.singularForms = new FormSet();
  this.pluralForms = new FormSet();

  this.addIrregular("am", "are");
  this.addIrregular("is", "are");
  this.addIrregular("was", "were");

  this.singularForms.regularForms.push([/ed$/i, 'ed']);
  this.singularForms.regularForms.push([/ss$/i, 'sses']);
  this.singularForms.regularForms.push([/x$/i, 'xes']);
  this.singularForms.regularForms.push([/(h|z|o)$/i, '$1es']);
  this.singularForms.regularForms.push([/$zz/i, 'zzes']);
  this.singularForms.regularForms.push([/$/i, 's']);

  this.pluralForms.regularForms.push([/sses$/i, 'ss']);
  this.pluralForms.regularForms.push([/xes$/i, 'x']);
  this.pluralForms.regularForms.push([/([cs])hes$/i, '$1h']);
  this.pluralForms.regularForms.push([/zzes$/i, 'zz']);
  this.pluralForms.regularForms.push([/([^h|z|o])es$/i, '$1e']);
  this.pluralForms.regularForms.push([/e?s$/i, '']);
};

util.inherits(VerbInflector, SingularPluralInflector);

module.exports = VerbInflector;
});

require.define("/lib/natural/inflectors/count_inflector.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

function nthForm(i) {
  teenth = (i % 100);

  if(teenth > 10 && teenth < 14)
      return 'th';
  else {
      switch(i % 10) {
          case 1:
              return 'st';
              break;
          case 2:
              return 'nd';
              break;
          case 3:
              return 'rd';
              break;
          default:
              return 'th';
      }
  }
}

function nth(i) {
  return i.toString() + nthForm(i);
}

function CountInflector() {}
CountInflector.nth = nth;

module.exports = CountInflector;

});

require.define("/lib/natural/tfidf/tfidf.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Rob Ellis, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var _ = require("underscore")._,
  Tokenizer = require('../tokenizers/regexp_tokenizer').WordTokenizer,
  tokenizer = new Tokenizer(),
  stopwords = require('../util/stopwords').words,
  fs = require('fs');

function buildDocument(text, key) {
  var stopOut;

  if(typeof text === 'string') {
      text = tokenizer.tokenize(text.toLowerCase());
      stopOut = true;
  } else if(!_.isArray(text)) {
      return text;
      stopOut = false;
  }

  return text.reduce(function(document, term) {
      if(!stopOut || stopwords.indexOf(term) < 0)
          document[term] = (document[term] ? document[term] + 1 : 1);

      return document;
  }, {__key: key});
}

function tf(term, document) {
  return document[term] ? document[term]: 0;
}

function documentHasTerm(term, document) {
  return document[term] && document[term] > 0;
}

function TfIdf(deserialized) {
  if(deserialized)
      this.documents = deserialized.documents;
  else
      this.documents = [];
}

module.exports = TfIdf;
TfIdf.tf = tf;

TfIdf.prototype.idf = function(term) {
  var docsWithTerm = this.documents.reduce(function(count, document) {
      return count + (documentHasTerm(term, document) ? 1 : 0);
  }, 1);

  return Math.log(this.documents.length + 1 / docsWithTerm /* inited to 1 so
      no addition needed */);
};

TfIdf.prototype.addDocument = function(document, key) {
  this.documents.push(buildDocument(document, key));
};

TfIdf.prototype.addFileSync = function(path, encoding, key) {
  if(encoding)
      encoding = 'UTF-8';

  var document = fs.readFileSync(path, 'UTF-8');
  this.documents.push(buildDocument(document, key));
};

TfIdf.prototype.tfidf = function(terms, d) {
  var _this = this;

  if(!_.isArray(terms))
      terms = tokenizer.tokenize(terms.toString().toLowerCase());

  return terms.reduce(function(value, term) {
      return value + (tf(term, _this.documents[d]) * _this.idf(term));
  }, 0.0);
};

TfIdf.prototype.listTerms = function(d) {
  var terms = [];

  for(term in this.documents[d]) {
terms.push({term: term, tfidf: this.tfidf(term, d)})
  }

  return terms.sort(function(x, y) { return y.tfidf - x.tfidf });
}

TfIdf.prototype.tfidfs = function(terms, callback) {
  var tfidfs = new Array(this.documents.length);

  for(var i = 0; i < this.documents.length; i++) {
      tfidfs[i] = this.tfidf(terms, i);

      if(callback)
          callback(i, tfidfs[i], this.documents[i].__key);
  }

  return tfidfs;
};
});

require.define("fs",function(require,module,exports,__dirname,__filename,process){// nothing to see here... no file methods for the browser
});

require.define("/lib/natural/analyzers/sentence_analyzer.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Rob Ellis, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var _ = require("underscore")._;

/*
Sentences Analizer Class
From http://www.writingcentre.uottawa.ca/hypergrammar/sntpurps.html

Take a POS input and analyse it for
- Type of Sentense
   - Interrogative
     - Tag Questions
     -
   - Declarative
   - Exclamatory
   - Imperative

- Parts of a Sentense
   - Subject
   - Predicate

- Show Preposition Phrases
*/

var Sentences = function(pos, callback) {
  this.posObj = pos;
  this.senType = null;
  callback(this);
}

Sentences.prototype.part = function(callback) {
  var subject = [],
predicat = [],
verbFound = false;

  this.prepositionPhrases();

  for (var i = 0; i < this.posObj.tags.length; i++) {
      if (this.posObj.tags[i].pos == "VB") {
          if (i === 0) {
              verbFound = true;
          } else {
              // We need to Test for any EX before the VB
              if (this.posObj.tags[i - 1].pos != "EX") {
                  verbFound = true;
              } else {
                  predicat.push(this.posObj.tags[i].token);
              }
          }
      }

      // Add Pronoun Phrase (pp) Or Subject Phrase (sp)
      if (!verbFound) {
          if (this.posObj.tags[i].pp != true)
              this.posObj.tags[i].spos = "SP";

          subject.push(this.posObj.tags[i].token);
      } else {
          if (this.posObj.tags[i].pp != true)
              this.posObj.tags[i].spos = "PP";

          predicat.push(this.posObj.tags[i].token)
      }
  }

  if (subject.length == 0) {
this.posObj.tags.push({token:"You",spos:"SP",pos:"PRP",added:true});
  }

  callback(this);
}

// Takes POS and removes IN to NN or NNS
// Adds a PP for each prepositionPhrases
Sentences.prototype.prepositionPhrases = function() {
  var remove = false;

  for (var i = 0; i < this.posObj.tags.length; i++) {
      if (this.posObj.tags[i].pos.match("IN")) {
          remove = true;
      }

      if (remove) {
          this.posObj.tags[i].pp = true;
      }

      if (this.posObj.tags[i].pos.match("NN")) {
          remove = false;
      }
  }
}

Sentences.prototype.subjectToString = function() {
  return this.posObj.tags.map(function(t){ if (t.spos == "SP" || t.spos == "S" ) return t.token }).join(' ');
}

Sentences.prototype.predicateToString = function() {
  return this.posObj.tags.map(function(t){ if (t.spos == "PP" || t.spos == "P" ) return t.token }).join(' ');
}

Sentences.prototype.implicitYou = function() {
  for (var i = 0; i < this.posObj.tags.length;i++) {
      if (this.posObj.tags[i].added) {
          return true;
      }
  }

  return false;
}

Sentences.prototype.toString = function() {
  return this.posObj.tags.map(function(t){return t.token}).join(' ');
}

// This is quick and incomplete.
Sentences.prototype.type = function(callback) {
  var callback = callback || false;

  // FIXME - punct seems useless
  var lastElement = this.posObj.punct();
  lastElement = (lastElement.length != 0) ? lastElement.pop() : this.posObj.tags.pop();

  if (lastElement.pos !== ".") {
      if (this.implicitYou()) {
          this.senType = "COMMAND";
      } else if (_(["WDT","WP","WP$","WRB"]).contains(this.posObj.tags[0].pos)) {
          // Sentences that start with: who, what where when why and how, then they are questions
          this.senType = "INTERROGATIVE";
      } else if (_(["PRP"]).contains(lastElement.pos)) {
          // Sentences that end in a Personal pronoun are most likely questions
          // eg. We should run away, should we [?]
          // eg. You want to see that again, do you [?]
          this.senType = "INTERROGATIVE";
      } else {
          this.senType = "UNKNOWN";
      }

  } else {
      switch(lastElement.token) {
          case "?": this.senType = "INTERROGATIVE"; break;
          case "!": this.senType = (this.implicitYou()) ? "COMMAND":"EXCLAMATORY"; break;
          case ".": this.senType = (this.implicitYou()) ? "COMMAND":"DECLARATIVE";	break;
      }
  }

  if (callback && _(callback).isFunction()) {
      callback(this);
  } else {
      return this.senType;
  }
}

module.exports = Sentences;
});

require.define("/lib/natural/ngrams/ngrams.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, Rob Ellis, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var _ = require("underscore")._,
  Tokenizer = require('../tokenizers/regexp_tokenizer').WordTokenizer,
  tokenizer = new Tokenizer();

exports.ngrams = function(sequence, n) {
  return ngrams(sequence, n);
}

exports.bigrams = function(sequence) {
  return ngrams(sequence, 2);
}

exports.trigrams = function(sequence) {
  return ngrams(sequence, 3);
}

var ngrams = function(sequence, n) {
  var result = [];

  if (!_(sequence).isArray()) {
      sequence = tokenizer.tokenize(sequence);
  }

  var count = _.max([0, sequence.length - n + 1]);

  for (var i = 0; i < count; i++) {
      result.push(sequence.slice(i, i + n));
  }

  return result;
}

});

require.define("/lib/natural/distance/jaro-winkler_distance.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2012, Adam Phillabaum, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

Unless otherwise stated by a specific section of code

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

// Computes the Jaro distance between two string -- intrepreted from:
// http://en.wikipedia.org/wiki/Jaro%E2%80%93Winkler_distance
// s1 is the first string to compare
// s2 is the second string to compare
function distance(s1, s2) {
  if (typeof(s1) != "string" || typeof(s2) != "string") return 0;
  if (s1.length == 0 || s2.length == 0)
      return 0;
  s1 = s1.toLowerCase(), s2 = s2.toLowerCase();
  var matchWindow = (Math.floor(Math.max(s1.length, s2.length) / 2.0)) - 1;
  var matches1 = new Array(s1.length);
  var matches2 = new Array(s2.length);
  var m = 0; // number of matches
  var t = 0; // number of transpositions

  //debug helpers
  //console.log("s1: " + s1 + "; s2: " + s2);
  //console.log(" - matchWindow: " + matchWindow);

  // find matches
  for (var i = 0; i < s1.length; i++) {
var matched = false;

// check for an exact match
if (s1[i] ==  s2[i]) {
  matches1[i] = matches2[i] = matched = true;
  m++
}

// check the "match window"
else {
        // this for loop is a little brutal
        for (k = (i <= matchWindow) ? 0 : i - matchWindow;
          (k <= i + matchWindow) && k < s2.length && !matched;
    k++) {
              if (s1[i] == s2[k]) {
                  if(!matches1[i] && !matches2[k]) {
                        m++;
                 }

                matches1[i] = matches2[k] = matched = true;
            }
        }
}
  }

  if(m == 0)
      return 0.0;

  // count transpositions
  var k = 0;

  for(var i = 0; i < s1.length; i++) {
    if(matches1[k]) {
        while(!matches2[k] && k < matches2.length)
              k++;
        if(s1[i] != s2[k] &&  k < matches2.length)  {
              t++;
          }

        k++;
    }
  }

  //debug helpers:
  //console.log(" - matches: " + m);
  //console.log(" - transpositions: " + t);
  t = t / 2.0;
  return (m / s1.length + m / s2.length + (m - t) / m) / 3;
}

// Computes the Winkler distance between two string -- intrepreted from:
// http://en.wikipedia.org/wiki/Jaro%E2%80%93Winkler_distance
// s1 is the first string to compare
// s2 is the second string to compare
// dj is the Jaro Distance (if you've already computed it), leave blank and the method handles it
function JaroWinklerDistance(s1, s2, dj) {
  var jaro;
  (typeof(dj) == 'undefined')? jaro = distance(s1,s2) : jaro = dj;
  var p = 0.1; //
  var l = 0 // length of the matching prefix
  while(s1[l] == s2[l] && l < 4)
      l++;

  return jaro + l * p * (1 - jaro);
}
module.exports = JaroWinklerDistance;
});

require.define("/lib/natural/distance/levenshtein_distance.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2012, Sid Nallu, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/*
* contribution by sidred123
*/

/*
* Compute the Levenshtein distance between two strings.
* Algorithm based from Speech and Language Processing - Daniel Jurafsky and James H. Martin.
*/

function LevenshteinDistance (source, target, options) {
  options = options || {};
  options.insertion_cost = options.insertion_cost || 1;
  options.deletion_cost = options.deletion_cost || 1;
  options.substitution_cost = options.substitution_cost || 2;

  var sourceLength = source.length;
  var targetLength = target.length;
  var distanceMatrix = [[0]];

  for (var row =  1; row <= sourceLength; row++) {
      distanceMatrix[row] = [];
      distanceMatrix[row][0] = distanceMatrix[row-1][0] + options.deletion_cost;
  }

  for (var column = 1; column <= targetLength; column++) {
      distanceMatrix[0][column] = distanceMatrix[0][column-1] + options.insertion_cost;
  }

  for (var row = 1; row <= sourceLength; row++) {
      for (var column = 1; column <= targetLength; column++) {
          var costToInsert = distanceMatrix[row][column-1] + options.insertion_cost;
          var costToDelete = distanceMatrix[row-1][column] + options.deletion_cost;

          var sourceElement = source[row-1];
          var targetElement = target[column-1];
          var costToSubstitute = distanceMatrix[row-1][column-1];
          if (sourceElement !== targetElement) {
              costToSubstitute = costToSubstitute + options.substitution_cost;
          }
          distanceMatrix[row][column] = Math.min(costToInsert, costToDelete, costToSubstitute);
      }
  }
  return distanceMatrix[sourceLength][targetLength];
}

module.exports = LevenshteinDistance;
});

require.define("/lib/natural/distance/dice_coefficient.js",function(require,module,exports,__dirname,__filename,process){/*
Copyright (c) 2011, John Crepezzi, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

// Get all of the pairs of letters for a string
var letterPairs = function (str) {
var numPairs = str.length - 1;
var pairs = new Array(numPairs);
for (var i = 0; i < numPairs; i++) {
  pairs[i] = str.substring(i, i + 2);
}
return pairs;
};

// Get all of the pairs in all of the words for a string
var wordLetterPairs = function (str) {
var allPairs = [], pairs;
var words = str.split(/\s+/);
for (var i = 0; i < words.length; i++) {
  pairs = letterPairs(words[i]);
  allPairs.push.apply(allPairs, pairs);
}
return allPairs;
};

// Perform some sanitization steps
var sanitize = function (str) {
return str.toLowerCase().replace(/^\s+|\s+$/g, '');
};

// Compare two strings, and spit out a number from 0-1
var compare = function (str1, str2) {
var pairs1 = wordLetterPairs(sanitize(str1));
var pairs2 = wordLetterPairs(sanitize(str2));
var intersection = 0, union = pairs1.length + pairs2.length;
var i, j, pair1, pair2;
for (i = 0; i < pairs1.length; i++) {
  pair1 = pairs1[i];
  for (j = 0; j < pairs2.length; j++) {
    pair2 = pairs2[j];
    if (pair1 == pair2) {
      intersection ++;
      delete pairs2[j];
      break;
    }
  }
}
return 2 * intersection / union;
};

module.exports = compare;
});

require.define("/lib/natural/entry.js",function(require,module,exports,__dirname,__filename,process){window.natural = {};

window.natural.SoundEx = require('./phonetics/soundex');
window.natural.Metaphone = require('./phonetics/metaphone');
window.natural.DoubleMetaphone = require('./phonetics/double_metaphone');
window.natural.PorterStemmer = require('./stemmers/porter_stemmer');
window.natural.PorterStemmerRu = require('./stemmers/porter_stemmer_ru');
window.natural.LancasterStemmer = require('./stemmers/lancaster_stemmer');
window.natural.AggressiveTokenizerRu = require('./tokenizers/aggressive_tokenizer_ru');
window.natural.AggressiveTokenizer = require('./tokenizers/aggressive_tokenizer');
window.natural.RegexpTokenizer = require('./tokenizers/regexp_tokenizer').RegexpTokenizer;
window.natural.WordTokenizer = require('./tokenizers/regexp_tokenizer').WordTokenizer;
window.natural.WordPunctTokenizer = require('./tokenizers/regexp_tokenizer').WordPunctTokenizer;
window.natural.TreebankWordTokenizer = require('./tokenizers/treebank_word_tokenizer');
/*
window.natural.BayesClassifier = require('./classifiers/bayes_classifier');
window.natural.LogisticRegressionClassifier = require('./classifiers/logistic_regression_classifier');
*/
window.natural.NounInflector = require('./inflectors/noun_inflector');
window.natural.PresentVerbInflector = require('./inflectors/present_verb_inflector');
window.natural.CountInflector = require('./inflectors/count_inflector');
/*
window.natural.WordNet = require('./wordnet/wordnet');
*/
window.natural.TfIdf = require('./tfidf/tfidf');
window.natural.SentenceAnalyzer = require('./analyzers/sentence_analyzer');
window.natural.stopwords = require('./util/stopwords').words;
window.natural.NGrams = require('./ngrams/ngrams');
window.natural.JaroWinklerDistance = require('./distance/jaro-winkler_distance');
window.natural.LevenshteinDistance = require('./distance/levenshtein_distance');
window.natural.DiceCoefficient = require('./distance/dice_coefficient');
});
require("/lib/natural/entry.js");
})();
