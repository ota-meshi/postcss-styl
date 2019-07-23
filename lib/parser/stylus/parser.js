/* eslint-disable no-fallthrough, no-cond-assign */

const Parser = require('stylus/lib/parser')
const Lexer = require('./lexer')
const nodes = require('stylus/lib/nodes')

/**
 * Initialize a new `Parser` with the given `str` and `options`.
 *
 * @param {String} str
 * @param {Object} options
 * @api private
 */

module.exports = class PatchedParser extends Parser {
  constructor(str, options, ...args) {
    super(str, options, ...args);
    this.lexer = new Lexer(str, options);
  }

  /**
   * Check if the following sequence of tokens
   * forms a selector.
   *
   * @param {Boolean} [fromProperty]
   * @return {Boolean}
   * @api private
   */
  // patched
  looksLikeSelector(fromProperty) {
    var i = 1
      , node
      , brace;

    // Real property
    if (fromProperty && ':' == this.lookahead(i + 1).type
      && (this.lookahead(i + 1).space || 'indent' == this.lookahead(i + 2).type))
      return false;

    // Assume selector when an ident is
    // followed by a selector
    while ('ident' == this.lookahead(i).type
      && ('newline' == this.lookahead(i + 1).type
         || ',' == this.lookahead(i + 1).type)) i += 2;

    while (this.isSelectorToken(i)
      || ',' == this.lookahead(i).type) {

      if ('selector' == this.lookahead(i).type)
        return true;

      if ('&' == this.lookahead(i + 1).type)
        return true;

      // Hash values inside properties
      if (
        i > 1 &&
        'ident' === this.lookahead(i - 1).type &&
        '.' === this.lookahead(i).type &&
        'ident' === this.lookahead(i + 1).type
      ) {
        while ((node = this.lookahead(i + 2))) {
          if (~[
            'indent',
            'outdent',
            '{',
            ';',
            'eos',
            'selector',
            'media',
            'if',
            'atrule',
            ')',
            '}',
            'unit',
            '[',
            'for',
            'function'
          ].indexOf(node.type)) {
            if (node.type === '[') {
              while ((node = this.lookahead(i + 3)) && node.type !== ']') {
                if (~['.', 'unit'].indexOf(node.type)) {
                  return false;
                }
                i += 1
              }
            } else {
              return !~['outdent', ';', 'eos', 'media', 'if', 'atrule', ')', '}', 'unit', 'for', 'function'].indexOf(node.type);
            }
          }

          i += 1
        }

        return true;
      }

      if ('.' == this.lookahead(i).type && 'ident' == this.lookahead(i + 1).type) {
        return true;
      }

      if ('*' == this.lookahead(i).type && 'newline' == this.lookahead(i + 1).type)
        return true;

      // Pseudo-elements
      if (':' == this.lookahead(i).type
        && ':' == this.lookahead(i + 1).type)
        return true; 

      // #a after an ident and newline
      if ('color' == this.lookahead(i).type
        && 'newline' == this.lookahead(i - 1).type)
        return true;

      if (this.looksLikeAttributeSelector(i))
        return true;

      if (('=' == this.lookahead(i).type || 'function' == this.lookahead(i).type)
        && '{' == this.lookahead(i + 1).type)
        return false;

      // Hash values inside properties
      if (':' == this.lookahead(i).type
        && !this.isPseudoSelector(i + 1)
        && this.lineContains('.'))
        return false;

      // the ':' token within braces signifies
      // a selector. ex: "foo{bar:'baz'}"
      if ('{' == this.lookahead(i).type) brace = true;
      else if ('}' == this.lookahead(i).type) brace = false;
      if (brace && ':' == this.lookahead(i).type) return true;

      // '{' preceded by a space is considered a selector.
      // for example "foo{bar}{baz}" may be a property,
      // however "foo{bar} {baz}" is a selector
      if ('space' == this.lookahead(i).type
        && '{' == this.lookahead(i + 1).type)
        return true;

      // Assume pseudo selectors are NOT properties
      // as 'td:th-child(1)' may look like a property
      // and function call to the parser otherwise
      if (':' == this.lookahead(i++).type
        && !this.lookahead(i-1).space
        && this.isPseudoSelector(i))
        return true;

      // Trailing space
      if ('space' == this.lookahead(i).type
        && 'newline' == this.lookahead(i + 1).type
        && '{' == this.lookahead(i + 2).type)
        return true;

      if (',' == this.lookahead(i).type
        && 'newline' == this.lookahead(i + 1).type)
        return true;
    }

    // Trailing comma
    if (',' == this.lookahead(i).type
      && 'newline' == this.lookahead(i + 1).type)
      return true;

    // Trailing brace
    if ('{' == this.lookahead(i).type
      && 'newline' == this.lookahead(i + 1).type)
      return true;

    // css-style mode, false on ; }
    if (this.css) {
      if (';' == this.lookahead(i).type ||
          '}' == this.lookahead(i - 1).type)
        return false;
    }

    // Trailing separators
    while (!~[
        'indent'
      , 'outdent'
      , 'newline'
      , 'for'
      , 'if'
      , ';'
      , '}'
      , 'eos'].indexOf(this.lookahead(i).type))
      ++i;

    if ('indent' == this.lookahead(i).type)
      return true;
  }

  /**
   *    ident
   *  | selector
   *  | literal
   *  | charset
   *  | namespace
   *  | import
   *  | require
   *  | media
   *  | atrule
   *  | scope
   *  | keyframes
   *  | mozdocument
   *  | for
   *  | if
   *  | unless
   *  | comment
   *  | expression
   *  | 'return' expression
   */
  // patched
  stmt() {
    var tok = this.peek(), selector;
    switch (tok.type) {
      case 'keyframes':
        return this.keyframes();
      case '-moz-document':
        return this.mozdocument();
      case 'comment':
      case 'selector':
      case 'literal':
      case 'charset':
      case 'namespace':
      case 'import':
      case 'require':
      case 'extend':
      case 'media':
      case 'atrule':
      case 'ident':
      case 'scope':
      case 'supports':
      case 'unless':
      case 'function':
      case 'for':
      case 'if':
        return this[tok.type]();
      case 'return':
        return this.return();
      case '{':
        return this.property();
      default:
        // Contextual selectors
        if (this.stateAllowsSelector()) {
          switch (tok.type) {
            case 'color':
            case '~':
            case '>':
            case '<':
            case ':':
            case '&':
            case '&&':
            case '[':
            case '.':
            case '/':
              selector = this.selector();
              selector.column = tok.column;
              selector.lineno = tok.lineno;
              return selector;
            // relative reference
            case '..':
              if ('/' == this.lookahead(2).type)
                return this.selector();
            case '+':
              return 'function' == this.lookahead(2).type
                ? this.functionCall()
                : this.selector();
            case '*':
              return this.property();
            // keyframe blocks (10%, 20% { ... })
            case 'unit':
              if (this.looksLikeKeyframe()) {
                selector = this.selector();
                selector.column = tok.column;
                selector.lineno = tok.lineno;
                return selector;
              }
            case '-':
              if ('{' == this.lookahead(2).type)
                return this.property();
          }
        }

        // Expression fallback
        var expr = this.expression();
        if (expr.isEmpty) this.error('unexpected {peek}');
        return expr;
    }
  }

  /**
   * if expression block (else block)?
   */
  // patched
  if() {
    var token = this.expect('if');

    this.state.push('conditional');
    this.cond = true;
    var node = new nodes.If(this.expression())
      , cond
      , block
      , item;

    node.column = token.column;

    this.cond = false;
    node.block = this.block(node, false);
    this.skip(['newline', 'comment']);
    while (this.accept('else')) {
      token = this.accept('if');
      if (token) {
        this.cond = true;
        cond = this.expression();
        this.cond = false;
        block = this.block(node, false);
        item = new nodes.If(cond, block);

        item.column = token.column;

        node.elses.push(item);
      } else {
        node.elses.push(this.block(node, false));
        break;
      }
      this.skip(['newline', 'comment']);
    }
    this.state.pop();
    return node;
  }

  /**
   * keyframes name block
   */
  // patched
  keyframes() {
    var tok = this.expect('keyframes')
      , keyframes;

    this.skipSpacesAndComments();
    keyframes = new nodes.Keyframes(this.selectorParts(), tok.val);
    keyframes.column = tok.column;

    this.skipSpacesAndComments();

    // block
    this.state.push('atrule');
    keyframes.block = this.block(keyframes);
    this.state.pop();

    return keyframes;
  }

  /**
   * ident ('=' | '?=') expression
   */
  // patched
  assignment() {
    var
      op,
      node,
      ident = this.id(),
      name = ident.name;

    if (op =
         this.accept('=')
      || this.accept('?=')
      || this.accept('+=')
      || this.accept('-=')
      || this.accept('*=')
      || this.accept('/=')
      || this.accept('%=')) {
      this.state.push('assignment');
      var expr = this.list();
      // @block support
      if (expr.isEmpty) this.assignAtblock(expr);
      node = new nodes.Ident(name, expr);

      node.lineno = ident.lineno;
      node.column = ident.column;

      this.state.pop();

      switch (op.type) {
        case '?=':
          var defined = new nodes.BinOp('is defined', node)
            , lookup = new nodes.Expression;
          lookup.push(new nodes.Ident(name));
          node = new nodes.Ternary(defined, lookup, node);
          break;
        case '+=':
        case '-=':
        case '*=':
        case '/=':
        case '%=':
          node.val = new nodes.BinOp(op.type[0], new nodes.Ident(name), expr);
          break;
      }
    }

    return node;
  }

  /**
   * '+'? ident '(' expression ')' block?
   */
  // patched
  functionCall() {
    var withBlock = this.accept('+');
    if ('url' == this.peek().val.name) return this.url();

    var tok = this.expect('function').val;
    var name = tok.name;

    this.state.push('function arguments');
    this.parens++;
    var args = this.args();
    this.expect(')');
    this.parens--;
    this.state.pop();
    var call = new nodes.Call(name, args);

    call.column = tok.column;
    call.lineno = tok.lineno;

    if (withBlock) {
      this.state.push('function');
      call.block = this.block(call);
      this.state.pop();
    }
    return call;
  }

  /**
   * ident '(' params ')' block
   */
  // patched
  functionDefinition() {
    var
      tok = this.expect('function'),
      name = tok.val.name;

    // params
    this.state.push('function params');
    this.skipWhitespace();
    var params = this.params();
    this.skipWhitespace();
    this.expect(')');
    this.state.pop();

    // Body
    this.state.push('function');
    var fn = new nodes.Function(name, params);

    fn.column = tok.column;
    fn.lineno = tok.lineno;

    fn.block = this.block(fn);
    this.state.pop();
    return new nodes.Ident(name, fn);
  }
}
