(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){

/* **********************************************
     Begin prism-core.js
********************************************** */

var _self = (typeof window !== 'undefined')
	? window   // if in browser
	: (
		(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
		? self // if in worker
		: {}   // if in node js
	);

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */

var Prism = (function(){

// Private helper vars
var lang = /\blang(?:uage)?-(\w+)\b/i;
var uniqueId = 0;

var _ = _self.Prism = {
	manual: _self.Prism && _self.Prism.manual,
	util: {
		encode: function (tokens) {
			if (tokens instanceof Token) {
				return new Token(tokens.type, _.util.encode(tokens.content), tokens.alias);
			} else if (_.util.type(tokens) === 'Array') {
				return tokens.map(_.util.encode);
			} else {
				return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
			}
		},

		type: function (o) {
			return Object.prototype.toString.call(o).match(/\[object (\w+)\]/)[1];
		},

		objId: function (obj) {
			if (!obj['__id']) {
				Object.defineProperty(obj, '__id', { value: ++uniqueId });
			}
			return obj['__id'];
		},

		// Deep clone a language definition (e.g. to extend it)
		clone: function (o) {
			var type = _.util.type(o);

			switch (type) {
				case 'Object':
					var clone = {};

					for (var key in o) {
						if (o.hasOwnProperty(key)) {
							clone[key] = _.util.clone(o[key]);
						}
					}

					return clone;

				case 'Array':
					// Check for existence for IE8
					return o.map && o.map(function(v) { return _.util.clone(v); });
			}

			return o;
		}
	},

	languages: {
		extend: function (id, redef) {
			var lang = _.util.clone(_.languages[id]);

			for (var key in redef) {
				lang[key] = redef[key];
			}

			return lang;
		},

		/**
		 * Insert a token before another token in a language literal
		 * As this needs to recreate the object (we cannot actually insert before keys in object literals),
		 * we cannot just provide an object, we need anobject and a key.
		 * @param inside The key (or language id) of the parent
		 * @param before The key to insert before. If not provided, the function appends instead.
		 * @param insert Object with the key/value pairs to insert
		 * @param root The object that contains `inside`. If equal to Prism.languages, it can be omitted.
		 */
		insertBefore: function (inside, before, insert, root) {
			root = root || _.languages;
			var grammar = root[inside];

			if (arguments.length == 2) {
				insert = arguments[1];

				for (var newToken in insert) {
					if (insert.hasOwnProperty(newToken)) {
						grammar[newToken] = insert[newToken];
					}
				}

				return grammar;
			}

			var ret = {};

			for (var token in grammar) {

				if (grammar.hasOwnProperty(token)) {

					if (token == before) {

						for (var newToken in insert) {

							if (insert.hasOwnProperty(newToken)) {
								ret[newToken] = insert[newToken];
							}
						}
					}

					ret[token] = grammar[token];
				}
			}

			// Update references in other language definitions
			_.languages.DFS(_.languages, function(key, value) {
				if (value === root[inside] && key != inside) {
					this[key] = ret;
				}
			});

			return root[inside] = ret;
		},

		// Traverse a language definition with Depth First Search
		DFS: function(o, callback, type, visited) {
			visited = visited || {};
			for (var i in o) {
				if (o.hasOwnProperty(i)) {
					callback.call(o, i, o[i], type || i);

					if (_.util.type(o[i]) === 'Object' && !visited[_.util.objId(o[i])]) {
						visited[_.util.objId(o[i])] = true;
						_.languages.DFS(o[i], callback, null, visited);
					}
					else if (_.util.type(o[i]) === 'Array' && !visited[_.util.objId(o[i])]) {
						visited[_.util.objId(o[i])] = true;
						_.languages.DFS(o[i], callback, i, visited);
					}
				}
			}
		}
	},
	plugins: {},

	highlightAll: function(async, callback) {
		var env = {
			callback: callback,
			selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
		};

		_.hooks.run("before-highlightall", env);

		var elements = env.elements || document.querySelectorAll(env.selector);

		for (var i=0, element; element = elements[i++];) {
			_.highlightElement(element, async === true, env.callback);
		}
	},

	highlightElement: function(element, async, callback) {
		// Find language
		var language, grammar, parent = element;

		while (parent && !lang.test(parent.className)) {
			parent = parent.parentNode;
		}

		if (parent) {
			language = (parent.className.match(lang) || [,''])[1].toLowerCase();
			grammar = _.languages[language];
		}

		// Set language on the element, if not present
		element.className = element.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;

		// Set language on the parent, for styling
		parent = element.parentNode;

		if (/pre/i.test(parent.nodeName)) {
			parent.className = parent.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
		}

		var code = element.textContent;

		var env = {
			element: element,
			language: language,
			grammar: grammar,
			code: code
		};

		_.hooks.run('before-sanity-check', env);

		if (!env.code || !env.grammar) {
			if (env.code) {
				_.hooks.run('before-highlight', env);
				env.element.textContent = env.code;
				_.hooks.run('after-highlight', env);
			}
			_.hooks.run('complete', env);
			return;
		}

		_.hooks.run('before-highlight', env);

		if (async && _self.Worker) {
			var worker = new Worker(_.filename);

			worker.onmessage = function(evt) {
				env.highlightedCode = evt.data;

				_.hooks.run('before-insert', env);

				env.element.innerHTML = env.highlightedCode;

				callback && callback.call(env.element);
				_.hooks.run('after-highlight', env);
				_.hooks.run('complete', env);
			};

			worker.postMessage(JSON.stringify({
				language: env.language,
				code: env.code,
				immediateClose: true
			}));
		}
		else {
			env.highlightedCode = _.highlight(env.code, env.grammar, env.language);

			_.hooks.run('before-insert', env);

			env.element.innerHTML = env.highlightedCode;

			callback && callback.call(element);

			_.hooks.run('after-highlight', env);
			_.hooks.run('complete', env);
		}
	},

	highlight: function (text, grammar, language) {
		var tokens = _.tokenize(text, grammar);
		return Token.stringify(_.util.encode(tokens), language);
	},

	matchGrammar: function (text, strarr, grammar, index, startPos, oneshot, target) {
		var Token = _.Token;

		for (var token in grammar) {
			if(!grammar.hasOwnProperty(token) || !grammar[token]) {
				continue;
			}

			if (token == target) {
				return;
			}

			var patterns = grammar[token];
			patterns = (_.util.type(patterns) === "Array") ? patterns : [patterns];

			for (var j = 0; j < patterns.length; ++j) {
				var pattern = patterns[j],
					inside = pattern.inside,
					lookbehind = !!pattern.lookbehind,
					greedy = !!pattern.greedy,
					lookbehindLength = 0,
					alias = pattern.alias;

				if (greedy && !pattern.pattern.global) {
					// Without the global flag, lastIndex won't work
					var flags = pattern.pattern.toString().match(/[imuy]*$/)[0];
					pattern.pattern = RegExp(pattern.pattern.source, flags + "g");
				}

				pattern = pattern.pattern || pattern;

				// Don’t cache length as it changes during the loop
				for (var i = index, pos = startPos; i < strarr.length; pos += strarr[i].length, ++i) {

					var str = strarr[i];

					if (strarr.length > text.length) {
						// Something went terribly wrong, ABORT, ABORT!
						return;
					}

					if (str instanceof Token) {
						continue;
					}

					pattern.lastIndex = 0;

					var match = pattern.exec(str),
					    delNum = 1;

					// Greedy patterns can override/remove up to two previously matched tokens
					if (!match && greedy && i != strarr.length - 1) {
						pattern.lastIndex = pos;
						match = pattern.exec(text);
						if (!match) {
							break;
						}

						var from = match.index + (lookbehind ? match[1].length : 0),
						    to = match.index + match[0].length,
						    k = i,
						    p = pos;

						for (var len = strarr.length; k < len && (p < to || (!strarr[k].type && !strarr[k - 1].greedy)); ++k) {
							p += strarr[k].length;
							// Move the index i to the element in strarr that is closest to from
							if (from >= p) {
								++i;
								pos = p;
							}
						}

						/*
						 * If strarr[i] is a Token, then the match starts inside another Token, which is invalid
						 * If strarr[k - 1] is greedy we are in conflict with another greedy pattern
						 */
						if (strarr[i] instanceof Token || strarr[k - 1].greedy) {
							continue;
						}

						// Number of tokens to delete and replace with the new match
						delNum = k - i;
						str = text.slice(pos, p);
						match.index -= pos;
					}

					if (!match) {
						if (oneshot) {
							break;
						}

						continue;
					}

					if(lookbehind) {
						lookbehindLength = match[1].length;
					}

					var from = match.index + lookbehindLength,
					    match = match[0].slice(lookbehindLength),
					    to = from + match.length,
					    before = str.slice(0, from),
					    after = str.slice(to);

					var args = [i, delNum];

					if (before) {
						++i;
						pos += before.length;
						args.push(before);
					}

					var wrapped = new Token(token, inside? _.tokenize(match, inside) : match, alias, match, greedy);

					args.push(wrapped);

					if (after) {
						args.push(after);
					}

					Array.prototype.splice.apply(strarr, args);

					if (delNum != 1)
						_.matchGrammar(text, strarr, grammar, i, pos, true, token);

					if (oneshot)
						break;
				}
			}
		}
	},

	tokenize: function(text, grammar, language) {
		var strarr = [text];

		var rest = grammar.rest;

		if (rest) {
			for (var token in rest) {
				grammar[token] = rest[token];
			}

			delete grammar.rest;
		}

		_.matchGrammar(text, strarr, grammar, 0, 0, false);

		return strarr;
	},

	hooks: {
		all: {},

		add: function (name, callback) {
			var hooks = _.hooks.all;

			hooks[name] = hooks[name] || [];

			hooks[name].push(callback);
		},

		run: function (name, env) {
			var callbacks = _.hooks.all[name];

			if (!callbacks || !callbacks.length) {
				return;
			}

			for (var i=0, callback; callback = callbacks[i++];) {
				callback(env);
			}
		}
	}
};

var Token = _.Token = function(type, content, alias, matchedStr, greedy) {
	this.type = type;
	this.content = content;
	this.alias = alias;
	// Copy of the full string this token was created from
	this.length = (matchedStr || "").length|0;
	this.greedy = !!greedy;
};

Token.stringify = function(o, language, parent) {
	if (typeof o == 'string') {
		return o;
	}

	if (_.util.type(o) === 'Array') {
		return o.map(function(element) {
			return Token.stringify(element, language, o);
		}).join('');
	}

	var env = {
		type: o.type,
		content: Token.stringify(o.content, language, parent),
		tag: 'span',
		classes: ['token', o.type],
		attributes: {},
		language: language,
		parent: parent
	};

	if (env.type == 'comment') {
		env.attributes['spellcheck'] = 'true';
	}

	if (o.alias) {
		var aliases = _.util.type(o.alias) === 'Array' ? o.alias : [o.alias];
		Array.prototype.push.apply(env.classes, aliases);
	}

	_.hooks.run('wrap', env);

	var attributes = Object.keys(env.attributes).map(function(name) {
		return name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
	}).join(' ');

	return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + (attributes ? ' ' + attributes : '') + '>' + env.content + '</' + env.tag + '>';

};

if (!_self.document) {
	if (!_self.addEventListener) {
		// in Node.js
		return _self.Prism;
	}
 	// In worker
	_self.addEventListener('message', function(evt) {
		var message = JSON.parse(evt.data),
		    lang = message.language,
		    code = message.code,
		    immediateClose = message.immediateClose;

		_self.postMessage(_.highlight(code, _.languages[lang], lang));
		if (immediateClose) {
			_self.close();
		}
	}, false);

	return _self.Prism;
}

//Get current script and highlight
var script = document.currentScript || [].slice.call(document.getElementsByTagName("script")).pop();

if (script) {
	_.filename = script.src;

	if (document.addEventListener && !_.manual && !script.hasAttribute('data-manual')) {
		if(document.readyState !== "loading") {
			if (window.requestAnimationFrame) {
				window.requestAnimationFrame(_.highlightAll);
			} else {
				window.setTimeout(_.highlightAll, 16);
			}
		}
		else {
			document.addEventListener('DOMContentLoaded', _.highlightAll);
		}
	}
}

return _self.Prism;

})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Prism;
}

// hack for components to work correctly in node.js
if (typeof global !== 'undefined') {
	global.Prism = Prism;
}


/* **********************************************
     Begin prism-markup.js
********************************************** */

Prism.languages.markup = {
	'comment': /<!--[\s\S]*?-->/,
	'prolog': /<\?[\s\S]+?\?>/,
	'doctype': /<!DOCTYPE[\s\S]+?>/i,
	'cdata': /<!\[CDATA\[[\s\S]*?]]>/i,
	'tag': {
		pattern: /<\/?(?!\d)[^\s>\/=$<]+(?:\s+[^\s>\/=]+(?:=(?:("|')(?:\\\1|\\?(?!\1)[\s\S])*\1|[^\s'">=]+))?)*\s*\/?>/i,
		inside: {
			'tag': {
				pattern: /^<\/?[^\s>\/]+/i,
				inside: {
					'punctuation': /^<\/?/,
					'namespace': /^[^\s>\/:]+:/
				}
			},
			'attr-value': {
				pattern: /=(?:('|")[\s\S]*?(\1)|[^\s>]+)/i,
				inside: {
					'punctuation': /[=>"']/
				}
			},
			'punctuation': /\/?>/,
			'attr-name': {
				pattern: /[^\s>\/]+/,
				inside: {
					'namespace': /^[^\s>\/:]+:/
				}
			}

		}
	},
	'entity': /&#?[\da-z]{1,8};/i
};

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add('wrap', function(env) {

	if (env.type === 'entity') {
		env.attributes['title'] = env.content.replace(/&amp;/, '&');
	}
});

Prism.languages.xml = Prism.languages.markup;
Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;


/* **********************************************
     Begin prism-css.js
********************************************** */

Prism.languages.css = {
	'comment': /\/\*[\s\S]*?\*\//,
	'atrule': {
		pattern: /@[\w-]+?.*?(;|(?=\s*\{))/i,
		inside: {
			'rule': /@[\w-]+/
			// See rest below
		}
	},
	'url': /url\((?:(["'])(\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1|.*?)\)/i,
	'selector': /[^\{\}\s][^\{\};]*?(?=\s*\{)/,
	'string': {
		pattern: /("|')(\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'property': /(\b|\B)[\w-]+(?=\s*:)/i,
	'important': /\B!important\b/i,
	'function': /[-a-z0-9]+(?=\()/i,
	'punctuation': /[(){};:]/
};

Prism.languages.css['atrule'].inside.rest = Prism.util.clone(Prism.languages.css);

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'style': {
			pattern: /(<style[\s\S]*?>)[\s\S]*?(?=<\/style>)/i,
			lookbehind: true,
			inside: Prism.languages.css,
			alias: 'language-css'
		}
	});
	
	Prism.languages.insertBefore('inside', 'attr-value', {
		'style-attr': {
			pattern: /\s*style=("|').*?\1/i,
			inside: {
				'attr-name': {
					pattern: /^\s*style/i,
					inside: Prism.languages.markup.tag.inside
				},
				'punctuation': /^\s*=\s*['"]|['"]\s*$/,
				'attr-value': {
					pattern: /.+/i,
					inside: Prism.languages.css
				}
			},
			alias: 'language-css'
		}
	}, Prism.languages.markup.tag);
}

/* **********************************************
     Begin prism-clike.js
********************************************** */

Prism.languages.clike = {
	'comment': [
		{
			pattern: /(^|[^\\])\/\*[\s\S]*?\*\//,
			lookbehind: true
		},
		{
			pattern: /(^|[^\\:])\/\/.*/,
			lookbehind: true
		}
	],
	'string': {
		pattern: /(["'])(\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'class-name': {
		pattern: /((?:\b(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[a-z0-9_\.\\]+/i,
		lookbehind: true,
		inside: {
			punctuation: /(\.|\\)/
		}
	},
	'keyword': /\b(if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,
	'boolean': /\b(true|false)\b/,
	'function': /[a-z0-9_]+(?=\()/i,
	'number': /\b-?(?:0x[\da-f]+|\d*\.?\d+(?:e[+-]?\d+)?)\b/i,
	'operator': /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
	'punctuation': /[{}[\];(),.:]/
};


/* **********************************************
     Begin prism-javascript.js
********************************************** */

Prism.languages.javascript = Prism.languages.extend('clike', {
	'keyword': /\b(as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b/,
	'number': /\b-?(0x[\dA-Fa-f]+|0b[01]+|0o[0-7]+|\d*\.?\d+([Ee][+-]?\d+)?|NaN|Infinity)\b/,
	// Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
	'function': /[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*(?=\()/i,
	'operator': /-[-=]?|\+[+=]?|!=?=?|<<?=?|>>?>?=?|=(?:==?|>)?|&[&=]?|\|[|=]?|\*\*?=?|\/=?|~|\^=?|%=?|\?|\.{3}/
});

Prism.languages.insertBefore('javascript', 'keyword', {
	'regex': {
		pattern: /(^|[^/])\/(?!\/)(\[.+?]|\\.|[^/\\\r\n])+\/[gimyu]{0,5}(?=\s*($|[\r\n,.;})]))/,
		lookbehind: true,
		greedy: true
	}
});

Prism.languages.insertBefore('javascript', 'string', {
	'template-string': {
		pattern: /`(?:\\\\|\\?[^\\])*?`/,
		greedy: true,
		inside: {
			'interpolation': {
				pattern: /\$\{[^}]+\}/,
				inside: {
					'interpolation-punctuation': {
						pattern: /^\$\{|\}$/,
						alias: 'punctuation'
					},
					rest: Prism.languages.javascript
				}
			},
			'string': /[\s\S]+/
		}
	}
});

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'script': {
			pattern: /(<script[\s\S]*?>)[\s\S]*?(?=<\/script>)/i,
			lookbehind: true,
			inside: Prism.languages.javascript,
			alias: 'language-javascript'
		}
	});
}

Prism.languages.js = Prism.languages.javascript;

/* **********************************************
     Begin prism-file-highlight.js
********************************************** */

(function () {
	if (typeof self === 'undefined' || !self.Prism || !self.document || !document.querySelector) {
		return;
	}

	self.Prism.fileHighlight = function() {

		var Extensions = {
			'js': 'javascript',
			'py': 'python',
			'rb': 'ruby',
			'ps1': 'powershell',
			'psm1': 'powershell',
			'sh': 'bash',
			'bat': 'batch',
			'h': 'c',
			'tex': 'latex'
		};

		if(Array.prototype.forEach) { // Check to prevent error in IE8
			Array.prototype.slice.call(document.querySelectorAll('pre[data-src]')).forEach(function (pre) {
				var src = pre.getAttribute('data-src');

				var language, parent = pre;
				var lang = /\blang(?:uage)?-(?!\*)(\w+)\b/i;
				while (parent && !lang.test(parent.className)) {
					parent = parent.parentNode;
				}

				if (parent) {
					language = (pre.className.match(lang) || [, ''])[1];
				}

				if (!language) {
					var extension = (src.match(/\.(\w+)$/) || [, ''])[1];
					language = Extensions[extension] || extension;
				}

				var code = document.createElement('code');
				code.className = 'language-' + language;

				pre.textContent = '';

				code.textContent = 'Loading…';

				pre.appendChild(code);

				var xhr = new XMLHttpRequest();

				xhr.open('GET', src, true);

				xhr.onreadystatechange = function () {
					if (xhr.readyState == 4) {

						if (xhr.status < 400 && xhr.responseText) {
							code.textContent = xhr.responseText;

							Prism.highlightElement(code);
						}
						else if (xhr.status >= 400) {
							code.textContent = '✖ Error ' + xhr.status + ' while fetching file: ' + xhr.statusText;
						}
						else {
							code.textContent = '✖ Error: File does not exist or is empty';
						}
					}
				};

				xhr.send(null);
			});
		}

	};

	document.addEventListener('DOMContentLoaded', self.Prism.fileHighlight);

})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],2:[function(require,module,exports){
module.exports = function() {
  return function(deck) {
    var backdrops;

    function createBackdropForSlide(slide) {
      var backdropAttribute = slide.getAttribute('data-bespoke-backdrop');

      if (backdropAttribute) {
        var backdrop = document.createElement('div');
        backdrop.className = backdropAttribute;
        backdrop.classList.add('bespoke-backdrop');
        deck.parent.appendChild(backdrop);
        return backdrop;
      }
    }

    function updateClasses(el) {
      if (el) {
        var index = backdrops.indexOf(el),
          currentIndex = deck.slide();

        removeClass(el, 'active');
        removeClass(el, 'inactive');
        removeClass(el, 'before');
        removeClass(el, 'after');

        if (index !== currentIndex) {
          addClass(el, 'inactive');
          addClass(el, index < currentIndex ? 'before' : 'after');
        } else {
          addClass(el, 'active');
        }
      }
    }

    function removeClass(el, className) {
      el.classList.remove('bespoke-backdrop-' + className);
    }

    function addClass(el, className) {
      el.classList.add('bespoke-backdrop-' + className);
    }

    backdrops = deck.slides
      .map(createBackdropForSlide);

    deck.on('activate', function() {
      backdrops.forEach(updateClasses);
    });
  };
};

},{}],3:[function(require,module,exports){
module.exports = function(options) {
  return function(deck) {
    var activeSlideIndex,
      activeBulletIndex,

      bullets = deck.slides.map(function(slide) {
        return [].slice.call(slide.querySelectorAll((typeof options === 'string' ? options : '[data-bespoke-bullet]')), 0);
      }),

      next = function() {
        var nextSlideIndex = activeSlideIndex + 1;

        if (activeSlideHasBulletByOffset(1)) {
          activateBullet(activeSlideIndex, activeBulletIndex + 1);
          return false;
        } else if (bullets[nextSlideIndex]) {
          activateBullet(nextSlideIndex, 0);
        }
      },

      prev = function() {
        var prevSlideIndex = activeSlideIndex - 1;

        if (activeSlideHasBulletByOffset(-1)) {
          activateBullet(activeSlideIndex, activeBulletIndex - 1);
          return false;
        } else if (bullets[prevSlideIndex]) {
          activateBullet(prevSlideIndex, bullets[prevSlideIndex].length - 1);
        }
      },

      activateBullet = function(slideIndex, bulletIndex) {
        activeSlideIndex = slideIndex;
        activeBulletIndex = bulletIndex;

        bullets.forEach(function(slide, s) {
          slide.forEach(function(bullet, b) {
            bullet.classList.add('bespoke-bullet');

            if (s < slideIndex || s === slideIndex && b <= bulletIndex) {
              bullet.classList.add('bespoke-bullet-active');
              bullet.classList.remove('bespoke-bullet-inactive');
            } else {
              bullet.classList.add('bespoke-bullet-inactive');
              bullet.classList.remove('bespoke-bullet-active');
            }

            if (s === slideIndex && b === bulletIndex) {
              bullet.classList.add('bespoke-bullet-current');
            } else {
              bullet.classList.remove('bespoke-bullet-current');
            }
          });
        });
      },

      activeSlideHasBulletByOffset = function(offset) {
        return bullets[activeSlideIndex][activeBulletIndex + offset] !== undefined;
      };

    deck.on('next', next);
    deck.on('prev', prev);

    deck.on('slide', function(e) {
      activateBullet(e.index, 0);
    });

    activateBullet(0, 0);
  };
};

},{}],4:[function(require,module,exports){
module.exports = function() {
  return function(deck) {
    deck.slides.forEach(function(slide) {
      slide.addEventListener('keydown', function(e) {
        if (/INPUT|TEXTAREA|SELECT/.test(e.target.nodeName) || e.target.contentEditable === 'true') {
          e.stopPropagation();
        }
      });
    });
  };
};

},{}],5:[function(require,module,exports){
module.exports = function() {
  return function(deck) {
    var activateSlide = function(index) {
      var indexToActivate = -1 < index && index < deck.slides.length ? index : 0;
      if (indexToActivate !== deck.slide()) {
        deck.slide(indexToActivate);
      }
    };

    var parseHash = function() {
      var hash = window.location.hash.slice(1),
        slideNumberOrName = parseInt(hash, 10);

      if (hash) {
        if (slideNumberOrName) {
          activateSlide(slideNumberOrName - 1);
        } else {
          deck.slides.forEach(function(slide, i) {
            if (slide.getAttribute('data-bespoke-hash') === hash || slide.id === hash) {
              activateSlide(i);
            }
          });
        }
      }
    };

    setTimeout(function() {
      parseHash();

      deck.on('activate', function(e) {
        var slideName = e.slide.getAttribute('data-bespoke-hash') || e.slide.id;
        window.location.hash = slideName || e.index + 1;
      });

      window.addEventListener('hashchange', parseHash);
    }, 0);
  };
};

},{}],6:[function(require,module,exports){
module.exports = function(options) {
  return function(deck) {
    var isHorizontal = options !== 'vertical';

    document.addEventListener('keydown', function(e) {
      if (e.which == 34 || // PAGE DOWN
        (e.which == 32 && !e.shiftKey) || // SPACE WITHOUT SHIFT
        (isHorizontal && e.which == 39) || // RIGHT
        (!isHorizontal && e.which == 40) // DOWN
      ) { deck.next(); }

      if (e.which == 33 || // PAGE UP
        (e.which == 32 && e.shiftKey) || // SPACE + SHIFT
        (isHorizontal && e.which == 37) || // LEFT
        (!isHorizontal && e.which == 38) // UP
      ) { deck.prev(); }
    });
  };
};

},{}],7:[function(require,module,exports){
module.exports = function(options) {
  return function (deck) {
    var progressParent = document.createElement('div'),
      progressBar = document.createElement('div'),
      prop = options === 'vertical' ? 'height' : 'width';

    progressParent.className = 'bespoke-progress-parent';
    progressBar.className = 'bespoke-progress-bar';
    progressParent.appendChild(progressBar);
    deck.parent.appendChild(progressParent);

    deck.on('activate', function(e) {
      progressBar.style[prop] = (e.index * 100 / (deck.slides.length - 1)) + '%';
    });
  };
};

},{}],8:[function(require,module,exports){
module.exports = function(options) {
  return function(deck) {
    var parent = deck.parent,
      firstSlide = deck.slides[0],
      slideHeight = firstSlide.offsetHeight,
      slideWidth = firstSlide.offsetWidth,
      useZoom = options === 'zoom' || ('zoom' in parent.style && options !== 'transform'),

      wrap = function(element) {
        var wrapper = document.createElement('div');
        wrapper.className = 'bespoke-scale-parent';
        element.parentNode.insertBefore(wrapper, element);
        wrapper.appendChild(element);
        return wrapper;
      },

      elements = useZoom ? deck.slides : deck.slides.map(wrap),

      transformProperty = (function(property) {
        var prefixes = 'Moz Webkit O ms'.split(' ');
        return prefixes.reduce(function(currentProperty, prefix) {
            return prefix + property in parent.style ? prefix + property : currentProperty;
          }, property.toLowerCase());
      }('Transform')),

      scale = useZoom ?
        function(ratio, element) {
          element.style.zoom = ratio;
        } :
        function(ratio, element) {
          element.style[transformProperty] = 'scale(' + ratio + ')';
        },

      scaleAll = function() {
        var xScale = parent.offsetWidth / slideWidth,
          yScale = parent.offsetHeight / slideHeight;

        elements.forEach(scale.bind(null, Math.min(xScale, yScale)));
      };

    window.addEventListener('resize', scaleAll);
    scaleAll();
  };

};

},{}],9:[function(require,module,exports){
(function (global){
/*! bespoke-theme-fancy v0.6.0 © 2016 Flávio Coutinho, MIT License */
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var t;t="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,t=t.bespoke||(t.bespoke={}),t=t.themes||(t.themes={}),t.fancy=e()}}(function(){return function e(t,o,i){function s(r,n){if(!o[r]){if(!t[r]){var p="function"==typeof require&&require;if(!n&&p)return p(r,!0);if(a)return a(r,!0);var l=new Error("Cannot find module '"+r+"'");throw l.code="MODULE_NOT_FOUND",l}var b=o[r]={exports:{}};t[r][0].call(b.exports,function(e){var o=t[r][1][e];return s(o?o:e)},b,b.exports,e,t,o,i)}return o[r].exports}for(var a="function"==typeof require&&require,r=0;r<i.length;r++)s(i[r]);return s}({1:[function(e,t,o){var i=e("bespoke-classes"),s=e("insert-css");t.exports=function(){var e="@import url(\"http://fonts.googleapis.com/css?family=Calligraffitti|Open+Sans:400italic,700italic,400,700\");\n/*! normalize.css v3.0.0 | MIT License | git.io/normalize */\nhtml{font-family:sans-serif;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}body{margin:0}article,aside,details,figcaption,figure,footer,header,hgroup,main,nav,section,summary{display:block}audio,canvas,progress,video{display:inline-block;vertical-align:baseline}audio:not([controls]){display:none;height:0}[hidden],template{display:none}a{background:0 0}a:active,a:hover{outline:0}abbr[title]{border-bottom:1px dotted}b,strong{font-weight:700}dfn{font-style:italic}h1{font-size:2em;margin:.67em 0}mark{background:#ff0;color:#000}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sup{top:-.5em}sub{bottom:-.25em}img{border:0}svg:not(:root){overflow:hidden}figure{margin:1em 40px}hr{box-sizing:content-box;height:0}pre{overflow:auto}code,kbd,pre,samp{font-family:monospace,monospace;font-size:1em}button,input,optgroup,select,textarea{color:inherit;font:inherit;margin:0}button{overflow:visible}button,select{text-transform:none}button,html input[type=button],input[type=reset],input[type=submit]{-webkit-appearance:button;cursor:pointer}button[disabled],html input[disabled]{cursor:default}button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0}input{line-height:normal}input[type=checkbox],input[type=radio]{box-sizing:border-box;padding:0}input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{height:auto}input[type=search]{-webkit-appearance:textfield;box-sizing:content-box}input[type=search]::-webkit-search-cancel-button,input[type=search]::-webkit-search-decoration{-webkit-appearance:none}fieldset{border:1px solid silver;margin:0 2px;padding:.35em .625em .75em}legend{border:0}textarea{overflow:auto}optgroup{font-weight:700}table{border-collapse:collapse;border-spacing:0}legend,td,th{padding:0}@media screen{.bespoke-parent,.bespoke-scale-parent{position:absolute;top:0;left:0;right:0;bottom:0}.bespoke-parent{background-color:#d7d7fa}.bespoke-scale-parent{pointer-events:none}.bespoke-scale-parent .bespoke-active{pointer-events:auto}.bespoke-slide{width:800px;height:600px;position:absolute;overflow:hidden;top:50%;left:50%;margin-left:-400px;margin-top:-300px;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-flex-direction:column;-ms-flex-direction:column;flex-direction:column;-webkit-justify-content:center;-ms-flex-pack:center;justify-content:center;-webkit-align-items:center;-ms-flex-align:center;align-items:center}.bespoke-inactive{opacity:0;pointer-events:none}.emphatic{background:#a6b0ff;color:#fff}.emphatic h1,.emphatic h2,.emphatic h3,.emphatic h4,.emphatic h5,.emphatic h6{color:#431380}h1{color:#6e8ae4;font-family:'Calligraffitti',cursive;font-size:3em}h2{font-size:2em}h3{font-size:1.5em}h4,h5,h6{font-size:1em}article,h2,h3,h4,h5,h6{font-family:'Open Sans',Fuse-Segoe-UI,helvetica,arial,sans-serif}h1,h2,h3,h4,h5,h6,strong{font-weight:400}li,p{font-size:24px;line-height:1.5em}strong{color:#fc49d8}a{color:#b66c7e;text-decoration:none}a:hover{text-decoration:underline}code,pre{font-size:20px}.slide{overflow:hidden}.slide .bespoke-slide{-webkit-transform:translate3d(0,0,0);transform:translate3d(0,0,0);transition:all .8s ease}.slide .bespoke-before{-webkit-transform:translate3d(-100%,0,0);transform:translate3d(-100%,0,0)}.slide .bespoke-after{-webkit-transform:translate3d(100%,0,0);transform:translate3d(100%,0,0)}.slide .bespoke-inactive .bespoke-bullet-inactive{transition:opacity .8s ease}.cube{overflow:hidden}.cube,.cube .bespoke-scale-parent{-webkit-perspective:800px;perspective:800px}.cube .bespoke-slide{-webkit-transform-origin:50% 50% -400px;transform-origin:50% 50% -400px;transition:all .8s ease;-webkit-transform-style:preserve-3d;transform-style:preserve-3d}.cube .bespoke-inactive{opacity:0}.cube .bespoke-before{-webkit-transform:rotateY(-90deg);transform:rotateY(-90deg)}.cube .bespoke-after{-webkit-transform:rotateY(90deg);transform:rotateY(90deg)}.zelda-transition{overflow:hidden}.zelda-transition .bespoke-slide{-webkit-transform:translate3d(0,0,0);transform:translate3d(0,0,0);transition:all .8s cubic-bezier(.78,.03,.22,.68)}.zelda-transition .bespoke-before{-webkit-transform:translate3d(-100%,0,0);transform:translate3d(-100%,0,0)}.zelda-transition .bespoke-after{-webkit-transform:translate3d(100%,0,0);transform:translate3d(100%,0,0)}.bespoke-bullet{opacity:1;-webkit-transform:translate3d(0,0,0);transform:translate3d(0,0,0);transition:all .4s ease}.bespoke-bullet-inactive{opacity:0;pointer-events:none;-webkit-transform:translate3d(40px,0,0);transform:translate3d(40px,0,0);transition:all .2s ease}.bespoke-bullet-off .bespoke-bullet-inactive{display:list-item;opacity:initial;-webkit-transform:initial;transform:initial}.bespoke-progress-parent{position:absolute;top:0;left:0;right:0;height:.2vw}.bespoke-progress-bar{position:absolute;height:100%;transition:width .6s ease}.bespoke-progress-bar:after,.bespoke-progress-bar:before{content:\"\";position:absolute;display:block;width:100%;height:50%}.bespoke-progress-bar:before{background:#aeaef5}.bespoke-progress-bar:after{top:50%;background:#c2c2f7}.bespoke-simple-overview .bespoke-parent{display:inline-block}.bespoke-simple-overview .bespoke-slide{position:absolute;-webkit-transform:translate3d(0,0,-2000px);transform:translate3d(0,0,-2000px);opacity:1;outline:4px solid silver;background-color:rgba(255,255,255,.2)}.bespoke-simple-overview .bespoke-slide.bespoke-active,.bespoke-simple-overview .bespoke-slide:hover{outline-color:#4682b4}.bespoke-simple-overview .bespoke-slide.bespoke-inactive.bespoke-after:not(.bespoke-after-1):not(.bespoke-after-2),.bespoke-simple-overview .bespoke-slide.bespoke-inactive.bespoke-before:not(.bespoke-before-1):not(.bespoke-before-2){display:-webkit-flex;display:-ms-flexbox;display:flex}.bespoke-simple-overview .bespoke-bullet-inactive{display:list-item;opacity:initial;-webkit-transform:initial;transform:initial}.bespoke-simple-overview .bespoke-slide.bespoke-after{display:none;-webkit-transform:translate3d(4120.00048000192px,0,-2000px);transform:translate3d(4120.00048000192px,0,-2000px)}.bespoke-simple-overview .bespoke-slide.bespoke-before{display:none;-webkit-transform:translate3d(-4120.00048000192px,0,-2000px);transform:translate3d(-4120.00048000192px,0,-2000px)}.bespoke-simple-overview.zelda-transition .bespoke-slide.bespoke-after{-webkit-transform:translate3d(4120.00048000192px,100%,-2000px);transform:translate3d(4120.00048000192px,100%,-2000px)}.bespoke-simple-overview.zelda-transition .bespoke-slide.bespoke-before{-webkit-transform:translate3d(-4120.00048000192px,100%,-2000px);transform:translate3d(-4120.00048000192px,100%,-2000px)}.bespoke-simple-overview .bespoke-slide.bespoke-after-1{display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-transform:translate3d(824.000096000384px,0,-2000px);transform:translate3d(824.000096000384px,0,-2000px)}.bespoke-simple-overview .bespoke-slide.bespoke-before-1{display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-transform:translate3d(-824.000096000384px,0,-2000px);transform:translate3d(-824.000096000384px,0,-2000px)}.bespoke-simple-overview.zelda-transition .bespoke-slide.bespoke-after-1{display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-transform:translate3d(824.000096000384px,100%,-2000px);transform:translate3d(824.000096000384px,100%,-2000px)}.bespoke-simple-overview.zelda-transition .bespoke-slide.bespoke-before-1{display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-transform:translate3d(-824.000096000384px,100%,-2000px);transform:translate3d(-824.000096000384px,100%,-2000px)}.bespoke-simple-overview .bespoke-slide.bespoke-after-2{display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-transform:translate3d(1648.000192000768px,0,-2000px);transform:translate3d(1648.000192000768px,0,-2000px)}.bespoke-simple-overview .bespoke-slide.bespoke-before-2{display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-transform:translate3d(-1648.000192000768px,0,-2000px);transform:translate3d(-1648.000192000768px,0,-2000px)}.bespoke-simple-overview.zelda-transition .bespoke-slide.bespoke-after-2{display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-transform:translate3d(1648.000192000768px,100%,-2000px);transform:translate3d(1648.000192000768px,100%,-2000px)}.bespoke-simple-overview.zelda-transition .bespoke-slide.bespoke-before-2{display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-transform:translate3d(-1648.000192000768px,100%,-2000px);transform:translate3d(-1648.000192000768px,100%,-2000px)}.bespoke-simple-overview .bespoke-slide.bespoke-after-3{display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-transform:translate3d(2472.000288001152px,0,-2000px);transform:translate3d(2472.000288001152px,0,-2000px)}.bespoke-simple-overview .bespoke-slide.bespoke-before-3{display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-transform:translate3d(-2472.000288001152px,0,-2000px);transform:translate3d(-2472.000288001152px,0,-2000px)}.bespoke-simple-overview.zelda-transition .bespoke-slide.bespoke-after-3{display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-transform:translate3d(2472.000288001152px,100%,-2000px);transform:translate3d(2472.000288001152px,100%,-2000px)}.bespoke-simple-overview.zelda-transition .bespoke-slide.bespoke-before-3{display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-transform:translate3d(-2472.000288001152px,100%,-2000px);transform:translate3d(-2472.000288001152px,100%,-2000px)}.bespoke-simple-overview.zelda-transition .bespoke-slide{-webkit-transform:translate3d(0,100%,-2000px);transform:translate3d(0,100%,-2000px);background-color:inherit}#bespoke-search{position:absolute;width:100%;height:100%;pointer-events:none;z-index:1;opacity:0;background-color:rgba(128,128,128,.3);transition:opacity 100ms ease-out}#bespoke-search.bespoke-search-searching{opacity:1}#bespoke-search.bespoke-search-searching>#bespoke-search-input{bottom:5%}#bespoke-search-input{position:absolute;left:50%;bottom:-5%;pointer-events:all;width:200px;margin-left:-100px;padding:8px;border-radius:10px;border:1px solid silver;outline:none;color:gray;font-size:x-large;background-color:rgba(255,255,255,.9);transition:bottom 140ms ease-out}.bespoke-search-result{background-color:#ff0}.bespoke-search-result-focused{background-color:orange}#bespoke-search.bespoke-search-no-result>#bespoke-search-input{border:1px solid #8b0000;color:#8b0000}#bespoke-search-results-count{position:absolute;bottom:1%;left:50%;margin-left:-30px;width:60px;text-align:center;font-size:smaller;color:#8a2be2;font-weight:700}}@media print{*{background:0 0!important;color:#000!important;text-shadow:none!important}body,html{overflow:visible!important;height:auto!important}body{margin:0!important;padding:.1in!important}body,code{line-height:1em!important}code,ol,pre,ul{text-align:left!important}pre code{border:1px solid #696969!important;padding:5px!important;border-radius:4px!important}@page{margin:.79in!important}.bespoke-slide{box-sizing:border-box!important;display:block!important;float:left!important;border:2px solid #000!important;text-align:center!important;margin-top:0!important;margin-left:0!important;page-break-inside:avoid!important}.bespoke-slide>*{zoom:.65!important}.bespoke-slide>* *{zoom:.85!important}.bespoke-slide>h1:only-child,.bespoke-slide>h2:only-child,.bespoke-slide>h3:only-child,.bespoke-slide>h4:only-child,.bespoke-slide>h5:only-child,.bespoke-slide>h6:only-child{margin-top:4em!important}.bespoke-slide .bespoke-bullet-inactive{opacity:1!important;-webkit-transform:none!important;transform:none!important;transition:none!important}.bespoke-slide:nth-child(6n),.bespoke-slide:nth-of-type(6n){page-break-after:always!important;-webkit-column-break-after:page!important;break-after:page!important}}@media print and (orientation:portrait){.bespoke-slide{width:2.919472443000001in!important;height:2.189604332250001in!important;margin-right:.324385827in!important;margin-bottom:.324385827in!important}.bespoke-slide:nth-child(2n){margin-right:0!important}.bespoke-parent{width:6.487716540000001in!important}img{max-width:5.248012976470589in!important}}@media print and (orientation:landscape){.bespoke-slide{width:2.97387402in!important;height:2.230405515in!important;margin-right:.297387402in!important;margin-bottom:.297387402in!important}.bespoke-slide:nth-child(3n){margin-right:0!important}.bespoke-parent{width:9.9129134in!important}img{max-width:3.498675317647059in!important}}\n/*# sourceMappingURL=theme.css.map */\n";return s(e,{prepend:!0}),function(e){i()(e)}}},{"bespoke-classes":2,"insert-css":3}],2:[function(e,t,o){t.exports=function(){return function(e){var t=function(e,t){e.classList.add("bespoke-"+t)},o=function(e,t){e.className=e.className.replace(new RegExp("bespoke-"+t+"(\\s|$)","g")," ").trim()},i=function(i,s){var a=e.slides[e.slide()],r=s-e.slide(),n=r>0?"after":"before";["before(-\\d+)?","after(-\\d+)?","active","inactive"].map(o.bind(null,i)),i!==a&&["inactive",n,n+"-"+Math.abs(r)].map(t.bind(null,i))};t(e.parent,"parent"),e.slides.map(function(e){t(e,"slide")}),e.on("activate",function(s){e.slides.map(i),t(s.slide,"active"),o(s.slide,"inactive")})}}},{}],3:[function(e,t,o){var i={};t.exports=function(e,t){if(!i[e]){i[e]=!0;var o=document.createElement("style");o.setAttribute("type","text/css"),"textContent"in o?o.textContent=e:o.styleSheet.cssText=e;var s=document.getElementsByTagName("head")[0];t&&t.prepend?s.insertBefore(o,s.childNodes[0]):s.appendChild(o)}}},{}]},{},[1])(1)});
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],10:[function(require,module,exports){
module.exports = function(options) {
  return function(deck) {
    var axis = options == 'vertical' ? 'Y' : 'X',
      startPosition,
      delta;

    deck.parent.addEventListener('touchstart', function(e) {
      if (e.touches.length == 1) {
        startPosition = e.touches[0]['page' + axis];
        delta = 0;
      }
    });

    deck.parent.addEventListener('touchmove', function(e) {
      if (e.touches.length == 1) {
        e.preventDefault();
        delta = e.touches[0]['page' + axis] - startPosition;
      }
    });

    deck.parent.addEventListener('touchend', function() {
      if (Math.abs(delta) > 50) {
        deck[delta > 0 ? 'prev' : 'next']();
      }
    });
  };
};

},{}],11:[function(require,module,exports){
var from = function(opts, plugins) {
  var parent = (opts.parent || opts).nodeType === 1 ? (opts.parent || opts) : document.querySelector(opts.parent || opts),
    slides = [].filter.call(typeof opts.slides === 'string' ? parent.querySelectorAll(opts.slides) : (opts.slides || parent.children), function(el) { return el.nodeName !== 'SCRIPT'; }),
    activeSlide = slides[0],
    listeners = {},

    activate = function(index, customData) {
      if (!slides[index]) {
        return;
      }

      fire('deactivate', createEventData(activeSlide, customData));
      activeSlide = slides[index];
      fire('activate', createEventData(activeSlide, customData));
    },

    slide = function(index, customData) {
      if (arguments.length) {
        fire('slide', createEventData(slides[index], customData)) && activate(index, customData);
      } else {
        return slides.indexOf(activeSlide);
      }
    },

    step = function(offset, customData) {
      var slideIndex = slides.indexOf(activeSlide) + offset;

      fire(offset > 0 ? 'next' : 'prev', createEventData(activeSlide, customData)) && activate(slideIndex, customData);
    },

    on = function(eventName, callback) {
      (listeners[eventName] || (listeners[eventName] = [])).push(callback);
      return off.bind(null, eventName, callback);
    },

    off = function(eventName, callback) {
      listeners[eventName] = (listeners[eventName] || []).filter(function(listener) { return listener !== callback; });
    },

    fire = function(eventName, eventData) {
      return (listeners[eventName] || [])
        .reduce(function(notCancelled, callback) {
          return notCancelled && callback(eventData) !== false;
        }, true);
    },

    createEventData = function(el, eventData) {
      eventData = eventData || {};
      eventData.index = slides.indexOf(el);
      eventData.slide = el;
      return eventData;
    },

    deck = {
      on: on,
      off: off,
      fire: fire,
      slide: slide,
      next: step.bind(null, 1),
      prev: step.bind(null, -1),
      parent: parent,
      slides: slides
    };

  (plugins || []).forEach(function(plugin) {
    plugin(deck);
  });

  activate(0);

  return deck;
};

module.exports = {
  from: from
};

},{}],12:[function(require,module,exports){
// Require Node modules in the browser thanks to Browserify: http://browserify.org
var bespoke = require('bespoke'),
  cube = require('bespoke-theme-fancy'),
  keys = require('bespoke-keys'),
  touch = require('bespoke-touch'),
  bullets = require('bespoke-bullets'),
  backdrop = require('bespoke-backdrop'),
  scale = require('bespoke-scale'),
  hash = require('bespoke-hash'),
  progress = require('bespoke-progress'),
  forms = require('bespoke-forms');

// Bespoke.js
bespoke.from('article', [
  cube(),
  keys(),
  touch(),
  bullets('li, .bullet'),
  backdrop(),
  scale(),
  hash(),
  progress(),
  forms()
]);

// Prism syntax highlighting
// This is actually loaded from "bower_components" thanks to
// debowerify: https://github.com/eugeneware/debowerify
require("./..\\..\\bower_components\\prism\\prism.js");


},{"./..\\..\\bower_components\\prism\\prism.js":1,"bespoke":11,"bespoke-backdrop":2,"bespoke-bullets":3,"bespoke-forms":4,"bespoke-hash":5,"bespoke-keys":6,"bespoke-progress":7,"bespoke-scale":8,"bespoke-theme-fancy":9,"bespoke-touch":10}]},{},[12])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkQ6XFxBcnRpZmljaWFsLUludGVsbGlnZW5jZVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiRDovQXJ0aWZpY2lhbC1JbnRlbGxpZ2VuY2UvYm93ZXJfY29tcG9uZW50cy9wcmlzbS9wcmlzbS5qcyIsIkQ6L0FydGlmaWNpYWwtSW50ZWxsaWdlbmNlL25vZGVfbW9kdWxlcy9iZXNwb2tlLWJhY2tkcm9wL2xpYi9iZXNwb2tlLWJhY2tkcm9wLmpzIiwiRDovQXJ0aWZpY2lhbC1JbnRlbGxpZ2VuY2Uvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtYnVsbGV0cy9saWIvYmVzcG9rZS1idWxsZXRzLmpzIiwiRDovQXJ0aWZpY2lhbC1JbnRlbGxpZ2VuY2Uvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtZm9ybXMvbGliL2Jlc3Bva2UtZm9ybXMuanMiLCJEOi9BcnRpZmljaWFsLUludGVsbGlnZW5jZS9ub2RlX21vZHVsZXMvYmVzcG9rZS1oYXNoL2xpYi9iZXNwb2tlLWhhc2guanMiLCJEOi9BcnRpZmljaWFsLUludGVsbGlnZW5jZS9ub2RlX21vZHVsZXMvYmVzcG9rZS1rZXlzL2xpYi9iZXNwb2tlLWtleXMuanMiLCJEOi9BcnRpZmljaWFsLUludGVsbGlnZW5jZS9ub2RlX21vZHVsZXMvYmVzcG9rZS1wcm9ncmVzcy9saWIvYmVzcG9rZS1wcm9ncmVzcy5qcyIsIkQ6L0FydGlmaWNpYWwtSW50ZWxsaWdlbmNlL25vZGVfbW9kdWxlcy9iZXNwb2tlLXNjYWxlL2xpYi9iZXNwb2tlLXNjYWxlLmpzIiwiRDovQXJ0aWZpY2lhbC1JbnRlbGxpZ2VuY2Uvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtdGhlbWUtZmFuY3kvZGlzdC9iZXNwb2tlLXRoZW1lLWZhbmN5Lm1pbi5qcyIsIkQ6L0FydGlmaWNpYWwtSW50ZWxsaWdlbmNlL25vZGVfbW9kdWxlcy9iZXNwb2tlLXRvdWNoL2xpYi9iZXNwb2tlLXRvdWNoLmpzIiwiRDovQXJ0aWZpY2lhbC1JbnRlbGxpZ2VuY2Uvbm9kZV9tb2R1bGVzL2Jlc3Bva2UvbGliL2Jlc3Bva2UuanMiLCJEOi9BcnRpZmljaWFsLUludGVsbGlnZW5jZS9zcmMvc2NyaXB0cy9mYWtlXzg1ZDNlZmQwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcblxyXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAgQmVnaW4gcHJpc20tY29yZS5qc1xyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcblxyXG52YXIgX3NlbGYgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpXHJcblx0PyB3aW5kb3cgICAvLyBpZiBpbiBicm93c2VyXHJcblx0OiAoXHJcblx0XHQodHlwZW9mIFdvcmtlckdsb2JhbFNjb3BlICE9PSAndW5kZWZpbmVkJyAmJiBzZWxmIGluc3RhbmNlb2YgV29ya2VyR2xvYmFsU2NvcGUpXHJcblx0XHQ/IHNlbGYgLy8gaWYgaW4gd29ya2VyXHJcblx0XHQ6IHt9ICAgLy8gaWYgaW4gbm9kZSBqc1xyXG5cdCk7XHJcblxyXG4vKipcclxuICogUHJpc206IExpZ2h0d2VpZ2h0LCByb2J1c3QsIGVsZWdhbnQgc3ludGF4IGhpZ2hsaWdodGluZ1xyXG4gKiBNSVQgbGljZW5zZSBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocC9cclxuICogQGF1dGhvciBMZWEgVmVyb3UgaHR0cDovL2xlYS52ZXJvdS5tZVxyXG4gKi9cclxuXHJcbnZhciBQcmlzbSA9IChmdW5jdGlvbigpe1xyXG5cclxuLy8gUHJpdmF0ZSBoZWxwZXIgdmFyc1xyXG52YXIgbGFuZyA9IC9cXGJsYW5nKD86dWFnZSk/LShcXHcrKVxcYi9pO1xyXG52YXIgdW5pcXVlSWQgPSAwO1xyXG5cclxudmFyIF8gPSBfc2VsZi5QcmlzbSA9IHtcclxuXHRtYW51YWw6IF9zZWxmLlByaXNtICYmIF9zZWxmLlByaXNtLm1hbnVhbCxcclxuXHR1dGlsOiB7XHJcblx0XHRlbmNvZGU6IGZ1bmN0aW9uICh0b2tlbnMpIHtcclxuXHRcdFx0aWYgKHRva2VucyBpbnN0YW5jZW9mIFRva2VuKSB7XHJcblx0XHRcdFx0cmV0dXJuIG5ldyBUb2tlbih0b2tlbnMudHlwZSwgXy51dGlsLmVuY29kZSh0b2tlbnMuY29udGVudCksIHRva2Vucy5hbGlhcyk7XHJcblx0XHRcdH0gZWxzZSBpZiAoXy51dGlsLnR5cGUodG9rZW5zKSA9PT0gJ0FycmF5Jykge1xyXG5cdFx0XHRcdHJldHVybiB0b2tlbnMubWFwKF8udXRpbC5lbmNvZGUpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHJldHVybiB0b2tlbnMucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvXFx1MDBhMC9nLCAnICcpO1xyXG5cdFx0XHR9XHJcblx0XHR9LFxyXG5cclxuXHRcdHR5cGU6IGZ1bmN0aW9uIChvKSB7XHJcblx0XHRcdHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobykubWF0Y2goL1xcW29iamVjdCAoXFx3KylcXF0vKVsxXTtcclxuXHRcdH0sXHJcblxyXG5cdFx0b2JqSWQ6IGZ1bmN0aW9uIChvYmopIHtcclxuXHRcdFx0aWYgKCFvYmpbJ19faWQnXSkge1xyXG5cdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosICdfX2lkJywgeyB2YWx1ZTogKyt1bmlxdWVJZCB9KTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gb2JqWydfX2lkJ107XHJcblx0XHR9LFxyXG5cclxuXHRcdC8vIERlZXAgY2xvbmUgYSBsYW5ndWFnZSBkZWZpbml0aW9uIChlLmcuIHRvIGV4dGVuZCBpdClcclxuXHRcdGNsb25lOiBmdW5jdGlvbiAobykge1xyXG5cdFx0XHR2YXIgdHlwZSA9IF8udXRpbC50eXBlKG8pO1xyXG5cclxuXHRcdFx0c3dpdGNoICh0eXBlKSB7XHJcblx0XHRcdFx0Y2FzZSAnT2JqZWN0JzpcclxuXHRcdFx0XHRcdHZhciBjbG9uZSA9IHt9O1xyXG5cclxuXHRcdFx0XHRcdGZvciAodmFyIGtleSBpbiBvKSB7XHJcblx0XHRcdFx0XHRcdGlmIChvLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuXHRcdFx0XHRcdFx0XHRjbG9uZVtrZXldID0gXy51dGlsLmNsb25lKG9ba2V5XSk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRyZXR1cm4gY2xvbmU7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ0FycmF5JzpcclxuXHRcdFx0XHRcdC8vIENoZWNrIGZvciBleGlzdGVuY2UgZm9yIElFOFxyXG5cdFx0XHRcdFx0cmV0dXJuIG8ubWFwICYmIG8ubWFwKGZ1bmN0aW9uKHYpIHsgcmV0dXJuIF8udXRpbC5jbG9uZSh2KTsgfSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBvO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdGxhbmd1YWdlczoge1xyXG5cdFx0ZXh0ZW5kOiBmdW5jdGlvbiAoaWQsIHJlZGVmKSB7XHJcblx0XHRcdHZhciBsYW5nID0gXy51dGlsLmNsb25lKF8ubGFuZ3VhZ2VzW2lkXSk7XHJcblxyXG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gcmVkZWYpIHtcclxuXHRcdFx0XHRsYW5nW2tleV0gPSByZWRlZltrZXldO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gbGFuZztcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJbnNlcnQgYSB0b2tlbiBiZWZvcmUgYW5vdGhlciB0b2tlbiBpbiBhIGxhbmd1YWdlIGxpdGVyYWxcclxuXHRcdCAqIEFzIHRoaXMgbmVlZHMgdG8gcmVjcmVhdGUgdGhlIG9iamVjdCAod2UgY2Fubm90IGFjdHVhbGx5IGluc2VydCBiZWZvcmUga2V5cyBpbiBvYmplY3QgbGl0ZXJhbHMpLFxyXG5cdFx0ICogd2UgY2Fubm90IGp1c3QgcHJvdmlkZSBhbiBvYmplY3QsIHdlIG5lZWQgYW5vYmplY3QgYW5kIGEga2V5LlxyXG5cdFx0ICogQHBhcmFtIGluc2lkZSBUaGUga2V5IChvciBsYW5ndWFnZSBpZCkgb2YgdGhlIHBhcmVudFxyXG5cdFx0ICogQHBhcmFtIGJlZm9yZSBUaGUga2V5IHRvIGluc2VydCBiZWZvcmUuIElmIG5vdCBwcm92aWRlZCwgdGhlIGZ1bmN0aW9uIGFwcGVuZHMgaW5zdGVhZC5cclxuXHRcdCAqIEBwYXJhbSBpbnNlcnQgT2JqZWN0IHdpdGggdGhlIGtleS92YWx1ZSBwYWlycyB0byBpbnNlcnRcclxuXHRcdCAqIEBwYXJhbSByb290IFRoZSBvYmplY3QgdGhhdCBjb250YWlucyBgaW5zaWRlYC4gSWYgZXF1YWwgdG8gUHJpc20ubGFuZ3VhZ2VzLCBpdCBjYW4gYmUgb21pdHRlZC5cclxuXHRcdCAqL1xyXG5cdFx0aW5zZXJ0QmVmb3JlOiBmdW5jdGlvbiAoaW5zaWRlLCBiZWZvcmUsIGluc2VydCwgcm9vdCkge1xyXG5cdFx0XHRyb290ID0gcm9vdCB8fCBfLmxhbmd1YWdlcztcclxuXHRcdFx0dmFyIGdyYW1tYXIgPSByb290W2luc2lkZV07XHJcblxyXG5cdFx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAyKSB7XHJcblx0XHRcdFx0aW5zZXJ0ID0gYXJndW1lbnRzWzFdO1xyXG5cclxuXHRcdFx0XHRmb3IgKHZhciBuZXdUb2tlbiBpbiBpbnNlcnQpIHtcclxuXHRcdFx0XHRcdGlmIChpbnNlcnQuaGFzT3duUHJvcGVydHkobmV3VG9rZW4pKSB7XHJcblx0XHRcdFx0XHRcdGdyYW1tYXJbbmV3VG9rZW5dID0gaW5zZXJ0W25ld1Rva2VuXTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBncmFtbWFyO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgcmV0ID0ge307XHJcblxyXG5cdFx0XHRmb3IgKHZhciB0b2tlbiBpbiBncmFtbWFyKSB7XHJcblxyXG5cdFx0XHRcdGlmIChncmFtbWFyLmhhc093blByb3BlcnR5KHRva2VuKSkge1xyXG5cclxuXHRcdFx0XHRcdGlmICh0b2tlbiA9PSBiZWZvcmUpIHtcclxuXHJcblx0XHRcdFx0XHRcdGZvciAodmFyIG5ld1Rva2VuIGluIGluc2VydCkge1xyXG5cclxuXHRcdFx0XHRcdFx0XHRpZiAoaW5zZXJ0Lmhhc093blByb3BlcnR5KG5ld1Rva2VuKSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0cmV0W25ld1Rva2VuXSA9IGluc2VydFtuZXdUb2tlbl07XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0cmV0W3Rva2VuXSA9IGdyYW1tYXJbdG9rZW5dO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gVXBkYXRlIHJlZmVyZW5jZXMgaW4gb3RoZXIgbGFuZ3VhZ2UgZGVmaW5pdGlvbnNcclxuXHRcdFx0Xy5sYW5ndWFnZXMuREZTKF8ubGFuZ3VhZ2VzLCBmdW5jdGlvbihrZXksIHZhbHVlKSB7XHJcblx0XHRcdFx0aWYgKHZhbHVlID09PSByb290W2luc2lkZV0gJiYga2V5ICE9IGluc2lkZSkge1xyXG5cdFx0XHRcdFx0dGhpc1trZXldID0gcmV0O1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRyZXR1cm4gcm9vdFtpbnNpZGVdID0gcmV0O1xyXG5cdFx0fSxcclxuXHJcblx0XHQvLyBUcmF2ZXJzZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gd2l0aCBEZXB0aCBGaXJzdCBTZWFyY2hcclxuXHRcdERGUzogZnVuY3Rpb24obywgY2FsbGJhY2ssIHR5cGUsIHZpc2l0ZWQpIHtcclxuXHRcdFx0dmlzaXRlZCA9IHZpc2l0ZWQgfHwge307XHJcblx0XHRcdGZvciAodmFyIGkgaW4gbykge1xyXG5cdFx0XHRcdGlmIChvLmhhc093blByb3BlcnR5KGkpKSB7XHJcblx0XHRcdFx0XHRjYWxsYmFjay5jYWxsKG8sIGksIG9baV0sIHR5cGUgfHwgaSk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKF8udXRpbC50eXBlKG9baV0pID09PSAnT2JqZWN0JyAmJiAhdmlzaXRlZFtfLnV0aWwub2JqSWQob1tpXSldKSB7XHJcblx0XHRcdFx0XHRcdHZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSA9IHRydWU7XHJcblx0XHRcdFx0XHRcdF8ubGFuZ3VhZ2VzLkRGUyhvW2ldLCBjYWxsYmFjaywgbnVsbCwgdmlzaXRlZCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRlbHNlIGlmIChfLnV0aWwudHlwZShvW2ldKSA9PT0gJ0FycmF5JyAmJiAhdmlzaXRlZFtfLnV0aWwub2JqSWQob1tpXSldKSB7XHJcblx0XHRcdFx0XHRcdHZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSA9IHRydWU7XHJcblx0XHRcdFx0XHRcdF8ubGFuZ3VhZ2VzLkRGUyhvW2ldLCBjYWxsYmFjaywgaSwgdmlzaXRlZCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSxcclxuXHRwbHVnaW5zOiB7fSxcclxuXHJcblx0aGlnaGxpZ2h0QWxsOiBmdW5jdGlvbihhc3luYywgY2FsbGJhY2spIHtcclxuXHRcdHZhciBlbnYgPSB7XHJcblx0XHRcdGNhbGxiYWNrOiBjYWxsYmFjayxcclxuXHRcdFx0c2VsZWN0b3I6ICdjb2RlW2NsYXNzKj1cImxhbmd1YWdlLVwiXSwgW2NsYXNzKj1cImxhbmd1YWdlLVwiXSBjb2RlLCBjb2RlW2NsYXNzKj1cImxhbmctXCJdLCBbY2xhc3MqPVwibGFuZy1cIl0gY29kZSdcclxuXHRcdH07XHJcblxyXG5cdFx0Xy5ob29rcy5ydW4oXCJiZWZvcmUtaGlnaGxpZ2h0YWxsXCIsIGVudik7XHJcblxyXG5cdFx0dmFyIGVsZW1lbnRzID0gZW52LmVsZW1lbnRzIHx8IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoZW52LnNlbGVjdG9yKTtcclxuXHJcblx0XHRmb3IgKHZhciBpPTAsIGVsZW1lbnQ7IGVsZW1lbnQgPSBlbGVtZW50c1tpKytdOykge1xyXG5cdFx0XHRfLmhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCwgYXN5bmMgPT09IHRydWUsIGVudi5jYWxsYmFjayk7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0aGlnaGxpZ2h0RWxlbWVudDogZnVuY3Rpb24oZWxlbWVudCwgYXN5bmMsIGNhbGxiYWNrKSB7XHJcblx0XHQvLyBGaW5kIGxhbmd1YWdlXHJcblx0XHR2YXIgbGFuZ3VhZ2UsIGdyYW1tYXIsIHBhcmVudCA9IGVsZW1lbnQ7XHJcblxyXG5cdFx0d2hpbGUgKHBhcmVudCAmJiAhbGFuZy50ZXN0KHBhcmVudC5jbGFzc05hbWUpKSB7XHJcblx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChwYXJlbnQpIHtcclxuXHRcdFx0bGFuZ3VhZ2UgPSAocGFyZW50LmNsYXNzTmFtZS5tYXRjaChsYW5nKSB8fCBbLCcnXSlbMV0udG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0Z3JhbW1hciA9IF8ubGFuZ3VhZ2VzW2xhbmd1YWdlXTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBTZXQgbGFuZ3VhZ2Ugb24gdGhlIGVsZW1lbnQsIGlmIG5vdCBwcmVzZW50XHJcblx0XHRlbGVtZW50LmNsYXNzTmFtZSA9IGVsZW1lbnQuY2xhc3NOYW1lLnJlcGxhY2UobGFuZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKSArICcgbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xyXG5cclxuXHRcdC8vIFNldCBsYW5ndWFnZSBvbiB0aGUgcGFyZW50LCBmb3Igc3R5bGluZ1xyXG5cdFx0cGFyZW50ID0gZWxlbWVudC5wYXJlbnROb2RlO1xyXG5cclxuXHRcdGlmICgvcHJlL2kudGVzdChwYXJlbnQubm9kZU5hbWUpKSB7XHJcblx0XHRcdHBhcmVudC5jbGFzc05hbWUgPSBwYXJlbnQuY2xhc3NOYW1lLnJlcGxhY2UobGFuZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKSArICcgbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBjb2RlID0gZWxlbWVudC50ZXh0Q29udGVudDtcclxuXHJcblx0XHR2YXIgZW52ID0ge1xyXG5cdFx0XHRlbGVtZW50OiBlbGVtZW50LFxyXG5cdFx0XHRsYW5ndWFnZTogbGFuZ3VhZ2UsXHJcblx0XHRcdGdyYW1tYXI6IGdyYW1tYXIsXHJcblx0XHRcdGNvZGU6IGNvZGVcclxuXHRcdH07XHJcblxyXG5cdFx0Xy5ob29rcy5ydW4oJ2JlZm9yZS1zYW5pdHktY2hlY2snLCBlbnYpO1xyXG5cclxuXHRcdGlmICghZW52LmNvZGUgfHwgIWVudi5ncmFtbWFyKSB7XHJcblx0XHRcdGlmIChlbnYuY29kZSkge1xyXG5cdFx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaGlnaGxpZ2h0JywgZW52KTtcclxuXHRcdFx0XHRlbnYuZWxlbWVudC50ZXh0Q29udGVudCA9IGVudi5jb2RlO1xyXG5cdFx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xyXG5cdFx0XHR9XHJcblx0XHRcdF8uaG9va3MucnVuKCdjb21wbGV0ZScsIGVudik7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWhpZ2hsaWdodCcsIGVudik7XHJcblxyXG5cdFx0aWYgKGFzeW5jICYmIF9zZWxmLldvcmtlcikge1xyXG5cdFx0XHR2YXIgd29ya2VyID0gbmV3IFdvcmtlcihfLmZpbGVuYW1lKTtcclxuXHJcblx0XHRcdHdvcmtlci5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRlbnYuaGlnaGxpZ2h0ZWRDb2RlID0gZXZ0LmRhdGE7XHJcblxyXG5cdFx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaW5zZXJ0JywgZW52KTtcclxuXHJcblx0XHRcdFx0ZW52LmVsZW1lbnQuaW5uZXJIVE1MID0gZW52LmhpZ2hsaWdodGVkQ29kZTtcclxuXHJcblx0XHRcdFx0Y2FsbGJhY2sgJiYgY2FsbGJhY2suY2FsbChlbnYuZWxlbWVudCk7XHJcblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XHJcblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2NvbXBsZXRlJywgZW52KTtcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdHdvcmtlci5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeSh7XHJcblx0XHRcdFx0bGFuZ3VhZ2U6IGVudi5sYW5ndWFnZSxcclxuXHRcdFx0XHRjb2RlOiBlbnYuY29kZSxcclxuXHRcdFx0XHRpbW1lZGlhdGVDbG9zZTogdHJ1ZVxyXG5cdFx0XHR9KSk7XHJcblx0XHR9XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0ZW52LmhpZ2hsaWdodGVkQ29kZSA9IF8uaGlnaGxpZ2h0KGVudi5jb2RlLCBlbnYuZ3JhbW1hciwgZW52Lmxhbmd1YWdlKTtcclxuXHJcblx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaW5zZXJ0JywgZW52KTtcclxuXHJcblx0XHRcdGVudi5lbGVtZW50LmlubmVySFRNTCA9IGVudi5oaWdobGlnaHRlZENvZGU7XHJcblxyXG5cdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjay5jYWxsKGVsZW1lbnQpO1xyXG5cclxuXHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XHJcblx0XHRcdF8uaG9va3MucnVuKCdjb21wbGV0ZScsIGVudik7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0aGlnaGxpZ2h0OiBmdW5jdGlvbiAodGV4dCwgZ3JhbW1hciwgbGFuZ3VhZ2UpIHtcclxuXHRcdHZhciB0b2tlbnMgPSBfLnRva2VuaXplKHRleHQsIGdyYW1tYXIpO1xyXG5cdFx0cmV0dXJuIFRva2VuLnN0cmluZ2lmeShfLnV0aWwuZW5jb2RlKHRva2VucyksIGxhbmd1YWdlKTtcclxuXHR9LFxyXG5cclxuXHRtYXRjaEdyYW1tYXI6IGZ1bmN0aW9uICh0ZXh0LCBzdHJhcnIsIGdyYW1tYXIsIGluZGV4LCBzdGFydFBvcywgb25lc2hvdCwgdGFyZ2V0KSB7XHJcblx0XHR2YXIgVG9rZW4gPSBfLlRva2VuO1xyXG5cclxuXHRcdGZvciAodmFyIHRva2VuIGluIGdyYW1tYXIpIHtcclxuXHRcdFx0aWYoIWdyYW1tYXIuaGFzT3duUHJvcGVydHkodG9rZW4pIHx8ICFncmFtbWFyW3Rva2VuXSkge1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodG9rZW4gPT0gdGFyZ2V0KSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgcGF0dGVybnMgPSBncmFtbWFyW3Rva2VuXTtcclxuXHRcdFx0cGF0dGVybnMgPSAoXy51dGlsLnR5cGUocGF0dGVybnMpID09PSBcIkFycmF5XCIpID8gcGF0dGVybnMgOiBbcGF0dGVybnNdO1xyXG5cclxuXHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBwYXR0ZXJucy5sZW5ndGg7ICsraikge1xyXG5cdFx0XHRcdHZhciBwYXR0ZXJuID0gcGF0dGVybnNbal0sXHJcblx0XHRcdFx0XHRpbnNpZGUgPSBwYXR0ZXJuLmluc2lkZSxcclxuXHRcdFx0XHRcdGxvb2tiZWhpbmQgPSAhIXBhdHRlcm4ubG9va2JlaGluZCxcclxuXHRcdFx0XHRcdGdyZWVkeSA9ICEhcGF0dGVybi5ncmVlZHksXHJcblx0XHRcdFx0XHRsb29rYmVoaW5kTGVuZ3RoID0gMCxcclxuXHRcdFx0XHRcdGFsaWFzID0gcGF0dGVybi5hbGlhcztcclxuXHJcblx0XHRcdFx0aWYgKGdyZWVkeSAmJiAhcGF0dGVybi5wYXR0ZXJuLmdsb2JhbCkge1xyXG5cdFx0XHRcdFx0Ly8gV2l0aG91dCB0aGUgZ2xvYmFsIGZsYWcsIGxhc3RJbmRleCB3b24ndCB3b3JrXHJcblx0XHRcdFx0XHR2YXIgZmxhZ3MgPSBwYXR0ZXJuLnBhdHRlcm4udG9TdHJpbmcoKS5tYXRjaCgvW2ltdXldKiQvKVswXTtcclxuXHRcdFx0XHRcdHBhdHRlcm4ucGF0dGVybiA9IFJlZ0V4cChwYXR0ZXJuLnBhdHRlcm4uc291cmNlLCBmbGFncyArIFwiZ1wiKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHBhdHRlcm4gPSBwYXR0ZXJuLnBhdHRlcm4gfHwgcGF0dGVybjtcclxuXHJcblx0XHRcdFx0Ly8gRG9u4oCZdCBjYWNoZSBsZW5ndGggYXMgaXQgY2hhbmdlcyBkdXJpbmcgdGhlIGxvb3BcclxuXHRcdFx0XHRmb3IgKHZhciBpID0gaW5kZXgsIHBvcyA9IHN0YXJ0UG9zOyBpIDwgc3RyYXJyLmxlbmd0aDsgcG9zICs9IHN0cmFycltpXS5sZW5ndGgsICsraSkge1xyXG5cclxuXHRcdFx0XHRcdHZhciBzdHIgPSBzdHJhcnJbaV07XHJcblxyXG5cdFx0XHRcdFx0aWYgKHN0cmFyci5sZW5ndGggPiB0ZXh0Lmxlbmd0aCkge1xyXG5cdFx0XHRcdFx0XHQvLyBTb21ldGhpbmcgd2VudCB0ZXJyaWJseSB3cm9uZywgQUJPUlQsIEFCT1JUIVxyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKHN0ciBpbnN0YW5jZW9mIFRva2VuKSB7XHJcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHBhdHRlcm4ubGFzdEluZGV4ID0gMDtcclxuXHJcblx0XHRcdFx0XHR2YXIgbWF0Y2ggPSBwYXR0ZXJuLmV4ZWMoc3RyKSxcclxuXHRcdFx0XHRcdCAgICBkZWxOdW0gPSAxO1xyXG5cclxuXHRcdFx0XHRcdC8vIEdyZWVkeSBwYXR0ZXJucyBjYW4gb3ZlcnJpZGUvcmVtb3ZlIHVwIHRvIHR3byBwcmV2aW91c2x5IG1hdGNoZWQgdG9rZW5zXHJcblx0XHRcdFx0XHRpZiAoIW1hdGNoICYmIGdyZWVkeSAmJiBpICE9IHN0cmFyci5sZW5ndGggLSAxKSB7XHJcblx0XHRcdFx0XHRcdHBhdHRlcm4ubGFzdEluZGV4ID0gcG9zO1xyXG5cdFx0XHRcdFx0XHRtYXRjaCA9IHBhdHRlcm4uZXhlYyh0ZXh0KTtcclxuXHRcdFx0XHRcdFx0aWYgKCFtYXRjaCkge1xyXG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgZnJvbSA9IG1hdGNoLmluZGV4ICsgKGxvb2tiZWhpbmQgPyBtYXRjaFsxXS5sZW5ndGggOiAwKSxcclxuXHRcdFx0XHRcdFx0ICAgIHRvID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGgsXHJcblx0XHRcdFx0XHRcdCAgICBrID0gaSxcclxuXHRcdFx0XHRcdFx0ICAgIHAgPSBwb3M7XHJcblxyXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBsZW4gPSBzdHJhcnIubGVuZ3RoOyBrIDwgbGVuICYmIChwIDwgdG8gfHwgKCFzdHJhcnJba10udHlwZSAmJiAhc3RyYXJyW2sgLSAxXS5ncmVlZHkpKTsgKytrKSB7XHJcblx0XHRcdFx0XHRcdFx0cCArPSBzdHJhcnJba10ubGVuZ3RoO1xyXG5cdFx0XHRcdFx0XHRcdC8vIE1vdmUgdGhlIGluZGV4IGkgdG8gdGhlIGVsZW1lbnQgaW4gc3RyYXJyIHRoYXQgaXMgY2xvc2VzdCB0byBmcm9tXHJcblx0XHRcdFx0XHRcdFx0aWYgKGZyb20gPj0gcCkge1xyXG5cdFx0XHRcdFx0XHRcdFx0KytpO1xyXG5cdFx0XHRcdFx0XHRcdFx0cG9zID0gcDtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdC8qXHJcblx0XHRcdFx0XHRcdCAqIElmIHN0cmFycltpXSBpcyBhIFRva2VuLCB0aGVuIHRoZSBtYXRjaCBzdGFydHMgaW5zaWRlIGFub3RoZXIgVG9rZW4sIHdoaWNoIGlzIGludmFsaWRcclxuXHRcdFx0XHRcdFx0ICogSWYgc3RyYXJyW2sgLSAxXSBpcyBncmVlZHkgd2UgYXJlIGluIGNvbmZsaWN0IHdpdGggYW5vdGhlciBncmVlZHkgcGF0dGVyblxyXG5cdFx0XHRcdFx0XHQgKi9cclxuXHRcdFx0XHRcdFx0aWYgKHN0cmFycltpXSBpbnN0YW5jZW9mIFRva2VuIHx8IHN0cmFycltrIC0gMV0uZ3JlZWR5KSB7XHJcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdC8vIE51bWJlciBvZiB0b2tlbnMgdG8gZGVsZXRlIGFuZCByZXBsYWNlIHdpdGggdGhlIG5ldyBtYXRjaFxyXG5cdFx0XHRcdFx0XHRkZWxOdW0gPSBrIC0gaTtcclxuXHRcdFx0XHRcdFx0c3RyID0gdGV4dC5zbGljZShwb3MsIHApO1xyXG5cdFx0XHRcdFx0XHRtYXRjaC5pbmRleCAtPSBwb3M7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCFtYXRjaCkge1xyXG5cdFx0XHRcdFx0XHRpZiAob25lc2hvdCkge1xyXG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZihsb29rYmVoaW5kKSB7XHJcblx0XHRcdFx0XHRcdGxvb2tiZWhpbmRMZW5ndGggPSBtYXRjaFsxXS5sZW5ndGg7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0dmFyIGZyb20gPSBtYXRjaC5pbmRleCArIGxvb2tiZWhpbmRMZW5ndGgsXHJcblx0XHRcdFx0XHQgICAgbWF0Y2ggPSBtYXRjaFswXS5zbGljZShsb29rYmVoaW5kTGVuZ3RoKSxcclxuXHRcdFx0XHRcdCAgICB0byA9IGZyb20gKyBtYXRjaC5sZW5ndGgsXHJcblx0XHRcdFx0XHQgICAgYmVmb3JlID0gc3RyLnNsaWNlKDAsIGZyb20pLFxyXG5cdFx0XHRcdFx0ICAgIGFmdGVyID0gc3RyLnNsaWNlKHRvKTtcclxuXHJcblx0XHRcdFx0XHR2YXIgYXJncyA9IFtpLCBkZWxOdW1dO1xyXG5cclxuXHRcdFx0XHRcdGlmIChiZWZvcmUpIHtcclxuXHRcdFx0XHRcdFx0KytpO1xyXG5cdFx0XHRcdFx0XHRwb3MgKz0gYmVmb3JlLmxlbmd0aDtcclxuXHRcdFx0XHRcdFx0YXJncy5wdXNoKGJlZm9yZSk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0dmFyIHdyYXBwZWQgPSBuZXcgVG9rZW4odG9rZW4sIGluc2lkZT8gXy50b2tlbml6ZShtYXRjaCwgaW5zaWRlKSA6IG1hdGNoLCBhbGlhcywgbWF0Y2gsIGdyZWVkeSk7XHJcblxyXG5cdFx0XHRcdFx0YXJncy5wdXNoKHdyYXBwZWQpO1xyXG5cclxuXHRcdFx0XHRcdGlmIChhZnRlcikge1xyXG5cdFx0XHRcdFx0XHRhcmdzLnB1c2goYWZ0ZXIpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkoc3RyYXJyLCBhcmdzKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoZGVsTnVtICE9IDEpXHJcblx0XHRcdFx0XHRcdF8ubWF0Y2hHcmFtbWFyKHRleHQsIHN0cmFyciwgZ3JhbW1hciwgaSwgcG9zLCB0cnVlLCB0b2tlbik7XHJcblxyXG5cdFx0XHRcdFx0aWYgKG9uZXNob3QpXHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdHRva2VuaXplOiBmdW5jdGlvbih0ZXh0LCBncmFtbWFyLCBsYW5ndWFnZSkge1xyXG5cdFx0dmFyIHN0cmFyciA9IFt0ZXh0XTtcclxuXHJcblx0XHR2YXIgcmVzdCA9IGdyYW1tYXIucmVzdDtcclxuXHJcblx0XHRpZiAocmVzdCkge1xyXG5cdFx0XHRmb3IgKHZhciB0b2tlbiBpbiByZXN0KSB7XHJcblx0XHRcdFx0Z3JhbW1hclt0b2tlbl0gPSByZXN0W3Rva2VuXTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZGVsZXRlIGdyYW1tYXIucmVzdDtcclxuXHRcdH1cclxuXHJcblx0XHRfLm1hdGNoR3JhbW1hcih0ZXh0LCBzdHJhcnIsIGdyYW1tYXIsIDAsIDAsIGZhbHNlKTtcclxuXHJcblx0XHRyZXR1cm4gc3RyYXJyO1xyXG5cdH0sXHJcblxyXG5cdGhvb2tzOiB7XHJcblx0XHRhbGw6IHt9LFxyXG5cclxuXHRcdGFkZDogZnVuY3Rpb24gKG5hbWUsIGNhbGxiYWNrKSB7XHJcblx0XHRcdHZhciBob29rcyA9IF8uaG9va3MuYWxsO1xyXG5cclxuXHRcdFx0aG9va3NbbmFtZV0gPSBob29rc1tuYW1lXSB8fCBbXTtcclxuXHJcblx0XHRcdGhvb2tzW25hbWVdLnB1c2goY2FsbGJhY2spO1xyXG5cdFx0fSxcclxuXHJcblx0XHRydW46IGZ1bmN0aW9uIChuYW1lLCBlbnYpIHtcclxuXHRcdFx0dmFyIGNhbGxiYWNrcyA9IF8uaG9va3MuYWxsW25hbWVdO1xyXG5cclxuXHRcdFx0aWYgKCFjYWxsYmFja3MgfHwgIWNhbGxiYWNrcy5sZW5ndGgpIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZvciAodmFyIGk9MCwgY2FsbGJhY2s7IGNhbGxiYWNrID0gY2FsbGJhY2tzW2krK107KSB7XHJcblx0XHRcdFx0Y2FsbGJhY2soZW52KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbnZhciBUb2tlbiA9IF8uVG9rZW4gPSBmdW5jdGlvbih0eXBlLCBjb250ZW50LCBhbGlhcywgbWF0Y2hlZFN0ciwgZ3JlZWR5KSB7XHJcblx0dGhpcy50eXBlID0gdHlwZTtcclxuXHR0aGlzLmNvbnRlbnQgPSBjb250ZW50O1xyXG5cdHRoaXMuYWxpYXMgPSBhbGlhcztcclxuXHQvLyBDb3B5IG9mIHRoZSBmdWxsIHN0cmluZyB0aGlzIHRva2VuIHdhcyBjcmVhdGVkIGZyb21cclxuXHR0aGlzLmxlbmd0aCA9IChtYXRjaGVkU3RyIHx8IFwiXCIpLmxlbmd0aHwwO1xyXG5cdHRoaXMuZ3JlZWR5ID0gISFncmVlZHk7XHJcbn07XHJcblxyXG5Ub2tlbi5zdHJpbmdpZnkgPSBmdW5jdGlvbihvLCBsYW5ndWFnZSwgcGFyZW50KSB7XHJcblx0aWYgKHR5cGVvZiBvID09ICdzdHJpbmcnKSB7XHJcblx0XHRyZXR1cm4gbztcclxuXHR9XHJcblxyXG5cdGlmIChfLnV0aWwudHlwZShvKSA9PT0gJ0FycmF5Jykge1xyXG5cdFx0cmV0dXJuIG8ubWFwKGZ1bmN0aW9uKGVsZW1lbnQpIHtcclxuXHRcdFx0cmV0dXJuIFRva2VuLnN0cmluZ2lmeShlbGVtZW50LCBsYW5ndWFnZSwgbyk7XHJcblx0XHR9KS5qb2luKCcnKTtcclxuXHR9XHJcblxyXG5cdHZhciBlbnYgPSB7XHJcblx0XHR0eXBlOiBvLnR5cGUsXHJcblx0XHRjb250ZW50OiBUb2tlbi5zdHJpbmdpZnkoby5jb250ZW50LCBsYW5ndWFnZSwgcGFyZW50KSxcclxuXHRcdHRhZzogJ3NwYW4nLFxyXG5cdFx0Y2xhc3NlczogWyd0b2tlbicsIG8udHlwZV0sXHJcblx0XHRhdHRyaWJ1dGVzOiB7fSxcclxuXHRcdGxhbmd1YWdlOiBsYW5ndWFnZSxcclxuXHRcdHBhcmVudDogcGFyZW50XHJcblx0fTtcclxuXHJcblx0aWYgKGVudi50eXBlID09ICdjb21tZW50Jykge1xyXG5cdFx0ZW52LmF0dHJpYnV0ZXNbJ3NwZWxsY2hlY2snXSA9ICd0cnVlJztcclxuXHR9XHJcblxyXG5cdGlmIChvLmFsaWFzKSB7XHJcblx0XHR2YXIgYWxpYXNlcyA9IF8udXRpbC50eXBlKG8uYWxpYXMpID09PSAnQXJyYXknID8gby5hbGlhcyA6IFtvLmFsaWFzXTtcclxuXHRcdEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KGVudi5jbGFzc2VzLCBhbGlhc2VzKTtcclxuXHR9XHJcblxyXG5cdF8uaG9va3MucnVuKCd3cmFwJywgZW52KTtcclxuXHJcblx0dmFyIGF0dHJpYnV0ZXMgPSBPYmplY3Qua2V5cyhlbnYuYXR0cmlidXRlcykubWFwKGZ1bmN0aW9uKG5hbWUpIHtcclxuXHRcdHJldHVybiBuYW1lICsgJz1cIicgKyAoZW52LmF0dHJpYnV0ZXNbbmFtZV0gfHwgJycpLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKSArICdcIic7XHJcblx0fSkuam9pbignICcpO1xyXG5cclxuXHRyZXR1cm4gJzwnICsgZW52LnRhZyArICcgY2xhc3M9XCInICsgZW52LmNsYXNzZXMuam9pbignICcpICsgJ1wiJyArIChhdHRyaWJ1dGVzID8gJyAnICsgYXR0cmlidXRlcyA6ICcnKSArICc+JyArIGVudi5jb250ZW50ICsgJzwvJyArIGVudi50YWcgKyAnPic7XHJcblxyXG59O1xyXG5cclxuaWYgKCFfc2VsZi5kb2N1bWVudCkge1xyXG5cdGlmICghX3NlbGYuYWRkRXZlbnRMaXN0ZW5lcikge1xyXG5cdFx0Ly8gaW4gTm9kZS5qc1xyXG5cdFx0cmV0dXJuIF9zZWxmLlByaXNtO1xyXG5cdH1cclxuIFx0Ly8gSW4gd29ya2VyXHJcblx0X3NlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0dmFyIG1lc3NhZ2UgPSBKU09OLnBhcnNlKGV2dC5kYXRhKSxcclxuXHRcdCAgICBsYW5nID0gbWVzc2FnZS5sYW5ndWFnZSxcclxuXHRcdCAgICBjb2RlID0gbWVzc2FnZS5jb2RlLFxyXG5cdFx0ICAgIGltbWVkaWF0ZUNsb3NlID0gbWVzc2FnZS5pbW1lZGlhdGVDbG9zZTtcclxuXHJcblx0XHRfc2VsZi5wb3N0TWVzc2FnZShfLmhpZ2hsaWdodChjb2RlLCBfLmxhbmd1YWdlc1tsYW5nXSwgbGFuZykpO1xyXG5cdFx0aWYgKGltbWVkaWF0ZUNsb3NlKSB7XHJcblx0XHRcdF9zZWxmLmNsb3NlKCk7XHJcblx0XHR9XHJcblx0fSwgZmFsc2UpO1xyXG5cclxuXHRyZXR1cm4gX3NlbGYuUHJpc207XHJcbn1cclxuXHJcbi8vR2V0IGN1cnJlbnQgc2NyaXB0IGFuZCBoaWdobGlnaHRcclxudmFyIHNjcmlwdCA9IGRvY3VtZW50LmN1cnJlbnRTY3JpcHQgfHwgW10uc2xpY2UuY2FsbChkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInNjcmlwdFwiKSkucG9wKCk7XHJcblxyXG5pZiAoc2NyaXB0KSB7XHJcblx0Xy5maWxlbmFtZSA9IHNjcmlwdC5zcmM7XHJcblxyXG5cdGlmIChkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyICYmICFfLm1hbnVhbCAmJiAhc2NyaXB0Lmhhc0F0dHJpYnV0ZSgnZGF0YS1tYW51YWwnKSkge1xyXG5cdFx0aWYoZG9jdW1lbnQucmVhZHlTdGF0ZSAhPT0gXCJsb2FkaW5nXCIpIHtcclxuXHRcdFx0aWYgKHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUpIHtcclxuXHRcdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKF8uaGlnaGxpZ2h0QWxsKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dChfLmhpZ2hsaWdodEFsbCwgMTYpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIF8uaGlnaGxpZ2h0QWxsKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbnJldHVybiBfc2VsZi5QcmlzbTtcclxuXHJcbn0pKCk7XHJcblxyXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcclxuXHRtb2R1bGUuZXhwb3J0cyA9IFByaXNtO1xyXG59XHJcblxyXG4vLyBoYWNrIGZvciBjb21wb25lbnRzIHRvIHdvcmsgY29ycmVjdGx5IGluIG5vZGUuanNcclxuaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XHJcblx0Z2xvYmFsLlByaXNtID0gUHJpc207XHJcbn1cclxuXHJcblxyXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAgQmVnaW4gcHJpc20tbWFya3VwLmpzXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuXHJcblByaXNtLmxhbmd1YWdlcy5tYXJrdXAgPSB7XHJcblx0J2NvbW1lbnQnOiAvPCEtLVtcXHNcXFNdKj8tLT4vLFxyXG5cdCdwcm9sb2cnOiAvPFxcP1tcXHNcXFNdKz9cXD8+LyxcclxuXHQnZG9jdHlwZSc6IC88IURPQ1RZUEVbXFxzXFxTXSs/Pi9pLFxyXG5cdCdjZGF0YSc6IC88IVxcW0NEQVRBXFxbW1xcc1xcU10qP11dPi9pLFxyXG5cdCd0YWcnOiB7XHJcblx0XHRwYXR0ZXJuOiAvPFxcLz8oPyFcXGQpW15cXHM+XFwvPSQ8XSsoPzpcXHMrW15cXHM+XFwvPV0rKD86PSg/OihcInwnKSg/OlxcXFxcXDF8XFxcXD8oPyFcXDEpW1xcc1xcU10pKlxcMXxbXlxccydcIj49XSspKT8pKlxccypcXC8/Pi9pLFxyXG5cdFx0aW5zaWRlOiB7XHJcblx0XHRcdCd0YWcnOiB7XHJcblx0XHRcdFx0cGF0dGVybjogL148XFwvP1teXFxzPlxcL10rL2ksXHJcblx0XHRcdFx0aW5zaWRlOiB7XHJcblx0XHRcdFx0XHQncHVuY3R1YXRpb24nOiAvXjxcXC8/LyxcclxuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXlteXFxzPlxcLzpdKzovXHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnYXR0ci12YWx1ZSc6IHtcclxuXHRcdFx0XHRwYXR0ZXJuOiAvPSg/OignfFwiKVtcXHNcXFNdKj8oXFwxKXxbXlxccz5dKykvaSxcclxuXHRcdFx0XHRpbnNpZGU6IHtcclxuXHRcdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9bPT5cIiddL1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSxcclxuXHRcdFx0J3B1bmN0dWF0aW9uJzogL1xcLz8+LyxcclxuXHRcdFx0J2F0dHItbmFtZSc6IHtcclxuXHRcdFx0XHRwYXR0ZXJuOiAvW15cXHM+XFwvXSsvLFxyXG5cdFx0XHRcdGluc2lkZToge1xyXG5cdFx0XHRcdFx0J25hbWVzcGFjZSc6IC9eW15cXHM+XFwvOl0rOi9cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHR9XHJcblx0fSxcclxuXHQnZW50aXR5JzogLyYjP1tcXGRhLXpdezEsOH07L2lcclxufTtcclxuXHJcbi8vIFBsdWdpbiB0byBtYWtlIGVudGl0eSB0aXRsZSBzaG93IHRoZSByZWFsIGVudGl0eSwgaWRlYSBieSBSb21hbiBLb21hcm92XHJcblByaXNtLmhvb2tzLmFkZCgnd3JhcCcsIGZ1bmN0aW9uKGVudikge1xyXG5cclxuXHRpZiAoZW52LnR5cGUgPT09ICdlbnRpdHknKSB7XHJcblx0XHRlbnYuYXR0cmlidXRlc1sndGl0bGUnXSA9IGVudi5jb250ZW50LnJlcGxhY2UoLyZhbXA7LywgJyYnKTtcclxuXHR9XHJcbn0pO1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLnhtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XHJcblByaXNtLmxhbmd1YWdlcy5odG1sID0gUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cDtcclxuUHJpc20ubGFuZ3VhZ2VzLm1hdGhtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XHJcblByaXNtLmxhbmd1YWdlcy5zdmcgPSBQcmlzbS5sYW5ndWFnZXMubWFya3VwO1xyXG5cclxuXHJcbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuICAgICBCZWdpbiBwcmlzbS1jc3MuanNcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLmNzcyA9IHtcclxuXHQnY29tbWVudCc6IC9cXC9cXCpbXFxzXFxTXSo/XFwqXFwvLyxcclxuXHQnYXRydWxlJzoge1xyXG5cdFx0cGF0dGVybjogL0BbXFx3LV0rPy4qPyg7fCg/PVxccypcXHspKS9pLFxyXG5cdFx0aW5zaWRlOiB7XHJcblx0XHRcdCdydWxlJzogL0BbXFx3LV0rL1xyXG5cdFx0XHQvLyBTZWUgcmVzdCBiZWxvd1xyXG5cdFx0fVxyXG5cdH0sXHJcblx0J3VybCc6IC91cmxcXCgoPzooW1wiJ10pKFxcXFwoPzpcXHJcXG58W1xcc1xcU10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDF8Lio/KVxcKS9pLFxyXG5cdCdzZWxlY3Rvcic6IC9bXlxce1xcfVxcc11bXlxce1xcfTtdKj8oPz1cXHMqXFx7KS8sXHJcblx0J3N0cmluZyc6IHtcclxuXHRcdHBhdHRlcm46IC8oXCJ8JykoXFxcXCg/OlxcclxcbnxbXFxzXFxTXSl8KD8hXFwxKVteXFxcXFxcclxcbl0pKlxcMS8sXHJcblx0XHRncmVlZHk6IHRydWVcclxuXHR9LFxyXG5cdCdwcm9wZXJ0eSc6IC8oXFxifFxcQilbXFx3LV0rKD89XFxzKjopL2ksXHJcblx0J2ltcG9ydGFudCc6IC9cXEIhaW1wb3J0YW50XFxiL2ksXHJcblx0J2Z1bmN0aW9uJzogL1stYS16MC05XSsoPz1cXCgpL2ksXHJcblx0J3B1bmN0dWF0aW9uJzogL1soKXt9OzpdL1xyXG59O1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLmNzc1snYXRydWxlJ10uaW5zaWRlLnJlc3QgPSBQcmlzbS51dGlsLmNsb25lKFByaXNtLmxhbmd1YWdlcy5jc3MpO1xyXG5cclxuaWYgKFByaXNtLmxhbmd1YWdlcy5tYXJrdXApIHtcclxuXHRQcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdtYXJrdXAnLCAndGFnJywge1xyXG5cdFx0J3N0eWxlJzoge1xyXG5cdFx0XHRwYXR0ZXJuOiAvKDxzdHlsZVtcXHNcXFNdKj8+KVtcXHNcXFNdKj8oPz08XFwvc3R5bGU+KS9pLFxyXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlLFxyXG5cdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5jc3MsXHJcblx0XHRcdGFsaWFzOiAnbGFuZ3VhZ2UtY3NzJ1xyXG5cdFx0fVxyXG5cdH0pO1xyXG5cdFxyXG5cdFByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ2luc2lkZScsICdhdHRyLXZhbHVlJywge1xyXG5cdFx0J3N0eWxlLWF0dHInOiB7XHJcblx0XHRcdHBhdHRlcm46IC9cXHMqc3R5bGU9KFwifCcpLio/XFwxL2ksXHJcblx0XHRcdGluc2lkZToge1xyXG5cdFx0XHRcdCdhdHRyLW5hbWUnOiB7XHJcblx0XHRcdFx0XHRwYXR0ZXJuOiAvXlxccypzdHlsZS9pLFxyXG5cdFx0XHRcdFx0aW5zaWRlOiBQcmlzbS5sYW5ndWFnZXMubWFya3VwLnRhZy5pbnNpZGVcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9eXFxzKj1cXHMqWydcIl18WydcIl1cXHMqJC8sXHJcblx0XHRcdFx0J2F0dHItdmFsdWUnOiB7XHJcblx0XHRcdFx0XHRwYXR0ZXJuOiAvLisvaSxcclxuXHRcdFx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLmNzc1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSxcclxuXHRcdFx0YWxpYXM6ICdsYW5ndWFnZS1jc3MnXHJcblx0XHR9XHJcblx0fSwgUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cC50YWcpO1xyXG59XHJcblxyXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAgQmVnaW4gcHJpc20tY2xpa2UuanNcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLmNsaWtlID0ge1xyXG5cdCdjb21tZW50JzogW1xyXG5cdFx0e1xyXG5cdFx0XHRwYXR0ZXJuOiAvKF58W15cXFxcXSlcXC9cXCpbXFxzXFxTXSo/XFwqXFwvLyxcclxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZVxyXG5cdFx0fSxcclxuXHRcdHtcclxuXHRcdFx0cGF0dGVybjogLyhefFteXFxcXDpdKVxcL1xcLy4qLyxcclxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZVxyXG5cdFx0fVxyXG5cdF0sXHJcblx0J3N0cmluZyc6IHtcclxuXHRcdHBhdHRlcm46IC8oW1wiJ10pKFxcXFwoPzpcXHJcXG58W1xcc1xcU10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDEvLFxyXG5cdFx0Z3JlZWR5OiB0cnVlXHJcblx0fSxcclxuXHQnY2xhc3MtbmFtZSc6IHtcclxuXHRcdHBhdHRlcm46IC8oKD86XFxiKD86Y2xhc3N8aW50ZXJmYWNlfGV4dGVuZHN8aW1wbGVtZW50c3x0cmFpdHxpbnN0YW5jZW9mfG5ldylcXHMrKXwoPzpjYXRjaFxccytcXCgpKVthLXowLTlfXFwuXFxcXF0rL2ksXHJcblx0XHRsb29rYmVoaW5kOiB0cnVlLFxyXG5cdFx0aW5zaWRlOiB7XHJcblx0XHRcdHB1bmN0dWF0aW9uOiAvKFxcLnxcXFxcKS9cclxuXHRcdH1cclxuXHR9LFxyXG5cdCdrZXl3b3JkJzogL1xcYihpZnxlbHNlfHdoaWxlfGRvfGZvcnxyZXR1cm58aW58aW5zdGFuY2VvZnxmdW5jdGlvbnxuZXd8dHJ5fHRocm93fGNhdGNofGZpbmFsbHl8bnVsbHxicmVha3xjb250aW51ZSlcXGIvLFxyXG5cdCdib29sZWFuJzogL1xcYih0cnVlfGZhbHNlKVxcYi8sXHJcblx0J2Z1bmN0aW9uJzogL1thLXowLTlfXSsoPz1cXCgpL2ksXHJcblx0J251bWJlcic6IC9cXGItPyg/OjB4W1xcZGEtZl0rfFxcZCpcXC4/XFxkKyg/OmVbKy1dP1xcZCspPylcXGIvaSxcclxuXHQnb3BlcmF0b3InOiAvLS0/fFxcK1xcKz98IT0/PT98PD0/fD49P3w9PT89P3wmJj98XFx8XFx8P3xcXD98XFwqfFxcL3x+fFxcXnwlLyxcclxuXHQncHVuY3R1YXRpb24nOiAvW3t9W1xcXTsoKSwuOl0vXHJcbn07XHJcblxyXG5cclxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gICAgIEJlZ2luIHByaXNtLWphdmFzY3JpcHQuanNcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHQgPSBQcmlzbS5sYW5ndWFnZXMuZXh0ZW5kKCdjbGlrZScsIHtcclxuXHQna2V5d29yZCc6IC9cXGIoYXN8YXN5bmN8YXdhaXR8YnJlYWt8Y2FzZXxjYXRjaHxjbGFzc3xjb25zdHxjb250aW51ZXxkZWJ1Z2dlcnxkZWZhdWx0fGRlbGV0ZXxkb3xlbHNlfGVudW18ZXhwb3J0fGV4dGVuZHN8ZmluYWxseXxmb3J8ZnJvbXxmdW5jdGlvbnxnZXR8aWZ8aW1wbGVtZW50c3xpbXBvcnR8aW58aW5zdGFuY2VvZnxpbnRlcmZhY2V8bGV0fG5ld3xudWxsfG9mfHBhY2thZ2V8cHJpdmF0ZXxwcm90ZWN0ZWR8cHVibGljfHJldHVybnxzZXR8c3RhdGljfHN1cGVyfHN3aXRjaHx0aGlzfHRocm93fHRyeXx0eXBlb2Z8dmFyfHZvaWR8d2hpbGV8d2l0aHx5aWVsZClcXGIvLFxyXG5cdCdudW1iZXInOiAvXFxiLT8oMHhbXFxkQS1GYS1mXSt8MGJbMDFdK3wwb1swLTddK3xcXGQqXFwuP1xcZCsoW0VlXVsrLV0/XFxkKyk/fE5hTnxJbmZpbml0eSlcXGIvLFxyXG5cdC8vIEFsbG93IGZvciBhbGwgbm9uLUFTQ0lJIGNoYXJhY3RlcnMgKFNlZSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMDA4NDQ0KVxyXG5cdCdmdW5jdGlvbic6IC9bXyRhLXpBLVpcXHhBMC1cXHVGRkZGXVtfJGEtekEtWjAtOVxceEEwLVxcdUZGRkZdKig/PVxcKCkvaSxcclxuXHQnb3BlcmF0b3InOiAvLVstPV0/fFxcK1srPV0/fCE9Pz0/fDw8Pz0/fD4+Pz4/PT98PSg/Oj09P3w+KT98JlsmPV0/fFxcfFt8PV0/fFxcKlxcKj89P3xcXC89P3x+fFxcXj0/fCU9P3xcXD98XFwuezN9L1xyXG59KTtcclxuXHJcblByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ2phdmFzY3JpcHQnLCAna2V5d29yZCcsIHtcclxuXHQncmVnZXgnOiB7XHJcblx0XHRwYXR0ZXJuOiAvKF58W14vXSlcXC8oPyFcXC8pKFxcWy4rP118XFxcXC58W14vXFxcXFxcclxcbl0pK1xcL1tnaW15dV17MCw1fSg/PVxccyooJHxbXFxyXFxuLC47fSldKSkvLFxyXG5cdFx0bG9va2JlaGluZDogdHJ1ZSxcclxuXHRcdGdyZWVkeTogdHJ1ZVxyXG5cdH1cclxufSk7XHJcblxyXG5QcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdqYXZhc2NyaXB0JywgJ3N0cmluZycsIHtcclxuXHQndGVtcGxhdGUtc3RyaW5nJzoge1xyXG5cdFx0cGF0dGVybjogL2AoPzpcXFxcXFxcXHxcXFxcP1teXFxcXF0pKj9gLyxcclxuXHRcdGdyZWVkeTogdHJ1ZSxcclxuXHRcdGluc2lkZToge1xyXG5cdFx0XHQnaW50ZXJwb2xhdGlvbic6IHtcclxuXHRcdFx0XHRwYXR0ZXJuOiAvXFwkXFx7W159XStcXH0vLFxyXG5cdFx0XHRcdGluc2lkZToge1xyXG5cdFx0XHRcdFx0J2ludGVycG9sYXRpb24tcHVuY3R1YXRpb24nOiB7XHJcblx0XHRcdFx0XHRcdHBhdHRlcm46IC9eXFwkXFx7fFxcfSQvLFxyXG5cdFx0XHRcdFx0XHRhbGlhczogJ3B1bmN0dWF0aW9uJ1xyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdHJlc3Q6IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnc3RyaW5nJzogL1tcXHNcXFNdKy9cclxuXHRcdH1cclxuXHR9XHJcbn0pO1xyXG5cclxuaWYgKFByaXNtLmxhbmd1YWdlcy5tYXJrdXApIHtcclxuXHRQcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdtYXJrdXAnLCAndGFnJywge1xyXG5cdFx0J3NjcmlwdCc6IHtcclxuXHRcdFx0cGF0dGVybjogLyg8c2NyaXB0W1xcc1xcU10qPz4pW1xcc1xcU10qPyg/PTxcXC9zY3JpcHQ+KS9pLFxyXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlLFxyXG5cdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0LFxyXG5cdFx0XHRhbGlhczogJ2xhbmd1YWdlLWphdmFzY3JpcHQnXHJcblx0XHR9XHJcblx0fSk7XHJcbn1cclxuXHJcblByaXNtLmxhbmd1YWdlcy5qcyA9IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0O1xyXG5cclxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gICAgIEJlZ2luIHByaXNtLWZpbGUtaGlnaGxpZ2h0LmpzXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuXHJcbihmdW5jdGlvbiAoKSB7XHJcblx0aWYgKHR5cGVvZiBzZWxmID09PSAndW5kZWZpbmVkJyB8fCAhc2VsZi5QcmlzbSB8fCAhc2VsZi5kb2N1bWVudCB8fCAhZG9jdW1lbnQucXVlcnlTZWxlY3Rvcikge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0c2VsZi5QcmlzbS5maWxlSGlnaGxpZ2h0ID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdFx0dmFyIEV4dGVuc2lvbnMgPSB7XHJcblx0XHRcdCdqcyc6ICdqYXZhc2NyaXB0JyxcclxuXHRcdFx0J3B5JzogJ3B5dGhvbicsXHJcblx0XHRcdCdyYic6ICdydWJ5JyxcclxuXHRcdFx0J3BzMSc6ICdwb3dlcnNoZWxsJyxcclxuXHRcdFx0J3BzbTEnOiAncG93ZXJzaGVsbCcsXHJcblx0XHRcdCdzaCc6ICdiYXNoJyxcclxuXHRcdFx0J2JhdCc6ICdiYXRjaCcsXHJcblx0XHRcdCdoJzogJ2MnLFxyXG5cdFx0XHQndGV4JzogJ2xhdGV4J1xyXG5cdFx0fTtcclxuXHJcblx0XHRpZihBcnJheS5wcm90b3R5cGUuZm9yRWFjaCkgeyAvLyBDaGVjayB0byBwcmV2ZW50IGVycm9yIGluIElFOFxyXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdwcmVbZGF0YS1zcmNdJykpLmZvckVhY2goZnVuY3Rpb24gKHByZSkge1xyXG5cdFx0XHRcdHZhciBzcmMgPSBwcmUuZ2V0QXR0cmlidXRlKCdkYXRhLXNyYycpO1xyXG5cclxuXHRcdFx0XHR2YXIgbGFuZ3VhZ2UsIHBhcmVudCA9IHByZTtcclxuXHRcdFx0XHR2YXIgbGFuZyA9IC9cXGJsYW5nKD86dWFnZSk/LSg/IVxcKikoXFx3KylcXGIvaTtcclxuXHRcdFx0XHR3aGlsZSAocGFyZW50ICYmICFsYW5nLnRlc3QocGFyZW50LmNsYXNzTmFtZSkpIHtcclxuXHRcdFx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKHBhcmVudCkge1xyXG5cdFx0XHRcdFx0bGFuZ3VhZ2UgPSAocHJlLmNsYXNzTmFtZS5tYXRjaChsYW5nKSB8fCBbLCAnJ10pWzFdO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCFsYW5ndWFnZSkge1xyXG5cdFx0XHRcdFx0dmFyIGV4dGVuc2lvbiA9IChzcmMubWF0Y2goL1xcLihcXHcrKSQvKSB8fCBbLCAnJ10pWzFdO1xyXG5cdFx0XHRcdFx0bGFuZ3VhZ2UgPSBFeHRlbnNpb25zW2V4dGVuc2lvbl0gfHwgZXh0ZW5zaW9uO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIGNvZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjb2RlJyk7XHJcblx0XHRcdFx0Y29kZS5jbGFzc05hbWUgPSAnbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xyXG5cclxuXHRcdFx0XHRwcmUudGV4dENvbnRlbnQgPSAnJztcclxuXHJcblx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9ICdMb2FkaW5n4oCmJztcclxuXHJcblx0XHRcdFx0cHJlLmFwcGVuZENoaWxkKGNvZGUpO1xyXG5cclxuXHRcdFx0XHR2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcblxyXG5cdFx0XHRcdHhoci5vcGVuKCdHRVQnLCBzcmMsIHRydWUpO1xyXG5cclxuXHRcdFx0XHR4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0aWYgKHhoci5yZWFkeVN0YXRlID09IDQpIHtcclxuXHJcblx0XHRcdFx0XHRcdGlmICh4aHIuc3RhdHVzIDwgNDAwICYmIHhoci5yZXNwb25zZVRleHQpIHtcclxuXHRcdFx0XHRcdFx0XHRjb2RlLnRleHRDb250ZW50ID0geGhyLnJlc3BvbnNlVGV4dDtcclxuXHJcblx0XHRcdFx0XHRcdFx0UHJpc20uaGlnaGxpZ2h0RWxlbWVudChjb2RlKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRlbHNlIGlmICh4aHIuc3RhdHVzID49IDQwMCkge1xyXG5cdFx0XHRcdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAn4pyWIEVycm9yICcgKyB4aHIuc3RhdHVzICsgJyB3aGlsZSBmZXRjaGluZyBmaWxlOiAnICsgeGhyLnN0YXR1c1RleHQ7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9ICfinJYgRXJyb3I6IEZpbGUgZG9lcyBub3QgZXhpc3Qgb3IgaXMgZW1wdHknO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0eGhyLnNlbmQobnVsbCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG5cclxuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgc2VsZi5QcmlzbS5maWxlSGlnaGxpZ2h0KTtcclxuXHJcbn0pKCk7XHJcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XHJcbiAgICB2YXIgYmFja2Ryb3BzO1xyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUJhY2tkcm9wRm9yU2xpZGUoc2xpZGUpIHtcclxuICAgICAgdmFyIGJhY2tkcm9wQXR0cmlidXRlID0gc2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtYmFja2Ryb3AnKTtcclxuXHJcbiAgICAgIGlmIChiYWNrZHJvcEF0dHJpYnV0ZSkge1xyXG4gICAgICAgIHZhciBiYWNrZHJvcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgIGJhY2tkcm9wLmNsYXNzTmFtZSA9IGJhY2tkcm9wQXR0cmlidXRlO1xyXG4gICAgICAgIGJhY2tkcm9wLmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtYmFja2Ryb3AnKTtcclxuICAgICAgICBkZWNrLnBhcmVudC5hcHBlbmRDaGlsZChiYWNrZHJvcCk7XHJcbiAgICAgICAgcmV0dXJuIGJhY2tkcm9wO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdXBkYXRlQ2xhc3NlcyhlbCkge1xyXG4gICAgICBpZiAoZWwpIHtcclxuICAgICAgICB2YXIgaW5kZXggPSBiYWNrZHJvcHMuaW5kZXhPZihlbCksXHJcbiAgICAgICAgICBjdXJyZW50SW5kZXggPSBkZWNrLnNsaWRlKCk7XHJcblxyXG4gICAgICAgIHJlbW92ZUNsYXNzKGVsLCAnYWN0aXZlJyk7XHJcbiAgICAgICAgcmVtb3ZlQ2xhc3MoZWwsICdpbmFjdGl2ZScpO1xyXG4gICAgICAgIHJlbW92ZUNsYXNzKGVsLCAnYmVmb3JlJyk7XHJcbiAgICAgICAgcmVtb3ZlQ2xhc3MoZWwsICdhZnRlcicpO1xyXG5cclxuICAgICAgICBpZiAoaW5kZXggIT09IGN1cnJlbnRJbmRleCkge1xyXG4gICAgICAgICAgYWRkQ2xhc3MoZWwsICdpbmFjdGl2ZScpO1xyXG4gICAgICAgICAgYWRkQ2xhc3MoZWwsIGluZGV4IDwgY3VycmVudEluZGV4ID8gJ2JlZm9yZScgOiAnYWZ0ZXInKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgYWRkQ2xhc3MoZWwsICdhY3RpdmUnKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByZW1vdmVDbGFzcyhlbCwgY2xhc3NOYW1lKSB7XHJcbiAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2Jlc3Bva2UtYmFja2Ryb3AtJyArIGNsYXNzTmFtZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYWRkQ2xhc3MoZWwsIGNsYXNzTmFtZSkge1xyXG4gICAgICBlbC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLWJhY2tkcm9wLScgKyBjbGFzc05hbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIGJhY2tkcm9wcyA9IGRlY2suc2xpZGVzXHJcbiAgICAgIC5tYXAoY3JlYXRlQmFja2Ryb3BGb3JTbGlkZSk7XHJcblxyXG4gICAgZGVjay5vbignYWN0aXZhdGUnLCBmdW5jdGlvbigpIHtcclxuICAgICAgYmFja2Ryb3BzLmZvckVhY2godXBkYXRlQ2xhc3Nlcyk7XHJcbiAgICB9KTtcclxuICB9O1xyXG59O1xyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcclxuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xyXG4gICAgdmFyIGFjdGl2ZVNsaWRlSW5kZXgsXHJcbiAgICAgIGFjdGl2ZUJ1bGxldEluZGV4LFxyXG5cclxuICAgICAgYnVsbGV0cyA9IGRlY2suc2xpZGVzLm1hcChmdW5jdGlvbihzbGlkZSkge1xyXG4gICAgICAgIHJldHVybiBbXS5zbGljZS5jYWxsKHNsaWRlLnF1ZXJ5U2VsZWN0b3JBbGwoKHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiAnW2RhdGEtYmVzcG9rZS1idWxsZXRdJykpLCAwKTtcclxuICAgICAgfSksXHJcblxyXG4gICAgICBuZXh0ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIG5leHRTbGlkZUluZGV4ID0gYWN0aXZlU2xpZGVJbmRleCArIDE7XHJcblxyXG4gICAgICAgIGlmIChhY3RpdmVTbGlkZUhhc0J1bGxldEJ5T2Zmc2V0KDEpKSB7XHJcbiAgICAgICAgICBhY3RpdmF0ZUJ1bGxldChhY3RpdmVTbGlkZUluZGV4LCBhY3RpdmVCdWxsZXRJbmRleCArIDEpO1xyXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoYnVsbGV0c1tuZXh0U2xpZGVJbmRleF0pIHtcclxuICAgICAgICAgIGFjdGl2YXRlQnVsbGV0KG5leHRTbGlkZUluZGV4LCAwKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBwcmV2ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIHByZXZTbGlkZUluZGV4ID0gYWN0aXZlU2xpZGVJbmRleCAtIDE7XHJcblxyXG4gICAgICAgIGlmIChhY3RpdmVTbGlkZUhhc0J1bGxldEJ5T2Zmc2V0KC0xKSkge1xyXG4gICAgICAgICAgYWN0aXZhdGVCdWxsZXQoYWN0aXZlU2xpZGVJbmRleCwgYWN0aXZlQnVsbGV0SW5kZXggLSAxKTtcclxuICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9IGVsc2UgaWYgKGJ1bGxldHNbcHJldlNsaWRlSW5kZXhdKSB7XHJcbiAgICAgICAgICBhY3RpdmF0ZUJ1bGxldChwcmV2U2xpZGVJbmRleCwgYnVsbGV0c1twcmV2U2xpZGVJbmRleF0ubGVuZ3RoIC0gMSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG5cclxuICAgICAgYWN0aXZhdGVCdWxsZXQgPSBmdW5jdGlvbihzbGlkZUluZGV4LCBidWxsZXRJbmRleCkge1xyXG4gICAgICAgIGFjdGl2ZVNsaWRlSW5kZXggPSBzbGlkZUluZGV4O1xyXG4gICAgICAgIGFjdGl2ZUJ1bGxldEluZGV4ID0gYnVsbGV0SW5kZXg7XHJcblxyXG4gICAgICAgIGJ1bGxldHMuZm9yRWFjaChmdW5jdGlvbihzbGlkZSwgcykge1xyXG4gICAgICAgICAgc2xpZGUuZm9yRWFjaChmdW5jdGlvbihidWxsZXQsIGIpIHtcclxuICAgICAgICAgICAgYnVsbGV0LmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtYnVsbGV0Jyk7XHJcblxyXG4gICAgICAgICAgICBpZiAocyA8IHNsaWRlSW5kZXggfHwgcyA9PT0gc2xpZGVJbmRleCAmJiBiIDw9IGJ1bGxldEluZGV4KSB7XHJcbiAgICAgICAgICAgICAgYnVsbGV0LmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtYnVsbGV0LWFjdGl2ZScpO1xyXG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QucmVtb3ZlKCdiZXNwb2tlLWJ1bGxldC1pbmFjdGl2ZScpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLWJ1bGxldC1pbmFjdGl2ZScpO1xyXG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QucmVtb3ZlKCdiZXNwb2tlLWJ1bGxldC1hY3RpdmUnKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKHMgPT09IHNsaWRlSW5kZXggJiYgYiA9PT0gYnVsbGV0SW5kZXgpIHtcclxuICAgICAgICAgICAgICBidWxsZXQuY2xhc3NMaXN0LmFkZCgnYmVzcG9rZS1idWxsZXQtY3VycmVudCcpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QucmVtb3ZlKCdiZXNwb2tlLWJ1bGxldC1jdXJyZW50Jyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9LFxyXG5cclxuICAgICAgYWN0aXZlU2xpZGVIYXNCdWxsZXRCeU9mZnNldCA9IGZ1bmN0aW9uKG9mZnNldCkge1xyXG4gICAgICAgIHJldHVybiBidWxsZXRzW2FjdGl2ZVNsaWRlSW5kZXhdW2FjdGl2ZUJ1bGxldEluZGV4ICsgb2Zmc2V0XSAhPT0gdW5kZWZpbmVkO1xyXG4gICAgICB9O1xyXG5cclxuICAgIGRlY2sub24oJ25leHQnLCBuZXh0KTtcclxuICAgIGRlY2sub24oJ3ByZXYnLCBwcmV2KTtcclxuXHJcbiAgICBkZWNrLm9uKCdzbGlkZScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgYWN0aXZhdGVCdWxsZXQoZS5pbmRleCwgMCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBhY3RpdmF0ZUJ1bGxldCgwLCAwKTtcclxuICB9O1xyXG59O1xyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XHJcbiAgICBkZWNrLnNsaWRlcy5mb3JFYWNoKGZ1bmN0aW9uKHNsaWRlKSB7XHJcbiAgICAgIHNsaWRlLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKC9JTlBVVHxURVhUQVJFQXxTRUxFQ1QvLnRlc3QoZS50YXJnZXQubm9kZU5hbWUpIHx8IGUudGFyZ2V0LmNvbnRlbnRFZGl0YWJsZSA9PT0gJ3RydWUnKSB7XHJcbiAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9O1xyXG59O1xyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XHJcbiAgICB2YXIgYWN0aXZhdGVTbGlkZSA9IGZ1bmN0aW9uKGluZGV4KSB7XHJcbiAgICAgIHZhciBpbmRleFRvQWN0aXZhdGUgPSAtMSA8IGluZGV4ICYmIGluZGV4IDwgZGVjay5zbGlkZXMubGVuZ3RoID8gaW5kZXggOiAwO1xyXG4gICAgICBpZiAoaW5kZXhUb0FjdGl2YXRlICE9PSBkZWNrLnNsaWRlKCkpIHtcclxuICAgICAgICBkZWNrLnNsaWRlKGluZGV4VG9BY3RpdmF0ZSk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgdmFyIHBhcnNlSGFzaCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICB2YXIgaGFzaCA9IHdpbmRvdy5sb2NhdGlvbi5oYXNoLnNsaWNlKDEpLFxyXG4gICAgICAgIHNsaWRlTnVtYmVyT3JOYW1lID0gcGFyc2VJbnQoaGFzaCwgMTApO1xyXG5cclxuICAgICAgaWYgKGhhc2gpIHtcclxuICAgICAgICBpZiAoc2xpZGVOdW1iZXJPck5hbWUpIHtcclxuICAgICAgICAgIGFjdGl2YXRlU2xpZGUoc2xpZGVOdW1iZXJPck5hbWUgLSAxKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgZGVjay5zbGlkZXMuZm9yRWFjaChmdW5jdGlvbihzbGlkZSwgaSkge1xyXG4gICAgICAgICAgICBpZiAoc2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtaGFzaCcpID09PSBoYXNoIHx8IHNsaWRlLmlkID09PSBoYXNoKSB7XHJcbiAgICAgICAgICAgICAgYWN0aXZhdGVTbGlkZShpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgIHBhcnNlSGFzaCgpO1xyXG5cclxuICAgICAgZGVjay5vbignYWN0aXZhdGUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgdmFyIHNsaWRlTmFtZSA9IGUuc2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtaGFzaCcpIHx8IGUuc2xpZGUuaWQ7XHJcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLmhhc2ggPSBzbGlkZU5hbWUgfHwgZS5pbmRleCArIDE7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2hhc2hjaGFuZ2UnLCBwYXJzZUhhc2gpO1xyXG4gICAgfSwgMCk7XHJcbiAgfTtcclxufTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRpb25zKSB7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcclxuICAgIHZhciBpc0hvcml6b250YWwgPSBvcHRpb25zICE9PSAndmVydGljYWwnO1xyXG5cclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIGlmIChlLndoaWNoID09IDM0IHx8IC8vIFBBR0UgRE9XTlxyXG4gICAgICAgIChlLndoaWNoID09IDMyICYmICFlLnNoaWZ0S2V5KSB8fCAvLyBTUEFDRSBXSVRIT1VUIFNISUZUXHJcbiAgICAgICAgKGlzSG9yaXpvbnRhbCAmJiBlLndoaWNoID09IDM5KSB8fCAvLyBSSUdIVFxyXG4gICAgICAgICghaXNIb3Jpem9udGFsICYmIGUud2hpY2ggPT0gNDApIC8vIERPV05cclxuICAgICAgKSB7IGRlY2submV4dCgpOyB9XHJcblxyXG4gICAgICBpZiAoZS53aGljaCA9PSAzMyB8fCAvLyBQQUdFIFVQXHJcbiAgICAgICAgKGUud2hpY2ggPT0gMzIgJiYgZS5zaGlmdEtleSkgfHwgLy8gU1BBQ0UgKyBTSElGVFxyXG4gICAgICAgIChpc0hvcml6b250YWwgJiYgZS53aGljaCA9PSAzNykgfHwgLy8gTEVGVFxyXG4gICAgICAgICghaXNIb3Jpem9udGFsICYmIGUud2hpY2ggPT0gMzgpIC8vIFVQXHJcbiAgICAgICkgeyBkZWNrLnByZXYoKTsgfVxyXG4gICAgfSk7XHJcbiAgfTtcclxufTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRpb25zKSB7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uIChkZWNrKSB7XHJcbiAgICB2YXIgcHJvZ3Jlc3NQYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcclxuICAgICAgcHJvZ3Jlc3NCYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcclxuICAgICAgcHJvcCA9IG9wdGlvbnMgPT09ICd2ZXJ0aWNhbCcgPyAnaGVpZ2h0JyA6ICd3aWR0aCc7XHJcblxyXG4gICAgcHJvZ3Jlc3NQYXJlbnQuY2xhc3NOYW1lID0gJ2Jlc3Bva2UtcHJvZ3Jlc3MtcGFyZW50JztcclxuICAgIHByb2dyZXNzQmFyLmNsYXNzTmFtZSA9ICdiZXNwb2tlLXByb2dyZXNzLWJhcic7XHJcbiAgICBwcm9ncmVzc1BhcmVudC5hcHBlbmRDaGlsZChwcm9ncmVzc0Jhcik7XHJcbiAgICBkZWNrLnBhcmVudC5hcHBlbmRDaGlsZChwcm9ncmVzc1BhcmVudCk7XHJcblxyXG4gICAgZGVjay5vbignYWN0aXZhdGUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIHByb2dyZXNzQmFyLnN0eWxlW3Byb3BdID0gKGUuaW5kZXggKiAxMDAgLyAoZGVjay5zbGlkZXMubGVuZ3RoIC0gMSkpICsgJyUnO1xyXG4gICAgfSk7XHJcbiAgfTtcclxufTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRpb25zKSB7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcclxuICAgIHZhciBwYXJlbnQgPSBkZWNrLnBhcmVudCxcclxuICAgICAgZmlyc3RTbGlkZSA9IGRlY2suc2xpZGVzWzBdLFxyXG4gICAgICBzbGlkZUhlaWdodCA9IGZpcnN0U2xpZGUub2Zmc2V0SGVpZ2h0LFxyXG4gICAgICBzbGlkZVdpZHRoID0gZmlyc3RTbGlkZS5vZmZzZXRXaWR0aCxcclxuICAgICAgdXNlWm9vbSA9IG9wdGlvbnMgPT09ICd6b29tJyB8fCAoJ3pvb20nIGluIHBhcmVudC5zdHlsZSAmJiBvcHRpb25zICE9PSAndHJhbnNmb3JtJyksXHJcblxyXG4gICAgICB3cmFwID0gZnVuY3Rpb24oZWxlbWVudCkge1xyXG4gICAgICAgIHZhciB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgd3JhcHBlci5jbGFzc05hbWUgPSAnYmVzcG9rZS1zY2FsZS1wYXJlbnQnO1xyXG4gICAgICAgIGVsZW1lbnQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUod3JhcHBlciwgZWxlbWVudCk7XHJcbiAgICAgICAgd3JhcHBlci5hcHBlbmRDaGlsZChlbGVtZW50KTtcclxuICAgICAgICByZXR1cm4gd3JhcHBlcjtcclxuICAgICAgfSxcclxuXHJcbiAgICAgIGVsZW1lbnRzID0gdXNlWm9vbSA/IGRlY2suc2xpZGVzIDogZGVjay5zbGlkZXMubWFwKHdyYXApLFxyXG5cclxuICAgICAgdHJhbnNmb3JtUHJvcGVydHkgPSAoZnVuY3Rpb24ocHJvcGVydHkpIHtcclxuICAgICAgICB2YXIgcHJlZml4ZXMgPSAnTW96IFdlYmtpdCBPIG1zJy5zcGxpdCgnICcpO1xyXG4gICAgICAgIHJldHVybiBwcmVmaXhlcy5yZWR1Y2UoZnVuY3Rpb24oY3VycmVudFByb3BlcnR5LCBwcmVmaXgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHByZWZpeCArIHByb3BlcnR5IGluIHBhcmVudC5zdHlsZSA/IHByZWZpeCArIHByb3BlcnR5IDogY3VycmVudFByb3BlcnR5O1xyXG4gICAgICAgICAgfSwgcHJvcGVydHkudG9Mb3dlckNhc2UoKSk7XHJcbiAgICAgIH0oJ1RyYW5zZm9ybScpKSxcclxuXHJcbiAgICAgIHNjYWxlID0gdXNlWm9vbSA/XHJcbiAgICAgICAgZnVuY3Rpb24ocmF0aW8sIGVsZW1lbnQpIHtcclxuICAgICAgICAgIGVsZW1lbnQuc3R5bGUuem9vbSA9IHJhdGlvO1xyXG4gICAgICAgIH0gOlxyXG4gICAgICAgIGZ1bmN0aW9uKHJhdGlvLCBlbGVtZW50KSB7XHJcbiAgICAgICAgICBlbGVtZW50LnN0eWxlW3RyYW5zZm9ybVByb3BlcnR5XSA9ICdzY2FsZSgnICsgcmF0aW8gKyAnKSc7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgIHNjYWxlQWxsID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIHhTY2FsZSA9IHBhcmVudC5vZmZzZXRXaWR0aCAvIHNsaWRlV2lkdGgsXHJcbiAgICAgICAgICB5U2NhbGUgPSBwYXJlbnQub2Zmc2V0SGVpZ2h0IC8gc2xpZGVIZWlnaHQ7XHJcblxyXG4gICAgICAgIGVsZW1lbnRzLmZvckVhY2goc2NhbGUuYmluZChudWxsLCBNYXRoLm1pbih4U2NhbGUsIHlTY2FsZSkpKTtcclxuICAgICAgfTtcclxuXHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgc2NhbGVBbGwpO1xyXG4gICAgc2NhbGVBbGwoKTtcclxuICB9O1xyXG5cclxufTtcclxuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuLyohIGJlc3Bva2UtdGhlbWUtZmFuY3kgdjAuNi4wIMKpIDIwMTYgRmzDoXZpbyBDb3V0aW5obywgTUlUIExpY2Vuc2UgKi9cclxuIWZ1bmN0aW9uKGUpe2lmKFwib2JqZWN0XCI9PXR5cGVvZiBleHBvcnRzJiZcInVuZGVmaW5lZFwiIT10eXBlb2YgbW9kdWxlKW1vZHVsZS5leHBvcnRzPWUoKTtlbHNlIGlmKFwiZnVuY3Rpb25cIj09dHlwZW9mIGRlZmluZSYmZGVmaW5lLmFtZClkZWZpbmUoW10sZSk7ZWxzZXt2YXIgdDt0PVwidW5kZWZpbmVkXCIhPXR5cGVvZiB3aW5kb3c/d2luZG93OlwidW5kZWZpbmVkXCIhPXR5cGVvZiBnbG9iYWw/Z2xvYmFsOlwidW5kZWZpbmVkXCIhPXR5cGVvZiBzZWxmP3NlbGY6dGhpcyx0PXQuYmVzcG9rZXx8KHQuYmVzcG9rZT17fSksdD10LnRoZW1lc3x8KHQudGhlbWVzPXt9KSx0LmZhbmN5PWUoKX19KGZ1bmN0aW9uKCl7cmV0dXJuIGZ1bmN0aW9uIGUodCxvLGkpe2Z1bmN0aW9uIHMocixuKXtpZighb1tyXSl7aWYoIXRbcl0pe3ZhciBwPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIW4mJnApcmV0dXJuIHAociwhMCk7aWYoYSlyZXR1cm4gYShyLCEwKTt2YXIgbD1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK3IrXCInXCIpO3Rocm93IGwuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixsfXZhciBiPW9bcl09e2V4cG9ydHM6e319O3Rbcl1bMF0uY2FsbChiLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG89dFtyXVsxXVtlXTtyZXR1cm4gcyhvP286ZSl9LGIsYi5leHBvcnRzLGUsdCxvLGkpfXJldHVybiBvW3JdLmV4cG9ydHN9Zm9yKHZhciBhPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUscj0wO3I8aS5sZW5ndGg7cisrKXMoaVtyXSk7cmV0dXJuIHN9KHsxOltmdW5jdGlvbihlLHQsbyl7dmFyIGk9ZShcImJlc3Bva2UtY2xhc3Nlc1wiKSxzPWUoXCJpbnNlcnQtY3NzXCIpO3QuZXhwb3J0cz1mdW5jdGlvbigpe3ZhciBlPVwiQGltcG9ydCB1cmwoXFxcImh0dHA6Ly9mb250cy5nb29nbGVhcGlzLmNvbS9jc3M/ZmFtaWx5PUNhbGxpZ3JhZmZpdHRpfE9wZW4rU2Fuczo0MDBpdGFsaWMsNzAwaXRhbGljLDQwMCw3MDBcXFwiKTtcXG4vKiEgbm9ybWFsaXplLmNzcyB2My4wLjAgfCBNSVQgTGljZW5zZSB8IGdpdC5pby9ub3JtYWxpemUgKi9cXG5odG1se2ZvbnQtZmFtaWx5OnNhbnMtc2VyaWY7LW1zLXRleHQtc2l6ZS1hZGp1c3Q6MTAwJTstd2Via2l0LXRleHQtc2l6ZS1hZGp1c3Q6MTAwJX1ib2R5e21hcmdpbjowfWFydGljbGUsYXNpZGUsZGV0YWlscyxmaWdjYXB0aW9uLGZpZ3VyZSxmb290ZXIsaGVhZGVyLGhncm91cCxtYWluLG5hdixzZWN0aW9uLHN1bW1hcnl7ZGlzcGxheTpibG9ja31hdWRpbyxjYW52YXMscHJvZ3Jlc3MsdmlkZW97ZGlzcGxheTppbmxpbmUtYmxvY2s7dmVydGljYWwtYWxpZ246YmFzZWxpbmV9YXVkaW86bm90KFtjb250cm9sc10pe2Rpc3BsYXk6bm9uZTtoZWlnaHQ6MH1baGlkZGVuXSx0ZW1wbGF0ZXtkaXNwbGF5Om5vbmV9YXtiYWNrZ3JvdW5kOjAgMH1hOmFjdGl2ZSxhOmhvdmVye291dGxpbmU6MH1hYmJyW3RpdGxlXXtib3JkZXItYm90dG9tOjFweCBkb3R0ZWR9YixzdHJvbmd7Zm9udC13ZWlnaHQ6NzAwfWRmbntmb250LXN0eWxlOml0YWxpY31oMXtmb250LXNpemU6MmVtO21hcmdpbjouNjdlbSAwfW1hcmt7YmFja2dyb3VuZDojZmYwO2NvbG9yOiMwMDB9c21hbGx7Zm9udC1zaXplOjgwJX1zdWIsc3Vwe2ZvbnQtc2l6ZTo3NSU7bGluZS1oZWlnaHQ6MDtwb3NpdGlvbjpyZWxhdGl2ZTt2ZXJ0aWNhbC1hbGlnbjpiYXNlbGluZX1zdXB7dG9wOi0uNWVtfXN1Yntib3R0b206LS4yNWVtfWltZ3tib3JkZXI6MH1zdmc6bm90KDpyb290KXtvdmVyZmxvdzpoaWRkZW59ZmlndXJle21hcmdpbjoxZW0gNDBweH1ocntib3gtc2l6aW5nOmNvbnRlbnQtYm94O2hlaWdodDowfXByZXtvdmVyZmxvdzphdXRvfWNvZGUsa2JkLHByZSxzYW1we2ZvbnQtZmFtaWx5Om1vbm9zcGFjZSxtb25vc3BhY2U7Zm9udC1zaXplOjFlbX1idXR0b24saW5wdXQsb3B0Z3JvdXAsc2VsZWN0LHRleHRhcmVhe2NvbG9yOmluaGVyaXQ7Zm9udDppbmhlcml0O21hcmdpbjowfWJ1dHRvbntvdmVyZmxvdzp2aXNpYmxlfWJ1dHRvbixzZWxlY3R7dGV4dC10cmFuc2Zvcm06bm9uZX1idXR0b24saHRtbCBpbnB1dFt0eXBlPWJ1dHRvbl0saW5wdXRbdHlwZT1yZXNldF0saW5wdXRbdHlwZT1zdWJtaXRdey13ZWJraXQtYXBwZWFyYW5jZTpidXR0b247Y3Vyc29yOnBvaW50ZXJ9YnV0dG9uW2Rpc2FibGVkXSxodG1sIGlucHV0W2Rpc2FibGVkXXtjdXJzb3I6ZGVmYXVsdH1idXR0b246Oi1tb3otZm9jdXMtaW5uZXIsaW5wdXQ6Oi1tb3otZm9jdXMtaW5uZXJ7Ym9yZGVyOjA7cGFkZGluZzowfWlucHV0e2xpbmUtaGVpZ2h0Om5vcm1hbH1pbnB1dFt0eXBlPWNoZWNrYm94XSxpbnB1dFt0eXBlPXJhZGlvXXtib3gtc2l6aW5nOmJvcmRlci1ib3g7cGFkZGluZzowfWlucHV0W3R5cGU9bnVtYmVyXTo6LXdlYmtpdC1pbm5lci1zcGluLWJ1dHRvbixpbnB1dFt0eXBlPW51bWJlcl06Oi13ZWJraXQtb3V0ZXItc3Bpbi1idXR0b257aGVpZ2h0OmF1dG99aW5wdXRbdHlwZT1zZWFyY2hdey13ZWJraXQtYXBwZWFyYW5jZTp0ZXh0ZmllbGQ7Ym94LXNpemluZzpjb250ZW50LWJveH1pbnB1dFt0eXBlPXNlYXJjaF06Oi13ZWJraXQtc2VhcmNoLWNhbmNlbC1idXR0b24saW5wdXRbdHlwZT1zZWFyY2hdOjotd2Via2l0LXNlYXJjaC1kZWNvcmF0aW9uey13ZWJraXQtYXBwZWFyYW5jZTpub25lfWZpZWxkc2V0e2JvcmRlcjoxcHggc29saWQgc2lsdmVyO21hcmdpbjowIDJweDtwYWRkaW5nOi4zNWVtIC42MjVlbSAuNzVlbX1sZWdlbmR7Ym9yZGVyOjB9dGV4dGFyZWF7b3ZlcmZsb3c6YXV0b31vcHRncm91cHtmb250LXdlaWdodDo3MDB9dGFibGV7Ym9yZGVyLWNvbGxhcHNlOmNvbGxhcHNlO2JvcmRlci1zcGFjaW5nOjB9bGVnZW5kLHRkLHRoe3BhZGRpbmc6MH1AbWVkaWEgc2NyZWVuey5iZXNwb2tlLXBhcmVudCwuYmVzcG9rZS1zY2FsZS1wYXJlbnR7cG9zaXRpb246YWJzb2x1dGU7dG9wOjA7bGVmdDowO3JpZ2h0OjA7Ym90dG9tOjB9LmJlc3Bva2UtcGFyZW50e2JhY2tncm91bmQtY29sb3I6I2Q3ZDdmYX0uYmVzcG9rZS1zY2FsZS1wYXJlbnR7cG9pbnRlci1ldmVudHM6bm9uZX0uYmVzcG9rZS1zY2FsZS1wYXJlbnQgLmJlc3Bva2UtYWN0aXZle3BvaW50ZXItZXZlbnRzOmF1dG99LmJlc3Bva2Utc2xpZGV7d2lkdGg6ODAwcHg7aGVpZ2h0OjYwMHB4O3Bvc2l0aW9uOmFic29sdXRlO292ZXJmbG93OmhpZGRlbjt0b3A6NTAlO2xlZnQ6NTAlO21hcmdpbi1sZWZ0Oi00MDBweDttYXJnaW4tdG9wOi0zMDBweDtkaXNwbGF5Oi13ZWJraXQtZmxleDtkaXNwbGF5Oi1tcy1mbGV4Ym94O2Rpc3BsYXk6ZmxleDstd2Via2l0LWZsZXgtZGlyZWN0aW9uOmNvbHVtbjstbXMtZmxleC1kaXJlY3Rpb246Y29sdW1uO2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjstd2Via2l0LWp1c3RpZnktY29udGVudDpjZW50ZXI7LW1zLWZsZXgtcGFjazpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjstd2Via2l0LWFsaWduLWl0ZW1zOmNlbnRlcjstbXMtZmxleC1hbGlnbjpjZW50ZXI7YWxpZ24taXRlbXM6Y2VudGVyfS5iZXNwb2tlLWluYWN0aXZle29wYWNpdHk6MDtwb2ludGVyLWV2ZW50czpub25lfS5lbXBoYXRpY3tiYWNrZ3JvdW5kOiNhNmIwZmY7Y29sb3I6I2ZmZn0uZW1waGF0aWMgaDEsLmVtcGhhdGljIGgyLC5lbXBoYXRpYyBoMywuZW1waGF0aWMgaDQsLmVtcGhhdGljIGg1LC5lbXBoYXRpYyBoNntjb2xvcjojNDMxMzgwfWgxe2NvbG9yOiM2ZThhZTQ7Zm9udC1mYW1pbHk6J0NhbGxpZ3JhZmZpdHRpJyxjdXJzaXZlO2ZvbnQtc2l6ZTozZW19aDJ7Zm9udC1zaXplOjJlbX1oM3tmb250LXNpemU6MS41ZW19aDQsaDUsaDZ7Zm9udC1zaXplOjFlbX1hcnRpY2xlLGgyLGgzLGg0LGg1LGg2e2ZvbnQtZmFtaWx5OidPcGVuIFNhbnMnLEZ1c2UtU2Vnb2UtVUksaGVsdmV0aWNhLGFyaWFsLHNhbnMtc2VyaWZ9aDEsaDIsaDMsaDQsaDUsaDYsc3Ryb25ne2ZvbnQtd2VpZ2h0OjQwMH1saSxwe2ZvbnQtc2l6ZToyNHB4O2xpbmUtaGVpZ2h0OjEuNWVtfXN0cm9uZ3tjb2xvcjojZmM0OWQ4fWF7Y29sb3I6I2I2NmM3ZTt0ZXh0LWRlY29yYXRpb246bm9uZX1hOmhvdmVye3RleHQtZGVjb3JhdGlvbjp1bmRlcmxpbmV9Y29kZSxwcmV7Zm9udC1zaXplOjIwcHh9LnNsaWRle292ZXJmbG93OmhpZGRlbn0uc2xpZGUgLmJlc3Bva2Utc2xpZGV7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwwLDApO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLDAsMCk7dHJhbnNpdGlvbjphbGwgLjhzIGVhc2V9LnNsaWRlIC5iZXNwb2tlLWJlZm9yZXstd2Via2l0LXRyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMTAwJSwwLDApO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMTAwJSwwLDApfS5zbGlkZSAuYmVzcG9rZS1hZnRlcnstd2Via2l0LXRyYW5zZm9ybTp0cmFuc2xhdGUzZCgxMDAlLDAsMCk7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDEwMCUsMCwwKX0uc2xpZGUgLmJlc3Bva2UtaW5hY3RpdmUgLmJlc3Bva2UtYnVsbGV0LWluYWN0aXZle3RyYW5zaXRpb246b3BhY2l0eSAuOHMgZWFzZX0uY3ViZXtvdmVyZmxvdzpoaWRkZW59LmN1YmUsLmN1YmUgLmJlc3Bva2Utc2NhbGUtcGFyZW50ey13ZWJraXQtcGVyc3BlY3RpdmU6ODAwcHg7cGVyc3BlY3RpdmU6ODAwcHh9LmN1YmUgLmJlc3Bva2Utc2xpZGV7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOjUwJSA1MCUgLTQwMHB4O3RyYW5zZm9ybS1vcmlnaW46NTAlIDUwJSAtNDAwcHg7dHJhbnNpdGlvbjphbGwgLjhzIGVhc2U7LXdlYmtpdC10cmFuc2Zvcm0tc3R5bGU6cHJlc2VydmUtM2Q7dHJhbnNmb3JtLXN0eWxlOnByZXNlcnZlLTNkfS5jdWJlIC5iZXNwb2tlLWluYWN0aXZle29wYWNpdHk6MH0uY3ViZSAuYmVzcG9rZS1iZWZvcmV7LXdlYmtpdC10cmFuc2Zvcm06cm90YXRlWSgtOTBkZWcpO3RyYW5zZm9ybTpyb3RhdGVZKC05MGRlZyl9LmN1YmUgLmJlc3Bva2UtYWZ0ZXJ7LXdlYmtpdC10cmFuc2Zvcm06cm90YXRlWSg5MGRlZyk7dHJhbnNmb3JtOnJvdGF0ZVkoOTBkZWcpfS56ZWxkYS10cmFuc2l0aW9ue292ZXJmbG93OmhpZGRlbn0uemVsZGEtdHJhbnNpdGlvbiAuYmVzcG9rZS1zbGlkZXstd2Via2l0LXRyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLDAsMCk7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsMCwwKTt0cmFuc2l0aW9uOmFsbCAuOHMgY3ViaWMtYmV6aWVyKC43OCwuMDMsLjIyLC42OCl9LnplbGRhLXRyYW5zaXRpb24gLmJlc3Bva2UtYmVmb3Jley13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0xMDAlLDAsMCk7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0xMDAlLDAsMCl9LnplbGRhLXRyYW5zaXRpb24gLmJlc3Bva2UtYWZ0ZXJ7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTAwJSwwLDApO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgxMDAlLDAsMCl9LmJlc3Bva2UtYnVsbGV0e29wYWNpdHk6MTstd2Via2l0LXRyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLDAsMCk7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsMCwwKTt0cmFuc2l0aW9uOmFsbCAuNHMgZWFzZX0uYmVzcG9rZS1idWxsZXQtaW5hY3RpdmV7b3BhY2l0eTowO3BvaW50ZXItZXZlbnRzOm5vbmU7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlM2QoNDBweCwwLDApO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCg0MHB4LDAsMCk7dHJhbnNpdGlvbjphbGwgLjJzIGVhc2V9LmJlc3Bva2UtYnVsbGV0LW9mZiAuYmVzcG9rZS1idWxsZXQtaW5hY3RpdmV7ZGlzcGxheTpsaXN0LWl0ZW07b3BhY2l0eTppbml0aWFsOy13ZWJraXQtdHJhbnNmb3JtOmluaXRpYWw7dHJhbnNmb3JtOmluaXRpYWx9LmJlc3Bva2UtcHJvZ3Jlc3MtcGFyZW50e3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtyaWdodDowO2hlaWdodDouMnZ3fS5iZXNwb2tlLXByb2dyZXNzLWJhcntwb3NpdGlvbjphYnNvbHV0ZTtoZWlnaHQ6MTAwJTt0cmFuc2l0aW9uOndpZHRoIC42cyBlYXNlfS5iZXNwb2tlLXByb2dyZXNzLWJhcjphZnRlciwuYmVzcG9rZS1wcm9ncmVzcy1iYXI6YmVmb3Jle2NvbnRlbnQ6XFxcIlxcXCI7cG9zaXRpb246YWJzb2x1dGU7ZGlzcGxheTpibG9jazt3aWR0aDoxMDAlO2hlaWdodDo1MCV9LmJlc3Bva2UtcHJvZ3Jlc3MtYmFyOmJlZm9yZXtiYWNrZ3JvdW5kOiNhZWFlZjV9LmJlc3Bva2UtcHJvZ3Jlc3MtYmFyOmFmdGVye3RvcDo1MCU7YmFja2dyb3VuZDojYzJjMmY3fS5iZXNwb2tlLXNpbXBsZS1vdmVydmlldyAuYmVzcG9rZS1wYXJlbnR7ZGlzcGxheTppbmxpbmUtYmxvY2t9LmJlc3Bva2Utc2ltcGxlLW92ZXJ2aWV3IC5iZXNwb2tlLXNsaWRle3Bvc2l0aW9uOmFic29sdXRlOy13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsMCwtMjAwMHB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwwLC0yMDAwcHgpO29wYWNpdHk6MTtvdXRsaW5lOjRweCBzb2xpZCBzaWx2ZXI7YmFja2dyb3VuZC1jb2xvcjpyZ2JhKDI1NSwyNTUsMjU1LC4yKX0uYmVzcG9rZS1zaW1wbGUtb3ZlcnZpZXcgLmJlc3Bva2Utc2xpZGUuYmVzcG9rZS1hY3RpdmUsLmJlc3Bva2Utc2ltcGxlLW92ZXJ2aWV3IC5iZXNwb2tlLXNsaWRlOmhvdmVye291dGxpbmUtY29sb3I6IzQ2ODJiNH0uYmVzcG9rZS1zaW1wbGUtb3ZlcnZpZXcgLmJlc3Bva2Utc2xpZGUuYmVzcG9rZS1pbmFjdGl2ZS5iZXNwb2tlLWFmdGVyOm5vdCguYmVzcG9rZS1hZnRlci0xKTpub3QoLmJlc3Bva2UtYWZ0ZXItMiksLmJlc3Bva2Utc2ltcGxlLW92ZXJ2aWV3IC5iZXNwb2tlLXNsaWRlLmJlc3Bva2UtaW5hY3RpdmUuYmVzcG9rZS1iZWZvcmU6bm90KC5iZXNwb2tlLWJlZm9yZS0xKTpub3QoLmJlc3Bva2UtYmVmb3JlLTIpe2Rpc3BsYXk6LXdlYmtpdC1mbGV4O2Rpc3BsYXk6LW1zLWZsZXhib3g7ZGlzcGxheTpmbGV4fS5iZXNwb2tlLXNpbXBsZS1vdmVydmlldyAuYmVzcG9rZS1idWxsZXQtaW5hY3RpdmV7ZGlzcGxheTpsaXN0LWl0ZW07b3BhY2l0eTppbml0aWFsOy13ZWJraXQtdHJhbnNmb3JtOmluaXRpYWw7dHJhbnNmb3JtOmluaXRpYWx9LmJlc3Bva2Utc2ltcGxlLW92ZXJ2aWV3IC5iZXNwb2tlLXNsaWRlLmJlc3Bva2UtYWZ0ZXJ7ZGlzcGxheTpub25lOy13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDQxMjAuMDAwNDgwMDAxOTJweCwwLC0yMDAwcHgpO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCg0MTIwLjAwMDQ4MDAwMTkycHgsMCwtMjAwMHB4KX0uYmVzcG9rZS1zaW1wbGUtb3ZlcnZpZXcgLmJlc3Bva2Utc2xpZGUuYmVzcG9rZS1iZWZvcmV7ZGlzcGxheTpub25lOy13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC00MTIwLjAwMDQ4MDAwMTkycHgsMCwtMjAwMHB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTQxMjAuMDAwNDgwMDAxOTJweCwwLC0yMDAwcHgpfS5iZXNwb2tlLXNpbXBsZS1vdmVydmlldy56ZWxkYS10cmFuc2l0aW9uIC5iZXNwb2tlLXNsaWRlLmJlc3Bva2UtYWZ0ZXJ7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlM2QoNDEyMC4wMDA0ODAwMDE5MnB4LDEwMCUsLTIwMDBweCk7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDQxMjAuMDAwNDgwMDAxOTJweCwxMDAlLC0yMDAwcHgpfS5iZXNwb2tlLXNpbXBsZS1vdmVydmlldy56ZWxkYS10cmFuc2l0aW9uIC5iZXNwb2tlLXNsaWRlLmJlc3Bva2UtYmVmb3Jley13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC00MTIwLjAwMDQ4MDAwMTkycHgsMTAwJSwtMjAwMHB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTQxMjAuMDAwNDgwMDAxOTJweCwxMDAlLC0yMDAwcHgpfS5iZXNwb2tlLXNpbXBsZS1vdmVydmlldyAuYmVzcG9rZS1zbGlkZS5iZXNwb2tlLWFmdGVyLTF7ZGlzcGxheTotd2Via2l0LWZsZXg7ZGlzcGxheTotbXMtZmxleGJveDtkaXNwbGF5OmZsZXg7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlM2QoODI0LjAwMDA5NjAwMDM4NHB4LDAsLTIwMDBweCk7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDgyNC4wMDAwOTYwMDAzODRweCwwLC0yMDAwcHgpfS5iZXNwb2tlLXNpbXBsZS1vdmVydmlldyAuYmVzcG9rZS1zbGlkZS5iZXNwb2tlLWJlZm9yZS0xe2Rpc3BsYXk6LXdlYmtpdC1mbGV4O2Rpc3BsYXk6LW1zLWZsZXhib3g7ZGlzcGxheTpmbGV4Oy13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC04MjQuMDAwMDk2MDAwMzg0cHgsMCwtMjAwMHB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTgyNC4wMDAwOTYwMDAzODRweCwwLC0yMDAwcHgpfS5iZXNwb2tlLXNpbXBsZS1vdmVydmlldy56ZWxkYS10cmFuc2l0aW9uIC5iZXNwb2tlLXNsaWRlLmJlc3Bva2UtYWZ0ZXItMXtkaXNwbGF5Oi13ZWJraXQtZmxleDtkaXNwbGF5Oi1tcy1mbGV4Ym94O2Rpc3BsYXk6ZmxleDstd2Via2l0LXRyYW5zZm9ybTp0cmFuc2xhdGUzZCg4MjQuMDAwMDk2MDAwMzg0cHgsMTAwJSwtMjAwMHB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoODI0LjAwMDA5NjAwMDM4NHB4LDEwMCUsLTIwMDBweCl9LmJlc3Bva2Utc2ltcGxlLW92ZXJ2aWV3LnplbGRhLXRyYW5zaXRpb24gLmJlc3Bva2Utc2xpZGUuYmVzcG9rZS1iZWZvcmUtMXtkaXNwbGF5Oi13ZWJraXQtZmxleDtkaXNwbGF5Oi1tcy1mbGV4Ym94O2Rpc3BsYXk6ZmxleDstd2Via2l0LXRyYW5zZm9ybTp0cmFuc2xhdGUzZCgtODI0LjAwMDA5NjAwMDM4NHB4LDEwMCUsLTIwMDBweCk7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC04MjQuMDAwMDk2MDAwMzg0cHgsMTAwJSwtMjAwMHB4KX0uYmVzcG9rZS1zaW1wbGUtb3ZlcnZpZXcgLmJlc3Bva2Utc2xpZGUuYmVzcG9rZS1hZnRlci0ye2Rpc3BsYXk6LXdlYmtpdC1mbGV4O2Rpc3BsYXk6LW1zLWZsZXhib3g7ZGlzcGxheTpmbGV4Oy13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDE2NDguMDAwMTkyMDAwNzY4cHgsMCwtMjAwMHB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTY0OC4wMDAxOTIwMDA3NjhweCwwLC0yMDAwcHgpfS5iZXNwb2tlLXNpbXBsZS1vdmVydmlldyAuYmVzcG9rZS1zbGlkZS5iZXNwb2tlLWJlZm9yZS0ye2Rpc3BsYXk6LXdlYmtpdC1mbGV4O2Rpc3BsYXk6LW1zLWZsZXhib3g7ZGlzcGxheTpmbGV4Oy13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0xNjQ4LjAwMDE5MjAwMDc2OHB4LDAsLTIwMDBweCk7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0xNjQ4LjAwMDE5MjAwMDc2OHB4LDAsLTIwMDBweCl9LmJlc3Bva2Utc2ltcGxlLW92ZXJ2aWV3LnplbGRhLXRyYW5zaXRpb24gLmJlc3Bva2Utc2xpZGUuYmVzcG9rZS1hZnRlci0ye2Rpc3BsYXk6LXdlYmtpdC1mbGV4O2Rpc3BsYXk6LW1zLWZsZXhib3g7ZGlzcGxheTpmbGV4Oy13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDE2NDguMDAwMTkyMDAwNzY4cHgsMTAwJSwtMjAwMHB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTY0OC4wMDAxOTIwMDA3NjhweCwxMDAlLC0yMDAwcHgpfS5iZXNwb2tlLXNpbXBsZS1vdmVydmlldy56ZWxkYS10cmFuc2l0aW9uIC5iZXNwb2tlLXNsaWRlLmJlc3Bva2UtYmVmb3JlLTJ7ZGlzcGxheTotd2Via2l0LWZsZXg7ZGlzcGxheTotbXMtZmxleGJveDtkaXNwbGF5OmZsZXg7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTE2NDguMDAwMTkyMDAwNzY4cHgsMTAwJSwtMjAwMHB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTE2NDguMDAwMTkyMDAwNzY4cHgsMTAwJSwtMjAwMHB4KX0uYmVzcG9rZS1zaW1wbGUtb3ZlcnZpZXcgLmJlc3Bva2Utc2xpZGUuYmVzcG9rZS1hZnRlci0ze2Rpc3BsYXk6LXdlYmtpdC1mbGV4O2Rpc3BsYXk6LW1zLWZsZXhib3g7ZGlzcGxheTpmbGV4Oy13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDI0NzIuMDAwMjg4MDAxMTUycHgsMCwtMjAwMHB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMjQ3Mi4wMDAyODgwMDExNTJweCwwLC0yMDAwcHgpfS5iZXNwb2tlLXNpbXBsZS1vdmVydmlldyAuYmVzcG9rZS1zbGlkZS5iZXNwb2tlLWJlZm9yZS0ze2Rpc3BsYXk6LXdlYmtpdC1mbGV4O2Rpc3BsYXk6LW1zLWZsZXhib3g7ZGlzcGxheTpmbGV4Oy13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0yNDcyLjAwMDI4ODAwMTE1MnB4LDAsLTIwMDBweCk7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0yNDcyLjAwMDI4ODAwMTE1MnB4LDAsLTIwMDBweCl9LmJlc3Bva2Utc2ltcGxlLW92ZXJ2aWV3LnplbGRhLXRyYW5zaXRpb24gLmJlc3Bva2Utc2xpZGUuYmVzcG9rZS1hZnRlci0ze2Rpc3BsYXk6LXdlYmtpdC1mbGV4O2Rpc3BsYXk6LW1zLWZsZXhib3g7ZGlzcGxheTpmbGV4Oy13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDI0NzIuMDAwMjg4MDAxMTUycHgsMTAwJSwtMjAwMHB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMjQ3Mi4wMDAyODgwMDExNTJweCwxMDAlLC0yMDAwcHgpfS5iZXNwb2tlLXNpbXBsZS1vdmVydmlldy56ZWxkYS10cmFuc2l0aW9uIC5iZXNwb2tlLXNsaWRlLmJlc3Bva2UtYmVmb3JlLTN7ZGlzcGxheTotd2Via2l0LWZsZXg7ZGlzcGxheTotbXMtZmxleGJveDtkaXNwbGF5OmZsZXg7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTI0NzIuMDAwMjg4MDAxMTUycHgsMTAwJSwtMjAwMHB4KTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTI0NzIuMDAwMjg4MDAxMTUycHgsMTAwJSwtMjAwMHB4KX0uYmVzcG9rZS1zaW1wbGUtb3ZlcnZpZXcuemVsZGEtdHJhbnNpdGlvbiAuYmVzcG9rZS1zbGlkZXstd2Via2l0LXRyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLDEwMCUsLTIwMDBweCk7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsMTAwJSwtMjAwMHB4KTtiYWNrZ3JvdW5kLWNvbG9yOmluaGVyaXR9I2Jlc3Bva2Utc2VhcmNoe3Bvc2l0aW9uOmFic29sdXRlO3dpZHRoOjEwMCU7aGVpZ2h0OjEwMCU7cG9pbnRlci1ldmVudHM6bm9uZTt6LWluZGV4OjE7b3BhY2l0eTowO2JhY2tncm91bmQtY29sb3I6cmdiYSgxMjgsMTI4LDEyOCwuMyk7dHJhbnNpdGlvbjpvcGFjaXR5IDEwMG1zIGVhc2Utb3V0fSNiZXNwb2tlLXNlYXJjaC5iZXNwb2tlLXNlYXJjaC1zZWFyY2hpbmd7b3BhY2l0eToxfSNiZXNwb2tlLXNlYXJjaC5iZXNwb2tlLXNlYXJjaC1zZWFyY2hpbmc+I2Jlc3Bva2Utc2VhcmNoLWlucHV0e2JvdHRvbTo1JX0jYmVzcG9rZS1zZWFyY2gtaW5wdXR7cG9zaXRpb246YWJzb2x1dGU7bGVmdDo1MCU7Ym90dG9tOi01JTtwb2ludGVyLWV2ZW50czphbGw7d2lkdGg6MjAwcHg7bWFyZ2luLWxlZnQ6LTEwMHB4O3BhZGRpbmc6OHB4O2JvcmRlci1yYWRpdXM6MTBweDtib3JkZXI6MXB4IHNvbGlkIHNpbHZlcjtvdXRsaW5lOm5vbmU7Y29sb3I6Z3JheTtmb250LXNpemU6eC1sYXJnZTtiYWNrZ3JvdW5kLWNvbG9yOnJnYmEoMjU1LDI1NSwyNTUsLjkpO3RyYW5zaXRpb246Ym90dG9tIDE0MG1zIGVhc2Utb3V0fS5iZXNwb2tlLXNlYXJjaC1yZXN1bHR7YmFja2dyb3VuZC1jb2xvcjojZmYwfS5iZXNwb2tlLXNlYXJjaC1yZXN1bHQtZm9jdXNlZHtiYWNrZ3JvdW5kLWNvbG9yOm9yYW5nZX0jYmVzcG9rZS1zZWFyY2guYmVzcG9rZS1zZWFyY2gtbm8tcmVzdWx0PiNiZXNwb2tlLXNlYXJjaC1pbnB1dHtib3JkZXI6MXB4IHNvbGlkICM4YjAwMDA7Y29sb3I6IzhiMDAwMH0jYmVzcG9rZS1zZWFyY2gtcmVzdWx0cy1jb3VudHtwb3NpdGlvbjphYnNvbHV0ZTtib3R0b206MSU7bGVmdDo1MCU7bWFyZ2luLWxlZnQ6LTMwcHg7d2lkdGg6NjBweDt0ZXh0LWFsaWduOmNlbnRlcjtmb250LXNpemU6c21hbGxlcjtjb2xvcjojOGEyYmUyO2ZvbnQtd2VpZ2h0OjcwMH19QG1lZGlhIHByaW50eyp7YmFja2dyb3VuZDowIDAhaW1wb3J0YW50O2NvbG9yOiMwMDAhaW1wb3J0YW50O3RleHQtc2hhZG93Om5vbmUhaW1wb3J0YW50fWJvZHksaHRtbHtvdmVyZmxvdzp2aXNpYmxlIWltcG9ydGFudDtoZWlnaHQ6YXV0byFpbXBvcnRhbnR9Ym9keXttYXJnaW46MCFpbXBvcnRhbnQ7cGFkZGluZzouMWluIWltcG9ydGFudH1ib2R5LGNvZGV7bGluZS1oZWlnaHQ6MWVtIWltcG9ydGFudH1jb2RlLG9sLHByZSx1bHt0ZXh0LWFsaWduOmxlZnQhaW1wb3J0YW50fXByZSBjb2Rle2JvcmRlcjoxcHggc29saWQgIzY5Njk2OSFpbXBvcnRhbnQ7cGFkZGluZzo1cHghaW1wb3J0YW50O2JvcmRlci1yYWRpdXM6NHB4IWltcG9ydGFudH1AcGFnZXttYXJnaW46Ljc5aW4haW1wb3J0YW50fS5iZXNwb2tlLXNsaWRle2JveC1zaXppbmc6Ym9yZGVyLWJveCFpbXBvcnRhbnQ7ZGlzcGxheTpibG9jayFpbXBvcnRhbnQ7ZmxvYXQ6bGVmdCFpbXBvcnRhbnQ7Ym9yZGVyOjJweCBzb2xpZCAjMDAwIWltcG9ydGFudDt0ZXh0LWFsaWduOmNlbnRlciFpbXBvcnRhbnQ7bWFyZ2luLXRvcDowIWltcG9ydGFudDttYXJnaW4tbGVmdDowIWltcG9ydGFudDtwYWdlLWJyZWFrLWluc2lkZTphdm9pZCFpbXBvcnRhbnR9LmJlc3Bva2Utc2xpZGU+Knt6b29tOi42NSFpbXBvcnRhbnR9LmJlc3Bva2Utc2xpZGU+KiAqe3pvb206Ljg1IWltcG9ydGFudH0uYmVzcG9rZS1zbGlkZT5oMTpvbmx5LWNoaWxkLC5iZXNwb2tlLXNsaWRlPmgyOm9ubHktY2hpbGQsLmJlc3Bva2Utc2xpZGU+aDM6b25seS1jaGlsZCwuYmVzcG9rZS1zbGlkZT5oNDpvbmx5LWNoaWxkLC5iZXNwb2tlLXNsaWRlPmg1Om9ubHktY2hpbGQsLmJlc3Bva2Utc2xpZGU+aDY6b25seS1jaGlsZHttYXJnaW4tdG9wOjRlbSFpbXBvcnRhbnR9LmJlc3Bva2Utc2xpZGUgLmJlc3Bva2UtYnVsbGV0LWluYWN0aXZle29wYWNpdHk6MSFpbXBvcnRhbnQ7LXdlYmtpdC10cmFuc2Zvcm06bm9uZSFpbXBvcnRhbnQ7dHJhbnNmb3JtOm5vbmUhaW1wb3J0YW50O3RyYW5zaXRpb246bm9uZSFpbXBvcnRhbnR9LmJlc3Bva2Utc2xpZGU6bnRoLWNoaWxkKDZuKSwuYmVzcG9rZS1zbGlkZTpudGgtb2YtdHlwZSg2bil7cGFnZS1icmVhay1hZnRlcjphbHdheXMhaW1wb3J0YW50Oy13ZWJraXQtY29sdW1uLWJyZWFrLWFmdGVyOnBhZ2UhaW1wb3J0YW50O2JyZWFrLWFmdGVyOnBhZ2UhaW1wb3J0YW50fX1AbWVkaWEgcHJpbnQgYW5kIChvcmllbnRhdGlvbjpwb3J0cmFpdCl7LmJlc3Bva2Utc2xpZGV7d2lkdGg6Mi45MTk0NzI0NDMwMDAwMDFpbiFpbXBvcnRhbnQ7aGVpZ2h0OjIuMTg5NjA0MzMyMjUwMDAxaW4haW1wb3J0YW50O21hcmdpbi1yaWdodDouMzI0Mzg1ODI3aW4haW1wb3J0YW50O21hcmdpbi1ib3R0b206LjMyNDM4NTgyN2luIWltcG9ydGFudH0uYmVzcG9rZS1zbGlkZTpudGgtY2hpbGQoMm4pe21hcmdpbi1yaWdodDowIWltcG9ydGFudH0uYmVzcG9rZS1wYXJlbnR7d2lkdGg6Ni40ODc3MTY1NDAwMDAwMDFpbiFpbXBvcnRhbnR9aW1ne21heC13aWR0aDo1LjI0ODAxMjk3NjQ3MDU4OWluIWltcG9ydGFudH19QG1lZGlhIHByaW50IGFuZCAob3JpZW50YXRpb246bGFuZHNjYXBlKXsuYmVzcG9rZS1zbGlkZXt3aWR0aDoyLjk3Mzg3NDAyaW4haW1wb3J0YW50O2hlaWdodDoyLjIzMDQwNTUxNWluIWltcG9ydGFudDttYXJnaW4tcmlnaHQ6LjI5NzM4NzQwMmluIWltcG9ydGFudDttYXJnaW4tYm90dG9tOi4yOTczODc0MDJpbiFpbXBvcnRhbnR9LmJlc3Bva2Utc2xpZGU6bnRoLWNoaWxkKDNuKXttYXJnaW4tcmlnaHQ6MCFpbXBvcnRhbnR9LmJlc3Bva2UtcGFyZW50e3dpZHRoOjkuOTEyOTEzNGluIWltcG9ydGFudH1pbWd7bWF4LXdpZHRoOjMuNDk4Njc1MzE3NjQ3MDU5aW4haW1wb3J0YW50fX1cXG4vKiMgc291cmNlTWFwcGluZ1VSTD10aGVtZS5jc3MubWFwICovXFxuXCI7cmV0dXJuIHMoZSx7cHJlcGVuZDohMH0pLGZ1bmN0aW9uKGUpe2koKShlKX19fSx7XCJiZXNwb2tlLWNsYXNzZXNcIjoyLFwiaW5zZXJ0LWNzc1wiOjN9XSwyOltmdW5jdGlvbihlLHQsbyl7dC5leHBvcnRzPWZ1bmN0aW9uKCl7cmV0dXJuIGZ1bmN0aW9uKGUpe3ZhciB0PWZ1bmN0aW9uKGUsdCl7ZS5jbGFzc0xpc3QuYWRkKFwiYmVzcG9rZS1cIit0KX0sbz1mdW5jdGlvbihlLHQpe2UuY2xhc3NOYW1lPWUuY2xhc3NOYW1lLnJlcGxhY2UobmV3IFJlZ0V4cChcImJlc3Bva2UtXCIrdCtcIihcXFxcc3wkKVwiLFwiZ1wiKSxcIiBcIikudHJpbSgpfSxpPWZ1bmN0aW9uKGkscyl7dmFyIGE9ZS5zbGlkZXNbZS5zbGlkZSgpXSxyPXMtZS5zbGlkZSgpLG49cj4wP1wiYWZ0ZXJcIjpcImJlZm9yZVwiO1tcImJlZm9yZSgtXFxcXGQrKT9cIixcImFmdGVyKC1cXFxcZCspP1wiLFwiYWN0aXZlXCIsXCJpbmFjdGl2ZVwiXS5tYXAoby5iaW5kKG51bGwsaSkpLGkhPT1hJiZbXCJpbmFjdGl2ZVwiLG4sbitcIi1cIitNYXRoLmFicyhyKV0ubWFwKHQuYmluZChudWxsLGkpKX07dChlLnBhcmVudCxcInBhcmVudFwiKSxlLnNsaWRlcy5tYXAoZnVuY3Rpb24oZSl7dChlLFwic2xpZGVcIil9KSxlLm9uKFwiYWN0aXZhdGVcIixmdW5jdGlvbihzKXtlLnNsaWRlcy5tYXAoaSksdChzLnNsaWRlLFwiYWN0aXZlXCIpLG8ocy5zbGlkZSxcImluYWN0aXZlXCIpfSl9fX0se31dLDM6W2Z1bmN0aW9uKGUsdCxvKXt2YXIgaT17fTt0LmV4cG9ydHM9ZnVuY3Rpb24oZSx0KXtpZighaVtlXSl7aVtlXT0hMDt2YXIgbz1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7by5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsXCJ0ZXh0L2Nzc1wiKSxcInRleHRDb250ZW50XCJpbiBvP28udGV4dENvbnRlbnQ9ZTpvLnN0eWxlU2hlZXQuY3NzVGV4dD1lO3ZhciBzPWRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiaGVhZFwiKVswXTt0JiZ0LnByZXBlbmQ/cy5pbnNlcnRCZWZvcmUobyxzLmNoaWxkTm9kZXNbMF0pOnMuYXBwZW5kQ2hpbGQobyl9fX0se31dfSx7fSxbMV0pKDEpfSk7XG59KS5jYWxsKHRoaXMsdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0aW9ucykge1xyXG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XHJcbiAgICB2YXIgYXhpcyA9IG9wdGlvbnMgPT0gJ3ZlcnRpY2FsJyA/ICdZJyA6ICdYJyxcclxuICAgICAgc3RhcnRQb3NpdGlvbixcclxuICAgICAgZGVsdGE7XHJcblxyXG4gICAgZGVjay5wYXJlbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgaWYgKGUudG91Y2hlcy5sZW5ndGggPT0gMSkge1xyXG4gICAgICAgIHN0YXJ0UG9zaXRpb24gPSBlLnRvdWNoZXNbMF1bJ3BhZ2UnICsgYXhpc107XHJcbiAgICAgICAgZGVsdGEgPSAwO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBkZWNrLnBhcmVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIGlmIChlLnRvdWNoZXMubGVuZ3RoID09IDEpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgZGVsdGEgPSBlLnRvdWNoZXNbMF1bJ3BhZ2UnICsgYXhpc10gLSBzdGFydFBvc2l0aW9uO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBkZWNrLnBhcmVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIGZ1bmN0aW9uKCkge1xyXG4gICAgICBpZiAoTWF0aC5hYnMoZGVsdGEpID4gNTApIHtcclxuICAgICAgICBkZWNrW2RlbHRhID4gMCA/ICdwcmV2JyA6ICduZXh0J10oKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfTtcclxufTtcclxuIiwidmFyIGZyb20gPSBmdW5jdGlvbihvcHRzLCBwbHVnaW5zKSB7XHJcbiAgdmFyIHBhcmVudCA9IChvcHRzLnBhcmVudCB8fCBvcHRzKS5ub2RlVHlwZSA9PT0gMSA/IChvcHRzLnBhcmVudCB8fCBvcHRzKSA6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Iob3B0cy5wYXJlbnQgfHwgb3B0cyksXHJcbiAgICBzbGlkZXMgPSBbXS5maWx0ZXIuY2FsbCh0eXBlb2Ygb3B0cy5zbGlkZXMgPT09ICdzdHJpbmcnID8gcGFyZW50LnF1ZXJ5U2VsZWN0b3JBbGwob3B0cy5zbGlkZXMpIDogKG9wdHMuc2xpZGVzIHx8IHBhcmVudC5jaGlsZHJlbiksIGZ1bmN0aW9uKGVsKSB7IHJldHVybiBlbC5ub2RlTmFtZSAhPT0gJ1NDUklQVCc7IH0pLFxyXG4gICAgYWN0aXZlU2xpZGUgPSBzbGlkZXNbMF0sXHJcbiAgICBsaXN0ZW5lcnMgPSB7fSxcclxuXHJcbiAgICBhY3RpdmF0ZSA9IGZ1bmN0aW9uKGluZGV4LCBjdXN0b21EYXRhKSB7XHJcbiAgICAgIGlmICghc2xpZGVzW2luZGV4XSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgZmlyZSgnZGVhY3RpdmF0ZScsIGNyZWF0ZUV2ZW50RGF0YShhY3RpdmVTbGlkZSwgY3VzdG9tRGF0YSkpO1xyXG4gICAgICBhY3RpdmVTbGlkZSA9IHNsaWRlc1tpbmRleF07XHJcbiAgICAgIGZpcmUoJ2FjdGl2YXRlJywgY3JlYXRlRXZlbnREYXRhKGFjdGl2ZVNsaWRlLCBjdXN0b21EYXRhKSk7XHJcbiAgICB9LFxyXG5cclxuICAgIHNsaWRlID0gZnVuY3Rpb24oaW5kZXgsIGN1c3RvbURhdGEpIHtcclxuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGgpIHtcclxuICAgICAgICBmaXJlKCdzbGlkZScsIGNyZWF0ZUV2ZW50RGF0YShzbGlkZXNbaW5kZXhdLCBjdXN0b21EYXRhKSkgJiYgYWN0aXZhdGUoaW5kZXgsIGN1c3RvbURhdGEpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJldHVybiBzbGlkZXMuaW5kZXhPZihhY3RpdmVTbGlkZSk7XHJcbiAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgc3RlcCA9IGZ1bmN0aW9uKG9mZnNldCwgY3VzdG9tRGF0YSkge1xyXG4gICAgICB2YXIgc2xpZGVJbmRleCA9IHNsaWRlcy5pbmRleE9mKGFjdGl2ZVNsaWRlKSArIG9mZnNldDtcclxuXHJcbiAgICAgIGZpcmUob2Zmc2V0ID4gMCA/ICduZXh0JyA6ICdwcmV2JywgY3JlYXRlRXZlbnREYXRhKGFjdGl2ZVNsaWRlLCBjdXN0b21EYXRhKSkgJiYgYWN0aXZhdGUoc2xpZGVJbmRleCwgY3VzdG9tRGF0YSk7XHJcbiAgICB9LFxyXG5cclxuICAgIG9uID0gZnVuY3Rpb24oZXZlbnROYW1lLCBjYWxsYmFjaykge1xyXG4gICAgICAobGlzdGVuZXJzW2V2ZW50TmFtZV0gfHwgKGxpc3RlbmVyc1tldmVudE5hbWVdID0gW10pKS5wdXNoKGNhbGxiYWNrKTtcclxuICAgICAgcmV0dXJuIG9mZi5iaW5kKG51bGwsIGV2ZW50TmFtZSwgY2FsbGJhY2spO1xyXG4gICAgfSxcclxuXHJcbiAgICBvZmYgPSBmdW5jdGlvbihldmVudE5hbWUsIGNhbGxiYWNrKSB7XHJcbiAgICAgIGxpc3RlbmVyc1tldmVudE5hbWVdID0gKGxpc3RlbmVyc1tldmVudE5hbWVdIHx8IFtdKS5maWx0ZXIoZnVuY3Rpb24obGlzdGVuZXIpIHsgcmV0dXJuIGxpc3RlbmVyICE9PSBjYWxsYmFjazsgfSk7XHJcbiAgICB9LFxyXG5cclxuICAgIGZpcmUgPSBmdW5jdGlvbihldmVudE5hbWUsIGV2ZW50RGF0YSkge1xyXG4gICAgICByZXR1cm4gKGxpc3RlbmVyc1tldmVudE5hbWVdIHx8IFtdKVxyXG4gICAgICAgIC5yZWR1Y2UoZnVuY3Rpb24obm90Q2FuY2VsbGVkLCBjYWxsYmFjaykge1xyXG4gICAgICAgICAgcmV0dXJuIG5vdENhbmNlbGxlZCAmJiBjYWxsYmFjayhldmVudERhdGEpICE9PSBmYWxzZTtcclxuICAgICAgICB9LCB0cnVlKTtcclxuICAgIH0sXHJcblxyXG4gICAgY3JlYXRlRXZlbnREYXRhID0gZnVuY3Rpb24oZWwsIGV2ZW50RGF0YSkge1xyXG4gICAgICBldmVudERhdGEgPSBldmVudERhdGEgfHwge307XHJcbiAgICAgIGV2ZW50RGF0YS5pbmRleCA9IHNsaWRlcy5pbmRleE9mKGVsKTtcclxuICAgICAgZXZlbnREYXRhLnNsaWRlID0gZWw7XHJcbiAgICAgIHJldHVybiBldmVudERhdGE7XHJcbiAgICB9LFxyXG5cclxuICAgIGRlY2sgPSB7XHJcbiAgICAgIG9uOiBvbixcclxuICAgICAgb2ZmOiBvZmYsXHJcbiAgICAgIGZpcmU6IGZpcmUsXHJcbiAgICAgIHNsaWRlOiBzbGlkZSxcclxuICAgICAgbmV4dDogc3RlcC5iaW5kKG51bGwsIDEpLFxyXG4gICAgICBwcmV2OiBzdGVwLmJpbmQobnVsbCwgLTEpLFxyXG4gICAgICBwYXJlbnQ6IHBhcmVudCxcclxuICAgICAgc2xpZGVzOiBzbGlkZXNcclxuICAgIH07XHJcblxyXG4gIChwbHVnaW5zIHx8IFtdKS5mb3JFYWNoKGZ1bmN0aW9uKHBsdWdpbikge1xyXG4gICAgcGx1Z2luKGRlY2spO1xyXG4gIH0pO1xyXG5cclxuICBhY3RpdmF0ZSgwKTtcclxuXHJcbiAgcmV0dXJuIGRlY2s7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICBmcm9tOiBmcm9tXHJcbn07XHJcbiIsIi8vIFJlcXVpcmUgTm9kZSBtb2R1bGVzIGluIHRoZSBicm93c2VyIHRoYW5rcyB0byBCcm93c2VyaWZ5OiBodHRwOi8vYnJvd3NlcmlmeS5vcmdcclxudmFyIGJlc3Bva2UgPSByZXF1aXJlKCdiZXNwb2tlJyksXHJcbiAgY3ViZSA9IHJlcXVpcmUoJ2Jlc3Bva2UtdGhlbWUtZmFuY3knKSxcclxuICBrZXlzID0gcmVxdWlyZSgnYmVzcG9rZS1rZXlzJyksXHJcbiAgdG91Y2ggPSByZXF1aXJlKCdiZXNwb2tlLXRvdWNoJyksXHJcbiAgYnVsbGV0cyA9IHJlcXVpcmUoJ2Jlc3Bva2UtYnVsbGV0cycpLFxyXG4gIGJhY2tkcm9wID0gcmVxdWlyZSgnYmVzcG9rZS1iYWNrZHJvcCcpLFxyXG4gIHNjYWxlID0gcmVxdWlyZSgnYmVzcG9rZS1zY2FsZScpLFxyXG4gIGhhc2ggPSByZXF1aXJlKCdiZXNwb2tlLWhhc2gnKSxcclxuICBwcm9ncmVzcyA9IHJlcXVpcmUoJ2Jlc3Bva2UtcHJvZ3Jlc3MnKSxcclxuICBmb3JtcyA9IHJlcXVpcmUoJ2Jlc3Bva2UtZm9ybXMnKTtcclxuXHJcbi8vIEJlc3Bva2UuanNcclxuYmVzcG9rZS5mcm9tKCdhcnRpY2xlJywgW1xyXG4gIGN1YmUoKSxcclxuICBrZXlzKCksXHJcbiAgdG91Y2goKSxcclxuICBidWxsZXRzKCdsaSwgLmJ1bGxldCcpLFxyXG4gIGJhY2tkcm9wKCksXHJcbiAgc2NhbGUoKSxcclxuICBoYXNoKCksXHJcbiAgcHJvZ3Jlc3MoKSxcclxuICBmb3JtcygpXHJcbl0pO1xyXG5cclxuLy8gUHJpc20gc3ludGF4IGhpZ2hsaWdodGluZ1xyXG4vLyBUaGlzIGlzIGFjdHVhbGx5IGxvYWRlZCBmcm9tIFwiYm93ZXJfY29tcG9uZW50c1wiIHRoYW5rcyB0b1xyXG4vLyBkZWJvd2VyaWZ5OiBodHRwczovL2dpdGh1Yi5jb20vZXVnZW5ld2FyZS9kZWJvd2VyaWZ5XHJcbnJlcXVpcmUoXCIuLy4uXFxcXC4uXFxcXGJvd2VyX2NvbXBvbmVudHNcXFxccHJpc21cXFxccHJpc20uanNcIik7XHJcblxyXG4iXX0=
