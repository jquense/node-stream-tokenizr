var chai = require('chai')
  , sinon = require('sinon')
  , sinonChai = require('sinon-chai')
  , Assertion = require("chai").Assertion
  , Tokenizer = require('../stream-tokenizr')
  , Readable  = require('stream').Readable
  , bufferEqual = require('../lib/binaryHelpers' ).bufferEqual;

chai.use(sinonChai);
chai.should();

Assertion.addMethod("buffer", function(buffer, enc){
    var obj = this._obj

    buffer = typeof buffer === 'string'
        ? new Buffer(buffer, enc)
        : buffer

    this.assert(
        bufferEqual(obj, buffer)
        , "expected buffer #{exp} to equal #{act}"
        , "expected buffer #{exp} not to equal #{act}"
        , obj
        , buffer)
})

describe('when a one wishes to move through the buffer ', function(){
    var src, toknzr, options;

    beforeEach(function(){
        options = {};
        src = new Readable();
        toknzr = new Tokenizer(options)
    })

    describe('when skip is preformed', function(){

        it ('should skip the correct number of bytes', function(done){

            toknzr
                .skip(6)
                .readBuffer(6, 'word')
                .tap(function(vars){
                    vars.word.should.be.a.buffer('world!', 'utf8')
                    done()
                })

            toknzr.write(new Buffer('hello world!', 'utf8'))
        })
    })

})

