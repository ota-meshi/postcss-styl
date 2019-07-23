
const Lexer = require('stylus/lib/lexer')

module.exports = class PatchedLexer extends Lexer {

  /**
   * Fetch next token.
   *
   * @return {Token}
   * @api private
   */

  advance() {
    var column = this.column
      , line = this.lineno
      , tok = this.eos()
      || this.null()
      || this.sep()
      || this.keyword()
      || this.urlchars()
      || this.comment()
      || this.newline()
      || this.escaped()
      || this.important()
      || this.literal()
      || this.anonFunc()
      || this.atrule()
      || this.function()
      || this.brace()
      || this.paren()
      || this.color()
      || this.string()
      || this.unit()
      || this.namedop()
      || this.boolean()
      || this.unicode()
      || this.ident()
      || this.op()
      || (function () {
        var token = this.eol();

        if (token) {
          column = token.column;
          line = token.lineno;
        }

        return token;
      }).call(this)
      || this.space()
      || this.selector();

    tok.lineno = line;
    tok.column = column;

    return tok;
  }
}

